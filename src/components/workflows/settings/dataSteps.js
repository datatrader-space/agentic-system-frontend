// What the external database steps' settings show beside the fields (ADM-1363). Pure, no Vue.
//
// The server decides: a write on a read-only connection is refused by the database itself, and `{{ }}` in a query's
// text is refused at validation. These helpers only say so BEFORE the person saves, so nothing here is a control.

// The operations that write, per step (the backend's steps refuse them on a read-only connection).
export const WRITE_OPERATIONS = Object.freeze({
  'data.sql': ['insert', 'update', 'upsert', 'delete'],
  'data.mongo': ['insert_one', 'insert_many', 'update_one', 'update_many', 'delete_one', 'delete_many'],
  'data.redis': ['set', 'delete', 'incr', 'expire', 'hset', 'hdel', 'lpush', 'rpush', 'lpop', 'rpop', 'publish'],
})

/** Whether a step's operation writes. A raw SQL query may write too: the database decides, so it says "maybe". */
export function writesData(type, operation) {
  if (type === 'data.sql' && operation === 'query') return 'maybe'
  return (WRITE_OPERATIONS[type] || []).includes(operation) ? 'yes' : 'no'
}

/**
 * A raw query's parameters, checked as the person types:
 *   templates  the text has {{ }} (refused: a value goes in a parameter, never into the SQL text)
 *   highest    the largest $n the text uses (0 for none)
 *   missing    the $n the text uses that have no parameter row
 *   unused     the parameter rows the text never names
 */
export function sqlParamCheck(query, params) {
  const text = String(query || '')
  const count = Array.isArray(params) ? params.length : 0
  const used = new Set([...text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])).filter((n) => n > 0))
  const highest = used.size ? Math.max(...used) : 0
  const missing = []
  for (let n = count + 1; n <= highest; n += 1) missing.push(n)
  const unused = []
  for (let n = 1; n <= count; n += 1) if (!used.has(n)) unused.push(n)
  return { templates: /\{\{/.test(text), highest, missing, unused }
}
