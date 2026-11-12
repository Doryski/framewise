import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { checkFfmpeg, runFfmpeg, runProcess } from './ffmpeg.js';
import { DEFAULT_PROBE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS } from './options.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFile: vi.fn(actual.execFile) };
});

const execFileMock = vi.mocked(execFile);
const node = process.execPath;
const HANG_SCRIPT = 'setTimeout(() => {}, 10000)';

function lastExecFileCall(): { args: unknown; options: unknown } {
  const [, args, options] = execFileMock.mock.calls[execFileMock.mock.calls.length - 1];
  return { args, options };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('runFfmpeg', () => {
  it('prepends -nostdin and an explicit overwrite flag, passing an argument array', async () => {
    await expect(runFfmpeg(node, ['-i', '/tmp/in.mp4', '/tmp/out.jpg'])).rejects.toThrow();

    const { args, options } = lastExecFileCall();
    expect(args).toEqual(
      expect.arrayContaining(['-nostdin', '-y', '-i', '/tmp/in.mp4', '/tmp/out.jpg'])
    );
    expect(args).toEqual(expect.not.arrayContaining(['-n']));
    expect(options).toMatchObject({ timeout: DEFAULT_TIMEOUT_MS, killSignal: 'SIGKILL' });
  });

  it('kills a hanging process and rejects with a timeout error', async () => {
    const started = Date.now();
    await expect(runProcess(node, ['-e', HANG_SCRIPT], 200)).rejects.toThrow(
      /timed out after 200 ms and was killed/
    );
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('does not report a regular non-zero exit as a timeout', async () => {
    await expect(runProcess(node, ['-e', 'process.exit(3)'], 5000)).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringMatching(/timed out/) })
    );
  });
});

describe('checkFfmpeg', () => {
  it('probes with the default probe timeout', async () => {
    await checkFfmpeg(node);

    const { args, options } = lastExecFileCall();
    expect(args).toEqual(['-version']);
    expect(options).toMatchObject({ timeout: DEFAULT_PROBE_TIMEOUT_MS });
  });
});
