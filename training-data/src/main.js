import { createApp, reactive } from 'vue';
import { loadSession } from './api/session.js';
import { ApiError, signInUrl } from './api/client.js';

import { cameraSecret, consentSecret, phoneCamSecret, phoneSecret } from './api/phone.js';
import { watchForUpdates } from './api/updateCheck.js';

// A phone opening a phone upload link (?phone=<secret>), a camera pairing code of "Scan from phone" (?camera=<secret>), or
// a phone camera's link (#phonecam=<secret>, in the fragment, which sends the phone's own camera to AADML):
// the phone page alone, with no sign-in; the link is its only authority and the server checks it on every call. The
// secret leaves the address at once and is kept for this tab only, so a reload still works and nothing of it is left
// in the history.
function phoneLink(name, read) {
  const key = `tmd.${name}`;
  const fromAddress = read();
  if (fromAddress) {
    try { sessionStorage.setItem(key, fromAddress); } catch { /* no storage: the link works until a reload */ }
    const url = new URL(location.href); url.searchParams.delete(name);
    history.replaceState(null, '', `${url.pathname}${url.search}#${name}`);
    return fromAddress;
  }
  if (location.hash === `#${name}`) { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } }
  return '';
}
const secret = phoneLink('phone', phoneSecret);
const pairing = secret ? '' : phoneLink('camera', cameraSecret);
const phoneCam = secret || pairing ? '' : phoneLink('phonecam', phoneCamSecret);
// A person's own workplace consent link (?consent=<secret>, backend workplace_api.py): their page alone, no sign-in.
const consentLink = secret || pairing || phoneCam ? '' : phoneLink('consent', consentSecret);

// Nothing else shows until AADML says who is signed in. A signed-out person goes to the AADML login page, which sends
// them back to this exact page afterwards.
// A tab opened before an AADML update says so and offers a reload (api/updateCheck.js), on every page here.
// Each page's code is loaded only when it is the page shown (live, 2026-11-18: a phone on slow mobile data waited for
// the whole 1.4 MB app, phone pages included, and showed nothing until it came). The signed-in app is loaded while
// AADML is asked who is signed in, so it costs no extra wait.
watchForUpdates();
function mountPhonePage(load, props) {
  Promise.all([import('./phoneStyles.js'), load()])
    .then(([styles, page]) => { styles.addPhoneStyles(); createApp(page.default, props).mount('#training-data-app'); })
    .catch(showError);
}
if (secret) mountPhonePage(() => import('./components/PhoneUpload.vue'), { secret });
else if (pairing) mountPhonePage(() => import('./components/PhoneCameraScan.vue'), { secret: pairing });
else if (phoneCam) mountPhonePage(() => import('./components/PhoneCameraSend.vue'), { secret: phoneCam });
else if (consentLink) mountPhonePage(() => import('./components/WorkplaceConsent.vue'), { secret: consentLink });
else {
  const app = import('./appEntry.js');
  app.catch(() => { /* said by the step below, once the sign-in is known */ });
  loadSession().then(async session => {
    if (!session.signedIn) { window.location.assign(signInUrl()); return; }
    createApp((await app).default).provide('session', reactive(session)).mount('#training-data-app');
  }).catch(showError);
}
function showError(error) {
  const root = document.getElementById('training-data-app');
  root.setAttribute('role', 'alert');
  root.style.cssText = 'font:14px/1.6 Inter,system-ui,sans-serif;color:#334155;padding:48px 24px;text-align:center';
  // AADML's own message (api/client.js) may end by saying to try again already; the page says it once. Anything else
  // (a page's code that did not download) is said plainly, never the browser's own text with its address.
  const said = String((error instanceof ApiError && error.message) || 'This page did not load. Check your connection.').replace(/\s*(Check your connection and )?try again\.?$/i, '.').replace(/\.\.$/, '.');
  root.textContent = `${said} Reload the page to try again.`;
}
