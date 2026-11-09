import { describe, it, expect } from 'vitest'
import { phaseLabel, phaseTone, isReady, failedStep, pipelineSteps, githubWebUrl } from './projectStatus'

const states = (p) => pipelineSteps(p).map(s => s.state)

describe('Let\'s Code project status', () => {
  it('labels and tones every phase the backend sends', () => {
    expect(phaseLabel({ phase: 'queued' })).toBe('Queued')
    expect(phaseLabel({ phase: 'switching' })).toBe('Switching branch')
    expect(phaseLabel({ phase: 'error' })).toBe('Failed')
    expect(phaseTone({ phase: 'ready' })).toBe('ok')
    expect(phaseTone({ phase: 'error' })).toBe('err')
    expect(phaseTone({ phase: 'indexing' })).toBe('run')
  })

  it('is ready only when the phase is ready AND the files exist', () => {
    expect(isReady({ phase: 'ready', clone_ready: true })).toBe(true)
    expect(isReady({ phase: 'ready', clone_ready: false })).toBe(false)
    expect(isReady({ phase: 'indexing', clone_ready: true })).toBe(false)
  })

  it('maps phases onto Clone → Index → Ready', () => {
    expect(states({ phase: 'queued' })).toEqual(['current', 'pending', 'pending'])
    expect(states({ phase: 'cloning' })).toEqual(['current', 'pending', 'pending'])
    expect(states({ phase: 'indexing' })).toEqual(['done', 'current', 'pending'])
    expect(states({ phase: 'switching' })).toEqual(['done', 'current', 'pending'])
    expect(states({ phase: 'ready' })).toEqual(['done', 'done', 'done'])
  })

  it('marks the step that failed', () => {
    expect(states({ phase: 'error', failed_step: 'clone' })).toEqual(['failed', 'pending', 'pending'])
    expect(states({ phase: 'error', failed_step: 'index' })).toEqual(['done', 'failed', 'pending'])
    expect(failedStep({ phase: 'error', clone_ready: true })).toBe('index')
  })

  it('a new project starts instead of cloning, and a lost one fails on its first step (ADM-1183)', () => {
    const steps = pipelineSteps({ phase: 'cloning', is_new: true })
    expect(steps[0].label).toBe('Start')
    expect(steps[0].detail).toBe('Create an empty project in your workspace')
    expect(pipelineSteps({ phase: 'cloning' })[0].label).toBe('Clone')
    expect(phaseLabel({ phase: 'cloning', is_new: true })).toBe('Starting')
    expect(phaseLabel({ phase: 'cloning' })).toBe('Cloning')
    // A lost copy keeps clone_ready from before, and still fails on the first step, not on Index.
    expect(states({ phase: 'error', failed_step: 'lost', clone_ready: true, is_new: true }))
      .toEqual(['failed', 'pending', 'pending'])
  })

  it('turns a clone URL into the repository page', () => {
    expect(githubWebUrl('https://github.com/o/r.git')).toBe('https://github.com/o/r')
  })
})
