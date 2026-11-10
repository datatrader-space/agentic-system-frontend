// xterm is loaded only when a terminal is first shown: every other page keeps its bundle (budget, Lighthouse).
// One app module owns the dynamic imports so a test replaces xterm by mocking this file. A mock of the package's own
// dynamic import sometimes fell back to the real xterm on the CI runner (vite 6; run 42815825100, 2026-11-10).
export async function loadXterm() {
  const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
    import('@xterm/xterm'), import('@xterm/addon-fit'), import('@xterm/addon-web-links'), import('@xterm/xterm/css/xterm.css'),
  ])
  return { Terminal, FitAddon, WebLinksAddon }
}
