import './monitor.ts';
import { serve } from '@hono/node-server';
import { app } from './app.ts';
import { config } from './config.ts';
import { startQueue } from './queue.ts';
import { seedStores } from './seed.ts';

if (!config.uploadKey) console.warn('[config] UPLOAD_KEY가 없어 촬영 모드를 쓸 수 없습니다.');
const seeded = seedStores();
if (seeded) console.log(`[seed] 가게 ${seeded}곳 반영`);
startQueue();
serve({ fetch: app.fetch, port: config.port }, ({ port }) => console.log(`fruit-api :${port} (analyzer=${config.analyzer})`));
