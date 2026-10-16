/** 좋아요용 기기 id: 브라우저에 저장한 무작위 값 (개인정보 아님) */
const KEY = 'fruit.clientId';
let memory: string | null = null;

export function clientId(): string {
  if (memory) return memory;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return (memory = saved);
  } catch {
    /* 저장 불가 환경 */
  }
  memory = crypto.randomUUID();
  try {
    localStorage.setItem(KEY, memory);
  } catch {
    /* 이 탭에서만 유지 */
  }
  return memory;
}
