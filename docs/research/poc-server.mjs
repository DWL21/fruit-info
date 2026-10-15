import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.css': 'text/css' };

const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    store_name: { type: ['string', 'null'] },
    observations: {
      type: 'array', maxItems: 12,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          item_name: { type: 'string' }, price_krw: { type: ['integer', 'null'] },
          unit: { type: ['string', 'null'] }, confidence: { type: 'number' }, evidence: { type: 'string' },
          price_label_box: { type: ['object', 'null'], additionalProperties: false, properties: { x: { type: 'integer' }, y: { type: 'integer' }, width: { type: 'integer' }, height: { type: 'integer' } }, required: ['x', 'y', 'width', 'height'] },
          product_box: { type: ['object', 'null'], additionalProperties: false, properties: { x: { type: 'integer' }, y: { type: 'integer' }, width: { type: 'integer' }, height: { type: 'integer' } }, required: ['x', 'y', 'width', 'height'] }
        }, required: ['item_name', 'price_krw', 'unit', 'confidence', 'evidence', 'price_label_box', 'product_box']
      }
    },
    needs_review: { type: 'boolean' },
    note: { type: 'string' }
  }, required: ['store_name', 'observations', 'needs_review', 'note']
};

async function analyze(imageDataUrl) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. 서버 환경 변수에 키를 설정한 뒤 다시 시도하세요.');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.6-sol',
      input: [{ role: 'user', content: [
        { type: 'input_text', text: '청과물 시장 현장 사진을 분석해 가격표에서 확인되는 정보만 추출하세요. 추정하지 마세요. 가게 간판은 보이면 store_name에 넣으세요. 각 관측값은 품목명, 원화 정수 가격, 판매 단위, 0~1 confidence, 사진 속 근거 문구를 반환하세요. 또한 price_label_box와 product_box에 각각 가격표와 해당 매대의 위치를 이미지 가로·세로 1000 기준 정수 좌표(x, y, width, height)로 반환하세요. 가격표와 매대 연결이 불명확하면 두 박스 모두 null로 표시하세요. 읽기 어려운 가격·단위는 null 또는 낮은 confidence로 표시하세요. 사람의 얼굴, 전화번호, 개인 정보는 추출하거나 반환하지 마세요.' },
        { type: 'input_image', image_url: imageDataUrl, detail: 'high' }
      ] }],
      text: { format: { type: 'json_schema', name: 'market_price_observation', strict: true, schema } }
    })
  });
  if (!response.ok) throw new Error(`모델 요청 실패 (${response.status})`);
  const data = await response.json();
  return JSON.parse(data.output_text);
}

createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/analyze') {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 12_000_000) throw new Error('이미지 요청 크기가 너무 큽니다.'); }
      const result = await analyze(JSON.parse(raw).image);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(result));
    }
    const urlPath = req.url === '/' ? '/poc.html' : req.url.split('?')[0];
    const file = normalize(join(root, urlPath));
    if (!file.startsWith(root)) throw new Error('잘못된 경로입니다.');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (error) {
    res.writeHead(error.message.includes('잘못된') ? 400 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: error.message || '요청을 처리하지 못했습니다.' }));
  }
}).listen(port, () => console.log(`PoC: http://localhost:${port}`));
