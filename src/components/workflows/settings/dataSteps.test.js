// ADM-1363: which database operations write (flagged on a read-only connection) and a raw query's parameters.
import { describe, expect, it } from 'vitest'
import { sqlParamCheck, writesData } from './dataSteps'

describe('writesData', () => {
  it.each([
    ['data.sql', 'select', 'no'], ['data.sql', 'insert', 'yes'], ['data.sql', 'query', 'maybe'],
    ['data.mongo', 'aggregate', 'no'], ['data.mongo', 'delete_many', 'yes'],
    ['data.redis', 'get', 'no'], ['data.redis', 'scan', 'no'], ['data.redis', 'publish', 'yes'],
    ['trigger.database', undefined, 'no'],
  ])('%s %s -> %s', (type, op, want) => {
    expect(writesData(type, op)).toBe(want)
  })
})

describe('sqlParamCheck', () => {
  it('finds templates in the text, missing and unused parameters', () => {
    expect(sqlParamCheck('SELECT * FROM t WHERE a = $1 AND b = $3', [{ value: 'x' }])).toEqual({ templates: false, highest: 3, missing: [2, 3], unused: [] })
    expect(sqlParamCheck('SELECT 1', [{ value: 'x' }, { value: 'y' }])).toEqual({ templates: false, highest: 0, missing: [], unused: [1, 2] })
    expect(sqlParamCheck("SELECT * FROM t WHERE a = '{{trigger.a}}'", []).templates).toBe(true)
    expect(sqlParamCheck('', null)).toEqual({ templates: false, highest: 0, missing: [], unused: [] })
  })
})
