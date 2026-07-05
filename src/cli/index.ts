#!/usr/bin/env node
import { basename, dirname, extname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { extractFrames, type ExtractOptions, type FrameFormat } from '../index.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8')) as {
  version: string;
};

const VALID_FORMATS = ['jpeg', 'png', 'webp'] as const;

function toNumber(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${name}: ${value}`);
  return n;
}

function defaultOutputDir(videoPath: string): string {
  const dir = dirname(videoPath);
  const base = basename(videoPath, extname(videoPath));
  return join(dir, `${base}-frames`);
}

type CliOptions = {
  fps?: string;
  maxFrames?: string;
  format?: FrameFormat;
  quality?: string;
  dedupe: boolean;
  dedupeThreshold?: string;
  blurThreshold?: string;
  sceneDetection?: boolean;
  sceneThreshold?: string;
  ffmpegPath?: string;
  json?: boolean;
  quiet?: boolean;
};

const program = new Command();

program
  .name('framewise')
  .description('Turn a video into a lean, deduplicated, high-quality set of frames for vision LLMs.')
  .version(pkg.version, '-v, --version', 'output the version number')
  .argument('<video>', 'path to the input video file')
  .argument('[outputDir]', 'directory to write frames into (default: <video>-frames)')
  .option('--fps <n>', 'frames per second to sample (default 5)')
  .option('--max-frames <n>', 'cap the number of kept frames')
  .option('--format <fmt>', 'output image format: jpeg | png | webp (default jpeg)')
  .option('--quality <n>', 'output quality 0-100 (default 85)')
  .option('--no-dedupe', 'disable perceptual-hash deduplication')
  .option('--dedupe-threshold <n>', 'min Hamming distance to keep a frame (default 8)')
  .option('--blur-threshold <n>', 'drop frames below this Laplacian-variance sharpness')
  .option('--scene-detection', 'force-keep frames at detected scene cuts')
  .option('--scene-threshold <n>', 'mean-abs-diff threshold for a scene cut (default 0.08)')
  .option('--ffmpeg-path <path>', 'path to an ffmpeg binary')
  .option('--json', 'print the machine-readable ExtractResult as JSON')
  .option('--quiet', 'suppress progress and summary output')
  .addHelpText(
    'after',
    `
Examples:
  $ framewise clip.mp4
  $ framewise clip.mp4 ./frames --fps 2 --max-frames 40
  $ framewise clip.mp4 --blur-threshold 50 --scene-detection
  $ framewise clip.mp4 --format webp --quality 70 --json
`
  )
  .action(async (video: string, outputDir: string | undefined, opts: CliOptions) => {
    const quiet = Boolean(opts.quiet);
    const json = Boolean(opts.json);
    const status = (msg: string) => {
      if (!quiet && !json) process.stderr.write(`${msg}\n`);
    };

    const options: ExtractOptions = {
      dedupe: opts.dedupe,
      onProgress: ({ phase, current, total }) => {
        if (current && total) status(`  ${phase}: ${current}/${total}`);
        else status(`${phase}...`);
      },
    };

    try {
      if (opts.fps !== undefined) options.fps = toNumber(opts.fps, '--fps');
      if (opts.maxFrames !== undefined) options.maxFrames = toNumber(opts.maxFrames, '--max-frames');
      if (opts.format !== undefined) {
        if (!VALID_FORMATS.includes(opts.format)) {
          process.stderr.write(
            `Error: Invalid value for --format: ${opts.format}. Expected one of: ${VALID_FORMATS.join(', ')}.\n`
          );
          process.exit(1);
        }
        options.format = opts.format;
      }
      if (opts.quality !== undefined) options.quality = toNumber(opts.quality, '--quality');
      if (opts.dedupeThreshold !== undefined)
        options.dedupeThreshold = toNumber(opts.dedupeThreshold, '--dedupe-threshold');
      if (opts.blurThreshold !== undefined)
        options.blurThreshold = toNumber(opts.blurThreshold, '--blur-threshold');
      if (opts.sceneDetection) options.sceneDetection = true;
      if (opts.sceneThreshold !== undefined)
        options.sceneThreshold = toNumber(opts.sceneThreshold, '--scene-threshold');
      if (opts.ffmpegPath !== undefined) options.ffmpegPath = opts.ffmpegPath;

      const target = outputDir ?? defaultOutputDir(video);
      const result = await extractFrames(video, target, options);

      if (json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      if (!quiet) {
        process.stdout.write(
          [
            `Extracted ${result.extractedCount} frames, kept ${result.keptCount}.`,
            `  dropped duplicates: ${result.droppedDuplicates}`,
            `  dropped blurry:     ${result.droppedBlurry}`,
            `  output: ${result.outputDir}`,
          ].join('\n') + '\n'
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    }
  });

program.parseAsync().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
});
