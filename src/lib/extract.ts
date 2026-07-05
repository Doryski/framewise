import { existsSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { computeDHash, hammingDistance } from './hash.js';
import { downscaleGrey, sceneDiffBuffers } from './scene.js';
import { computeSharpness } from './sharpness.js';
import { qualityToScale, resolveFfmpegBinary, runFfmpeg } from './ffmpeg.js';

export type FrameFormat = 'jpeg' | 'png' | 'webp';

export type ExtractOptions = {
  fps?: number;
  format?: FrameFormat;
  quality?: number;
  maxFrames?: number;
  dedupe?: boolean;
  dedupeThreshold?: number;
  blurThreshold?: number;
  sceneDetection?: boolean;
  sceneThreshold?: number;
  includeFirstLast?: boolean;
  ffmpegPath?: string;
  onProgress?: (e: { phase: string; current?: number; total?: number }) => void;
};

export type KeptReason = 'first' | 'last' | 'scene-cut' | 'unique' | 'sampled';

export type FrameInfo = {
  index: number;
  path: string;
  timestampSec: number;
  dHash: string;
  sharpness: number;
  keptReason: KeptReason;
};

export type ExtractResult = {
  outputDir: string;
  frames: FrameInfo[];
  extractedCount: number;
  keptCount: number;
  droppedDuplicates: number;
  droppedBlurry: number;
};

type RawFrame = {
  rawPath: string;
  timestampSec: number;
  forced: boolean;
  dHash: string;
  sharpness: number;
  reason?: KeptReason;
};

const DEFAULTS = {
  fps: 5,
  format: 'jpeg' as FrameFormat,
  quality: 85,
  dedupe: true,
  dedupeThreshold: 8,
  sceneThreshold: 0.08,
  includeFirstLast: true,
} as const;

function extFor(format: FrameFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

function pad(n: number): string {
  return String(n).padStart(4, '0');
}

type ExtractedFrame = {
  path: string;
  timestampSec: number;
  forced: boolean;
  forcedReason?: 'first' | 'last';
};

async function extractRawFrames(
  binary: string,
  videoPath: string,
  outputDir: string,
  fps: number,
  ext: string,
  qScale: number,
  includeFirstLast: boolean
): Promise<ExtractedFrame[]> {
  await runFfmpeg(binary, [
    '-i',
    videoPath,
    '-vf',
    `fps=${fps}`,
    '-q:v',
    String(qScale),
    join(outputDir, `raw-%05d.${ext}`),
  ]);

  const regularPaths = readdirSync(outputDir)
    .filter((f) => new RegExp(`^raw-\\d{5}\\.${ext}$`).test(f))
    .sort()
    .map((f) => join(outputDir, f));

  const regular = regularPaths.map((path, i) => ({
    path,
    timestampSec: i / fps,
    forced: false,
  }));

  if (!includeFirstLast) return regular;

  const firstPath = join(outputDir, `raw-first.${ext}`);
  await runFfmpeg(binary, [
    '-i',
    videoPath,
    '-vf',
    'select=eq(n\\,0)',
    '-update',
    '1',
    '-vframes',
    '1',
    '-q:v',
    String(qScale),
    firstPath,
  ]);

  const lastPath = join(outputDir, `raw-last.${ext}`);
  await runFfmpeg(binary, [
    '-sseof',
    '-1',
    '-i',
    videoPath,
    '-update',
    '1',
    '-q:v',
    String(qScale),
    lastPath,
  ]);

  const lastTs = regular.length > 0 ? regular[regular.length - 1].timestampSec + 1 / fps : 0;

  const ordered: ExtractedFrame[] = [];
  if (existsSync(firstPath)) {
    ordered.push({ path: firstPath, timestampSec: 0, forced: true, forcedReason: 'first' });
  }
  ordered.push(...regular);
  if (existsSync(lastPath)) {
    ordered.push({ path: lastPath, timestampSec: lastTs, forced: true, forcedReason: 'last' });
  }
  return ordered;
}

function pickEvenly<T>(items: T[], count: number): T[] {
  if (count <= 0) return [];
  if (count >= items.length) return items;
  const step = items.length / count;
  const result: T[] = [];
  for (let i = 0; i < count; i++) result.push(items[Math.floor(step * i)]);
  return result;
}

export function selectByMaxFrames<T extends { forced: boolean }>(
  frames: T[],
  maxFrames: number
): T[] {
  if (maxFrames < 1) return frames;

  const forced = frames.filter((f) => f.forced);
  if (forced.length >= maxFrames) return forced;

  const discretionary = frames.filter((f) => !f.forced);
  const chosen = new Set(pickEvenly(discretionary, maxFrames - forced.length));
  return frames.filter((f) => f.forced || chosen.has(f));
}

export async function extractFrames(
  videoPath: string,
  outputDir: string,
  options: ExtractOptions = {}
): Promise<ExtractResult> {
  if (!existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const fps = options.fps ?? DEFAULTS.fps;
  const format = options.format ?? DEFAULTS.format;
  const quality = options.quality ?? DEFAULTS.quality;
  const dedupe = options.dedupe ?? DEFAULTS.dedupe;
  const dedupeThreshold = options.dedupeThreshold ?? DEFAULTS.dedupeThreshold;
  const sceneDetection = options.sceneDetection ?? false;
  const sceneThreshold = options.sceneThreshold ?? DEFAULTS.sceneThreshold;
  const includeFirstLast = options.includeFirstLast ?? DEFAULTS.includeFirstLast;
  const { blurThreshold, maxFrames } = options;
  const progress = options.onProgress ?? (() => {});

  const binary = await resolveFfmpegBinary(options.ffmpegPath);
  if (!binary) {
    throw new Error(
      'ffmpeg not found. Install ffmpeg and ensure it is on your PATH, add the optional ffmpeg-static dependency, or pass ffmpegPath.'
    );
  }

  await mkdir(outputDir, { recursive: true });
  const ext = extFor(format);
  const qScale = qualityToScale(quality);

  progress({ phase: 'extracting' });
  const extracted = await extractRawFrames(
    binary,
    videoPath,
    outputDir,
    fps,
    ext,
    qScale,
    includeFirstLast
  );

  if (extracted.length === 0) {
    throw new Error('No frames were extracted from the video.');
  }

  progress({ phase: 'analyzing', total: extracted.length });
  const frames: RawFrame[] = new Array<RawFrame>(extracted.length);
  const concurrency = Math.max(1, cpus().length);
  let nextIndex = 0;
  let completed = 0;
  const analyzeWorker = async () => {
    while (nextIndex < extracted.length) {
      const i = nextIndex++;
      const e = extracted[i];
      const [dHash, sharpness] = await Promise.all([
        computeDHash(e.path),
        computeSharpness(e.path),
      ]);
      frames[i] = {
        rawPath: e.path,
        timestampSec: e.timestampSec,
        forced: e.forced,
        dHash,
        sharpness,
        reason: e.forcedReason,
      };
      completed++;
      progress({ phase: 'analyzing', current: completed, total: extracted.length });
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, extracted.length) }, () => analyzeWorker())
  );

  progress({ phase: 'selecting' });

  let droppedBlurry = 0;
  let survivors = frames;
  if (blurThreshold !== undefined) {
    survivors = frames.filter((f) => {
      if (f.forced) return true;
      if (f.sharpness < blurThreshold) {
        droppedBlurry++;
        return false;
      }
      return true;
    });
  }

  if (sceneDetection && survivors.length > 1) {
    let prev = await downscaleGrey(survivors[0].rawPath);
    for (let i = 1; i < survivors.length; i++) {
      const curr = await downscaleGrey(survivors[i].rawPath);
      const diff = sceneDiffBuffers(prev, curr);
      if (diff >= sceneThreshold && !survivors[i].forced) {
        survivors[i].forced = true;
        survivors[i].reason = 'scene-cut';
      }
      prev = curr;
    }
  }

  let droppedDuplicates = 0;
  let kept: RawFrame[] = survivors;
  if (dedupe) {
    kept = [];
    let lastKeptHash: string | undefined;
    for (const f of survivors) {
      if (kept.length === 0) {
        if (!f.reason) f.reason = 'unique';
        kept.push(f);
        lastKeptHash = f.dHash;
        continue;
      }
      if (f.forced) {
        kept.push(f);
        lastKeptHash = f.dHash;
        continue;
      }
      if (lastKeptHash !== undefined && hammingDistance(f.dHash, lastKeptHash) >= dedupeThreshold) {
        f.reason = 'unique';
        kept.push(f);
        lastKeptHash = f.dHash;
      } else {
        droppedDuplicates++;
      }
    }
  } else {
    kept.forEach((f) => {
      if (!f.reason) f.reason = 'unique';
    });
  }

  if (maxFrames !== undefined) {
    kept = selectByMaxFrames(kept, maxFrames);
  }

  progress({ phase: 'writing', total: kept.length });

  const keptSet = new Set(kept.map((f) => f.rawPath));
  for (const f of extracted) {
    if (!keptSet.has(f.path) && existsSync(f.path)) unlinkSync(f.path);
  }

  const resultFrames: FrameInfo[] = kept.map((f, i) => {
    const finalPath = join(outputDir, `frame-${pad(i + 1)}.${ext}`);
    renameSync(f.rawPath, finalPath);
    progress({ phase: 'writing', current: i + 1, total: kept.length });
    return {
      index: i + 1,
      path: finalPath,
      timestampSec: f.timestampSec,
      dHash: f.dHash,
      sharpness: f.sharpness,
      keptReason: f.reason ?? 'unique',
    };
  });

  return {
    outputDir,
    frames: resultFrames,
    extractedCount: extracted.length,
    keptCount: resultFrames.length,
    droppedDuplicates,
    droppedBlurry,
  };
}
