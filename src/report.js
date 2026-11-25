// PLEX report page: the mud logging unit (code mlu-…) sends operation updates, the ship's bridge (code bridge-…) sends weather,
// sea, motion and riser reports. Entries go to PLEX Cloud; if the network drops they wait on this device and are sent automatically.
import { CONFIG } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const KEYK = 'plexReportKey', QK = 'plexReportQueue', NAMEK = 'plexReportName', LASTWX = 'plexLastWx';
const ls = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
const pad = (n) => String(n).padStart(2, '0');
const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmt = (t) => { const d = new Date(t); return isNaN(d) ? String(t) : `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
let KEY = '', ROLE = '';

function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 3500); }
function net(t, cls) { const n = $('#net'); n.textContent = t; n.className = 'net ' + (cls || ''); }

// ---------- API ----------
async function get() { const r = await fetch(`${CONFIG.api}?key=${encodeURIComponent(KEY)}`, { redirect: 'follow', cache: 'no-store' }); const j = await r.json(); if (!j.ok) throw Object.assign(new Error(j.err), { bad: j.err === 'bad key' }); return j; }
async function post(body) { const r = await fetch(CONFIG.api, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: KEY, ...body }) }); const j = await r.json(); if (!j.ok) throw Object.assign(new Error(j.err), { bad: j.err === 'not allowed' || j.err === 'bad key' }); return j; }

// ---------- outbox ----------
const queue = () => ls.get(QK, []);
async function flush() {
  const Q = queue(); if (!Q.length) { net('online', 'ok'); return true; }
  net(`sending ${Q.length}…`, 'wait');
  try {
    const wx = Q.filter((q) => q.kind === 'wx').map((q) => q.e), ops = Q.filter((q) => q.kind === 'ops').map((q) => q.e);
    if (wx.length) await post({ action: 'wx', entries: wx });
    if (ops.length) await post({ action: 'add', entries: ops });
    ls.set(QK, []); net('online · all sent', 'ok'); refresh(); return true;
  } catch (e) { if (e.bad) { net('code not accepted', 'wait'); return false; } net(`offline · ${Q.length} waiting`, 'wait'); return false; }
}
function enqueue(kind, e) { const Q = queue(); Q.push({ kind, e }); ls.set(QK, Q); }

// ---------- forms ----------
function numbersOk(form) { let ok = true; form.querySelectorAll('input[data-min]').forEach((i) => { const v = i.value.trim(); const bad = v !== '' && (isNaN(+v) || +v < +i.dataset.min || +v > +i.dataset.max); i.classList.toggle('bad', bad); i.setAttribute('aria-invalid', bad); if (bad) ok = false; }); return ok; }
function values(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = String(v).trim(); }); return o; }
function setupWx() {
  const f = $('#wx'); f.hidden = false; $('#title').textContent = 'Bridge report'; $('#sub').textContent = 'Platinum Explorer · weather, sea, motions, riser';
  f.t.value = localIso(new Date()); f.by.value = ls.get(NAMEK, '');
  $('#wx-copy').onclick = () => { const L = ls.get(LASTWX, null); if (!L) return toast('No earlier report on this device.'); Object.entries(L).forEach(([k, v]) => { if (f[k] && k !== 't') f[k].value = v; }); toast('Last report copied – change what is different.'); };
  f.addEventListener('submit', async (e) => { e.preventDefault(); const err = $('.err', f); err.textContent = '';
    if (!numbersOk(f)) { err.textContent = 'Check the numbers marked in red.'; return; }
    const v = values(f); if (!v.t) { err.textContent = 'Enter the time.'; return; }
    const keys = ['wind_kts', 'swell_m', 'heave_m', 'roll_deg', 'pitch_deg', 'ufj_deg', 'lfj_deg', 'vis_nm']; if (!keys.some((k) => v[k] !== '')) { err.textContent = 'Enter at least one reading.'; return; }
    ls.set(NAMEK, v.by); ls.set(LASTWX, v); enqueue('wx', { id: uid(), ...v, at: new Date().toISOString() });
    const sent = await flush(); toast(sent ? 'Report sent ✓' : 'Saved – it will be sent when the network is back'); f.t.value = localIso(new Date()); });
}
function setupOps(plan, entries) {
  const f = $('#ops'); f.hidden = false; $('#title').textContent = 'MLU operation update'; $('#sub').textContent = 'Platinum Explorer · 1–3-hourly updates';
  // pre-fill from the latest update (whoever sent it): same activity, status and line – usually only the depth and times change
  const prev = (entries || []).filter((e) => e.state !== 'no' && e.t1).sort((a, b) => (a.t1 < b.t1 ? 1 : -1))[0];
  const now = new Date(); now.setMinutes(Math.floor(now.getMinutes() / 15) * 15);
  const lastT1 = prev ? String(prev.t1).slice(0, 16) : ls.get('plexLastT1', '');
  f.t1.value = localIso(now); f.t0.value = lastT1 || localIso(new Date(now - 3 * 36e5)); f.by.value = ls.get(NAMEK, '') || (prev && prev.by) || '';
  if (prev) { f.op.value = prev.op || ''; f.depth.value = prev.depth || ''; if (prev.status) f.status.value = prev.status; $('#prefill').hidden = false; }
  const lines = (plan && plan.lines) || [], sel = f.la;
  lines.filter((l) => l.st !== 'done').slice(0, 8).forEach((l) => { const o = document.createElement('option'); o.value = l.seq; o.textContent = `${l.seq} – ${String(l.op).slice(0, 60)}`; if (prev && prev.la !== '' && prev.la != null ? +prev.la === +l.seq : plan && l.seq === plan.cur) o.selected = true; sel.appendChild(o); });
  f.addEventListener('submit', async (e) => { e.preventDefault(); const err = $('.err', f); err.textContent = '';
    if (!numbersOk(f)) { err.textContent = 'Check the depth.'; return; }
    const v = values(f); if (!v.t0 || !v.t1 || !v.op) { err.textContent = 'Fill in from, to and the activity.'; return; }
    if (v.t1 <= v.t0) { err.textContent = '"To" must be after "From".'; return; }
    const dup = queue().some((q) => q.kind === 'ops' && q.e.t0 === v.t0 && q.e.t1 === v.t1 && q.e.op === v.op); if (dup) { err.textContent = 'This update is already waiting to be sent.'; return; }
    ls.set(NAMEK, v.by); ls.set('plexLastT1', v.t1);
    enqueue('ops', { id: uid(), t0: v.t0, t1: v.t1, op: v.op, depth: v.depth, status: v.status, la: v.la, by: v.by, at: new Date().toISOString(), par: {} });
    const sent = await flush(); toast(sent ? 'Update sent ✓' : 'Saved – it will be sent when the network is back');
    f.t0.value = v.t1; f.depth.focus(); const n = new Date(); n.setMinutes(Math.floor(n.getMinutes() / 15) * 15); f.t1.value = localIso(n); });
}
async function refresh() {
  try { const j = await get(); const L = $('#recent-list'); L.innerHTML = ''; const Q = queue();
    const rows = ROLE === 'bridge' ? (j.wx || []).slice(-6).reverse().map((w) => [fmt(w.t), `wind ${w.wind_kts || '–'} kn · swell ${w.swell_m || '–'} m · heave ${w.heave_m || '–'} m · roll/pitch ${w.roll_deg || '–'}/${w.pitch_deg || '–'}°${w.ufj_deg ? ` · UFJ ${w.ufj_deg}° LFJ ${w.lfj_deg || '–'}°` : ''}`])
      : (j.entries || []).filter((e) => e.state !== 'no').sort((a, b) => (a.t0 < b.t0 ? 1 : -1)).slice(0, 6).map((e) => [`${fmt(e.t0).slice(-5)}–${fmt(e.t1).slice(-5)}`, e.op]);
    Q.forEach((q) => rows.unshift([q.kind === 'wx' ? fmt(q.e.t) : fmt(q.e.t0).slice(-5) + '–' + fmt(q.e.t1).slice(-5), (q.kind === 'wx' ? 'weather report' : q.e.op), true]));
    rows.forEach(([a, b, waiting]) => { const li = document.createElement('li'); const x = document.createElement('b'); x.textContent = a; const y = document.createElement('span'); y.textContent = b; li.append(x, y); if (waiting) { const q = document.createElement('span'); q.className = 'q'; q.textContent = 'waiting to send'; li.append(q); } L.appendChild(li); });
    $('#recent').hidden = !rows.length; return j;
  } catch (e) { if (e.bad) throw e; net('offline', 'wait'); return null; }
}
async function begin() {
  ROLE = KEY.startsWith('bridge-') ? 'bridge' : KEY.startsWith('mlu-') ? 'mlu' : '';
  if (!ROLE) { $('#code').hidden = false; $('#code-err').textContent = KEY ? 'That is not a report code. Mud logging codes start with mlu-, bridge codes with bridge-.' : ''; return; }
  let j = null; try { j = await refresh(); } catch (e) { ls.set(KEYK, ''); $('#code').hidden = false; $('#code-err').textContent = 'That code is not accepted. Check the link you were given.'; return; }
  if (ROLE === 'bridge') setupWx(); else setupOps(j && j.plan, j && j.entries);
  flush(); setInterval(flush, 30000); window.addEventListener('online', flush);
}
(function start() {
  const m = /[#&]k=([^&]+)/.exec(location.hash);
  if (m) { KEY = decodeURIComponent(m[1]).trim(); ls.set(KEYK, KEY); history.replaceState(null, '', location.pathname); } else KEY = ls.get(KEYK, '');
  $('#codeform').addEventListener('submit', (e) => { e.preventDefault(); KEY = $('#codein').value.trim(); ls.set(KEYK, KEY); $('#code').hidden = true; begin(); });
  $('#forget').addEventListener('click', () => { ls.set(KEYK, ''); location.replace(location.pathname); });
  net(navigator.onLine ? 'online' : 'offline', navigator.onLine ? 'ok' : 'wait');
  begin();
})();
