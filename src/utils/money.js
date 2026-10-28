// A person's balance as they see it (backend PAYMENTS_TOPUP_PLAN.md): cents rounded DOWN, so it never shows money they
// do not have ($0.9985 is $0.99, a debt of $0.501 is −$0.51), and "under $0.01" for a balance above zero that rounds
// down to nothing.
export function balanceText(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return '$0.00'
  const cents = Math.floor(Math.round(n * 1e8) / 1e6)   // in cents, toward less money (the 1e8 step drops float noise)
  if (n > 0 && cents === 0) return 'under $0.01'
  return (cents < 0 ? '−$' : '$') + (Math.abs(cents) / 100).toFixed(2)
}
