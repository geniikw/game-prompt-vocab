import { useEffect, useMemo, useState } from 'react';
import { DATA, Deck, Term } from './data';
import {
  copyText, fmtInterval, getState, grade, Grade, isDue, newRemaining, previewInterval,
  resetProgress, toggleStar, updateSettings, useStore,
} from './store';

function useHash() {
  const [h, setH] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const f = () => { setH(location.hash.slice(1) || '/'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}
const go = (p: string) => { location.hash = p; };
const back = () => history.length > 1 ? history.back() : go('/');

let toastTimer: any;
function toast(msg: string) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}
function copy(text: string, label = '복사했어요') { copyText(text); toast(label); }

function cardsFor(scope: string): Term[] {
  if (scope === 'all') return DATA.all;
  if (scope === 'stars') return getState().stars.map((id) => DATA.byId.get(id)!).filter(Boolean);
  return DATA.decks.find((d) => d.id === scope)?.cards ?? [];
}
function deckName(scope: string) {
  if (scope === 'all') return '전체';
  if (scope === 'stars') return '즐겨찾기';
  return DATA.decks.find((d) => d.id === scope)?.name ?? scope;
}
function stats(cards: Term[]) {
  const st = getState();
  const now = Date.now();
  let due = 0, learned = 0, mature = 0;
  for (const c of cards) {
    const s = st.cards[c.id];
    if (!s) continue;
    learned++;
    if (s.due <= now) due++;
    if (s.interval >= 21) mature++;
  }
  return { due, learned, mature, total: cards.length, fresh: cards.length - learned };
}

export default function App() {
  const route = useHash();
  useStore();
  const [seg, a] = route.split('/').filter(Boolean);
  let page;
  switch (seg) {
    case 'deck': page = <DeckPage id={a} />; break;
    case 'study': page = <Study key={route} scope={a} />; break;
    case 'quiz': page = <Quiz key={route} scope={a} />; break;
    case 'card': page = <CardPage id={decodeURIComponent(a)} />; break;
    case 'search': page = <Search />; break;
    case 'stars': page = <Stars />; break;
    case 'settings': page = <SettingsPage />; break;
    default: page = <Home />;
  }
  const tab = seg === 'search' ? 'search' : seg === 'stars' ? 'stars' : seg === 'settings' ? 'settings' : 'home';
  const hideTabs = seg === 'study' || seg === 'quiz';
  return (
    <div className="app">
      <main className={hideTabs ? 'full' : ''}>{page}</main>
      {!hideTabs && (
        <nav className="tabs">
          <TabBtn on={tab === 'home'} icon="📚" label="학습" to="/" />
          <TabBtn on={tab === 'search'} icon="🔍" label="검색" to="/search" />
          <TabBtn on={tab === 'stars'} icon="⭐" label="즐겨찾기" to="/stars" />
          <TabBtn on={tab === 'settings'} icon="⚙️" label="설정" to="/settings" />
        </nav>
      )}
      <div id="toast" className="toast" />
    </div>
  );
}

function TabBtn({ on, icon, label, to }: { on: boolean; icon: string; label: string; to: string }) {
  return (
    <button className={'tab' + (on ? ' on' : '')} onClick={() => go(to)}>
      <span className="ti">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Header({ title, onBack, right }: { title: string; onBack?: boolean; right?: React.ReactNode }) {
  return (
    <header className="hdr">
      {onBack && <button className="iconbtn" onClick={back} aria-label="뒤로">←</button>}
      <h1>{title}</h1>
      <div className="hdr-r">{right}</div>
    </header>
  );
}

function Home() {
  const all = stats(DATA.all);
  const newLeft = Math.min(newRemaining(), all.fresh);
  return (
    <>
      <Header title="게임 용어 사전" />
      <section className="hero">
        <div className="hero-nums">
          <div><b>{all.due}</b><span>복습할 카드</span></div>
          <div><b>{newLeft}</b><span>오늘 새 카드</span></div>
          <div><b>{all.learned}</b><span>/{all.total} 학습함</span></div>
        </div>
        <button className="btn primary big" disabled={all.due + newLeft === 0} onClick={() => go('/study/all')}>
          {all.due + newLeft === 0 ? '오늘 학습 완료 🎉' : '오늘의 학습 시작'}
        </button>
        <button className="btn ghost" onClick={() => go('/quiz/all')}>전체 퀴즈 10문제</button>
      </section>
      <h2 className="sec">분야별 덱</h2>
      <div className="decks">
        {DATA.decks.map((d) => <DeckRow key={d.id} d={d} />)}
      </div>
    </>
  );
}

function DeckRow({ d }: { d: Deck }) {
  const s = stats(d.cards);
  const pct = Math.round((s.learned / s.total) * 100);
  return (
    <button className="deck" onClick={() => go('/deck/' + d.id)}>
      <span className="deck-ic">{d.icon}</span>
      <span className="deck-main">
        <span className="deck-name">{d.name}</span>
        <span className="deck-desc">{d.desc}</span>
        <span className="bar"><i style={{ width: pct + '%' }} /></span>
      </span>
      <span className="deck-meta">
        {s.due > 0 && <span className="pill due">{s.due}</span>}
        <span className="cnt">{s.learned}/{s.total}</span>
      </span>
    </button>
  );
}

function DeckPage({ id }: { id: string }) {
  const d = DATA.decks.find((x) => x.id === id);
  const [q, setQ] = useState('');
  if (!d) return <Header title="없는 덱" onBack />;
  const s = stats(d.cards);
  const list = q ? d.cards.filter((c) => match(c, q)) : d.cards;
  return (
    <>
      <Header title={`${d.icon} ${d.name}`} onBack />
      <section className="deck-actions">
        <p className="muted">{d.desc}</p>
        <div className="row">
          <button className="btn primary" onClick={() => go('/study/' + d.id)}>
            학습 {s.due > 0 ? `(복습 ${s.due})` : ''}
          </button>
          <button className="btn" onClick={() => go('/quiz/' + d.id)}>퀴즈</button>
        </div>
        <input className="search" placeholder={`${d.name}에서 찾기`} value={q} onChange={(e) => setQ(e.target.value)} />
      </section>
      <TermList list={list} />
    </>
  );
}

function TermList({ list }: { list: Term[] }) {
  const st = getState();
  if (!list.length) return <p className="empty">결과가 없어요.</p>;
  return (
    <ul className="terms">
      {list.map((c) => {
        const s = st.cards[c.id];
        return (
          <li key={c.id} onClick={() => go('/card/' + encodeURIComponent(c.id))}>
            <div className="t-top">
              <b>{c.term}</b>
              <span className="en">{c.en}</span>
              {st.stars.includes(c.id) && <span className="star">★</span>}
              {s && <span className={'dot ' + (s.interval >= 21 ? 'm' : 'l')} />}
            </div>
            <div className="t-def">{c.definition}</div>
          </li>
        );
      })}
    </ul>
  );
}

function norm(s: string) { return s.toLowerCase().replace(/[\s\-·_()]/g, ''); }
const PARTICLE = /(으로|에서|에게|처럼|하고|하는|하게|해서|이랑|랑|이가|은|는|이|가|을|를|로|에|의|도|와|과)$/;
function tokens(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean).map((t) => {
    const n = norm(t);
    return n.length > 2 ? n.replace(PARTICLE, '') : n;
  }).filter(Boolean);
}
function match(c: Term, q: string) {
  const hay = [c.term, c.en, c.definition, c.example, c.exampleEn ?? '', ...(c.tags ?? []), ...(c.aliases ?? [])].map(norm).join('|');
  const n = norm(q);
  if (hay.includes(n)) return true;
  const ts = tokens(q);
  return ts.length > 0 && ts.every((t) => hay.includes(t));
}

function Search() {
  const [q, setQ] = useState(() => sessionStorage.getItem('q') || '');
  useEffect(() => { try { sessionStorage.setItem('q', q); } catch {} }, [q]);
  const res = useMemo(() => {
    if (!q.trim()) return [];
    const n = norm(q);
    const hits = DATA.all.filter((c) => match(c, q));
    const score = (c: Term) => (norm(c.term).startsWith(n) || norm(c.en).startsWith(n) ? 0 : norm(c.term).includes(n) || norm(c.en).includes(n) ? 1 : 2);
    return hits.sort((a, b) => score(a) - score(b));
  }, [q]);
  return (
    <>
      <Header title="검색" />
      <section className="pad">
        <input autoFocus className="search" placeholder="용어, 영어, 설명으로 검색 (예: 달리, 패링)" value={q} onChange={(e) => setQ(e.target.value)} />
        {!q && <p className="muted">한국어 설명으로도 찾을 수 있어요. 예: "카메라 앞으로", "멈칫", "빛 번짐", "엄지"</p>}
        {q && <p className="muted">{res.length}개</p>}
      </section>
      <TermList list={res} />
    </>
  );
}

function Stars() {
  const st = useStore();
  const list = st.stars.map((id) => DATA.byId.get(id)!).filter(Boolean);
  return (
    <>
      <Header title="즐겨찾기" right={list.length > 0 && <button className="btn sm" onClick={() => go('/study/stars')}>학습</button>} />
      {!list.length ? <p className="empty">카드의 ☆를 눌러 즐겨찾기에 추가하세요.</p> : <TermList list={list} />}
    </>
  );
}

function claudePrompt(c: Term) {
  return `게임 개발 용어 "${c.term} (${c.en})"를 설명해줘. 정의, 비슷한 용어와의 차이, 실제 게임 사례, 그리고 이 용어를 써서 게임 개발 AI에게 줄 수 있는 프롬프트 예시 3개를 알려줘.`;
}

function TermDetail({ c }: { c: Term }) {
  const st = getState();
  const s = st.cards[c.id];
  const d = DATA.decks.find((x) => x.id === c.deck);
  return (
    <div className="detail">
      <div className="d-head">
        <div>
          <div className="d-term">{c.term}</div>
          <div className="d-en" onClick={() => copy(c.en, '영어 원어를 복사했어요')}>{c.en}</div>
        </div>
        <button className="iconbtn star-btn" onClick={() => toggleStar(c.id)}>{st.stars.includes(c.id) ? '★' : '☆'}</button>
      </div>
      <p className="d-def">{c.definition}</p>
      {!!c.aliases?.length && <p className="aliases">비슷한 말: {c.aliases.join(', ')}</p>}
      <div className="ex" onClick={() => copy(c.example, '예문을 복사했어요')}>
        <span className="lbl">프롬프트 예문 · 눌러서 복사</span>
        <p>{c.example}</p>
        {c.exampleEn && <p className="ex-en">{c.exampleEn}</p>}
      </div>
      <div className="d-foot">
        {d && <span className="chip" onClick={() => go('/deck/' + d.id)}>{d.icon} {d.name}</span>}
        {(c.tags ?? []).map((t) => <span key={t} className="chip ghost">#{t}</span>)}
      </div>
      <button className="btn ghost wide" onClick={() => copy(claudePrompt(c), 'Claude에게 물어볼 질문을 복사했어요')}>
        💬 Claude에게 더 물어보기 (질문 복사)
      </button>
      {s && <p className="muted small">다음 복습: {new Date(s.due).toLocaleDateString('ko-KR')} · 간격 {fmtInterval(s.interval)}</p>}
    </div>
  );
}

function CardPage({ id }: { id: string }) {
  const c = DATA.byId.get(id);
  return (
    <>
      <Header title="용어" onBack />
      {c ? <section className="pad"><TermDetail c={c} /></section> : <p className="empty">카드를 찾을 수 없어요.</p>}
    </>
  );
}

function buildQueue(scope: string): Term[] {
  const cards = cardsFor(scope);
  const st = getState();
  const now = Date.now();
  const due = cards.filter((c) => isDue(c.id, now)).sort((a, b) => st.cards[a.id].due - st.cards[b.id].due);
  // new cards: round-robin across decks so a mixed session isn't one deck at a time
  const byDeck = new Map<string, Term[]>();
  for (const c of cards) if (!st.cards[c.id]) (byDeck.get(c.deck) ?? byDeck.set(c.deck, []).get(c.deck)!).push(c);
  const order = DATA.decks.map((d) => d.id);
  const lanes = [...byDeck.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map((e) => e[1]);
  const fresh: Term[] = [];
  for (let k = 0; fresh.length < newRemaining() && lanes.some((l) => k < l.length); k++)
    for (const l of lanes) if (k < l.length && fresh.length < newRemaining()) fresh.push(l[k]);
  // interleave new cards among reviews
  const out: Term[] = [];
  let i = 0, j = 0;
  while (i < due.length || j < fresh.length) {
    if (i < due.length) out.push(due[i++]);
    if (i < due.length) out.push(due[i++]);
    if (j < fresh.length) out.push(fresh[j++]);
  }
  return out;
}

function Study({ scope }: { scope: string }) {
  const [queue, setQueue] = useState<Term[]>(() => buildQueue(scope));
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const mode = getState().settings.front;
  const c = queue[0];
  const showDef = useMemo(() => mode === 'definition' || (mode === 'mixed' && Math.random() < 0.5), [c?.id, mode]);

  function answer(g: Grade) {
    if (!c) return;
    grade(c.id, g);
    const rest = queue.slice(1);
    if (g === 0) rest.splice(Math.min(rest.length, 4), 0, c);
    setQueue(rest);
    setFlipped(false);
    if (g !== 0) setDone((n) => n + 1);
  }

  if (!c) {
    return (
      <>
        <Header title={deckName(scope)} onBack />
        <section className="finish">
          <div className="big-emoji">🎉</div>
          <h2>{done > 0 ? `${done}장 학습 완료!` : '지금 학습할 카드가 없어요'}</h2>
          <p className="muted">
            {newRemaining() === 0 ? '오늘의 새 카드 한도를 다 썼어요. 설정에서 늘릴 수 있어요.' : '복습할 카드가 생기면 다시 알려 드릴게요.'}
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => go('/quiz/' + scope)}>퀴즈 풀기</button>
            <button className="btn" onClick={back}>돌아가기</button>
          </div>
        </section>
      </>
    );
  }
  const isNew = !getState().cards[c.id];
  return (
    <>
      <Header title={deckName(scope)} onBack right={<span className="muted">{queue.length}장 남음</span>} />
      <section className="study">
        <div className={'flash' + (flipped ? ' flipped' : '')} onClick={() => !flipped && setFlipped(true)}>
          {isNew && <span className="badge">NEW</span>}
          {!flipped ? (
            showDef ? (
              <div className="front">
                <span className="lbl">이 설명에 맞는 용어는?</span>
                <p className="front-def">{c.definition}</p>
              </div>
            ) : (
              <div className="front">
                <span className="lbl">이 용어의 뜻은?</span>
                <div className="front-term">{c.term}</div>
                <div className="front-en">{c.en}</div>
              </div>
            )
          ) : (
            <TermDetail c={c} />
          )}
          {!flipped && <span className="tap">탭해서 정답 보기</span>}
        </div>
      </section>
      {flipped && (
        <div className="grades">
          {(['다시', '어려움', '알맞음', '쉬움'] as const).map((l, g) => (
            <button key={l} className={'g g' + g} onClick={() => answer(g as Grade)}>
              <b>{l}</b>
              <span>{fmtInterval(previewInterval(c.id, g as Grade))}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

interface Q { c: Term; opts: Term[]; reverse: boolean }

function makeQuiz(scope: string): Q[] {
  const cards = cardsFor(scope);
  const pool = cards.length >= 4 ? cards : DATA.all;
  return shuffle(cards).slice(0, 10).map((c) => {
    const same = pool.filter((x) => x.id !== c.id && x.deck === c.deck);
    const others = same.length >= 3 ? same : pool.filter((x) => x.id !== c.id);
    return { c, opts: shuffle([c, ...shuffle(others).slice(0, 3)]), reverse: Math.random() < 0.35 };
  });
}

function Quiz({ scope }: { scope: string }) {
  const [qs, setQs] = useState(() => makeQuiz(scope));
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<Term[]>([]);
  const q = qs[i];
  if (!qs.length) return <><Header title="퀴즈" onBack /><p className="empty">카드가 없어요.</p></>;
  if (!q) {
    return (
      <>
        <Header title={`${deckName(scope)} 퀴즈`} onBack />
        <section className="finish">
          <div className="big-emoji">{score >= 8 ? '🏆' : score >= 5 ? '👍' : '📖'}</div>
          <h2>{qs.length}문제 중 {score}개 정답</h2>
          {wrong.length > 0 && (
            <>
              <p className="muted">틀린 용어</p>
              <TermList list={wrong} />
            </>
          )}
          <div className="row">
            <button className="btn primary" onClick={() => { setQs(makeQuiz(scope)); setI(0); setPick(null); setScore(0); setWrong([]); }}>한 번 더</button>
            <button className="btn" onClick={back}>돌아가기</button>
          </div>
        </section>
      </>
    );
  }
  function choose(o: Term) {
    if (pick) return;
    setPick(o.id);
    if (o.id === q.c.id) setScore((s) => s + 1);
    else setWrong((w) => [...w, q.c]);
  }
  return (
    <>
      <Header title={`${deckName(scope)} 퀴즈`} onBack right={<span className="muted">{i + 1}/{qs.length}</span>} />
      <section className="pad quiz">
        <div className="qcard">
          {q.reverse ? (
            <><span className="lbl">이 용어의 뜻은?</span><div className="front-term">{q.c.term}</div><div className="front-en">{q.c.en}</div></>
          ) : (
            <><span className="lbl">이 설명에 맞는 용어는?</span><p className="front-def">{q.c.definition}</p></>
          )}
        </div>
        <div className="opts">
          {q.opts.map((o) => {
            const cls = !pick ? '' : o.id === q.c.id ? ' right' : o.id === pick ? ' wrong' : ' dim';
            return (
              <button key={o.id} className={'opt' + cls} onClick={() => choose(o)}>
                {q.reverse ? o.definition : <><b>{o.term}</b> <span className="en">{o.en}</span></>}
              </button>
            );
          })}
        </div>
        {pick && (
          <>
            <div className="ex"><span className="lbl">예문</span><p>{q.c.example}</p></div>
            <button className="btn primary wide" onClick={() => { setI(i + 1); setPick(null); }}>
              {i + 1 < qs.length ? '다음' : '결과 보기'}
            </button>
          </>
        )}
      </section>
    </>
  );
}

function SettingsPage() {
  const st = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Header title="설정" />
      <section className="pad settings">
        <label className="set">
          <span>하루 새 카드 수</span>
          <div className="stepper">
            <button onClick={() => updateSettings({ newPerDay: Math.max(0, st.settings.newPerDay - 5) })}>−</button>
            <b>{st.settings.newPerDay}</b>
            <button onClick={() => updateSettings({ newPerDay: Math.min(100, st.settings.newPerDay + 5) })}>+</button>
          </div>
        </label>
        <div className="set col">
          <span>카드 앞면</span>
          <div className="seg">
            {([['term', '용어 → 뜻'], ['definition', '뜻 → 용어'], ['mixed', '섞기']] as const).map(([v, l]) => (
              <button key={v} className={st.settings.front === v ? 'on' : ''} onClick={() => updateSettings({ front: v })}>{l}</button>
            ))}
          </div>
          <p className="muted small">"뜻 → 용어"는 설명을 보고 용어를 떠올리는 연습이라, 프롬프트에 용어를 직접 쓰는 데 더 도움이 돼요.</p>
        </div>
        <div className="set col">
          <span>수록 용어</span>
          <p className="muted small">{DATA.decks.length}개 분야 · {DATA.all.length}개 용어</p>
        </div>
        {!confirm ? (
          <button className="btn danger" onClick={() => setConfirm(true)}>학습 기록 초기화</button>
        ) : (
          <div className="row">
            <button className="btn danger" onClick={() => { resetProgress(); setConfirm(false); toast('초기화했어요'); }}>정말 초기화</button>
            <button className="btn" onClick={() => setConfirm(false)}>취소</button>
          </div>
        )}
      </section>
    </>
  );
}
