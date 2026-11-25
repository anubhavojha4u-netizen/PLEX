// PLEX app shell.
// 1. Reads the access code (from the link #k=… once, then from this device).
// 2. Asks PLEX Cloud for the boot data (last laptop state + every newer rig mail + MLU feed).
// 3. Keeps the PLEX engine (≈6 MB) on the device and downloads it again only when a new version is uploaded.
// 4. Runs the engine in a sandboxed frame: it reads the new mails, rebuilds every page on this device and shows PLEX View.
// Offline: the last engine + boot data are used. Nothing here contains rig data.
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const screens = ['splash', 'signin', 'problem'];
const state = { key: '', loadedAt: 0, url: '', running: false };

// ---------- small helpers ----------
function show(name) { screens.forEach((s) => { $(s).hidden = s !== name; }); $('view').hidden = name !== 'view'; }
function status(text, detail = '', depth = null) {
  $('status').textContent = text; $('detail').textContent = detail;
  const w = document.querySelector('.well');
  if (depth == null) { w.classList.add('busy'); } else { w.classList.remove('busy'); w.style.setProperty('--depth', `${Math.max(8, Math.min(96, depth))}%`); }
}
function chip(text, off = false) { const c = $('chip'); c.textContent = text; c.classList.toggle('off', off); c.hidden = false; clearTimeout(chip.t); chip.t = setTimeout(() => { c.hidden = true; }, 6000); }
function toast(text, label, action) { $('toast-t').textContent = text; const b = $('toast-b'); b.textContent = label; b.onclick = () => { $('toast').hidden = true; action(); }; $('toast').hidden = false; }
const fmtTime = (t) => { const d = new Date(t); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

// ---------- storage (IndexedDB key-value; localStorage only for the code) ----------
const db = () => new Promise((resolve, reject) => { const r = indexedDB.open('plex', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
async function kvGet(k) { try { const d = await db(); return await new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); }); } catch { return null; } }
async function kvPut(k, v) { try { const d = await db(); await new Promise((res) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch { /* storage full or blocked: run from memory */ } }
const codeGet = () => { try { return localStorage.getItem('plexKey') || ''; } catch { return ''; } };
const codeSet = (v) => { try { v ? localStorage.setItem('plexKey', v) : localStorage.removeItem('plexKey'); } catch { /* private mode */ } };

// ---------- API ----------
class ApiError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }
async function api(query, onProgress) {
  let r;
  try { r = await fetch(`${CONFIG.api}?${query}&key=${encodeURIComponent(state.key)}`, { redirect: 'follow', cache: 'no-store' }); }
  catch { throw new ApiError('No connection', 'offline'); }
  if (!r.ok) throw new ApiError(`PLEX Cloud answered ${r.status}`, 'server');
  let text;
  if (onProgress && r.body && r.body.getReader) {
    const rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onProgress(got); }
    text = new TextDecoder().decode(await new Blob(parts).arrayBuffer());
  } else text = await r.text();
  let j; try { j = JSON.parse(text); } catch { throw new ApiError('PLEX Cloud sent an unexpected answer – the Google script may need updating', 'server'); }
  if (!j.ok) throw new ApiError(j.err || 'error', j.err === 'bad key' ? 'key' : 'server');
  return j;
}

// ---------- run ----------
const withBoot = (html, boot) => html.replace('<head>', () => `<head><script>window.__PLEX_BOOT=${JSON.stringify(boot).replace(/</g, '\\u003c')}<\/script>`);
function present(html, note, off = false) {
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const v = $('view'); v.onload = () => { show('view'); chip(note, off); }; v.src = state.url;
}
async function run({ quiet = false } = {}) {
  if (state.running) return; state.running = true; state.loadedAt = Date.now();
  try {
    if (!state.key) { show('signin'); $('code').focus(); return; }
    if (!quiet) { show('splash'); status('Getting the latest reports…'); }
    const boot = await api('get=boot');
    if (boot.engineAt) {
      let eng = await kvGet('engine');
      if (!eng || eng.at !== boot.engineAt) {
        if (!quiet) status('Updating PLEX', 'only after a new version', 15);
        const e = await api('get=engine', (n) => { if (!quiet) status('Updating PLEX', `${mb(n)} received`, 15 + Math.min(70, (n / 6.5e6) * 70)); });
        eng = { at: e.at, html: e.html }; await kvPut('engine', eng);
      }
      await kvPut('boot', boot.boot);
      if (!quiet) status('Building the pages on this device…', '', 92);
      present(withBoot(eng.html, boot.boot), `Updated ${fmtTime(Date.now())}`);
    } else {
      const v = await api('get=view'); await kvPut('view', v);
      present(v.html, `Pages from ${fmtTime(v.at)}`);
    }
  } catch (err) {
    if (err.kind === 'key') { codeSet(''); state.key = ''; show('signin'); $('signin-err').textContent = 'That access code is not valid. Check the link or code you were given.'; return; }
    const eng = await kvGet('engine'), boot = await kvGet('boot'), view = await kvGet('view');
    if (eng && boot) return present(withBoot(eng.html, boot), err.kind === 'offline' ? 'Offline – last copy' : 'Showing last copy', true);
    if (view) return present(view.html, `Offline – pages from ${fmtTime(view.at)}`, true);
    if (!quiet) { show('problem'); $('problem-msg').textContent = err.kind === 'offline' ? 'No connection, and nothing saved on this device yet. Connect once to load PLEX.' : err.message; }
  } finally { state.running = false; }
}

// ---------- start ----------
function start() {
  const m = /[#&]k=([^&]+)/.exec(location.hash);
  if (m) { state.key = decodeURIComponent(m[1]).trim(); codeSet(state.key); history.replaceState(null, '', location.pathname + location.search); }
  else state.key = codeGet();
  $('codeform').addEventListener('submit', (e) => { e.preventDefault(); const v = $('code').value.trim(); if (!v) return; $('signin-err').textContent = ''; state.key = v; codeSet(v); run(); });
  $('retry').addEventListener('click', () => run());
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - state.loadedAt > CONFIG.staleMinutes * 60000) run({ quiet: true }); });
  window.addEventListener('online', () => run({ quiet: true }));
  setInterval(() => { if (!document.hidden) run({ quiet: true }); }, CONFIG.refreshMinutes * 60000);
  // iPhone: show how to install once (Safari has no install prompt)
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  try { if (ios && !standalone && !localStorage.getItem('plexIosHint')) { $('ios').hidden = false; $('ios-x').onclick = () => { $('ios').hidden = true; localStorage.setItem('plexIosHint', '1'); }; } } catch { /* ignore */ }
  // service worker: app shell offline + "new version" prompt
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('A new version of PLEX is ready.', 'Reload', () => location.reload()); }); });
    }).catch(() => { /* file:// or blocked */ });
  }
  run();
}
start();
