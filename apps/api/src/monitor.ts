import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
if (dsn) Sentry.init({ dsn, environment: 'production', tracesSampleRate: 0 });

/** SENTRY_DSN이 없으면 아무것도 하지 않는다. */
export function capture(error: unknown, context?: Record<string, unknown>) {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
