import sharp from 'sharp';

export async function computeSharpness(imagePath: string): Promise<number> {
  const { data, info } = await sharp(imagePath)
    .greyscale()
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = data[y * width + x];
      const up = data[(y - 1) * width + x];
      const down = data[(y + 1) * width + x];
      const left = data[y * width + (x - 1)];
      const right = data[y * width + (x + 1)];
      const r = up + down + left + right - 4 * center;
      sum += r;
      sumSq += r * r;
      n++;
    }
  }

  if (n === 0) return 0;

  const mean = sum / n;
  return Math.max(0, sumSq / n - mean * mean);
}
