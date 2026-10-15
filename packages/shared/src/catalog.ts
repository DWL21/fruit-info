// 표준 품목 사전. 모델이 읽은 이름을 별칭으로 정규화한다.
export interface CatalogItem {
  slug: string;
  name: string;
  emoji: string;
  aliases: string[];
}

export const CATALOG: CatalogItem[] = [
  { slug: 'apple', name: '사과', emoji: '🍎', aliases: ['부사', '홍로', '아오리', '시나노골드', '감홍', '양광', '썸머킹'] },
  { slug: 'pear', name: '배', emoji: '🍐', aliases: ['신고', '원황', '신고배'] },
  { slug: 'mandarin', name: '귤', emoji: '🍊', aliases: ['감귤', '하우스귤', '하우스감귤', '노지귤', '조생귤', '밀감', '경봉', '극조생'] },
  { slug: 'hallabong', name: '한라봉', emoji: '🍊', aliases: ['천혜향', '레드향', '황금향', '만감', '카라향'] },
  { slug: 'orange', name: '오렌지', emoji: '🍊', aliases: ['네이블', '네이블오렌지', '블러드오렌지'] },
  { slug: 'grape', name: '포도', emoji: '🍇', aliases: ['캠벨', '거봉', '머루포도', '하우스포도', '흑보석', '캠벨얼리'] },
  { slug: 'shine-muscat', name: '샤인머스캣', emoji: '🍇', aliases: ['샤인', '샤인머스켓', '청포도', '머스캣'] },
  { slug: 'strawberry', name: '딸기', emoji: '🍓', aliases: ['설향', '킹스베리', '금실', '죽향', '장희'] },
  { slug: 'watermelon', name: '수박', emoji: '🍉', aliases: ['애플수박', '흑수박', '망고수박'] },
  { slug: 'korean-melon', name: '참외', emoji: '🍈', aliases: ['성주참외'] },
  { slug: 'melon', name: '멜론', emoji: '🍈', aliases: ['머스크멜론', '하미과', '메론'] },
  { slug: 'peach', name: '복숭아', emoji: '🍑', aliases: ['백도', '황도', '천도', '천도복숭아', '납작복숭아', '신비복숭아'] },
  { slug: 'plum', name: '자두', emoji: '🍑', aliases: ['대석', '추희', '피자두'] },
  { slug: 'persimmon', name: '감', emoji: '🟠', aliases: ['단감', '홍시', '대봉', '대봉시', '연시', '반시', '곶감'] },
  { slug: 'kiwi', name: '키위', emoji: '🥝', aliases: ['참다래', '골드키위', '그린키위'] },
  { slug: 'banana', name: '바나나', emoji: '🍌', aliases: [] },
  { slug: 'pineapple', name: '파인애플', emoji: '🍍', aliases: [] },
  { slug: 'mango', name: '망고', emoji: '🥭', aliases: ['애플망고', '태국망고'] },
  { slug: 'blueberry', name: '블루베리', emoji: '🫐', aliases: [] },
  { slug: 'cherry', name: '체리', emoji: '🍒', aliases: [] },
  { slug: 'lemon', name: '레몬', emoji: '🍋', aliases: ['라임'] },
  { slug: 'grapefruit', name: '자몽', emoji: '🍊', aliases: [] },
  { slug: 'tomato', name: '토마토', emoji: '🍅', aliases: ['찰토마토', '완숙토마토', '대저토마토', '짭짤이'] },
  { slug: 'cherry-tomato', name: '방울토마토', emoji: '🍅', aliases: ['대추방울토마토', '대추토마토', '스테비아토마토'] },
  { slug: 'pomegranate', name: '석류', emoji: '🔴', aliases: [] },
  { slug: 'avocado', name: '아보카도', emoji: '🥑', aliases: [] },
  { slug: 'jujube', name: '대추', emoji: '🟤', aliases: ['사과대추', '생대추'] },
  { slug: 'chestnut', name: '밤', emoji: '🌰', aliases: ['알밤'] },
  { slug: 'fig', name: '무화과', emoji: '🟣', aliases: [] },
  { slug: 'quince', name: '모과', emoji: '🟡', aliases: [] },
  { slug: 'yuzu', name: '유자', emoji: '🟡', aliases: [] },
];

const norm = (s: string) => s.replace(/[\s·.,()\[\]-]/g, '').toLowerCase();

/** 모델이 읽은 품목명(+품종)을 표준 품목으로 매칭한다. 가장 긴 일치를 고른다. */
export function matchCatalog(raw: string, variety?: string | null): CatalogItem | null {
  const text = norm(`${raw}${variety ?? ''}`);
  const name = norm(raw);
  let best: { item: CatalogItem; score: number } | null = null;
  for (const item of CATALOG) {
    for (const key of [item.name, ...item.aliases]) {
      const k = norm(key);
      if (!k) continue;
      // 품목명 정확 일치가 최우선, 그다음 포함 관계의 길이
      const score = name === k ? 100 + k.length : text.includes(k) ? k.length : 0;
      if (score > 0 && (!best || score > best.score)) best = { item, score };
    }
  }
  // '감' 한 글자는 '감귤' 같은 단어에 잘못 걸리기 쉬워 단독 일치만 허용
  if (best?.item.slug === 'persimmon' && best.score === 1 && name !== '감') return null;
  return best?.item ?? null;
}
