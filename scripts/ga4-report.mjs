#!/usr/bin/env node
// GA4 리포트 (CLI).
// Google이 gcloud 기본 앱의 GA 범위를 막아서, 서비스 계정 위임으로 토큰을 받는다.
//   1) gcloud auth login (일반 로그인)
//   2) 서비스 계정에 'Service Account Token Creator' 권한, GA4 속성에 그 계정을 '뷰어'로 추가
// 사용: GA4_SA=ga4-reader@<project>.iam.gserviceaccount.com [GA4_PROPERTY=123456789] node scripts/ga4-report.mjs [일수=7] [측정ID]
import { execFileSync } from 'node:child_process';

const days = Number(process.argv[2] ?? 7);
const measurementId = process.argv[3] ?? process.env.GA_MEASUREMENT_ID ?? 'G-22GE9YBSG6';
const gcloud = process.env.GCLOUD ?? 'gcloud';
const sa = process.env.GA4_SA;
if (!sa) throw new Error('GA4_SA(서비스 계정 이메일)를 지정하세요');

const token = execFileSync(
  gcloud,
  ['auth', 'print-access-token', `--impersonate-service-account=${sa}`, '--scopes=https://www.googleapis.com/auth/analytics.readonly'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
).trim();
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function get(url) {
  const res = await fetch(url, { headers });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${body.error?.message ?? ''}`);
  return body;
}

// 측정 ID로 GA4 속성을 찾는다. GA4_PROPERTY(숫자 속성 ID)를 주면 찾지 않고 그 속성을 쓴다.
async function findProperty() {
  if (process.env.GA4_PROPERTY) return { id: `properties/${process.env.GA4_PROPERTY.replace(/^properties\//, '')}`, name: 'GA4' };
  const { accountSummaries = [] } = await get('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200');
  for (const acc of accountSummaries) {
    for (const p of acc.propertySummaries ?? []) {
      const { dataStreams = [] } = await get(`https://analyticsadmin.googleapis.com/v1beta/${p.property}/dataStreams`);
      if (dataStreams.some((s) => s.webStreamData?.measurementId === measurementId)) return { id: p.property, name: p.displayName };
    }
  }
  throw new Error(`${measurementId} 속성을 찾지 못했습니다 — 서비스 계정 ${sa}가 GA4 속성 액세스 관리에 뷰어로 있는지 확인하세요 (보이는 계정 ${accountSummaries.length}개)`);
}

async function report(property, body) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }], ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${data.error?.message ?? ''}`);
  return data.rows ?? [];
}

const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const cells = (r) => [...(r.dimensionValues ?? []).map((v) => v.value), ...(r.metricValues ?? []).map((v) => v.value)];

const prop = await findProperty();
const [total] = await report(prop.id, { metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'averageSessionDuration' }] });
const pages = await report(prop.id, {
  dimensions: [{ name: 'pagePath' }],
  metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
  orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
  limit: 15,
});
const events = await report(prop.id, {
  dimensions: [{ name: 'eventName' }],
  metrics: [{ name: 'eventCount' }],
  orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
  limit: 15,
});
const devices = await report(prop.id, { dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }] });

const t = total ? total.metricValues.map((v) => v.value) : ['0', '0', '0', '0'];
console.log(`# GA4 리포트 — ${prop.name} (${prop.id}), 최근 ${days}일

- 활성 사용자 ${t[0]} · 세션 ${t[1]} · 페이지뷰 ${t[2]} · 평균 세션 ${Math.round(Number(t[3]))}초

## 페이지
${table(['경로', '페이지뷰', '사용자'], pages.map(cells))}

## 이벤트
${table(['이벤트', '횟수'], events.map(cells))}

## 기기
${table(['기기', '사용자'], devices.map(cells))}
`);
