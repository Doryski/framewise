export type {
  FrameFormat,
  ExtractOptions,
  KeptReason,
  FrameInfo,
  ExtractResult,
} from './lib/extract.js';
export { extractFrames } from './lib/extract.js';
export { isVideoFile, VIDEO_EXTENSIONS } from './lib/video.js';
export { checkFfmpeg, resolveFfmpegBinary } from './lib/ffmpeg.js';
export { computeDHash, hammingDistance } from './lib/hash.js';
export { computeSharpness } from './lib/sharpness.js';
