export type {
  FrameFormat,
  ExtractOptions,
  KeptReason,
  FrameInfo,
  ExtractResult,
} from './lib/extract.js';
export { extractFrames } from './lib/extract.js';
export {
  FRAME_FORMATS,
  LIMITS,
  DEFAULT_MAX_RAW_FRAMES,
  DEFAULT_MAX_DURATION_SEC,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_PROBE_TIMEOUT_MS,
  assertValidOptions,
  findOptionErrors,
} from './lib/options.js';
export { isVideoFile, VIDEO_EXTENSIONS } from './lib/video.js';
export { checkFfmpeg, resolveFfmpegBinary } from './lib/ffmpeg.js';
export { computeDHash, hammingDistance } from './lib/hash.js';
export { computeSharpness } from './lib/sharpness.js';
