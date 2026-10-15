import { serve } from '@hono/node-server';
import { app } from './app.ts';
import { config } from './config.ts';
import { startQueue } from './queue.ts';

if (!config.uploadKey) console.warn('[config] UPLOAD_KEY가 없어 촬영 모드를 쓸 수 없습니다.');
startQueue();
serve({ fetch: app.fetch, port: config.port }, ({ port }) => console.log(`fruit-api :${port} (analyzer=${config.analyzer})`));
