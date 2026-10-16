import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'fruit-likes-'));
const { db } = await import('./db.ts');
const { app } = await import('./app.ts');

const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';
const photo = (id: string, takenAt: string, extra = '') =>
  db.prepare(`INSERT INTO photos (id, store_id, width, height, status, taken_at, created_at${extra ? ', held' : ''}) VALUES (?, 1, 10, 10, 'done', ?, ?${extra ? ', 1' : ''})`).run(id, takenAt, takenAt);
const like = (id: string, cid: string, method = 'PUT') => app.request(`/api/photos/${id}/like`, { method, headers: { 'x-client-id': cid } });
const feed = async (q: string, cid = A) => ((await (await app.request(`/api/feed?${q}`, { headers: { 'x-client-id': cid } })).json()) as { data: { photo: { id: string; likes: number }; liked: boolean }[] }).data;

beforeAll(() => {
  db.prepare(`INSERT INTO stores (id, name, aisle, position, side) VALUES (1, '테스트상회', 'main', 1, 'A')`).run();
  const t = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  photo('old', t(30));
  photo('new', t(5));
  photo('held', t(1), 'held');
});

describe('좋아요', () => {
  it('누르기·중복·취소', async () => {
    expect((await (await like('old', A)).json()).data).toEqual({ likes: 1, liked: true });
    expect((await (await like('old', A)).json()).data.likes).toBe(1);
    expect((await (await like('old', B)).json()).data.likes).toBe(2);
    expect((await (await like('old', B, 'DELETE')).json()).data).toEqual({ likes: 1, liked: false });
  });
  it('게시되지 않은 사진·잘못된 기기 id는 거부', async () => {
    expect((await like('held', A)).status).toBe(404);
    expect((await like('old', 'x')).status).toBe(400);
  });
  it('최신순·추천순', async () => {
    expect((await feed('sort=latest')).map((e) => e.photo.id)).toEqual(['new', 'old']);
    const pop = await feed('sort=popular');
    expect(pop.map((e) => e.photo.id)).toEqual(['old', 'new']);
    expect(pop[0]).toMatchObject({ liked: true, photo: { likes: 1 } });
    expect((await feed('sort=popular', B))[0]!.liked).toBe(false);
  });
});
