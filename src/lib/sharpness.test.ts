import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { computeSharpness } from './sharpness.js';

let dir: string;

async function uniformPath(): Promise<string> {
  const buf = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .png()
    .toBuffer();
  const p = join(dir, 'uniform.png');
  await writeFile(p, buf);
  return p;
}

async function edgedBuffer(): Promise<Buffer> {
  const width = 64;
  const height = 64;
  const data = Buffer.alloc(width * height * 3, 30);
  for (let y = 3; y < height; y += 8) {
    for (let x = 3; x < width; x += 8) {
      const i = (y * width + x) * 3;
      data[i] = 235;
      data[i + 1] = 235;
      data[i + 2] = 235;
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

async function edgedPath(): Promise<string> {
  const buf = await edgedBuffer();
  const p = join(dir, 'edged.png');
  await writeFile(p, buf);
  return p;
}

async function negatedEdgedPath(): Promise<string> {
  const buf = await sharp(await edgedBuffer()).negate().png().toBuffer();
  const p = join(dir, 'edged-negated.png');
  await writeFile(p, buf);
  return p;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'framewise-sharp-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('computeSharpness', () => {
  it('scores a high-frequency edged image higher than a uniform gray image', async () => {
    const uniform = await computeSharpness(await uniformPath());
    const edged = await computeSharpness(await edgedPath());
    expect(edged).toBeGreaterThan(uniform);
  });

  it('scores a uniform image near zero', async () => {
    const uniform = await computeSharpness(await uniformPath());
    expect(uniform).toBeLessThan(1);
  });

  it('is invariant to contrast polarity (signed Laplacian, not uint8-clamped)', async () => {
    const edged = await computeSharpness(await edgedPath());
    const negated = await computeSharpness(await negatedEdgedPath());
    const ratio = edged / negated;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
  });
});
