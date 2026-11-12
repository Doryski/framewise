import { execFile, type ExecFileException } from 'node:child_process';
import { DEFAULT_PROBE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS } from './options.js';

const MAX_BUFFER_BYTES = 1024 * 1024 * 64;
const KILL_SIGNAL = 'SIGKILL';
const MAX_BUFFER_ERROR_CODE = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
const FFMPEG_BASE_ARGS = ['-nostdin', '-y', '-hide_banner', '-loglevel', 'error'] as const;

let cachedFfmpegPath: string | null | undefined;

function isTimeoutError(error: ExecFileException): boolean {
  return error.killed === true && error.signal === KILL_SIGNAL && error.code !== MAX_BUFFER_ERROR_CODE;
}

function toProcessError(binary: string, error: ExecFileException, timeoutMs: number): Error {
  if (!isTimeoutError(error)) return error;
  return new Error(`${binary} timed out after ${timeoutMs} ms and was killed.`, { cause: error });
}

export function runProcess(binary: string, args: readonly string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      binary,
      args,
      { timeout: timeoutMs, killSignal: KILL_SIGNAL, maxBuffer: MAX_BUFFER_BYTES, windowsHide: true },
      (error) => {
        if (error) {
          reject(toProcessError(binary, error, timeoutMs));
          return;
        }
        resolve();
      }
    );
  });
}

export async function checkFfmpeg(
  ffmpegPath?: string,
  timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS
): Promise<boolean> {
  try {
    await runProcess(ffmpegPath ?? 'ffmpeg', ['-version'], timeoutMs);
    return true;
  } catch {
    return false;
  }
}

export async function resolveFfmpegBinary(
  ffmpegPath?: string,
  probeTimeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS
): Promise<string | null> {
  if (ffmpegPath) {
    return (await checkFfmpeg(ffmpegPath, probeTimeoutMs)) ? ffmpegPath : null;
  }

  if (cachedFfmpegPath !== undefined) return cachedFfmpegPath;

  if (await checkFfmpeg('ffmpeg', probeTimeoutMs)) {
    cachedFfmpegPath = 'ffmpeg';
    return cachedFfmpegPath;
  }

  try {
    const moduleName = 'ffmpeg-static';
    const mod = (await import(moduleName)) as { default?: string } | string;
    const path = typeof mod === 'string' ? mod : mod.default;
    if (path && (await checkFfmpeg(path, probeTimeoutMs))) {
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

export async function runFfmpeg(
  binary: string,
  args: readonly string[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<void> {
  await runProcess(binary, [...FFMPEG_BASE_ARGS, ...args], timeoutMs);
}
