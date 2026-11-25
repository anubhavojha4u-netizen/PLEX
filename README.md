# PLEX app

Installable web app (PWA) for **PLEX – Platinum Explorer well delivery status**: Overview, lookahead, hourly MLU updates, materials, cost/HSD, performance, bits and Ask PLEX – on phones and desktops, online and offline.

## How it works

```
Rig mails ─► PLEX Cloud (Google Apps Script, owner's account) ◄─ PLEX WDS laptop app (state, engine)
                         │  JSON API, access code required
                         ▼
            PLEX app (this repository, GitHub Pages)
            └─ downloads the PLEX engine once per version, keeps it on the device,
               rebuilds every page on the device from the latest state + new mails
```

* **No rig data in this repository.** Everything shown is fetched from PLEX Cloud with the access code (read-only VIEW key).
* The access code arrives once through the link `https://<site>/#k=<code>`; it is stored on the device and removed from the address bar.
* Offline: the last engine and data on the device are used; the app shell is cached by the service worker.
* The engine runs in a sandboxed frame created from a blob; Content-Security-Policy limits network access to PLEX Cloud.

## Develop

```bash
npm ci
npm run serve        # http://localhost:8080
npm test             # end-to-end tests (iPhone + desktop) against a mocked PLEX Cloud
```

## Release

Push to `main`. GitHub Actions runs the tests and publishes `src/` to GitHub Pages (Settings › Pages › Source: **GitHub Actions**).
New PLEX engine versions do not need a release: they are uploaded from the laptop app (Hourly log › PLEX Cloud) and every device picks them up on next open.

## Files

| Path | Purpose |
|---|---|
| `src/index.html` | screens: opening, access code, problem; full-screen view frame |
| `src/app.js` | boot, engine cache (IndexedDB), offline fallback, refresh, install hint |
| `src/config.js` | PLEX Cloud address and refresh timings |
| `src/sw.js` | offline app shell, update prompt |
| `tests/` | Playwright end-to-end tests with a mocked API |
