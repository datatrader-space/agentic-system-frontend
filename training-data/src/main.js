import { createApp, reactive } from 'vue';
import App from './App.vue';
import './styles.css';
import './studio.css';
import './aadml-theme.css';
import { loadSession } from './api/session.js';
import { signInUrl } from './api/client.js';

import PhoneUpload from './components/PhoneUpload.vue';
import { phoneSecret } from './api/phone.js';

// A phone opening a phone upload link (?phone=<secret>): the phone page alone, with no sign-in; the link is its only
// authority and the server checks it on every call. The secret leaves the address at once and is kept for this tab
// only, so a reload still works and nothing of it is left in the history.
const PHONE_KEY = 'tmd.phone';
function phoneLink() {
  const fromAddress = phoneSecret();
  if (fromAddress) {
    try { sessionStorage.setItem(PHONE_KEY, fromAddress); } catch { /* no storage: the link works until a reload */ }
    const url = new URL(location.href); url.searchParams.delete('phone');
    history.replaceState(null, '', `${url.pathname}${url.search}#phone`);
    return fromAddress;
  }
  if (location.hash === '#phone') { try { return sessionStorage.getItem(PHONE_KEY) || ''; } catch { return ''; } }
  return '';
}
const secret = phoneLink();

// Nothing else shows until AADML says who is signed in. A signed-out person goes to the AADML login page, which sends
// them back to this exact page afterwards.
if (secret) createApp(PhoneUpload, { secret }).mount('#training-data-app');
else loadSession().then(session => {
  if (!session.signedIn) { window.location.assign(signInUrl()); return; }
  createApp(App).provide('session', reactive(session)).mount('#training-data-app');
}).catch(error => {
  const root = document.getElementById('training-data-app');
  root.setAttribute('role', 'alert');
  root.style.cssText = 'font:14px/1.6 Inter,system-ui,sans-serif;color:#334155;padding:48px 24px;text-align:center';
  root.textContent = `${error?.message || 'Could not reach AADML.'} Reload the page to try again.`;
});
