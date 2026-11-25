// ADM-1363: the Tables page's rules. Keys follow the server's rule, a cell's text becomes a value of its column's type
// (or says why not), an edit sends only what changed, the usage meter's state, and a CSV's errors in file order.
import { describe, expect, it } from 'vitest'
import {
  apiErrorText, columnKeyProblem, csvErrorLines, displayCell, editText, formatBytes, formatUsd, keyFromLabel, parseCell, rowChanges, usageLevel,
} from './tableData'

describe('column keys', () => {
  it.each([
    ['email', ''],
    ['Email_2', ''],
    ['', 'Give the column a key.'],
    ['2fa', 'A key starts with a letter.'],
    ['first name', 'A key has only letters, digits and _.'],
    ['a__b', 'A key cannot have two _ in a row.'],
    ['id', 'id is kept for every row; choose another key.'],
    ['Created_At', 'Created_At is kept for every row; choose another key.'],
    ['a'.repeat(64), 'A key has 63 characters at most.'],
  ])('%s -> %s', (key, problem) => {
    expect(columnKeyProblem(key)).toBe(problem)
  })

  it('refuses a key the table already has, whatever its case', () => {
    expect(columnKeyProblem('Email', { taken: ['email'] })).toBe('The table already has a column Email.')
  })

  it('makes a valid key from a label', () => {
    expect(keyFromLabel('Email address')).toBe('email_address')
    expect(keyFromLabel('  Café -- total  ')).toBe('cafe_total')
    expect(keyFromLabel('2nd phone')).toBe('c_2nd_phone')
    expect(columnKeyProblem(keyFromLabel('Résumé / CV (link)'))).toBe('')
  })
})

describe('cells', () => {
  it('reads each type, and empty text clears the value', () => {
    expect(parseCell('text', 'hi')).toEqual({ value: 'hi' })
    expect(parseCell('number', ' 4.5 ')).toEqual({ value: 4.5 })
    expect(parseCell('number', 'four')).toEqual({ error: 'Not a number.' })
    expect(parseCell('boolean', 'false')).toEqual({ value: false })
    expect(parseCell('date', '2026-11-25')).toEqual({ value: '2026-11-25' })
    expect(parseCell('date', '25/11/2026').error).toBe('A date is YYYY-MM-DD.')
    expect(parseCell('json', '{"a":[1]}')).toEqual({ value: { a: [1] } })
    expect(parseCell('json', '{a:1}').error).toBe('Not valid JSON.')
    expect(parseCell('number', '   ')).toEqual({ value: null })
  })

  it('a datetime typed in local time is sent as ISO and comes back as the same local text', () => {
    const { value } = parseCell('datetime', '2026-11-25T09:30')
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(editText('datetime', value)).toBe('2026-11-25T09:30')
  })

  it('shows JSON and booleans as text, and nothing for an empty value', () => {
    expect(displayCell('json', { a: 1 })).toBe('{"a":1}')
    expect(displayCell('boolean', false)).toBe('false')
    expect(displayCell('text', null)).toBe('')
  })
})

describe('rowChanges', () => {
  const columns = [{ key: 'email', type: 'text', required: true }, { key: 'age', type: 'number' }, { key: 'tags', type: 'json' }]

  it('sends only the changed values, and null for a cleared one', () => {
    const row = { id: 1, email: 'a@x.com', age: 30, tags: ['a'] }
    const texts = { email: 'a@x.com', age: '', tags: '["a"]' }
    expect(rowChanges(columns, row, texts)).toEqual({ values: { age: null }, errors: {} })
  })

  it('says which field is wrong and sends nothing for it', () => {
    const out = rowChanges(columns, null, { email: '', age: 'x', tags: '[' })
    expect(out.errors).toEqual({ email: 'Required.', age: 'Not a number.', tags: 'Not valid JSON.' })
    expect(out.values).toEqual({})
  })
})

describe('usage and money', () => {
  it('names the meter state from the server fields', () => {
    expect(usageLevel({ bytes: 1, warn_at_bytes: 80, over_free_bytes: 0 })).toBe('ok')
    expect(usageLevel({ bytes: 80, warn_at_bytes: 80, over_free_bytes: 0 })).toBe('warn')
    expect(usageLevel({ bytes: 120, warn_at_bytes: 80, over_free_bytes: 20 })).toBe('charging')
    expect(usageLevel({ bytes: 120, over_free_bytes: 20, writes_refused: true })).toBe('paused')
  })

  it('formats bytes and small charges', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(100 * 1024 * 1024)).toBe('100 MB')
    expect(formatUsd(0.0042)).toBe('$0.0042')
    expect(formatUsd(1.5)).toBe('$1.50')
    expect(formatUsd(0)).toBe('$0.00')
  })
})

describe('errors', () => {
  it('lists a CSV\'s errors in file order with the header named', () => {
    expect(csvErrorLines([
      { row: 4, column: 'age', message: 'not a number' },
      { row: 1, column: 'emial', message: 'no such column' },
      { row: 2, message: 'too many values' },
    ])).toEqual(['Header, column emial: no such column', 'Row 2: too many values', 'Row 4, column age: not a number'])
  })

  it('says what to do when writes are paused, and where a value was refused', () => {
    expect(apiErrorText({ response: { status: 402, data: { code: 'storage_unpaid' } } }, 'x')).toMatch(/Top up, or delete rows/)
    expect(apiErrorText({ response: { status: 409, data: { error: 'Already taken.', code: 'unique_violation', column: 'email' } } }, 'x'))
      .toBe('Already taken. (column email)')
    // ADM-1367: a message that already names its column is not told it again.
    expect(apiErrorText({ response: { status: 409, data: { error: "Column 'email' is unique, and another row already has 'a@example.com'.", code: 'unique_violation', column: 'email' } } }, 'x'))
      .toBe("Column 'email' is unique, and another row already has 'a@example.com'.")
    expect(apiErrorText({ response: { status: 500, data: {} } }, 'The row was not saved')).toBe('The row was not saved (error 500).')
    expect(apiErrorText(new Error('Network Error'), 'The row was not saved')).toBe('The row was not saved. Check your connection.')
  })
})
