/** KAMIS(aT 농산물유통정보) 도매 품목 → 우리 품목 사전 slug */
const BY_NAME: Record<string, string> = {
  사과: 'apple',
  배: 'pear',
  복숭아: 'peach',
  포도: 'grape',
  감귤: 'mandarin',
  단감: 'persimmon',
  바나나: 'banana',
  참다래: 'kiwi',
  키위: 'kiwi',
  파인애플: 'pineapple',
  오렌지: 'orange',
  자몽: 'grapefruit',
  레몬: 'lemon',
  체리: 'cherry',
  망고: 'mango',
  블루베리: 'blueberry',
  아보카도: 'avocado',
  수박: 'watermelon',
  참외: 'korean-melon',
  멜론: 'melon',
  딸기: 'strawberry',
  토마토: 'tomato',
  방울토마토: 'cherry-tomato',
  자두: 'plum',
};

export function wholesaleSlug(itemName: string, kindName: string): string | null {
  if (itemName === '포도' && /샤인/.test(kindName)) return 'shine-muscat';
  return BY_NAME[itemName.trim()] ?? null;
}

/** 품목 하나의 하루 도매가 (품종·등급별 한 줄) */
export interface WholesalePrice {
  slug: string;
  kind: string;
  rank: string;
  unit: string;
  price: number;
  /** 직전 거래일 가격 */
  prev: number | null;
}

export interface WholesaleDay {
  day: string | null;
  prevDay: string | null;
  /** 데이터가 있는 날 (최근순) */
  days: string[];
  items: { slug: string; name: string; emoji: string; prices: WholesalePrice[] }[];
}

export interface WholesaleHistory {
  series: { kind: string; rank: string; unit: string; points: { day: string; price: number }[] }[];
}
