import { createApp, reactive } from 'vue';
import App from './App.vue';
import './styles.css';
import './studio.css';
import './aadml-theme.css';
import { loadSession } from './api/session.js';
import { signInUrl } from './api/client.js';

// Nothing shows until AADML says who is signed in. A signed-out person goes to the AADML login page, which sends
// them back to this exact page afterwards.
loadSession().then(session => {
  if (!session.signedIn) { window.location.assign(signInUrl()); return; }
  createApp(App).provide('session', reactive(session)).mount('#training-data-app');
}).catch(error => {
  const root = document.getElementById('training-data-app');
  root.setAttribute('role', 'alert');
  root.style.cssText = 'font:14px/1.6 Inter,system-ui,sans-serif;color:#334155;padding:48px 24px;text-align:center';
  root.textContent = `${error?.message || 'Could not reach AADML.'} Reload the page to try again.`;
});
