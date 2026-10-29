import { describe, it, expect } from 'vitest'
import { uniqueModels } from './uniqueModels'

describe('uniqueModels: one list, each model once (owner, 2026-10-29)', () => {
  const rows = [
    { id: 1, model_id: 'openai/gpt-6' },
    { id: 2, model_id: 'anthropic/claude' },
    { id: 3, model_id: 'OpenAI/GPT-6' },          // the same model on a second connection
  ]

  it('keeps the first row of a model in the order the list came in', () => {
    expect(uniqueModels(rows).map((m) => m.id)).toEqual([1, 2])
  })

  it('keeps the row already chosen when its model is on two connections', () => {
    expect(uniqueModels(rows, [3]).map((m) => m.id)).toEqual([3, 2])
    expect(uniqueModels(rows, ['3', null]).map((m) => m.id)).toEqual([3, 2])
  })

  it('is safe on nothing', () => {
    expect(uniqueModels(null)).toEqual([])
    expect(uniqueModels(undefined, undefined)).toEqual([])
  })
})
