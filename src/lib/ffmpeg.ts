import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

let cachedFfmpegPath: string | null | undefined;

export async function checkFfmpeg(ffmpegPath?: string): Promise<boolean> {
  try {
    await execFileAsync(ffmpegPath ?? 'ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

export async function resolveFfmpegBinary(ffmpegPath?: string): Promise<string | null> {
  if (ffmpegPath) {
    return (await checkFfmpeg(ffmpegPath)) ? ffmpegPath : null;
  }

  if (cachedFfmpegPath !== undefined) return cachedFfmpegPath;

  if (await checkFfmpeg('ffmpeg')) {
    cachedFfmpegPath = 'ffmpeg';
    return cachedFfmpegPath;
  }

  try {
    const moduleName = 'ffmpeg-static';
    const mod = (await import(moduleName)) as { default?: string } | string;
    const path = typeof mod === 'string' ? mod : mod.default;
    if (path && (await checkFfmpeg(path))) {
      cachedFfmpegPath = path;
      return cachedFfmpegPath;
    }
  } catch {
    // optional dependency not installed; fall through
  }

  cachedFfmpegPath = null;
  return cachedFfmpegPath;
}

export const __test = {
  resetFfmpegCache: (): void => {
    cachedFfmpegPath = undefined;
  },
};

export function qualityToScale(quality: number): number {
  return Math.round(2 + ((100 - quality) / 100) * 29);
}

export async function runFfmpeg(binary: string, args: string[]): Promise<void> {
  await execFileAsync(binary, args, { maxBuffer: 1024 * 1024 * 64 });
}
