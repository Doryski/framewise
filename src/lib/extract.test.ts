import { describe, it, expect } from 'vitest';
import { selectByMaxFrames } from './extract.js';
import type { KeptReason } from './extract.js';

type TestFrame = {
  id: number;
  forced: boolean;
  keptReason: KeptReason;
};

function frame(id: number, keptReason: KeptReason): TestFrame {
  const forced = keptReason === 'first' || keptReason === 'last' || keptReason === 'scene-cut';
  return { id, forced, keptReason };
}

function ids(frames: TestFrame[]): number[] {
  return frames.map((f) => f.id);
}

describe('selectByMaxFrames', () => {
  it('always retains forced frames even when they exceed the budget', () => {
    const frames = [
      frame(0, 'first'),
      frame(1, 'unique'),
      frame(2, 'scene-cut'),
      frame(3, 'unique'),
      frame(4, 'scene-cut'),
      frame(5, 'last'),
    ];
    const result = selectByMaxFrames(frames, 2);
    expect(ids(result)).toEqual([0, 2, 4, 5]);
    expect(result.every((f) => f.forced)).toBe(true);
  });

  it('never drops a mid-sequence scene-cut when maxFrames is small', () => {
    const frames = [
      frame(0, 'first'),
      frame(1, 'unique'),
      frame(2, 'unique'),
      frame(3, 'scene-cut'),
      frame(4, 'unique'),
      frame(5, 'unique'),
      frame(6, 'last'),
    ];
    const result = selectByMaxFrames(frames, 3);
    expect(ids(result)).toContain(3);
    expect(ids(result)).toContain(0);
    expect(ids(result)).toContain(6);
  });

  it('keeps all forced plus evenly-spaced discretionary within budget, in temporal order', () => {
    const frames = [
      frame(0, 'first'),
      frame(1, 'unique'),
      frame(2, 'unique'),
      frame(3, 'unique'),
      frame(4, 'unique'),
      frame(5, 'last'),
    ];
    const result = selectByMaxFrames(frames, 4);
    expect(result).toHaveLength(4);
    expect(ids(result)).toContain(0);
    expect(ids(result)).toContain(5);
    expect(ids(result)).toEqual([...ids(result)].sort((a, b) => a - b));
  });

  it('returns everything unchanged when total is within the cap', () => {
    const frames = [frame(0, 'first'), frame(1, 'unique'), frame(2, 'last')];
    const result = selectByMaxFrames(frames, 10);
    expect(ids(result)).toEqual([0, 1, 2]);
  });

  it('disables the cap when maxFrames < 1', () => {
    const frames = [frame(0, 'first'), frame(1, 'unique'), frame(2, 'unique'), frame(3, 'last')];
    expect(ids(selectByMaxFrames(frames, 0))).toEqual([0, 1, 2, 3]);
    expect(ids(selectByMaxFrames(frames, -5))).toEqual([0, 1, 2, 3]);
  });

  it('produces no duplicates', () => {
    const frames = Array.from({ length: 20 }, (_, i) => frame(i, i === 10 ? 'scene-cut' : 'unique'));
    const result = selectByMaxFrames(frames, 5);
    expect(new Set(ids(result)).size).toBe(result.length);
    expect(ids(result)).toContain(10);
  });
});
