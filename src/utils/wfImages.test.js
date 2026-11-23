// Images in a workflow's run data (ADM-1351): which values are images or detections, the words for detections, the
// box geometry, and the one cache of 15-minute viewer links (read again once expired).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({ getWorkflowImage: vi.fn() }))
vi.mock('@/services/api', () => ({ default: apiMock }))
const { boxPercent, detectionSummary, findMedia, imageUrl, isDetections, isImageRef, polygonPoints, resetImageLinks } = await import('./wfImages')

const img = (id) => ({ kind: 'image', id })
const det = (image, items) => ({ kind: 'detections', image, size: [200, 100], items })

describe('image values', () => {
  it('knows an image, a camera frame and detections; a registry sample is not an image', () => {
    expect(isImageRef(img('a1'))).toBe(true)
    expect(isImageRef({ kind: 'image', event: 4 })).toBe(true)
    expect(isImageRef(img('(image)'))).toBe(false)
    expect(isImageRef({ kind: 'image' })).toBe(false)
    expect(isImageRef('a1')).toBe(false)
    expect(isDetections(det(img('a'), []))).toBe(true)
    expect(isDetections({ kind: 'detections' })).toBe(false)
  })

  it('finds every image and detections value, all of them, and an image drawn with its detections only once', () => {
    const crops = Array.from({ length: 60 }, (_, i) => img(`c${i}`))
    const out = { detections: det(img('p'), []), image: img('p'), crops, sample: img('(image)'), frame: { kind: 'image', event: 3 } }
    const found = findMedia(out)
    expect(found.map((m) => m.path)).toEqual(['detections', ...crops.map((_, i) => `crops[${i}]`), 'frame'])
    expect(found).toHaveLength(62)
    expect(findMedia({ detections: { kind: 'detections', items: [] } })).toEqual([])
    expect(findMedia(img('x'))).toEqual([{ kind: 'image', path: '', value: img('x') }])
  })

  it('says what was found in words', () => {
    expect(detectionSummary(det(img('p'), []))).toBe('No objects found')
    expect(detectionSummary(det(img('p'), [{ class: 'dog' }, { class: 'cat' }, { class: 'cat' }]))).toBe('3 objects: cat 2, dog 1')
    expect(detectionSummary(det(img('p'), [{ class: 'cat' }]))).toBe('1 object: cat 1')
  })

  it('places a box as percentages of the image, and reads a polygon in either shape', () => {
    expect(boxPercent([20, 10, 120, 60], [200, 100])).toEqual({ left: 10, top: 10, width: 50, height: 50 })
    expect(boxPercent([20, 10, 120], [200, 100])).toBeNull()
    expect(boxPercent([20, 10, 120, 60], [0, 100])).toBeNull()
    expect(polygonPoints([[1, 2], [3, 4], [5, 6]])).toBe('1,2 3,4 5,6')
    expect(polygonPoints([1, 2, 3, 4, 5, 6])).toBe('1,2 3,4 5,6')
    expect(polygonPoints(null)).toBe('')
  })
})

describe('viewer links', () => {
  beforeEach(() => { resetImageLinks(); apiMock.getWorkflowImage.mockReset(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('asks once per image, and again once the link has expired', async () => {
    apiMock.getWorkflowImage.mockResolvedValue({ data: { url: 'https://s3.example/a?sig=1', expires_in: 900 } })
    const [a, b] = await Promise.all([imageUrl('a'), imageUrl('a')])
    expect(a).toBe('https://s3.example/a?sig=1')
    expect(b).toBe(a)
    await imageUrl('a')
    expect(apiMock.getWorkflowImage).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(900 * 1000)
    await imageUrl('a')
    expect(apiMock.getWorkflowImage).toHaveBeenCalledTimes(2)
  })

  it('a failure is said in words and not kept', async () => {
    apiMock.getWorkflowImage.mockRejectedValueOnce({ response: { status: 404, data: { error: 'No such image.' } } })
    await expect(imageUrl('gone')).rejects.toThrow('No such image.')
    apiMock.getWorkflowImage.mockResolvedValueOnce({ data: { url: 'https://s3.example/g', expires_in: 900 } })
    await expect(imageUrl('gone')).resolves.toBe('https://s3.example/g')
  })
})
