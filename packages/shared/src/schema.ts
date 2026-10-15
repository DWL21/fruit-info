import { z } from 'zod';

/** 이미지 가로·세로를 각각 1000으로 정규화한 박스 */
export const Box = z.object({
  x: z.number().int().min(0).max(1000),
  y: z.number().int().min(0).max(1000),
  w: z.number().int().min(1).max(1000),
  h: z.number().int().min(1).max(1000),
});
export type Box = z.infer<typeof Box>;

const nullableBox = Box.nullable().catch(null);

/** 분석기가 반환하는 원시 결과. 모델 출력이라 관대하게 파싱한다. */
export const AnalysisItem = z.object({
  name: z.string().max(40).catch(''),
  variety: z.string().max(40).nullable().catch(null),
  price: z.number().int().positive().max(10_000_000).nullable().catch(null),
  unit: z.string().max(20).nullable().catch(null),
  confidence: z.number().min(0).max(1).catch(0.5),
  price_box: nullableBox,
  product_box: nullableBox,
});
export type AnalysisItem = z.infer<typeof AnalysisItem>;

export const Analysis = z.object({
  store_name: z.string().max(40).nullable().catch(null),
  items: z.array(AnalysisItem).max(40).catch([]),
  faces: z.array(Box).max(30).catch([]),
});
export type Analysis = z.infer<typeof Analysis>;

export const Aisle = z.enum(['main', 'v1', 'v2']);
export type Aisle = z.infer<typeof Aisle>;
export const Side = z.enum(['A', 'B']);
export type Side = z.infer<typeof Side>;

export const Store = z.object({
  id: z.number(),
  name: z.string(),
  aisle: Aisle,
  /** 통로 안에서의 순번 (1부터, market.ts 참고) */
  position: z.number(),
  side: Side,
  address: z.string().nullable(),
  note: z.string().nullable(),
  itemCount: z.number(),
  lastPhotoAt: z.string().nullable(),
});
export type Store = z.infer<typeof Store>;

export const StoreInput = z.object({
  name: z.string().trim().min(1, '가게 이름을 입력하세요').max(40),
  aisle: Aisle,
  position: z.number().int().min(0).max(500),
  side: Side,
  address: z.string().trim().max(60).nullable().optional(),
  note: z.string().trim().max(80).nullable().optional(),
});
export type StoreInput = z.infer<typeof StoreInput>;

export const Observation = z.object({
  id: z.number(),
  itemSlug: z.string(),
  storeId: z.number(),
  storeName: z.string(),
  storeAisle: Aisle,
  storePosition: z.number(),
  storeSide: Side,
  storeAddress: z.string().nullable(),
  rawName: z.string(),
  variety: z.string().nullable(),
  price: z.number(),
  unit: z.string().nullable(),
  confidence: z.number(),
  photoId: z.string(),
  photoUrl: z.string(),
  cropUrl: z.string().nullable(),
  priceBox: Box.nullable(),
  productBox: Box.nullable(),
  observedAt: z.string(),
});
export type Observation = z.infer<typeof Observation>;

export const ItemSummary = z.object({
  slug: z.string(),
  name: z.string(),
  emoji: z.string(),
  minPrice: z.number(),
  minUnit: z.string().nullable(),
  minStoreName: z.string(),
  storeCount: z.number(),
  cropUrl: z.string().nullable(),
  lastObservedAt: z.string(),
});
export type ItemSummary = z.infer<typeof ItemSummary>;

export const PhotoStatus = z.enum(['queued', 'analyzing', 'done', 'failed']);
export type PhotoStatus = z.infer<typeof PhotoStatus>;

export const Photo = z.object({
  id: z.string(),
  storeId: z.number(),
  storeName: z.string(),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  status: PhotoStatus,
  readStoreName: z.string().nullable(),
  itemCount: z.number(),
  error: z.string().nullable(),
  durationMs: z.number().nullable(),
  takenAt: z.string(),
});
export type Photo = z.infer<typeof Photo>;

export const ObservationPatch = z.object({
  hidden: z.boolean().optional(),
  itemSlug: z.string().optional(),
  price: z.number().int().min(100).max(10_000_000).optional(),
  unit: z.string().trim().max(20).nullable().optional(),
});
export type ObservationPatch = z.infer<typeof ObservationPatch>;

/** SSE 이벤트 */
export type LiveEvent =
  | { type: 'photo'; photo: Photo }
  | { type: 'prices'; storeId: number; itemSlugs: string[] };

/** 이 시간 안에 찍은 시세만 기본 목록에 보인다 */
export const VISIBLE_DAYS = 7;
