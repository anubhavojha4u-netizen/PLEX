// PLEX app configuration. The API is the PLEX Cloud Google Apps Script web app.
// No rig data lives in this repository: every figure is fetched from the API with the access code the user was given.
export const CONFIG = Object.freeze({
  api: 'https://script.google.com/macros/s/AKfycbz9k21GXVGUOFb0EpUkhaCDmTcQAGxaQse5gu8gKSo4iDHinESRWSZdhgEVWehAKM_D/exec',
  refreshMinutes: 30,        // background refresh while the app is open
  staleMinutes: 10,          // refresh on return to the app after this long
  rig: 'Platinum Explorer',
  version: '1.2.0'
});
