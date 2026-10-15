import { resolve } from 'node:path';

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 8787),
  dataDir: resolve(env.DATA_DIR ?? './data'),
  publicUrl: (env.PUBLIC_URL ?? 'http://localhost:8787').replace(/\/$/, ''),
  corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  uploadKey: env.UPLOAD_KEY ?? '',
  analyzer: (env.ANALYZER ?? 'mock') as 'codex' | 'mock',
  codexBin: env.CODEX_BIN ?? 'codex',
  codexModel: env.CODEX_MODEL ?? 'gpt-6.1-sol',
  concurrency: Math.max(1, Number(env.ANALYZE_CONCURRENCY ?? 2)),
};
