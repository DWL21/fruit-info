import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.ts';

mkdirSync(config.dataDir, { recursive: true });
export const db = new Database(join(config.dataDir, 'fruit.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// 순서대로 한 번씩만 적용되는 마이그레이션
const migrations: string[] = [
  `CREATE TABLE stores (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL,
     aisle TEXT NOT NULL DEFAULT 'main' CHECK (aisle IN ('main','v1','v2')),
     position INTEGER NOT NULL,
     side TEXT NOT NULL CHECK (side IN ('A','B')),
     note TEXT,
     active INTEGER NOT NULL DEFAULT 1,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   );
   CREATE TABLE photos (
     id TEXT PRIMARY KEY,
     store_id INTEGER NOT NULL REFERENCES stores(id),
     width INTEGER NOT NULL,
     height INTEGER NOT NULL,
     status TEXT NOT NULL DEFAULT 'queued',
     read_store_name TEXT,
     model TEXT,
     duration_ms INTEGER,
     raw TEXT,
     error TEXT,
     attempts INTEGER NOT NULL DEFAULT 0,
     taken_at TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   );
   CREATE INDEX photos_store ON photos(store_id, taken_at);
   CREATE INDEX photos_status ON photos(status);
   CREATE TABLE observations (
     id INTEGER PRIMARY KEY,
     photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
     store_id INTEGER NOT NULL REFERENCES stores(id),
     item_slug TEXT NOT NULL,
     raw_name TEXT NOT NULL,
     variety TEXT,
     price INTEGER NOT NULL,
     unit TEXT,
     confidence REAL NOT NULL,
     price_box TEXT,
     product_box TEXT,
     crop INTEGER NOT NULL DEFAULT 0,
     hidden INTEGER NOT NULL DEFAULT 0,
     observed_at TEXT NOT NULL
   );
   CREATE INDEX obs_item ON observations(item_slug, observed_at);
   CREATE INDEX obs_store ON observations(store_id, observed_at);`,
  `ALTER TABLE stores ADD COLUMN address TEXT;
   ALTER TABLE stores ADD COLUMN kakao_id TEXT;
   ALTER TABLE stores ADD COLUMN lat REAL;
   ALTER TABLE stores ADD COLUMN lon REAL;
   CREATE UNIQUE INDEX stores_kakao ON stores(kakao_id) WHERE kakao_id IS NOT NULL;`,
];

db.exec('CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY)');
const applied = new Set(db.prepare('SELECT id FROM _migrations').pluck().all() as number[]);
migrations.forEach((sql, i) => {
  if (applied.has(i)) return;
  db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(i);
  })();
});

export const now = () => new Date().toISOString();
