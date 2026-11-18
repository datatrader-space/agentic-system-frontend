import { createApp, reactive } from 'vue';
import App from './App.vue';
import './styles.css';
import './studio.css';
import './aadml-theme.css';
import { loadSession } from './api/session.js';
import { signInUrl } from './api/client.js';

import PhoneUpload from './components/PhoneUpload.vue';
import PhoneCameraScan from './components/PhoneCameraScan.vue';
import PhoneCameraSend from './components/PhoneCameraSend.vue';
import { cameraSecret, phoneCamSecret, phoneSecret } from './api/phone.js';

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

// Nothing else shows until AADML says who is signed in. A signed-out person goes to the AADML login page, which sends
// them back to this exact page afterwards.
if (secret) createApp(PhoneUpload, { secret }).mount('#training-data-app');
else if (pairing) createApp(PhoneCameraScan, { secret: pairing }).mount('#training-data-app');
else if (phoneCam) createApp(PhoneCameraSend, { secret: phoneCam }).mount('#training-data-app');
else loadSession().then(session => {
  if (!session.signedIn) { window.location.assign(signInUrl()); return; }
  createApp(App).provide('session', reactive(session)).mount('#training-data-app');
}).catch(error => {
  const root = document.getElementById('training-data-app');
  root.setAttribute('role', 'alert');
  root.style.cssText = 'font:14px/1.6 Inter,system-ui,sans-serif;color:#334155;padding:48px 24px;text-align:center';
  // The message may end by saying to try again already (api/client.js); the page says it once.
  const said = String(error?.message || 'Could not reach AADML.').replace(/\s*(Check your connection and )?try again\.?$/i, '.').replace(/\.\.$/, '.');
  root.textContent = `${said} Reload the page to try again.`;
});
