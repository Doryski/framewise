# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `maxRawFrames` (default `3000`) and `maxDurationSec` (default `1800`)
  options, passed to ffmpeg as `-frames:v` and an input-side `-t`, so a crafted
  video can no longer make the sampling pass write an unbounded number of frames.
- `timeoutMs` (default 5 minutes per ffmpeg run) and `probeTimeoutMs` (default
  30 seconds for the `ffmpeg -version` probe); a timed-out process is killed and
  the call rejects with a clear error.
- CLI flags `--max-raw-frames`, `--max-duration` and `--timeout`.
- Exported `FRAME_FORMATS`, `LIMITS`, `DEFAULT_MAX_RAW_FRAMES`,
  `DEFAULT_MAX_DURATION_SEC`, `DEFAULT_TIMEOUT_MS`, `DEFAULT_PROBE_TIMEOUT_MS`,
  `findOptionErrors` and `assertValidOptions`.

### Changed

- **Breaking:** options are validated before ffmpeg is spawned. `fps` must be
  in (0, 60], `maxFrames` a positive integer (`0` or negative values no longer
  silently disable the cap), `quality` in [0, 100]; invalid values throw.
- **Breaking:** requires Node.js >= 20.9.0.
- ffmpeg always runs with `-nostdin -y -hide_banner -loglevel error` and gets
  absolute input/output paths, so a leftover file can never trigger an
  interactive prompt and a path starting with `-` cannot be read as an option.

### Security

- Upgraded `sharp` from 0.33.5 to 0.35.5, picking up fixes for high-severity
  advisories in the bundled libvips, libheif and librsvg.

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
