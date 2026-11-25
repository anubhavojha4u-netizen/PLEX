// PLEX upload page: anyone with the upload code (store keeper, logistics, MLU, service companies) sends rig files to PLEX Cloud.
// The file lands in the PLEX inbox; the Company Man laptop and the phone app read it, check it is newer than the version in use,
// and update every page. Same file twice is ignored (checksum on the server). Crew / POB / manifest files are refused.
import { CONFIG } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const KEYK = 'plexUploadKey', NAMEK = 'plexUploadName', MAX = 20e6;
const ls = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
const pad = (n) => String(n).padStart(2, '0');
const fmt = (t) => { const d = new Date(t); return isNaN(d) ? String(t) : `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const size = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' kB');
let KEY = '', FILES = [];

// what each file is – from its name (the laptop checks the content again before using it)
const KINDS = [
  ['Crew / POB', /pob|crew|planner|manifest|personnel|passport/i, true],
  ['Rig inventory', /inventor|stock|\brob\b/i],
  ['Lookahead', /look\s*-?ahead|\bla[_ -]?\d/i],
  ['Bulk report', /^br[_ -]|bulk/i],
  ['DPR', /\b[me]?dpr\b|daily progress|drilling report/i],
  ['Mud report', /\bdmr\b|\bmdmr\b|mud report/i],
  ['Forecast', /stormgeo|forecast|weather/i],
  ['Well cost', /cost/i],
  ['Programme / other', /./]
];
export function kindOf(name) { for (const [k, re, block] of KINDS) if (re.test(name)) return { kind: k, block: !!block }; return { kind: 'Programme / other', block: false }; }

function net(t, cls) { const n = $('#net'); n.textContent = t; n.className = 'net ' + (cls || ''); }
async function api(body) {
  const r = await fetch(CONFIG.api, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: KEY, ...body }) });
  const j = await r.json(); if (!j.ok) throw Object.assign(new Error(j.err || 'refused'), { refused: true }); return j;
}
const b64 = (file) => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.onerror = () => no(fr.error); fr.readAsDataURL(file); });

function draw() {
  const ul = $('#list'); ul.innerHTML = '';
  FILES.forEach((f, i) => { const li = document.createElement('li'); li.className = f.state || '';
    li.innerHTML = `<span class="fn"></span><span class="fk"></span><span class="fs"></span>`;
    $('.fn', li).textContent = f.file.name; $('.fk', li).textContent = f.kind + ' · ' + size(f.file.size);
    $('.fs', li).textContent = f.msg || ''; if (!f.state || f.state === 'err') { const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.setAttribute('aria-label', 'Remove ' + f.file.name); x.textContent = '×'; x.onclick = () => { FILES.splice(i, 1); draw(); }; li.appendChild(x); }
    ul.appendChild(li); });
  $('#send').disabled = !FILES.some((f) => !f.state || f.state === 'err');
}
function add(list) {
  [...list].forEach((file) => { const k = kindOf(file.name);
    if (k.block) FILES.push({ file, kind: k.kind, state: 'no', msg: 'not accepted here' });
    else if (file.size > MAX) FILES.push({ file, kind: k.kind, state: 'no', msg: 'larger than 20 MB' });
    else if (!FILES.some((f) => f.file.name === file.name && f.file.size === file.size)) FILES.push({ file, kind: k.kind }); });
  draw();
}
async function send() {
  const by = $('#by').value.trim(); ls.set(NAMEK, by); $('#send').disabled = true;
  for (const f of FILES.filter((x) => !x.state || x.state === 'err')) {
    f.state = 'busy'; f.msg = 'sending…'; draw();
    try { const j = await api({ action: 'file', name: f.file.name, mime: f.file.type, kind: f.kind, by, b64: await b64(f.file) });
      f.state = 'ok'; f.msg = j.dup ? 'already received earlier' : 'received ✓'; }
    catch (e) { f.state = e.refused ? 'no' : 'err'; f.msg = e.refused ? e.message : 'no network – tap Send again'; }
    draw();
  }
  recent();
}
async function recent() {
  try { const r = await fetch(`${CONFIG.api}?key=${encodeURIComponent(KEY)}&get=uploads`, { redirect: 'follow', cache: 'no-store' }); const j = await r.json(); if (!j.ok) return;
    const ul = $('#rec'); ul.innerHTML = ''; (j.uploads || []).slice(0, 12).forEach((u) => { const li = document.createElement('li'); li.innerHTML = '<span class="fn"></span><span class="fk"></span>';
      $('.fn', li).textContent = String(u.name).replace(/^\d{8}_\d{4}_/, ''); $('.fk', li).textContent = `${fmt(u.at)}${u.by ? ' · ' + u.by : ''}`; ul.appendChild(li); });
    $('#recent').hidden = !(j.uploads || []).length; net('online', 'ok'); } catch { net('offline', 'wait'); }
}
function start(k) {
  KEY = k; ls.set(KEYK, k); $('#code').hidden = true; $('#drop').hidden = false; $('#by').value = ls.get(NAMEK, '');
  const inp = $('#files'); inp.onchange = () => { add(inp.files); inp.value = ''; };
  const dz = $('.dz'); ['dragover', 'dragenter'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add('on'); }));
  ['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, () => dz.classList.remove('on'))); dz.addEventListener('drop', (e) => { e.preventDefault(); add(e.dataTransfer.files); });
  $('#send').onclick = send; recent();
}
function init() {
  const h = new URLSearchParams(location.hash.slice(1)).get('k');
  if (h) { history.replaceState(null, '', location.pathname); ls.set(KEYK, h); }
  const k = h || ls.get(KEYK, '');
  if (k && /^(upl|adm)-/.test(k)) return start(k);
  $('#code').hidden = false;
  $('#codeform').onsubmit = (e) => { e.preventDefault(); const v = $('#codein').value.trim(); if (!/^(upl|adm)-/.test(v)) { $('#code-err').textContent = 'This is not an upload code.'; return; } start(v); };
}
if (typeof document !== 'undefined' && document.getElementById('drop')) init();
