import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Box } from '@fruit/shared';
import { config } from './config.ts';
export { cropBox } from './geometry.ts';

export const dirs = {
  originals: join(config.dataDir, 'originals'),
  photos: join(config.dataDir, 'photos'),
  previews: join(config.dataDir, 'previews'),
  crops: join(config.dataDir, 'crops'),
};
Object.values(dirs).forEach((d) => mkdirSync(d, { recursive: true }));

export const originalPath = (id: string) => join(dirs.originals, `${id}.jpg`);
export const photoPath = (id: string) => join(dirs.photos, `${id}.jpg`);
export const cropPath = (obsId: number) => join(dirs.crops, `${obsId}.jpg`);

export const photoUrl = (id: string) => `${config.publicUrl}/media/photos/${id}.jpg`;
export const previewPath = (id: string) => join(dirs.previews, `${id}.jpg`);
export const previewUrl = (id: string) => `${config.publicUrl}/media/previews/${id}.jpg`;

/** 분석(얼굴 흐림) 전에 피드에 바로 보여줄, 얼굴을 알아볼 수 없게 흐린 작은 미리보기 */
export async function makePreview(id: string) {
  await sharp(originalPath(id)).resize({ width: 320, height: 320, fit: 'inside' }).blur(10).jpeg({ quality: 60 }).toFile(previewPath(id));
}
export const cropUrl = (obsId: number) => `${config.publicUrl}/media/crops/${obsId}.jpg`;

/** 업로드 원본을 회전 보정·리사이즈하고 메타데이터(GPS 등)를 지워 비공개 원본으로 저장한다. */
export async function saveOriginal(id: string, input: Buffer) {
  const { info } = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(originalPath(id))
    .then((info) => ({ info }));
  return { width: info.width, height: info.height };
}

const toPx = (b: Box, w: number, h: number, pad = 0) => {
  const px = Math.round(((b.x - pad) / 1000) * w);
  const py = Math.round(((b.y - pad) / 1000) * h);
  const pw = Math.round(((b.w + pad * 2) / 1000) * w);
  const ph = Math.round(((b.h + pad * 2) / 1000) * h);
  const left = Math.max(0, Math.min(w - 1, px));
  const top = Math.max(0, Math.min(h - 1, py));
  return { left, top, width: Math.max(1, Math.min(w - left, pw)), height: Math.max(1, Math.min(h - top, ph)) };
};

/** 얼굴 영역을 흐리게 한 공개 사진을 만든다. */
export async function publishPhoto(id: string, faces: Box[]) {
  const base = sharp(originalPath(id));
  const { width = 0, height = 0 } = await base.metadata();
  const overlays = await Promise.all(
    faces.map(async (f) => {
      const r = toPx(f, width, height, 15);
      const input = await sharp(originalPath(id)).extract(r).blur(Math.max(12, r.width / 6)).toBuffer();
      return { input, left: r.left, top: r.top };
    }),
  );
  await sharp(originalPath(id)).composite(overlays).jpeg({ quality: 82, mozjpeg: true }).toFile(photoPath(id));
}

export async function makeCrop(photoId: string, obsId: number, box: Box) {
  const img = sharp(photoPath(photoId));
  const { width = 0, height = 0 } = await img.metadata();
  await img
    .extract(toPx(box, width, height))
    .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(cropPath(obsId));
}
