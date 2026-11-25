# Changelog


## 1.4.0 – 2026-11-25
### Added
- `news.html` – Ideas & news: the weekly PLEX research run writes `news.json` (new technology worth using, problems found, suggested fixes); cards open to detail and https source links only. Opened from More › Ideas & news in the app. 2 tests (34 in total).
## 1.3.0 – 2026-11-25
### Added
- `upload.html` – PLEX upload page: anyone with an upload code sends rig files (inventory, lookahead, bulk report, DPR, mud report, forecast, cost sheet) to PLEX Cloud; drag-and-drop or picker, several files at once, kind detected from the name, list of files received.
- Crew, POB and manifest files are refused on the device (and again on the server).
- Tests for the upload page (6 new, 30 in total).
### Requires
- PLEX Cloud script v8 (action `file`, `get=uploads`, `get=inbox`, role `upload`).
## 1.2.0 – 25.11.2026
- MLU form pre-filled from the latest update (activity, depth, status, lookahead line; "from" = last "to"), so a repeat update only needs the new depth.
## 1.1.0 – 25.11.2026
- Report page (report.html): bridge weather, sea, vessel motion, riser angles (UFJ/LFJ) and DP status; MLU operation updates linked to the running lookahead line. Range checks, "copy last report", entries kept on the device when offline and sent automatically. 10 new tests.
## 1.0.0 – 25.11.2026
- First release: access-code onboarding, engine cached per version, builds pages on the device, offline last copy, background refresh, update prompt, iPhone install hint, strict CSP, end-to-end tests, GitHub Pages deployment.
