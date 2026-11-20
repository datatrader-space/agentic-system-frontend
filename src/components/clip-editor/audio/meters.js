// Level meters (plan item 31, ADM-1199): peak and RMS of each channel from the last block of samples, in dBFS, with a
// peak hold that falls back at a fixed rate. Pure functions; audioGraph.js feeds them from two AnalyserNodes.

export const FLOOR_DB = -60
export const toDb = v => (v > 0 ? Math.max(20 * Math.log10(v), FLOOR_DB) : FLOOR_DB)

// Peak (largest absolute sample) and RMS of a block, linear and in dB.
export function levels(samples) {
  let peak = 0, sum = 0
  const n = samples?.length || 0
  for (let i = 0; i < n; i++) { const v = samples[i]; const a = v < 0 ? -v : v; if (a > peak) peak = a; sum += v * v }
  const rms = n ? Math.sqrt(sum / n) : 0
  return { peak, rms, peakDb: toDb(peak), rmsDb: toDb(rms), clipped: peak >= 1 }
}

// The held peak (dB): a new higher peak replaces it; otherwise it waits `holdMs`, then falls `fallDbPerS`.
export function holdPeak(state, peakDb, dtMs, { holdMs = 1000, fallDbPerS = 20 } = {}) {
  if (!state || peakDb >= state.db) return { db: peakDb, age: 0 }
  const age = state.age + dtMs
  const db = age > holdMs ? Math.max(peakDb, state.db - fallDbPerS * (dtMs / 1000)) : state.db
  return { db, age }
}

// A meter's fill (0..1) for a level in dB on the meter's scale (FLOOR_DB..0).
export const fill = db => Math.min(Math.max((db - FLOOR_DB) / -FLOOR_DB, 0), 1)
