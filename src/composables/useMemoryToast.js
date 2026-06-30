// Memory Autopilot — the backend still auto-saves memory from a turn (the `memory_saved` WS event), but
// per product decision we no longer surface a "Remembered: X — click to undo" toast (nor the "Okay —
// forgotten" toast on undo). This is intentionally a no-op so every chat surface stops showing it from one
// place; the WS event is still consumed harmlessly by the callers. Memory management lives in the Memory tab.
export function showMemorySavedToast(_data) {
  // intentionally no-op — memory auto-save toasts are disabled
}

export function useMemoryToast() {
  return { showMemorySavedToast }
}

export default showMemorySavedToast
