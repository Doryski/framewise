# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-05

### Added

- Initial release of `framewise`.
- `extractFrames(videoPath, outputDir, options?)` — extract, filter, and
  renumber video frames into a lean, deduplicated set.
- Perceptual-hash deduplication (dHash + Hamming distance).
- Optional Laplacian-variance blur filtering.
- Optional scene-cut detection to force-keep transition frames.
- `maxFrames` token-budget capping via deterministic even sampling.
- Zero-config ffmpeg resolution: system `ffmpeg` on `PATH` or the optional
  `ffmpeg-static` binary.
- `framewise` CLI with `--fps`, `--max-frames`, `--format`, `--quality`,
  `--blur-threshold`, `--scene-detection`, and `--json` flags.
- Exported building blocks: `isVideoFile`, `checkFfmpeg`,
  `resolveFfmpegBinary`, `computeDHash`, `hammingDistance`, `computeSharpness`.

[Unreleased]: https://github.com/doryski/framewise/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/doryski/framewise/releases/tag/v0.1.0
