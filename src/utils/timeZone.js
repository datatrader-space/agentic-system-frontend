// The person's own timezone, as an IANA name ("Asia/Karachi"), or 'UTC' when the browser does not say (ADM-1354).
export function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}
