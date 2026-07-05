# framewise

> Turn a video into a lean, deduplicated, high-quality set of frames — ideal for feeding vision LLMs within a token budget.

[![CI](https://github.com/doryski/framewise/actions/workflows/ci.yml/badge.svg)](https://github.com/doryski/framewise/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/framewise)](https://www.npmjs.com/package/framewise)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`framewise` is a smarter successor to naive frame extraction. Instead of uniform sampling plus a crude pixel diff, it combines perceptual-hash deduplication, blur filtering, and optional scene-cut detection so you get the fewest, most representative frames — perfect for vision/multimodal LLM prompts where every image costs tokens.

## Features

- **Perceptual-hash dedup** — dHash + Hamming distance drops near-duplicate frames, not just pixel-identical ones.
- **Blur filtering** — optional Laplacian-variance sharpness gate discards out-of-focus / motion-blurred frames.
- **Scene detection** — optionally force-keep frames at detected scene cuts so transitions are never lost.
- **VLM token-budget friendly** — `maxFrames` caps the kept set with deterministic, evenly-spaced sampling.
- **Zero-config ffmpeg** — uses system `ffmpeg` if present, otherwise falls back to the optional `ffmpeg-static` binary.
- **Safe by construction** — shells out via `execFile` with an argument array (no shell), so paths can never inject commands.
- **TypeScript-native** — full types, ESM, works as a library and a CLI.

## Install

```bash
pnpm add framewise
```

`framewise` needs an `ffmpeg` binary. Either install ffmpeg and put it on your `PATH`, or install the optional bundled binary:

```bash
pnpm add ffmpeg-static
```

## Quick start

### Library

```ts
import { extractFrames } from 'framewise';

const result = await extractFrames('demo.mp4', './frames', {
  fps: 2,
  maxFrames: 40,
  blurThreshold: 50,
  sceneDetection: true,
});

console.log(`kept ${result.keptCount} of ${result.extractedCount} frames`);
for (const frame of result.frames) {
  console.log(frame.index, frame.path, frame.keptReason, frame.timestampSec);
}
```

### CLI

```bash
# Simplest form — writes to ./demo-frames next to the video
framewise demo.mp4

# Sample at 2 fps, cap at 40 frames
framewise demo.mp4 ./frames --fps 2 --max-frames 40

# Drop blurry frames and keep scene cuts
framewise demo.mp4 --blur-threshold 50 --scene-detection

# WebP output, machine-readable result
framewise demo.mp4 --format webp --quality 70 --json
```

## API reference

### `extractFrames(videoPath, outputDir, options?)`

Extracts, filters and renumbers frames into `outputDir` (created recursively). Returns an `ExtractResult`.

#### Options

| Option             | Type                                  | Default     | Description                                                             |
| ------------------ | ------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `fps`              | `number`                              | `5`         | Frames per second to sample from the video.                            |
| `format`           | `'jpeg' \| 'png' \| 'webp'`           | `'jpeg'`    | Output image format.                                                   |
| `quality`          | `number` (0–100)                      | `85`        | Output quality, mapped to ffmpeg `-q:v`.                               |
| `maxFrames`        | `number`                              | `undefined` | Caps discretionary frames via even sampling; always retains first, last and scene-cut transitions. |
| `dedupe`           | `boolean`                             | `true`      | Enable dHash + Hamming-distance deduplication.                         |
| `dedupeThreshold`  | `number`                              | `8`         | Min Hamming distance from the last kept frame required to keep.        |
| `blurThreshold`    | `number`                              | `undefined` | Min Laplacian variance to keep; disabled when unset.                   |
| `sceneDetection`   | `boolean`                             | `false`     | Force-keep frames at detected scene cuts.                              |
| `sceneThreshold`   | `number`                              | `0.08`      | Normalized mean-abs-diff threshold for a scene cut.                    |
| `includeFirstLast` | `boolean`                             | `true`      | Always include the video's first and last frames.                     |
| `ffmpegPath`       | `string`                              | `undefined` | Override the ffmpeg binary path.                                       |
| `onProgress`       | `(e) => void`                         | `undefined` | Progress callback fired at `extracting`/`analyzing`/`selecting`/`writing`. |

#### `ExtractResult`

| Field               | Type          | Description                                          |
| ------------------- | ------------- | -------------------------------------------------- |
| `outputDir`         | `string`      | Directory the final frames were written to.         |
| `frames`            | `FrameInfo[]` | Kept frames, renumbered `frame-0001…`.              |
| `extractedCount`    | `number`      | Raw frames pulled from ffmpeg.                      |
| `keptCount`         | `number`      | Frames kept after selection.                        |
| `droppedDuplicates` | `number`      | Frames dropped as near-duplicates.                  |
| `droppedBlurry`     | `number`      | Frames dropped by the blur gate.                    |

Each `FrameInfo` has `index`, `path`, `timestampSec`, `dHash` (16-hex-char), `sharpness` (Laplacian variance) and `keptReason` (`'first' | 'last' | 'scene-cut' | 'unique' | 'sampled'`).

### Building blocks

Individually exported and unit-tested:

- `isVideoFile(filename): boolean`
- `checkFfmpeg(ffmpegPath?): Promise<boolean>`
- `resolveFfmpegBinary(ffmpegPath?): Promise<string | null>`
- `computeDHash(imagePath): Promise<string>`
- `hammingDistance(hexA, hexB): number`
- `computeSharpness(imagePath): Promise<number>`

## How selection works

1. **Extract** — one ffmpeg pass samples frames at `fps`; first/last frames are pulled separately when `includeFirstLast` is on.
2. **Analyze** — compute a dHash and a Laplacian-variance sharpness score for every extracted frame.
3. **Blur gate** — if `blurThreshold` is set, drop frames below it (first/last are never dropped).
4. **Scene cuts** — if `sceneDetection` is on, mark frames whose downscaled mean-abs-diff from the previous frame ≥ `sceneThreshold` as force-keeps.
5. **Dedup** — sequentially keep a frame only if its Hamming distance from the last kept frame ≥ `dedupeThreshold`; force-keeps always survive.
6. **Budget** — if `maxFrames` is set, it caps only discretionary frames via evenly-spaced sampling; first, last and scene-cut transitions are always retained (so the kept count may exceed `maxFrames` when forced frames alone do).
7. **Write** — kept frames are renumbered to `frame-0001.<ext>` and all raw files are removed, so the output directory holds only the final set.

## Requirements

- Node.js >= 20
- An `ffmpeg` binary on `PATH`, or the optional `ffmpeg-static` dependency.

## Contributing

Contributions are welcome! Please read the [contributing guide](./CONTRIBUTING.md)
for development setup and the PR process, and note the
[Code of Conduct](./CODE_OF_CONDUCT.md). To report a security issue, see the
[security policy](./SECURITY.md).

## License

MIT © Dominik Rycharski

See [LICENSE](./LICENSE) for details.
