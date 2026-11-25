// Weekly research feed for PLEX: news.json is written by the scheduled research run (new tools and methods worth using,
// problems found, suggested improvements). Shown as cards; each opens to its detail and source links.
const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const day = (t) => { const d = new Date(t); return isNaN(d) ? '' : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
const TAG = { idea: 'Idea', news: 'New technology', fix: 'To fix', done: 'Done' };
export function render(j) {
  const m = $('#news'); m.innerHTML = '';
  if (j.at) $('#when').textContent = 'Updated ' + day(j.at) + (j.next ? ' · next ' + day(j.next) : '');
  const items = (j.items || []);
  if (!items.length) { m.innerHTML = '<section class="card"><p>The first research run has not finished yet.</p></section>'; return; }
  items.forEach((it) => {
    const d = document.createElement('details'); d.className = 'card news ' + (it.type || 'idea');
    d.innerHTML = '<summary><span class="tag"></span><b class="t"></b><span class="small s"></span></summary><div class="body"></div>';
    $('.tag', d).textContent = TAG[it.type] || 'Idea'; $('.t', d).textContent = it.title || ''; $('.s', d).textContent = it.summary || '';
    const b = $('.body', d); (it.detail || []).forEach((p) => { const x = document.createElement('p'); x.textContent = p; b.appendChild(x); });
    if ((it.links || []).length) { const ul = document.createElement('ul'); it.links.forEach((l) => { if (!/^https:\/\//.test(l.url || '')) return; const li = document.createElement('li'), a = document.createElement('a'); a.href = l.url; a.rel = 'noopener noreferrer'; a.target = '_blank'; a.textContent = l.title || l.url; li.appendChild(a); ul.appendChild(li); }); b.appendChild(ul); }
    m.appendChild(d);
  });
}
async function load() { try { const r = await fetch('news.json', { cache: 'no-store' }); render(await r.json()); } catch { $('#news').innerHTML = '<section class="card"><p>Offline – open again when connected.</p></section>'; } }
if (typeof document !== 'undefined' && $('#news')) load();
