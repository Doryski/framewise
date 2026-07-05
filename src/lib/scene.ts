import sharp from 'sharp';

const SCENE_WIDTH = 64;
const SCENE_HEIGHT = 36;

export async function downscaleGrey(imagePath: string): Promise<Buffer> {
  const { data } = await sharp(imagePath)
    .greyscale()
    .resize(SCENE_WIDTH, SCENE_HEIGHT, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

export function sceneDiffBuffers(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n / 255;
}

export async function sceneDiff(pathA: string, pathB: string): Promise<number> {
  const [a, b] = await Promise.all([downscaleGrey(pathA), downscaleGrey(pathB)]);
  return sceneDiffBuffers(a, b);
}
