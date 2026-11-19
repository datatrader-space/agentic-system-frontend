// The global styles for the phone pages (main.js), without the signed-in app's: put first in <head>, so they come
// before the page's own styles, as they did when one bundle carried everything. Imported as text (?inline): the app's
// own import of the same files (appEntry.js) stays in the app's download.
import styles from './styles.css?inline';
import studio from './studio.css?inline';
import theme from './aadml-theme.css?inline';

export function addPhoneStyles(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById('td-phone-styles')) return;
  const style = doc.createElement('style');
  style.id = 'td-phone-styles';
  style.textContent = `${styles}\n${studio}\n${theme}`;
  doc.head.prepend(style);
}
