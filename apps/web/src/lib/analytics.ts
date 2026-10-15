// 지표 도구는 빌드 환경 변수에 ID가 있을 때만 불러온다.
const env = import.meta.env;
const GA_ID = env.VITE_GA_ID as string | undefined;
const CLARITY_ID = env.VITE_CLARITY_ID as string | undefined;
const POSTHOG_KEY = env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';
const SENTRY_DSN = env.VITE_SENTRY_DSN as string | undefined;

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
  }
}

let posthog: typeof import('posthog-js').default | null = null;
const queue: [string, Props | undefined][] = [];

function addScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

export function initAnalytics() {
  if (import.meta.env.DEV) return;
  if (GA_ID) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // gtag는 arguments 객체를 그대로 넣어야 한다.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { send_page_view: false });
    addScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
  }
  if (CLARITY_ID) {
    const c = ((...args: unknown[]) => {
      (c.q = c.q ?? []).push(args);
    }) as NonNullable<Window['clarity']>;
    window.clarity = window.clarity ?? c;
    addScript(`https://www.clarity.ms/tag/${CLARITY_ID}`);
  }
  if (POSTHOG_KEY) {
    void import('posthog-js').then(({ default: ph }) => {
      ph.init(POSTHOG_KEY, { api_host: POSTHOG_HOST, capture_pageview: false, person_profiles: 'identified_only' });
      posthog = ph;
      for (const [name, props] of queue.splice(0)) ph.capture(name, props);
    });
  }
  if (SENTRY_DSN) {
    void import('@sentry/react').then((Sentry) =>
      Sentry.init({ dsn: SENTRY_DSN, environment: 'production', tracesSampleRate: 0.1 }),
    );
  }
}

export function track(name: string, props?: Props) {
  if (import.meta.env.DEV) return;
  window.gtag?.('event', name, props);
  window.clarity?.('event', name);
  if (posthog) posthog.capture(name, props);
  else if (POSTHOG_KEY) queue.push([name, props]);
}

/** 페이지 종류와 대상(과일·가게)을 함께 남겨 퍼널을 볼 수 있게 한다. */
export function trackPage(path: string) {
  if (import.meta.env.DEV) return;
  const [, kind = 'home', id] = path.split('?')[0]!.split('/');
  const props = { page: kind || 'home', target: id ?? null, path };
  window.gtag?.('event', 'page_view', { page_path: path, page_location: window.location.href, ...props });
  window.clarity?.('set', 'page', props.page);
  if (posthog) posthog.capture('$pageview', { ...props, $current_url: window.location.href });
  else if (POSTHOG_KEY) queue.push(['$pageview', { ...props, $current_url: window.location.href }]);
}
