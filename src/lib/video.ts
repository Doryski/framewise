export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.webm',
  '.mkv',
  '.m4v',
  '.flv',
  '.wmv',
  '.mpg',
  '.mpeg',
] as const;

export function isVideoFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
