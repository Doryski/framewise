import { describe, it, expect } from 'vitest';
import { isVideoFile } from './video.js';

describe('isVideoFile', () => {
  it('returns true for known video extensions (case-insensitive)', () => {
    expect(isVideoFile('clip.mp4')).toBe(true);
    expect(isVideoFile('CLIP.MOV')).toBe(true);
    expect(isVideoFile('/a/b/movie.webm')).toBe(true);
    expect(isVideoFile('recording.mkv')).toBe(true);
  });

  it('returns false for non-video files', () => {
    expect(isVideoFile('photo.png')).toBe(false);
    expect(isVideoFile('doc.pdf')).toBe(false);
    expect(isVideoFile('archive.mp4.zip')).toBe(false);
    expect(isVideoFile('noextension')).toBe(false);
  });
});
