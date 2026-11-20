export interface Term {
  id: string;
  deck: string;
  term: string;
  en: string;
  definition: string;
  example: string;
  exampleEn?: string;
  tags?: string[];
  aliases?: string[];
}

export interface Deck {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cards: Term[];
}

const DECK_META: Record<string, { name: string; icon: string; desc: string }> = {
  camera: { name: '카메라 워크', icon: '🎥', desc: '샷 크기, 앵글, 카메라 이동, 게임 카메라 시스템' },
  sword: { name: '검술·무기', icon: '⚔️', desc: '파지법, 자세, 베기·찌르기, 방어 동작' },
  combat: { name: '전투·액션', icon: '🥊', desc: '공격 프레임, 판정, 콤보, 전투 시스템' },
  animation: { name: '애니메이션·모션', icon: '🏃', desc: '애니메이션 원칙, 리깅, 블렌딩, 이동 모션' },
  gamefeel: { name: '타격감·게임필', icon: '💥', desc: '히트스톱, 화면 흔들림, 입력 반응성' },
  vfx: { name: '이펙트(VFX)', icon: '✨', desc: '파티클, 셰이더 이펙트, 트레일, 임팩트' },
  lighting: { name: '조명·렌더링', icon: '💡', desc: '조명 기법, 후처리, 렌더링 용어' },
  art: { name: '아트·스타일', icon: '🎨', desc: '아트 스타일, 셰이딩, 구도, 색' },
  level: { name: '레벨 디자인', icon: '🗺️', desc: '동선, 유도, 공간 구성, 페이싱' },
  ui: { name: 'UI·UX', icon: '📱', desc: 'HUD, 메뉴, 피드백, 화면 구성' },
  audio: { name: '사운드', icon: '🔊', desc: '효과음, 음악 구성, 믹싱' },
  system: { name: '게임 시스템·장르', icon: '🎮', desc: '장르, 진행 구조, 밸런스, 경제' },
};

const ORDER = Object.keys(DECK_META);

const modules = import.meta.glob('../data/*.json', { eager: true, import: 'default' }) as Record<string, Term[]>;

function load(): { decks: Deck[]; all: Term[]; byId: Map<string, Term> } {
  const byId = new Map<string, Term>();
  const seenEn = new Map<string, string>(); // deck+en -> id, to drop duplicates across files
  for (const list of Object.values(modules)) {
    for (const t of list) {
      if (!t || !t.id || !t.term || !t.deck) continue;
      const key = t.deck + '|' + (t.en || t.term).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
      if (byId.has(t.id) || seenEn.has(key)) continue;
      seenEn.set(key, t.id);
      byId.set(t.id, t);
    }
  }
  const groups = new Map<string, Term[]>();
  for (const t of byId.values()) {
    if (!groups.has(t.deck)) groups.set(t.deck, []);
    groups.get(t.deck)!.push(t);
  }
  const ids = [...groups.keys()].sort((a, b) => {
    const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
  });
  const decks = ids.map((id) => ({
    id,
    ...(DECK_META[id] ?? { name: id, icon: '📘', desc: '' }),
    cards: groups.get(id)!,
  }));
  return { decks, all: [...byId.values()], byId };
}

export const DATA = load();
