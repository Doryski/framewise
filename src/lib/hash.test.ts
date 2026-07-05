import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { computeDHash, hammingDistance } from './hash.js';

let dir: string;

async function solidPath(name: string, value: number): Promise<string> {
  const buf = await sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: value, g: value, b: value } },
  })
    .png()
    .toBuffer();
  const p = join(dir, name);
  await writeFile(p, buf);
  return p;
}

async function gradientPath(name: string): Promise<string> {
  const width = 32;
  const height = 32;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = 255 - Math.floor((x / width) * 255);
      const i = (y * width + x) * 3;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }
  const buf = await sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const p = join(dir, name);
  await writeFile(p, buf);
  return p;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'framewise-hash-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('computeDHash', () => {
  it('returns a 16-char lowercase hex string', async () => {
    const hash = await computeDHash(await gradientPath('g1.png'));
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('gives an all-zero hash for a solid color (no left>right anywhere)', async () => {
    const hash = await computeDHash(await solidPath('s1.png', 120));
    expect(hash).toBe('0000000000000000');
  });

  it('differs between a solid image and a gradient image', async () => {
    const solid = await computeDHash(await solidPath('s2.png', 120));
    const gradient = await computeDHash(await gradientPath('g2.png'));
    expect(hammingDistance(solid, gradient)).toBeGreaterThan(0);
  });
});

describe('hammingDistance', () => {
  it('is 0 for identical hashes', () => {
    expect(hammingDistance('ffffffffffffffff', 'ffffffffffffffff')).toBe(0);
  });

  it('counts differing bits', () => {
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(hammingDistance('0000000000000000', '0000000000000001')).toBe(1);
    expect(hammingDistance('0000000000000000', '000000000000000f')).toBe(4);
  });

  it('throws when lengths differ', () => {
    expect(() => hammingDistance('ff', 'ffff')).toThrow();
  });
});
