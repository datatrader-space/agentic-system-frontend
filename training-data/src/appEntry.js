// The signed-in Training Data app, loaded only when it is the page shown (main.js). Its global styles come after it,
// exactly where main.js used to put them, so every rule wins as it did: a scoped rule and a global one of the same
// weight (".link-button[data-v-…]" and ".studio .link-button") are decided by which comes last.
import App from './App.vue';
import './styles.css';
import './studio.css';
import './aadml-theme.css';

export default App;
