// A photo every half second, i.e. two a second, can be taken from a video (the owner, 2026-11-24), as the server's
// media_import.EVERY_CHOICES allows.
import { describe, expect, it } from 'vitest';
import { FRAME_EVERY, everyText } from '../../../training-data/src/api/phone.js';

describe('how often a photo is taken from a video', () => {
  it('offers two a second first, then every 1, 2, 5, 10 and 30 seconds, each said plainly', () => {
    expect(FRAME_EVERY).toEqual([0.5, 1, 2, 5, 10, 30]);
    expect(FRAME_EVERY.map(everyText)).toEqual(['half second (2 a second)', '1 second', '2 seconds', '5 seconds', '10 seconds', '30 seconds']);
  });
});
