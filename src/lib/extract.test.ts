import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { extractFrames, selectByMaxFrames } from './extract.js';
import type { ExtractOptions, KeptReason } from './extract.js';
import { resolveFfmpegBinary, runFfmpeg } from './ffmpeg.js';
import { DEFAULT_MAX_DURATION_SEC, DEFAULT_MAX_RAW_FRAMES, DEFAULT_TIMEOUT_MS } from './options.js';

vi.mock('./ffmpeg.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ffmpeg.js')>();
  return { ...actual, resolveFfmpegBinary: vi.fn(), runFfmpeg: vi.fn() };
});

const resolveFfmpegBinaryMock = vi.mocked(resolveFfmpegBinary);
const runFfmpegMock = vi.mocked(runFfmpeg);

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

const SAMPLED_FRAME_COUNT = 2;

async function fakeJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 90, g: 120, b: 150 } },
  })
    .jpeg()
    .toBuffer();
}

async function writeFakeOutput(target: string): Promise<void> {
  const jpeg = await fakeJpeg();
  if (!target.includes('%05d')) {
    await writeFile(target, jpeg);
    return;
  }
  const indices = Array.from({ length: SAMPLED_FRAME_COUNT }, (_, i) => i + 1);
  await Promise.all(
    indices.map((i) => writeFile(target.replace('%05d', String(i).padStart(5, '0')), jpeg))
  );
}

function ffmpegCall(index: number): { args: readonly string[]; timeoutMs: number | undefined } {
  const [, args, timeoutMs] = runFfmpegMock.mock.calls[index];
  return { args, timeoutMs };
}

function argAfter(args: readonly string[], flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

describe('extractFrames ffmpeg invocation', () => {
  let dir: string;
  let videoPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'framewise-extract-'));
    videoPath = join(dir, 'clip.mp4');
    await writeFile(videoPath, '');
    resolveFfmpegBinaryMock.mockResolvedValue('ffmpeg');
    runFfmpegMock.mockImplementation(async (_binary, args) => writeFakeOutput(args[args.length - 1]));
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('caps raw frames and processed duration in the sampling pass by default', async () => {
    const result = await extractFrames(videoPath, join(dir, 'out'), { fps: 2 });

    const { args, timeoutMs } = ffmpegCall(0);
    expect(argAfter(args, '-frames:v')).toBe(String(DEFAULT_MAX_RAW_FRAMES));
    expect(argAfter(args, '-t')).toBe(String(DEFAULT_MAX_DURATION_SEC));
    expect(argAfter(args, '-vf')).toBe('fps=2');
    expect(timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(result.extractedCount).toBe(SAMPLED_FRAME_COUNT + 2);
    expect(result.keptCount).toBeGreaterThan(0);
  });

  it('places -t before -i so it limits how much input is read and decoded', async () => {
    await extractFrames(videoPath, join(dir, 'out'));

    runFfmpegMock.mock.calls.forEach(([, args]) => {
      expect(args.indexOf('-t')).toBeGreaterThan(-1);
      expect(args.indexOf('-t')).toBeLessThan(args.indexOf('-i'));
    });
  });

  it('forwards custom caps and timeout to every ffmpeg call', async () => {
    await extractFrames(videoPath, join(dir, 'out'), {
      maxRawFrames: 50,
      maxDurationSec: 12.5,
      timeoutMs: 1234,
      probeTimeoutMs: 567,
    });

    expect(argAfter(ffmpegCall(0).args, '-frames:v')).toBe('50');
    expect(runFfmpegMock).toHaveBeenCalledTimes(3);
    runFfmpegMock.mock.calls.forEach(([, args, timeoutMs]) => {
      expect(argAfter(args, '-t')).toBe('12.5');
      expect(timeoutMs).toBe(1234);
    });
    expect(resolveFfmpegBinaryMock).toHaveBeenCalledWith(undefined, 567);
  });

  it('passes absolute input and output paths so a leading "-" cannot be read as an option', async () => {
    const dashed = join(dir, '-i-am-not-a-flag.mp4');
    await writeFile(dashed, '');

    await extractFrames(relative(process.cwd(), dashed), relative(process.cwd(), join(dir, 'out')));

    runFfmpegMock.mock.calls.forEach(([, args]) => {
      expect(argAfter(args, '-i')).toBe(resolve(dashed));
      expect(isAbsolute(args[args.length - 1])).toBe(true);
    });
  });

  it.each<[string, ExtractOptions]>([
    ['fps of 0', { fps: 0 }],
    ['negative fps', { fps: -1 }],
    ['fps above 60', { fps: 61 }],
    ['NaN fps', { fps: Number.NaN }],
    ['infinite fps', { fps: Number.POSITIVE_INFINITY }],
    ['maxFrames of 0', { maxFrames: 0 }],
    ['negative maxFrames', { maxFrames: -5 }],
    ['fractional maxFrames', { maxFrames: 2.5 }],
    ['quality above 100', { quality: 101 }],
    ['negative quality', { quality: -1 }],
    ['maxRawFrames of 0', { maxRawFrames: 0 }],
    ['non-positive maxDurationSec', { maxDurationSec: 0 }],
    ['non-positive timeoutMs', { timeoutMs: 0 }],
    ['fractional probeTimeoutMs', { probeTimeoutMs: 1.5 }],
  ])('rejects %s before spawning any subprocess', async (_label, options) => {
    await expect(extractFrames(videoPath, join(dir, 'out'), options)).rejects.toThrow(/^Invalid /);
    expect(resolveFfmpegBinaryMock).not.toHaveBeenCalled();
    expect(runFfmpegMock).not.toHaveBeenCalled();
  });
});
