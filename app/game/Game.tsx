"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ITEMS, TRAITS, GATHER, LOCKED_PLACES, RECIPES, CROPS, MOBS, SPELLS, FIELDS, QUALITY, ARTISANS, PLAYER,
  SEED_TRADES, HUNT_SEED, EXPO_SEED, CHAT_SEED, type RecipeCat, type Field,
} from "./data.ts";
import * as L from "./logic.ts";
import type { State, Equip, Batch } from "./logic.ts";

const SAVE_KEY = "mcm-demo-v1", LOCK_KEY = "mcm-demo-tab";
type Act = (fn: (d: State, now: number) => void) => void;
type Go = (screen: Screen) => void;
type Screen = "town" | "work" | "farm" | "hunt" | "char" | "inv" | "skills" | "school" | "market" | "artisan" | "guild" | "bank" | "records" | "dev";
const NAV: [Screen, string, string][] = [
  ["town", "마을", "🏘️"], ["work", "작업", "⛏️"], ["farm", "농장", "🌾"], ["hunt", "사냥터", "⚔️"],
  ["char", "캐릭터", "🧙"], ["inv", "가방", "🎒"], ["skills", "숙련도", "📈"], ["school", "학교", "🏫"],
  ["market", "시장", "⚖️"], ["artisan", "장인·의뢰", "📜"], ["guild", "길드", "🛡️"], ["bank", "은행", "🏦"],
  ["records", "업적·기록", "🏆"], ["dev", "개발 옵션", "🛠️"],
];
const MOBILE_NAV: Screen[] = ["town", "work", "inv", "char", "hunt"];
const Q_STYLE = ["text-zinc-400 border-zinc-600", "text-slate-200 border-slate-500", "text-emerald-300 border-emerald-600", "text-sky-300 border-sky-500", "text-amber-300 border-amber-500"];
const n1 = (v: number) => +v.toFixed(1);

// ───────── 공통 UI ─────────
function Panel({ title, children, right }: { title?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      {title && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">{title}</h2>{right}</div>}
      {children}
    </section>
  );
}
function Btn({ children, onClick, disabled, kind = "base", title }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "base" | "gold" | "ghost"; title?: string }) {
  const k = kind === "gold" ? "border-gold bg-gold/15 text-gold hover:bg-gold/25" : kind === "ghost" ? "border-transparent text-sub hover:text-ink" : "border-line bg-raised hover:border-sub";
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      className={`min-h-9 rounded-lg border px-3 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${k}`}>
      {children}
    </button>
  );
}
function QTag({ q }: { q: number }) {
  return <span className={`rounded border px-1 text-[11px] leading-4 ${Q_STYLE[q]}`}>{QUALITY[q]}</span>;
}
function Icon({ def, q }: { def: string; q?: number }) {
  return (
    <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-raised text-lg" aria-hidden>
      {ITEMS[def].icon}
      {q !== undefined && <span className={`absolute -bottom-1 -right-1 rounded border bg-panel px-0.5 text-[9px] leading-3 ${Q_STYLE[q]}`}>{QUALITY[q][0]}</span>}
    </span>
  );
}
function Bar({ v, max, color = "bg-gold", label }: { v: number; max: number; color?: string; label?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-raised" role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemax={Math.round(max)}>
      <div className={`h-full ${color} transition-[width] duration-200 motion-reduce:transition-none`} style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} />
    </div>
  );
}
function Demo({ children = "데모" }: { children?: ReactNode }) {
  return <span className="rounded bg-violet-500/20 px-1.5 text-[11px] text-violet-300">{children}</span>;
}
function Unavailable({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line p-3 text-sm text-sub">🔒 {children} <span className="text-xs">(미구현 · 사용 불가)</span></div>;
}
const makerLabel = (def: string, name?: string) => {
  if (!name) return null;
  const cat = ITEMS[def].cat;
  const verb = cat === "bar" ? "제련" : cat === "gem" ? "세공" : cat === "weapon" || cat === "heart" ? "제작" : cat === "crop" || cat === "fish" ? "수확" : "제작";
  return `${verb}: ${name}`;
};
function EquipLine({ e }: { e: Equip }) {
  const d = ITEMS[e.def];
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon def={e.def} q={e.q} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {L.equipName(e)} {e.gems.length > 0 && <span className="text-xs text-sub">보석 {e.gems.filter(Boolean).length}/{e.gems.length}</span>}
          {e.locked && <span className="ml-1 text-xs text-amber-300">🔒{e.locked}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-sub">
          <QTag q={e.q} />
          {e.makerName && <span>{makerLabel(e.def, e.makerName)}</span>}
          {d.maxDur ? <span className={L.isBroken(e) ? "text-red-400" : ""}>내구도 {Math.floor(e.dur)}/{d.maxDur}{L.isBroken(e) && " · 사용 불가"}</span> : null}
        </div>
      </div>
    </div>
  );
}

// ───────── 루트 ─────────
export default function Game() {
  const [s, setS] = useState<State | null>(null);
  const [now, setNow] = useState(0);
  const [screen, setScreen] = useState<Screen>("town");
  const [summary, setSummary] = useState<string | null>(null);
  const [otherTab, setOtherTab] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [workTab, setWorkTab] = useState<string>("채집");
  const [returnRecipe, setReturnRecipe] = useState<string | null>(null);
  const tabId = useRef(""); // 첫 틱에서 생성
  const lastTick = useRef(0);
  const lastSave = useRef(0);

  useEffect(() => {
    const t = Date.now();
    let st: State | null = null;
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) st = JSON.parse(raw); } catch { st = null; }
    if (!st || st.v !== 1) st = L.newState(t);
    L.dailyCheck(st, t);
    const sum = L.offlineCatchUp(st, t);
    lastTick.current = t;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장소에서 1회 복원
    setS(st); setNow(t); setSummary(sum);
  }, []);

  // 게임 루프: 실제 경과시간으로 진행(타이머 호출 횟수와 무관)
  useEffect(() => {
    if (!s) return;
    const id = setInterval(() => {
      const t = Date.now();
      tabId.current ||= Math.random().toString(36);
      // 다중 탭 보호: 한 탭만 진행
      try {
        const lock = JSON.parse(localStorage.getItem(LOCK_KEY) ?? "null");
        if (lock && lock.id !== tabId.current && t - lock.at < 3000) { setOtherTab(true); lastTick.current = t; return; }
        localStorage.setItem(LOCK_KEY, JSON.stringify({ id: tabId.current, at: t }));
      } catch { /* 저장소 불가 시 단일 탭으로 간주 */ }
      setOtherTab(false);
      const dt = Math.max(0, Math.min(5000, Math.round(t - lastTick.current)));
      lastTick.current = t;
      setNow(t);
      setS((p) => {
        if (!p) return p;
        const d = structuredClone(p);
        L.dailyCheck(d, t);
        L.workTick(d, dt, t, true);
        L.combatTick(d, dt, t);
        if (d.combat?.end === "승리" && d.combat.auto) { const mob = d.combat.mob; L.startCombat(d, mob); }
        d.lastSeen = t;
        return d;
      });
    }, 200);
    return () => clearInterval(id);
  }, [s !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!s || otherTab || now - lastSave.current < 1000) return;
    lastSave.current = now;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* 저장 실패는 다음 틱에 재시도 */ }
  }, [s, now, otherTab]);

  const act: Act = (fn) => setS((p) => { if (!p) return p; const d = structuredClone(p); fn(d, Date.now()); return d; });
  const go: Go = (x) => { setScreen(x); window.scrollTo({ top: 0 }); };

  if (!s) return <div className="flex min-h-screen items-center justify-center text-sub">마을로 가는 중… (불러오는 중)</div>;
  const b = L.build(s, now);
  const clock = L.gameClock(s, now);

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* 상단 상태 */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
          <div className="flex items-center gap-2 font-semibold"><span className="text-gold">MCM</span> 마을 경제 RPG <Demo>데모 · 로컬 저장</Demo></div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            <span title="골드">🪙 <b className="text-gold">{s.gold.toLocaleString()}</b></span>
            <Stat label="HP" v={s.hp} max={b.maxHp} color="bg-red-500" />
            <Stat label="MP" v={s.mp} max={b.maxMp} color="bg-sky-500" />
            <Stat label="포만감" v={s.satiety} max={100} color="bg-amber-500" />
            <span className="text-sub" title={`다음 전환까지 ${L.fmtMs(clock.nextSwitch)}`}>{clock.night ? "🌙 밤" : "☀️ 낮"} · {clock.season} <span className="hidden lg:inline">({L.fmtMs(clock.nextSwitch)} 후 전환)</span></span>
            {s.work && (
              <button className="rounded-md border border-line px-2 py-0.5 text-xs hover:border-gold" onClick={() => go("work")}>
                {s.work.paused ? "⏸" : "▶"} {L.workDef(s.work).name} {Math.floor(s.work.progress * 100)}%
              </button>
            )}
            {s.combat && !s.combat.end && <button className="rounded-md border border-red-500/60 px-2 py-0.5 text-xs" onClick={() => go("hunt")}>⚔️ 전투 중</button>}
          </div>
        </div>
      </header>

      {otherTab && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-sm rounded-xl border border-line bg-panel p-5 text-center">
            <p className="mb-2 font-semibold">다른 탭에서 게임이 진행 중입니다</p>
            <p className="mb-4 text-sm text-sub">진행이 중복되지 않도록 이 탭은 멈춰 있습니다. 다른 탭을 닫으면 자동으로 이어집니다.</p>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 md:grid-cols-[180px_1fr] xl:grid-cols-[180px_1fr_300px]">
        <nav className="hidden md:block" aria-label="이동">
          <ul className="sticky top-16 space-y-1">
            {NAV.map(([k, label, icon]) => (
              <li key={k}>
                <button onClick={() => go(k)} aria-current={screen === k ? "page" : undefined}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ${screen === k ? "bg-gold/15 text-gold" : "text-sub hover:bg-raised hover:text-ink"}`}>
                  <span aria-hidden>{icon}</span>{label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 space-y-4">
          {summary && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-gold/50 bg-gold/10 p-3 text-sm">
              <div><b>복귀 요약</b> · {summary}</div>
              <Btn kind="ghost" onClick={() => setSummary(null)}>닫기</Btn>
            </div>
          )}
          {screen === "town" && <Town s={s} act={act} go={go} />}
          {screen === "work" && <WorkScreen s={s} now={now} act={act} go={go} tab={workTab} setTab={setWorkTab} returnRecipe={returnRecipe} setReturnRecipe={setReturnRecipe} />}
          {screen === "farm" && <Farm s={s} now={now} act={act} />}
          {screen === "hunt" && <Hunt s={s} now={now} act={act} />}
          {screen === "char" && <Character s={s} now={now} act={act} />}
          {screen === "inv" && <Inventory s={s} now={now} act={act} />}
          {screen === "skills" && <Skills s={s} />}
          {screen === "school" && <School s={s} now={now} act={act} />}
          {screen === "market" && <Market s={s} act={act} />}
          {screen === "artisan" && <Artisan s={s} act={act} />}
          {screen === "guild" && <Guild s={s} act={act} go={go} />}
          {screen === "bank" && <Bank s={s} act={act} />}
          {screen === "records" && <Records s={s} />}
          {screen === "dev" && <Dev act={act} go={go} />}
          <div className="xl:hidden"><ActivityLog s={s} /></div>
        </main>

        <aside className="hidden space-y-4 xl:block">
          <ActivityLog s={s} />
          <Chat open onToggle={() => {}} />
        </aside>
      </div>

      {/* 모바일 하단 탐색 + 접는 채팅 */}
      <div className="fixed bottom-16 right-3 z-30 xl:hidden">
        {chatOpen && <div className="mb-2 w-[min(92vw,340px)]"><Chat open onToggle={() => setChatOpen(false)} /></div>}
        <button className="ml-auto block rounded-full border border-line bg-panel px-3 py-2 text-sm shadow md:hidden" onClick={() => setChatOpen(!chatOpen)} aria-expanded={chatOpen}>💬 지역 채팅</button>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg md:hidden" aria-label="주요 이동">
        {MOBILE_NAV.map((k) => {
          const [, label, icon] = NAV.find((x) => x[0] === k)!;
          return (
            <button key={k} onClick={() => go(k)} aria-current={screen === k ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center text-xs ${screen === k ? "text-gold" : "text-sub"}`}>
              <span className="text-lg" aria-hidden>{icon}</span>{label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
function Stat({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-xs text-sub">{label}</span>
      <span className="w-14"><Bar v={v} max={max} color={color} label={label} /></span>
      <span className="text-xs tabular-nums">{Math.floor(v)}/{Math.floor(max)}</span>
    </span>
  );
}
function ActivityLog({ s }: { s: State }) {
  return (
    <Panel title="알림">
      <ul className="max-h-60 space-y-1 overflow-y-auto text-xs text-sub" aria-live="polite">
        {s.log.length ? s.log.slice(0, 15).map((x, i) => <li key={i} className={i === 0 ? "text-ink" : ""}>{x}</li>) : <li>아직 소식이 없습니다.</li>}
      </ul>
    </Panel>
  );
}
function Chat({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [msgs, setMsgs] = useState(CHAT_SEED);
  const [text, setText] = useState("");
  if (!open) return null;
  return (
    <Panel title={<>지역 채팅 <Demo>시드 메시지</Demo></>} right={<button className="text-xs text-sub xl:hidden" onClick={onToggle}>접기</button>}>
      <ul className="mb-2 max-h-40 space-y-1 overflow-y-auto text-xs">
        {msgs.map((m, i) => <li key={i}><b className="text-gold">{m.who}</b> {m.text}</li>)}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { setMsgs([...msgs, { who: PLAYER.name, text: text.trim() }]); setText(""); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder="메시지 (100자)" aria-label="채팅 입력"
          className="min-w-0 flex-1 rounded-md border border-line bg-raised px-2 py-1 text-sm" />
        <Btn>전송</Btn>
      </form>
    </Panel>
  );
}

// ───────── 마을 ─────────
function Town({ s, act, go }: { s: State; act: Act; go: Go }) {
  const places: [Screen, string, string, string][] = [
    ["work", "⛏️", "광산", "구리·철 채광, 희귀 보석 원석"], ["work", "🎣", "낚시터", "마을 강에서 붕어 낚시"],
    ["work", "🔨", "공방", "제련·세공·제작·요리·연금"], ["farm", "🌾", "농장", "4×4 밭과 닭장"],
    ["hunt", "🌲", "사냥터", "마을 숲 · 슬라임과 늑대"], ["school", "🏫", "학교", "오늘의 수업과 스크롤 해석실"],
    ["market", "⚖️", "시장", "거래소와 왕국 상점"], ["artisan", "📜", "장인 명부", "공방 등록과 제작 의뢰"],
    ["guild", "🛡️", "길드", "납품·토벌·박람회"], ["bank", "🏦", "은행", "보관함과 거래 기록"],
  ];
  return (
    <>
      {!s.starter && (
        <Panel title="환영합니다, 새벽님">
          <p className="mb-3 text-sm text-sub">MCM 왕국의 작은 마을에 오신 것을 환영합니다. 시작 보급을 받고 광산에서 첫 원석을 캐 보세요.</p>
          <Btn kind="gold" onClick={() => act((d) => L.claimStarter(d))}>🎁 시작 보급 수령 (철 원석 20 · 수지 3 · 불의 보석 원석 1)</Btn>
        </Panel>
      )}
      {s.work && (
        <Panel title="진행 중인 작업">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{L.workDef(s.work).name} · {s.work.done}{s.work.repeat ? `/${s.work.repeat}` : ""}회 완료</span>
            <Btn kind="gold" onClick={() => go("work")}>작업으로 복귀</Btn>
          </div>
        </Panel>
      )}
      <Panel title="마을">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {places.map(([k, icon, name, desc]) => (
            <button key={name} onClick={() => go(k)} className="rounded-xl border border-line bg-raised p-3 text-left transition-colors duration-150 hover:border-gold">
              <div className="text-2xl" aria-hidden>{icon}</div>
              <div className="mt-1 font-medium">{name}</div>
              <div className="text-xs text-sub">{desc}</div>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="마을 우물">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-sub">맑은 물은 무료로 받을 수 있습니다 (거래 불가). 보유 {L.count(s, "mat_water")}</span>
          <Btn onClick={() => act((d) => L.give(d, { def: "mat_water", qty: 10, q: 1 }))}>💧 10개 받기</Btn>
        </div>
      </Panel>
      <Panel title="이번 주 MCM 사건">
        <p className="text-sm"><b>독안개 토벌 주간</b> — 늪의 군주가 깨어났습니다. 해독 재료와 요리 수요가 늘어납니다. 길드 보급과 토벌 기록이 게시판에 공개됩니다.</p>
        <p className="mt-1 text-xs text-sub">방송 시청은 필수가 아니며 기간 안에 언제든 참여할 수 있습니다.</p>
      </Panel>
    </>
  );
}

// ───────── 작업 ─────────
const WORK_TABS = ["채집", "제련", "세공", "제작", "요리", "연금"] as const;
function WorkScreen({ s, now, act, go, tab, setTab, returnRecipe, setReturnRecipe }: {
  s: State; now: number; act: Act; go: Go; tab: string; setTab: (t: string) => void; returnRecipe: string | null; setReturnRecipe: (r: string | null) => void;
}) {
  return (
    <>
      <ActiveWork s={s} now={now} act={act} />
      {returnRecipe && tab !== RECIPES[returnRecipe].cat && (
        <div className="flex items-center justify-between rounded-lg border border-gold/50 bg-gold/10 p-2 text-sm">
          <span>재료를 모은 뒤 <b>{ITEMS[RECIPES[returnRecipe].out].name}</b> 레시피로 돌아갈 수 있습니다.</span>
          <Btn kind="gold" onClick={() => { setTab(RECIPES[returnRecipe].cat); setReturnRecipe(null); }}>레시피로 돌아가기</Btn>
        </div>
      )}
      <div className="flex flex-wrap gap-1" role="tablist">
        {WORK_TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? "bg-gold/15 text-gold" : "text-sub hover:bg-raised"}`}>{t}</button>
        ))}
      </div>
      {tab === "채집" ? <GatherList s={s} act={act} /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {Object.keys(RECIPES).filter((r) => RECIPES[r].cat === (tab as RecipeCat)).map((r) => (
            <RecipeCard key={r} id={r} s={s} act={act} onFetch={(def) => {
              setReturnRecipe(r);
              const ore = Object.values(GATHER).find((g) => g.out === def);
              const rec = Object.keys(RECIPES).find((x) => RECIPES[x].out === def && s.recipes.includes(x));
              if (ore) setTab("채집"); else if (rec) setTab(RECIPES[rec].cat); else if (ITEMS[def].cat === "crop") go("farm"); else go("market");
            }} />
          ))}
        </div>
      )}
    </>
  );
}
function ActiveWork({ s, now, act }: { s: State; now: number; act: Act }) {
  const [pulse, setPulse] = useState(0);
  const w = s.work;
  if (!w) return <Panel title="현재 작업"><p className="text-sm text-sub">진행 중인 작업이 없습니다. 아래에서 대상을 골라 시작하세요. 한 번에 하나의 주요 작업만 수행합니다.</p></Panel>;
  const def = L.workDef(w), sp = L.workSpeed(s, w, now, true), cyc = L.cycleMs(s, w, now, true);
  const key = w.target, info = L.levelInfo(s.xp[key] ?? 0);
  const out = w.kind === "gather" ? GATHER[w.target].out : RECIPES[w.target].out;
  const tool = w.kind === "gather" ? s.equips.find((e) => e.def === GATHER[w.target].tool && !L.isBroken(e)) : null;
  return (
    <Panel title={<>현재 작업 · {def.name}</>} right={<span className="text-xs text-sub">{w.done}{w.repeat ? `/${w.repeat}` : ""}회 완료</span>}>
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <button
          onClick={() => { act((d, t) => L.clickBoost(d, t)); setPulse((p) => p + 1); }}
          disabled={w.paused}
          aria-label={`${ITEMS[out].name} 작업 대상 두드리기: 3초간 작업 속도 +20%`}
          className="group relative flex aspect-square items-center justify-center rounded-2xl border-2 border-line bg-raised text-6xl transition-transform duration-150 active:scale-95 disabled:opacity-50 motion-reduce:transition-none"
        >
          <span key={pulse} className={pulse ? "animate-[tap_180ms_ease-out] motion-reduce:animate-none" : ""}>{ITEMS[out].icon}</span>
          {sp.boosted && <span className="absolute inset-0 rounded-2xl ring-2 ring-gold" />}
          <span className="absolute bottom-2 text-xs text-sub">클릭·Enter로 가속</span>
        </button>
        <div className="space-y-2 text-sm">
          <Bar v={w.progress} max={1} label="작업 진행" />
          <div className="flex flex-wrap justify-between gap-2">
            <span>{w.paused ? "일시정지됨" : `남은 시간 ${((1 - w.progress) * cyc / 1000).toFixed(1)}초`}</span>
            <span className="text-sub">회당 {(cyc / 1000).toFixed(2)}초 (기본 {def.sec}초)</span>
          </div>
          <div className={sp.boosted ? "text-gold" : "text-sub"}>
            클릭 가속 {sp.boosted ? `활성 · ${((s.boostUntil - now) / 1000).toFixed(1)}초 남음 (+20%, 중첩 없음)` : "비활성 · 대상을 누르면 3초간 +20%"}
          </div>
          <div className="text-xs text-sub">속도 보정: {sp.parts.length ? sp.parts.map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}%`).join(" · ") : "없음"} → 최종 ×{sp.mult.toFixed(3)}</div>
          <div className="text-xs text-sub">개별 숙련 Lv.{info.lv} ({info.into}/{info.need} XP) · {FIELDS[def.field as Field]} Lv.{L.fieldLv(s, def.field as Field)} · 회당 개별 10 XP, 분야 {def.sec} XP</div>
          {w.reserved && <div className="text-xs text-sub">예약된 재료: {w.reserved.map((b) => `${ITEMS[b.def].name}×${b.qty}`).join(", ")} (취소 시 반환)</div>}
          {tool && <div className="text-xs text-sub">도구: {ITEMS[tool.def].name} 내구도 {Math.floor(tool.dur)}/100 (20회당 1 마모)</div>}
          <div className="text-xs text-sub">포만감 {Math.floor(s.satiety)} · 회당 0.2 소모 · 효율 {Math.round(L.satietyEff(s.satiety) * 100)}%</div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Btn onClick={() => act((d) => { if (d.work) d.work.paused = !d.work.paused; })}>{w.paused ? "▶ 재개" : "⏸ 일시정지"}</Btn>
            <Btn onClick={() => act((d) => { if (d.work) d.work.stopAfter = !d.work.stopAfter; })}>{w.stopAfter ? "✔ 이번 회차 후 중단 예약됨" : "이번 회차 후 중단"}</Btn>
            <Btn onClick={() => act((d) => { L.cancelWork(d); L.log(d, "작업 즉시 중단 (예약 재료 반환, 보상 없음)"); })}>■ 즉시 중단</Btn>
          </div>
        </div>
      </div>
    </Panel>
  );
}
function GatherList({ s, act }: { s: State; act: Act }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(GATHER).map(([id, g]) => {
          const lv = L.indivLv(s, id), eff = L.masteryEffect(lv), err = L.canStart(s, "gather", id);
          return (
            <Panel key={id} title={<span className="flex items-center gap-2"><Icon def={g.out} />{g.name}</span>}>
              <div className="space-y-1 text-xs text-sub">
                <div>{g.loc} · 기본 {g.sec}초 · 도구 {ITEMS[g.tool].name}</div>
                <div>개별 Lv.{lv}: 속도 +{n1(eff.speed)}% · 추가 1개 {n1(eff.extra)}%</div>
                {g.rare && <div>희귀: {ITEMS[g.rare.id].name} {g.rare.p * 100}% (별도 판정)</div>}
                <div>보유 {L.count(s, g.out)}</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Btn kind="gold" disabled={!!err || s.work?.target === id} onClick={() => act((d) => L.startWork(d, "gather", id, 0))}>{s.work?.target === id ? "진행 중" : s.work ? "대상 변경" : "자동 작업 시작"}</Btn>
              </div>
              {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
            </Panel>
          );
        })}
      </div>
      <Panel title="잠긴 장소">
        <ul className="space-y-1 text-sm">
          {LOCKED_PLACES.map((p) => <li key={p.name} className="text-sub">🔒 <b className="text-ink">{p.name}</b> — {p.info} · 조건: {p.cond}</li>)}
        </ul>
      </Panel>
    </div>
  );
}
function RecipeCard({ id, s, act, onFetch }: { id: string; s: State; act: Act; onFetch: (def: string) => void }) {
  const [rep, setRep] = useState(1);
  const [sturdy, setSturdy] = useState(false);
  const r = RECIPES[id], out = ITEMS[r.out];
  if (!s.recipes.includes(id)) {
    return (
      <Panel title={<span className="flex items-center gap-2 text-sub"><Icon def={r.out} />{out.name} (미등록)</span>}>
        <p className="text-xs text-sub">🔒 도면 획득처: {r.source}. 등록 전에는 재료 요구량이 공개되지 않습니다.</p>
      </Panel>
    );
  }
  const runs = s.runs[id] ?? 0, info = L.levelInfo(s.xp[id] ?? 0);
  const score = Math.min(100, L.masteryEffect(info.lv).score);
  const dist = L.qualityDist(score);
  const miss = L.missing(s, id, rep, sturdy);
  const err = L.canStart(s, "recipe", id, sturdy);
  const ins = L.recipeInputs(id, sturdy);
  return (
    <Panel title={<span className="flex items-center gap-2"><Icon def={r.out} />{out.name}{r.qty > 1 ? ` ×${r.qty}` : ""}</span>} right={<span className="text-xs text-sub">{r.sec * (sturdy ? 1.5 : 1)}초</span>}>
      <ul className="space-y-1 text-sm">
        {ins.map(([d, n]) => {
          const have = L.count(s, d), need = n * rep;
          return (
            <li key={d} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><Icon def={d} />{ITEMS[d].name} ×{n}</span>
              <span className={have >= need ? "text-sub" : "text-red-400"}>
                {have}/{need}
                {have < need && <button className="ml-2 text-xs text-gold underline" onClick={() => onFetch(d)}>구하러 가기</button>}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 text-xs text-sub">개별 숙련 Lv.{info.lv} · 숙련 점수 {n1(score)} · 암기 {Math.min(runs, 10)}/10{runs >= 10 ? " ✔ (시간 -2%)" : ""} · 제작 표시 “{makerLabel(r.out, PLAYER.name)}”</div>
      <div className="mt-2" aria-label="예상 품질 분포">
        <div className="mb-1 text-xs text-sub">예상 품질 (보통 재료 기준)</div>
        <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
          {dist.map((p, q) => <div key={q} className={`rounded border px-1 py-0.5 ${Q_STYLE[q]}`}>{QUALITY[q]}<br />{n1(p)}%</div>)}
        </div>
      </div>
      {id === "recipe_iron_sword" && (
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={sturdy} onChange={(e) => setSturdy(e.target.checked)} />
          박람회 전용 견고 제작 (철 주괴 +1, 시간 +50%, 테마 점수 40)
        </label>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-sub">반복
          <input type="number" min={1} max={99} value={rep} onChange={(e) => setRep(Math.max(1, Math.min(99, +e.target.value || 1)))}
            className="w-14 rounded border border-line bg-raised px-1 py-0.5 text-ink" />회
        </label>
        <Btn kind="gold" disabled={!!err} onClick={() => act((d) => L.startWork(d, "recipe", id, rep, sturdy))}>{s.work ? "대상 변경" : "제작 시작"}</Btn>
        {miss.length > 0 && !err && <span className="text-xs text-amber-300">{rep}회분 중 일부 재료 부족 — 소진 시 자동 중단</span>}
      </div>
      {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
    </Panel>
  );
}

// ───────── 농장 ─────────
function Farm({ s, now, act }: { s: State; now: number; act: Act }) {
  const [seed, setSeed] = useState("seed_wheat");
  const seeds = Object.keys(CROPS);
  return (
    <>
      <Panel title="농장 4×4" right={<span className="text-xs text-sub">생육 중에는 포만감 소모 없음 · 다 자란 작물은 썩지 않음</span>}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-sm">씨앗
            <select value={seed} onChange={(e) => setSeed(e.target.value)} className="ml-2 rounded border border-line bg-raised px-2 py-1">
              {seeds.map((x) => <option key={x} value={x}>{ITEMS[x].name} (보유 {L.count(s, x)}) · {CROPS[x].min}분</option>)}
            </select>
          </label>
          <Btn onClick={() => act((d, t) => d.farm.forEach((p, i) => !p.seed && L.plant(d, i, seed, t)))}>빈 칸 모두 심기</Btn>
          <Btn kind="gold" onClick={() => act((d, t) => d.farm.forEach((_, i) => L.harvest(d, i, t)))}>일괄 수확</Btn>
        </div>
        <div className="grid max-w-md grid-cols-4 gap-2">
          {s.farm.map((p, i) => {
            const ready = p.seed && p.readyAt <= now;
            return (
              <button key={i} onClick={() => act((d, t) => (p.seed ? L.harvest(d, i, t) : L.plant(d, i, seed, t)))}
                aria-label={p.seed ? `${CROPS[p.seed].name} ${ready ? "수확 가능" : "생육 중"}` : "빈 밭: 심기"}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs ${ready ? "border-gold bg-gold/10" : "border-line bg-[#2a2216]"}`}>
                {p.seed ? <><span className="text-2xl">{ready ? ITEMS[CROPS[p.seed].out].icon : "🌱"}</span>{ready ? "수확!" : L.fmtMs(p.readyAt - now)}</> : <span className="text-sub">빈 밭</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-sub">변종 확률: 기본 0.5% + 농부 숙련 보너스(최대 +2%p). 황금 밀·은빛 약초는 수확 1개를 대체합니다.</p>
      </Panel>
      <Panel title="닭장">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-2xl" aria-hidden>🐔</span>
          {s.chickenReadyAt === null ? <><span className="text-sub">밀 1개를 주면 10분 후 달걀 2개</span><Btn onClick={() => act((d, t) => L.feedChicken(d, t))}>사료 주기</Btn></>
            : s.chickenReadyAt > now ? <span className="text-sub">달걀까지 {L.fmtMs(s.chickenReadyAt - now)}</span>
              : <Btn kind="gold" onClick={() => act((d, t) => L.collectEggs(d, t))}>달걀 줍기</Btn>}
        </div>
      </Panel>
      <Panel title="농장 확장">
        <Unavailable>6×6 밭 — 조건: 농부 스킬 Lv.50 <b>그리고</b> 농장 허가증 (또는 확장 퀘스트 완료)</Unavailable>
      </Panel>
    </>
  );
}

// ───────── 사냥 ─────────
function Hunt({ s, now, act }: { s: State; now: number; act: Act }) {
  const c = s.combat;
  const b = L.build(s, now);
  if (!c || c.end) {
    return (
      <>
        {c?.end && <Panel title={`전투 결과: ${c.end}`}><ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-sub">{c.log.slice(0, 8).map((x, i) => <li key={i}>{x}</li>)}</ul></Panel>}
        <Panel title="마을 숲">
          <p className="mb-3 text-xs text-sub">기본 공격은 자동입니다. 스킬·포션으로 개입하세요. 사냥 중에는 생산 작업이 멈추며, 오프라인 사냥은 진행되지 않습니다. 현재 공격력 {n1(b.atk)} · 화염 {b.fire} · 방어 {n1(b.def)} · 공격속도 {n1(b.speed)}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["mob_slime", "mob_wolf"] as const).map((m) => (
              <div key={m} className="rounded-lg border border-line bg-raised p-3 text-sm">
                <div className="font-medium">{MOBS[m].name}</div>
                <div className="text-xs text-sub">HP {MOBS[m].hp} · 공격 {MOBS[m].atk} · 방어 {MOBS[m].def} · 속도 {MOBS[m].speed}</div>
                <div className="text-xs text-sub">보상: {ITEMS[MOBS[m].drop].name}, {ITEMS[MOBS[m].heart!].name} 1%</div>
                <div className="mt-2"><Btn kind="gold" onClick={() => act((d) => L.startCombat(d, m))}>사냥 시작 (자동 반복)</Btn></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="다른 사냥터"><ul className="space-y-1 text-sm text-sub"><li>🔒 독안개 늪 — 늪 독거미 · 조건: 탐사 퀘스트</li><li>🔒 수정 동굴 — 수정 골렘·별가루 · 조건: 탐사 퀘스트</li></ul></Panel>
      </>
    );
  }
  const m = MOBS[c.mob];
  const spells = s.school.learned.slice(0, 3);
  const potions = s.inv.filter((x) => ITEMS[x.def].cat === "potion");
  return (
    <Panel title={<>{c.hunt ? "🛡️ 길드 토벌 · " : ""}{m.name}</>} right={<span className="text-xs text-sub">전투 {(c.t / 1000).toFixed(1)}초{c.limit ? ` / ${c.limit / 1000}초` : ""}</span>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>{m.name}</span><span className="tabular-nums">{Math.max(0, Math.ceil(c.mobHp))}/{c.mobMax}</span></div>
          <Bar v={c.mobHp} max={c.mobMax} color="bg-red-500" label="적 체력" />
          {(c.pShield > 0 || m.pShield) && <div className="text-xs text-sub">물리 방어막 {n1(c.pShield)}</div>}
          {(c.mShield > 0 || m.mShield) && <div className="text-xs text-sub">마법 방어막 {n1(c.mShield)}</div>}
          <div className="text-xs text-sub">행동 게이지</div>
          <Bar v={c.mG} max={L.GAUGE_FULL} color="bg-zinc-400" label="적 행동 게이지" />
          {m.boss && <p className="text-xs text-amber-300">행동 예고: 20초마다 전체 중독 (10초간 2초마다 HP 2)</p>}
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>새벽</span><span className="tabular-nums">HP {Math.ceil(s.hp)}/{Math.floor(b.maxHp)} · MP {Math.floor(s.mp)}</span></div>
          <Bar v={s.hp} max={b.maxHp} color="bg-red-500" label="내 체력" />
          <div className="text-xs text-sub">행동 게이지 {c.pending ? `· 예약: ${SPELLS[c.pending].name}` : ""}</div>
          <Bar v={c.pG} max={L.GAUGE_FULL} label="내 행동 게이지" />
          <div className="text-xs text-sub">
            {c.poison && "☠️ 중독 · "}{c.defBuffUntil > c.t && "🪨 방어 +4 · "}{c.myMShield && `🌙 마법 방어막 ${c.myMShield.amt} · `}
            행동 {c.pActs}회 / 적 {c.mActs}회
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {spells.length === 0 && <span className="text-xs text-sub">배운 마법이 없습니다 (학교에서 습득).</span>}
        {spells.map((id) => {
          const sp = SPELLS[id], cd = (c.cds[id] ?? 0) - c.t;
          return <Btn key={id} disabled={s.mp < sp.mp || cd > 0} onClick={() => act((d) => L.queueSpell(d, id))}>✨ {sp.name} (MP {sp.mp}){cd > 0 ? ` ${Math.ceil(cd / 1000)}초` : ""}</Btn>;
        })}
        {potions.map((p) => (
          <Btn key={p.id} disabled={c.potionAt > c.t} onClick={() => act((d, t) => L.eat(d, p.id, t))}>
            {ITEMS[p.def].icon} {ITEMS[p.def].name} ×{p.qty}{c.potionAt > c.t ? ` (${Math.ceil((c.potionAt - c.t) / 1000)}초)` : ""}
          </Btn>
        ))}
        <Btn kind="ghost" disabled title="음식은 전투 중 사용할 수 없습니다">🍞 음식 (전투 중 불가)</Btn>
        {!c.hunt && <Btn onClick={() => act((d) => { if (d.combat) d.combat.auto = !d.combat.auto; })}>{c.auto ? "자동 반복 켬" : "자동 반복 끔"}</Btn>}
        <Btn onClick={() => act((d) => L.flee(d))}>🏃 도주</Btn>
      </div>
      <p className="mt-1 text-xs text-sub">스킬은 다음 행동을 대체합니다 (예약 1개). 포션은 행동을 소비하지 않으며 공용 재사용 10초.</p>
      <ul className="mt-3 max-h-48 space-y-0.5 overflow-y-auto rounded-lg bg-raised p-2 text-xs text-sub" aria-live="polite">
        {c.log.map((x, i) => <li key={i} className={i === 0 ? "text-ink" : ""}>{x}</li>)}
      </ul>
    </Panel>
  );
}

// ───────── 캐릭터 ─────────
function Character({ s, now, act }: { s: State; now: number; act: Act }) {
  const b = L.build(s, now);
  const w = s.equips.find((e) => e.id === s.weapon), h = s.equips.find((e) => e.id === s.heart);
  const gems = s.inv.filter((x) => ITEMS[x.def].cat === "gem");
  const others = s.equips.filter((e) => ["weapon", "heart"].includes(ITEMS[e.def].cat) && e.id !== s.weapon && e.id !== s.heart);
  const slot = (e: Equip | undefined, label: string) => {
    if (!e) return <div className="text-sm text-sub">{label}: 없음</div>;
    const c = L.equipContribution(e);
    return (
      <div className="rounded-lg border border-line bg-raised p-3">
        <div className="mb-1 text-xs text-sub">{label}</div>
        <EquipLine e={e} />
        <div className="mt-2 space-y-0.5 text-xs">
          {c.lines.map((x) => <div key={x}>{x}</div>)}
          {c.traits.map((t, i) => <div key={i}><b>{t.name}</b> <span className="text-sub">— {t.effect} / 출처: {t.src}</span></div>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {e.gems.map((g, i) => g
            ? <Btn key={i} onClick={() => act((d) => L.removeGem(d, e.id, i))} title="보석 추출제 1개 소비, 보석은 보존">홈{i + 1}: {ITEMS[g.def].name}({QUALITY[g.q]}) 추출</Btn>
            : <span key={i} className="rounded border border-dashed border-line px-2 py-1 text-xs text-sub">홈{i + 1} 비어 있음</span>)}
        </div>
        {e.gems.includes(null) && gems.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {gems.map((g) => <Btn key={g.id} kind="gold" onClick={() => act((d) => L.socketGem(d, e.id, g.id))}>{ITEMS[g.def].name}({QUALITY[g.q]}) 장착 → {TRAITS[ITEMS[g.def].trait!].name} Lv.{L.gemLevel(g.q)}</Btn>)}
          </div>
        )}
        {e.history.length > 0 && <details className="mt-2 text-xs text-sub"><summary>가공 기록</summary>{e.history.map((x, i) => <div key={i}>{x}</div>)}</details>}
      </div>
    );
  };
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="장비 (무기 1 · 심장 1)">
          <div className="space-y-3">{slot(w, "무기")}{slot(h, "심장")}</div>
          <p className="mt-2 text-xs text-sub">작업 도구는 활동별로 자동 선택되며 전투 능력치에 합산하지 않습니다.</p>
        </Panel>
        <Panel title="최종 능력치">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {([["최대 체력", n1(b.maxHp)], ["최대 MP", n1(b.maxMp)], ["공격력", n1(b.atk)], ["화염 공격력", b.fire], ["방어력", n1(b.def)], ["공격속도", `×${n1(b.speed)}`],
              ["명중률", `${Math.round(b.hit * 100)}%`], ["치명타 확률", "5%"], ["치명타 공격력", "150%"], ["마법 치명타", "5% / 150%"]] as [string, ReactNode][]).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line/50 py-0.5"><dt className="text-sub">{k}</dt><dd className="tabular-nums">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-sub">계산 순서: 기본(HP 100·MP 30·공격 2·방어 1) + 장비 기본 × 품질 배율 → 특성 고정 가산 → 비율(분노) → 제한</p>
          <h3 className="mb-1 mt-4 text-sm font-semibold">적용 특성 합계</h3>
          {b.traits.length === 0 && <p className="text-xs text-sub">없음</p>}
          <ul className="space-y-2 text-sm">
            {b.traits.map((t) => (
              <li key={t.t} className="rounded-lg bg-raised p-2">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <b>{TRAITS[t.t].name} Lv.{t.eff}{t.raw > t.eff && <span className="text-xs text-amber-300"> (보유 {t.raw}, 초과 {t.raw - t.eff} 비활성)</span>}</b>
                  <span className={`text-xs ${t.active ? "text-emerald-300" : "text-sub"}`}>{t.reason} · {TRAITS[t.t].kind}</span>
                </div>
                <div className="text-xs">{L.traitEffectText(t.t, t.eff)}</div>
                {t.eff === 5 && TRAITS[t.t].drawback5 && <div className="text-xs text-red-300">{TRAITS[t.t].drawback5}</div>}
                <div className="text-xs text-sub">출처: {t.sources.join(" · ")}</div>
                {t.raw >= 5 && TRAITS[t.t].drawback5 && (
                  <label className="mt-1 flex items-center gap-1 text-xs"><input type="checkbox" checked={s.traitCap[t.t] === 4} disabled={!!s.combat && !s.combat.end}
                    onChange={(e) => act((d) => { if (e.target.checked) d.traitCap[t.t] = 4; else delete d.traitCap[t.t]; })} />적용 상한 4로 제한 (마을에서만)</label>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-sub">같은 특성은 레벨을 먼저 합친 뒤 최종 단계 효과를 한 번 적용합니다. 장비별 단독 기여의 합과 다를 수 있습니다.</p>
          {s.workBuff && s.workBuff.until > now && <p className="mt-2 text-xs">🍲 작업식: {s.workBuff.name} (채광 속도 +5%, {L.fmtMs(s.workBuff.until - now)})</p>}
        </Panel>
      </div>
      <Panel title="장비 교체 (장착 후 비교)">
        {others.length === 0 && <p className="text-sm text-sub">교체할 장비가 없습니다.</p>}
        <ul className="space-y-2">
          {others.map((e) => {
            const isW = ITEMS[e.def].cat === "weapon";
            const nb = L.build(s, now, isW ? e.id : s.weapon, isW ? s.heart : e.id);
            const diff = (a: number, c: number) => { const v = n1(a - c); return v ? <span className={v > 0 ? "text-emerald-300" : "text-red-300"}>{v > 0 ? "+" : ""}{v}</span> : <span className="text-sub">±0</span>; };
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-raised p-2">
                <EquipLine e={e} />
                <span className="text-xs">공격 {n1(nb.atk)} ({diff(nb.atk, b.atk)}) · 화염 {nb.fire} ({diff(nb.fire, b.fire)}) · HP {n1(nb.maxHp)} ({diff(nb.maxHp, b.maxHp)}) · 방어 {n1(nb.def)} ({diff(nb.def, b.def)})
                  <span className="text-sub"> · 특성 {nb.traits.map((t) => `${TRAITS[t.t].name}${t.eff}`).join(" ") || "없음"}</span></span>
                <Btn kind="gold" disabled={!!e.locked || (!!s.combat && !s.combat.end)} onClick={() => act((d) => L.equip(d, e.id))}>장착</Btn>
              </li>
            );
          })}
        </ul>
        <div className="mt-3"><Unavailable>장비 세트 저장 · 무기 강화</Unavailable></div>
      </Panel>
    </>
  );
}

// ───────── 가방 ─────────
const CAT_FILTER: [string, string[]][] = [["전체", []], ["재료", ["ore", "bar", "rough", "mat", "part", "crop", "fish", "seed"]], ["보석", ["gem"]], ["음식·포션", ["food", "potion"]], ["스크롤", ["scroll"]]];
function Inventory({ s, now, act }: { s: State; now: number; act: Act }) {
  const [qText, setQText] = useState("");
  const [cat, setCat] = useState("전체");
  const [open, setOpen] = useState<string | null>(null);
  const cats = CAT_FILTER.find((c) => c[0] === cat)![1];
  const match = (def: string, maker?: string) => (!cats.length || cats.includes(ITEMS[def].cat)) && (ITEMS[def].name.includes(qText) || (maker ?? "").includes(qText));
  const groups = new Map<string, Batch[]>();
  s.inv.filter((b) => match(b.def, b.makerName)).forEach((b) => groups.set(b.def, [...(groups.get(b.def) ?? []), b]));
  const eqs = s.equips.filter((e) => (cat === "전체" || cat === "장비") && (ITEMS[e.def].name.includes(qText) || L.equipName(e).includes(qText) || (e.makerName ?? "").includes(qText)));
  return (
    <>
      <Panel title={`가방 (${s.inv.length}/80 칸)`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <input value={qText} onChange={(e) => setQText(e.target.value)} placeholder="이름·제작자 검색" aria-label="가방 검색" className="min-w-0 flex-1 rounded-md border border-line bg-raised px-2 py-1 text-sm" />
          {[...CAT_FILTER.map((c) => c[0]), "장비"].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-md px-2 py-1 text-xs ${cat === c ? "bg-gold/15 text-gold" : "text-sub hover:bg-raised"}`}>{c}</button>
          ))}
        </div>
        {groups.size === 0 && cat !== "장비" && <p className="text-sm text-sub">비어 있습니다. 광산이나 농장에서 재료를 모아 보세요.</p>}
        <ul className="divide-y divide-line">
          {[...groups].map(([def, bs]) => {
            const total = bs.reduce((a, b) => a + b.qty, 0);
            return (
              <li key={def} className="py-2">
                <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === def ? null : def)} aria-expanded={open === def}>
                  <Icon def={def} /><span className="flex-1 text-sm">{ITEMS[def].name}{ITEMS[def].noTrade && <span className="ml-1 text-xs text-sub">(거래 불가)</span>}</span>
                  <span className="tabular-nums text-sm">{total}</span><span className="text-xs text-sub">배치 {bs.length} {open === def ? "▲" : "▼"}</span>
                </button>
                {open === def && <ul className="mt-2 space-y-2 pl-10">{bs.map((b) => <BatchRow key={b.id} b={b} s={s} now={now} act={act} />)}</ul>}
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel title="장비·도구">
        <ul className="space-y-2">
          {eqs.map((e) => <EquipRow key={e.id} e={e} s={s} act={act} />)}
        </ul>
      </Panel>
    </>
  );
}
function BatchRow({ b, s, now, act }: { b: Batch; s: State; now: number; act: Act }) {
  const [n, setN] = useState(1);
  const [price, setPrice] = useState(ITEMS[b.def].price || 1);
  const d = ITEMS[b.def], kp = L.kingdomPrice(s, b.def, b.q, now);
  const gross = Math.floor(kp.unit * Math.min(n, b.qty)), fee = Math.ceil(gross * 0.01);
  return (
    <li className="rounded-lg bg-raised p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2"><QTag q={b.q} /><span className="tabular-nums">×{b.qty}</span><span className="text-xs text-sub">{makerLabel(b.def, b.makerName) ?? "출처: 채집·보급"}</span></div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(d.cat === "food" || d.cat === "potion") && <Btn kind="gold" onClick={() => act((x, t) => L.eat(x, b.id, t))}>사용</Btn>}
        {!d.noTrade && <>
          <input type="number" min={1} max={b.qty} value={n} onChange={(e) => setN(Math.max(1, Math.min(b.qty, +e.target.value || 1)))} aria-label="수량" className="w-14 rounded border border-line bg-panel px-1 py-0.5" />
          <Btn disabled={kp.closed} onClick={() => act((x, t) => L.sellKingdom(x, b.id, n, t))}>왕국 매각 {gross - fee}G</Btn>
          <span className="text-xs text-sub">(시세 {Math.round(kp.factor * 100)}% · 수수료 1% {fee}G)</span>
          <input type="number" min={1} value={price} onChange={(e) => setPrice(Math.max(1, +e.target.value || 1))} aria-label="개당 가격" className="w-16 rounded border border-line bg-panel px-1 py-0.5" />
          <Btn onClick={() => act((x) => L.listItem(x, "batch", b.id, n, price))}>거래소 등록 (수령 {price * n - Math.ceil(price * n * 0.03)}G)</Btn>
        </>}
        <Btn kind="ghost" onClick={() => act((x) => L.bankItem(x, b.id, true))}>은행 보관</Btn>
      </div>
    </li>
  );
}
function EquipRow({ e, s, act }: { e: Equip; s: State; act: Act }) {
  const [price, setPrice] = useState(ITEMS[e.def].price);
  const equipped = e.id === s.weapon || e.id === s.heart;
  const cat = ITEMS[e.def].cat;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-raised p-2">
      <EquipLine e={e} />
      <div className="flex flex-wrap items-center gap-1">
        {equipped && <span className="text-xs text-gold">장착 중</span>}
        {(cat === "weapon" || cat === "heart") && !equipped && <Btn onClick={() => act((d) => L.equip(d, e.id))} disabled={!!e.locked}>장착</Btn>}
        {ITEMS[e.def].maxDur && e.dur < ITEMS[e.def].maxDur! && <Btn onClick={() => act((d) => L.repair(d, e.id))}>수리 (부품 1 · +20)</Btn>}
        {!equipped && cat !== "tool" && !e.locked && <>
          <input type="number" min={1} value={price} onChange={(x) => setPrice(Math.max(1, +x.target.value || 1))} aria-label="판매 가격" className="w-16 rounded border border-line bg-panel px-1 py-0.5 text-sm" />
          <Btn onClick={() => act((d) => L.listItem(d, "equip", e.id, 1, price))}>판매 등록</Btn>
          <Btn kind="ghost" onClick={() => act((d) => L.dismantle(d, e.id))}>분해</Btn>
        </>}
      </div>
    </li>
  );
}

// ───────── 숙련도 ─────────
function Skills({ s }: { s: State }) {
  const indiv = Object.keys(s.xp).filter((k) => !k.startsWith("f:"));
  const name = (k: string) => GATHER[k]?.name ?? (RECIPES[k] ? `${ITEMS[RECIPES[k].out].name} ${RECIPES[k].cat}` : k.startsWith("farm:") ? `${CROPS[k.slice(5)].name} 재배` : k.startsWith("hunt:") ? `${MOBS[k.slice(5)].name} 사냥` : k);
  return (
    <>
      <Panel title="분야 숙련도">
        <ul className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(FIELDS) as Field[]).map((f) => {
            const i = L.levelInfo(s.xp[L.fieldKey(f)] ?? 0);
            return (
              <li key={f} className="rounded-lg bg-raised p-3 text-sm">
                <div className="flex justify-between"><b>{FIELDS[f]}</b><span>Lv.{i.lv}</span></div>
                <Bar v={i.into} max={i.need || 1} label={`${FIELDS[f]} 경험치`} />
                <div className="mt-1 text-xs text-sub">{i.into}/{i.need} XP · 공통 작업 속도 +{n1(Math.min(5, i.lv / 200))}% (최대 5%)</div>
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel title="개별 숙련도">
        {indiv.length === 0 && <p className="text-sm text-sub">아직 수행한 작업이 없습니다.</p>}
        <ul className="space-y-2">
          {indiv.map((k) => {
            const i = L.levelInfo(s.xp[k]), e = L.masteryEffect(i.lv), ne = L.masteryEffect(Math.min(1000, i.lv + 1));
            return (
              <li key={k} className="rounded-lg bg-raised p-3 text-sm">
                <div className="flex justify-between"><b>{name(k)}</b><span>Lv.{i.lv} · 유효 완료 {s.runs[k] ?? Math.round(s.xp[k] / 10)}회</span></div>
                <Bar v={i.into} max={i.need || 1} label={`${name(k)} 경험치`} />
                <div className="mt-1 text-xs text-sub">
                  {i.into}/{i.need} XP · 현재 {GATHER[k] ? `속도 +${n1(e.speed)}% · 추가 획득 ${n1(e.extra)}%` : `숙련 점수 ${n1(e.score)}`} → 다음 Lv {GATHER[k] ? `속도 +${n1(ne.speed)}%` : `점수 ${n1(ne.score)}`}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel title="장기 성장 안내">
        <p className="text-sm text-sub">Lv.1~50 빠른 적응 · 51~200 활발한 성장 · 201~500 전문화 · 501~800 장기 수련 · 801~1,000 장인 영역.
          Lv.1→1,000 누적 {L.CUM[1000].toLocaleString()} XP(회당 10 XP 기준 약 {Math.ceil(L.CUM[1000] / 10).toLocaleString()}회). 수치는 목업 밸런스이며 기간을 보장하지 않습니다. 클릭은 XP를 주지 않습니다.</p>
      </Panel>
    </>
  );
}

// ───────── 학교 ─────────
function School({ s, now, act }: { s: State; now: number; act: Act }) {
  const sc = s.school, used = 3 - sc.points;
  const card = (id: string) => {
    const sp = SPELLS[id], done = sc.lessons[id] ?? 0, learned = sc.learned.includes(id), paid = sc.paid.includes(id);
    return (
      <li key={id} className="rounded-lg bg-raised p-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><b>{sp.name}</b><span className="text-xs text-sub">MP {sp.mp} · {sp.desc} · 재사용 {sp.cd}초</span></div>
        <Bar v={done} max={sp.lessons} label={`${sp.name} 진도`} />
        <div className="mt-1 text-xs text-sub">
          진도 {done}/{sp.lessons} · 회차 비용: 포인트 1
          {sp.items.length > 0 && <> · 첫 회차 재료: {sp.items.map(([d, n]) => `${ITEMS[d].name}×${n}${id === "spell_flame" ? "(보통 이상)" : ""}`).join(", ")} {paid ? "✔ 납부됨" : ""}</>}
          {sp.pre && <> · 선행: {SPELLS[sp.pre].name}</>}
        </div>
        <div className="mt-2">{learned ? <span className="text-xs text-emerald-300">✔ 습득 완료 (반복 시전 숙련도 없음)</span>
          : <Btn kind="gold" disabled={sc.points < 1} onClick={() => act((d) => L.attendLesson(d, id))}>{sp.src === "scroll" ? (paid ? "해석하기" : "스크롤 등록 + 해석") : "수업 듣기"} (1포인트)</Btn>}</div>
      </li>
    );
  };
  return (
    <>
      <Panel title="왕립 마을 학교">
        <p className="text-lg">오늘 학습 <b className="text-gold">{used}/3</b> · 자정 소멸 · 미접속일은 지급되지 않습니다</p>
        <p className="text-xs text-sub">초기화까지 {L.fmtMs(L.msToKstMidnight(now))} (Asia/Seoul 00:00 기준) · 남은 포인트 {sc.points} · 누적·휴식 보너스·복귀 보상 없음</p>
      </Panel>
      <Panel title="수업 목록"><ul className="space-y-2">{Object.keys(SPELLS).filter((k) => SPELLS[k].src === "school").map(card)}</ul></Panel>
      <div className="ml-auto max-w-lg">
        <Panel title="📜 스크롤 해석실">
          <p className="mb-2 text-xs text-sub">일반 수업에 없는 마법을 스크롤로 해석합니다. 첫 해석 때 스크롤 1개와 재료를 소비해 프로젝트를 등록하고, 이후에는 포인트만 씁니다. 보유 스크롤: 달빛 장막 {L.count(s, "scroll_moon")} · 잔불 폭발 {L.count(s, "scroll_ember")}</p>
          <ul className="space-y-2">{Object.keys(SPELLS).filter((k) => SPELLS[k].src === "scroll").map(card)}</ul>
        </Panel>
      </div>
    </>
  );
}

// ───────── 시장 ─────────
function Market({ s, act }: { s: State; act: Act }) {
  const [tab, setTab] = useState("구매");
  const [qText, setQText] = useState("");
  const listingName = (l: L.Listing) => (l.equip ? L.equipName(l.equip) : ITEMS[l.batch!.def].name);
  const traitsOf = (l: L.Listing) => (l.equip ? L.equipContribution(l.equip).traits.map((t) => t.name).join(", ") : l.batch && ITEMS[l.batch.def].trait ? `${TRAITS[ITEMS[l.batch.def].trait!].name} Lv.${L.gemLevel(l.batch.q)}` : "");
  const listings = s.market.filter((l) => l.seller !== PLAYER.name && `${listingName(l)} ${l.equip?.makerName ?? l.batch?.makerName ?? ""} ${traitsOf(l)}`.includes(qText));
  const mine = s.market.filter((l) => l.seller === PLAYER.name);
  return (
    <>
      <div className="flex gap-1" role="tablist">
        {["구매", "내 판매", "왕국", "체결 내역"].map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? "bg-gold/15 text-gold" : "text-sub hover:bg-raised"}`}>{t}</button>)}
      </div>
      {tab === "구매" && (
        <Panel title={<>거래소 <Demo>판매자는 시드 이용자</Demo></>}>
          <input value={qText} onChange={(e) => setQText(e.target.value)} placeholder="품목·제작자·특성 검색 (예: 열기, 하린)" aria-label="거래소 검색" className="mb-3 w-full rounded-md border border-line bg-raised px-2 py-1 text-sm" />
          {listings.length === 0 && <p className="text-sm text-sub">조건에 맞는 매물이 없습니다.</p>}
          <ul className="space-y-2">
            {listings.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-raised p-2">
                {l.equip ? <EquipLine e={l.equip} /> : (
                  <div className="flex items-center gap-2"><Icon def={l.batch!.def} q={l.batch!.q} /><div><div className="text-sm">{ITEMS[l.batch!.def].name} ×{l.batch!.qty}</div><div className="text-xs text-sub"><QTag q={l.batch!.q} /> {makerLabel(l.batch!.def, l.batch!.makerName)}</div></div></div>
                )}
                <div className="text-xs text-sub">{traitsOf(l)} · 판매자 {l.seller}</div>
                <Btn kind="gold" disabled={s.gold < l.price * (l.batch?.qty ?? 1)} onClick={() => act((d, t) => L.buyListing(d, l.id, t))}>{(l.price * (l.batch?.qty ?? 1)).toLocaleString()}G 구매</Btn>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {tab === "내 판매" && (
        <Panel title="내 판매 등록" right={<span className="text-xs text-sub">가방에서 등록 · 개인 거래 수수료 3%</span>}>
          {mine.length === 0 && <p className="text-sm text-sub">등록한 물품이 없습니다. 가방에서 “거래소 등록”을 누르세요.</p>}
          <ul className="space-y-2">
            {mine.map((l) => {
              const gross = l.price * (l.batch?.qty ?? 1), fee = Math.ceil(gross * 0.03);
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-raised p-2 text-sm">
                  <span>{listingName(l)}{l.batch && ` ×${l.batch.qty}`} · {gross}G → 수령 {gross - fee}G</span>
                  <span className="flex gap-1"><Btn kind="gold" onClick={() => act((d, t) => L.demoFillListing(d, l.id, t))}>데모 구매자 체결</Btn><Btn kind="ghost" onClick={() => act((d) => L.cancelListing(d, l.id))}>취소</Btn></span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      {tab === "왕국" && (
        <Panel title="왕국 상점">
          <ul className="grid gap-2 sm:grid-cols-2">
            {L.SHOP.map((d) => (
              <li key={d} className="flex items-center justify-between gap-2 rounded-lg bg-raised p-2 text-sm">
                <span className="flex items-center gap-2"><Icon def={d} />{ITEMS[d].name}</span>
                <span className="flex gap-1"><Btn onClick={() => act((x, t) => L.buyKingdom(x, d, 1, t))}>{ITEMS[d].price}G</Btn>{ITEMS[d].cat === "seed" && <Btn onClick={() => act((x, t) => L.buyKingdom(x, d, 10, t))}>×10</Btn>}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-sub">왕국 매각은 가방에서 할 수 있습니다. 매입가는 기준가의 50~110%로, 최근 매입량에 따라 내려가고 24시간에 걸쳐 회복합니다. 수수료 1%.</p>
        </Panel>
      )}
      {tab === "체결 내역" && (
        <Panel title="최근 체결">
          <ul className="space-y-1 text-sm">
            {s.ledger.filter((x) => x.text.startsWith("거래소")).map((x, i) => <li key={i}>{x.text} <span className="text-sub">{x.delta > 0 ? "+" : ""}{x.delta}G</span></li>)}
            {SEED_TRADES.map((t, i) => <li key={`s${i}`} className="text-sub">{t.item} {t.price}G · {t.at} <Demo>시드</Demo></li>)}
          </ul>
        </Panel>
      )}
    </>
  );
}

// ───────── 장인 명부·의뢰 ─────────
function Artisan({ s, act }: { s: State; act: Act }) {
  const [qText, setQText] = useState("");
  const [form, setForm] = useState({ name: s.profile?.name ?? PLAYER.name, workshop: s.profile?.workshop ?? "", bio: s.profile?.bio ?? "", accepts: s.profile?.accepts ?? true });
  const [req, setReq] = useState<{ to?: string; title: string; minQ: number; qty: number; reward: number } | null>(null);
  const dup = ARTISANS.some((a) => a.workshop === form.workshop.trim());
  const all = [...ARTISANS.map((a) => ({ ...a, seed: true })), ...(s.profile ? [{ id: PLAYER.id, name: s.profile.name, workshop: s.profile.workshop, bio: s.profile.bio, main: "-", crafts: s.stats.crafted, orders: s.orders.filter((o) => o.to === PLAYER.name && o.state === "완료").length, onTime: 100, accepts: s.profile.accepts, seed: false }] : [])]
    .filter((a) => `${a.name} ${a.workshop} ${a.main}`.includes(qText));
  const myOrders = s.orders.filter((o) => o.from === PLAYER.name);
  const pub = s.orders.filter((o) => o.from !== PLAYER.name);
  return (
    <>
      <Panel title="장인 명부">
        <input value={qText} onChange={(e) => setQText(e.target.value)} placeholder="장인·공방 이름 검색" aria-label="장인 검색" className="mb-3 w-full rounded-md border border-line bg-raised px-2 py-1 text-sm" />
        <ul className="grid gap-2 sm:grid-cols-2">
          {all.map((a) => (
            <li key={a.id} className="rounded-lg bg-raised p-3 text-sm">
              <div className="flex justify-between"><b>{a.name} / {a.workshop}</b>{a.seed && <Demo>시드 장인</Demo>}</div>
              <div className="text-xs text-sub">{a.bio}</div>
              <div className="text-xs text-sub">주력 {a.main} · 제작 {a.crafts.toLocaleString()}회 · 주문 완료 {a.orders} · 납기 준수 {a.onTime}% · {a.accepts ? "수주 가능" : "수주 중단"}</div>
              {a.seed && a.accepts && <div className="mt-2"><Btn kind="gold" onClick={() => setReq({ to: a.name, title: `${a.main === "철검" ? "우수 철검" : a.main} 제작 요청`, minQ: 3, qty: 1, reward: 250 })}>제작 요청</Btn></div>}
            </li>
          ))}
        </ul>
      </Panel>
      {req && (
        <Panel title={`의뢰 작성${req.to ? ` → ${req.to} 지정` : " (공개)"}`}>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <label>제목 <input maxLength={40} value={req.title} onChange={(e) => setReq({ ...req, title: e.target.value })} className="mt-1 w-full rounded border border-line bg-raised px-2 py-1" /></label>
            <label>품목 <input disabled value="철검" className="mt-1 w-full rounded border border-line bg-raised px-2 py-1 text-sub" /></label>
            <label>최소 품질 <select value={req.minQ} onChange={(e) => setReq({ ...req, minQ: +e.target.value })} className="mt-1 w-full rounded border border-line bg-raised px-2 py-1">{QUALITY.map((q, i) => <option key={q} value={i}>{q} 이상</option>)}</select></label>
            <label>수량 <input type="number" min={1} max={5} value={req.qty} onChange={(e) => setReq({ ...req, qty: Math.max(1, Math.min(5, +e.target.value || 1)) })} className="mt-1 w-full rounded border border-line bg-raised px-2 py-1" /></label>
            <label>보수(G) <input type="number" min={1} value={req.reward} onChange={(e) => setReq({ ...req, reward: Math.max(1, +e.target.value || 1) })} className="mt-1 w-full rounded border border-line bg-raised px-2 py-1" /></label>
            <div className="text-xs text-sub">재료: 제작자 제공 · 기한 48시간 · 수수료 3% ({Math.ceil(req.reward * 0.03)}G)<br />주문자 재료 제공형·확률 도전형은 확장 예정(비활성)</div>
          </div>
          <div className="mt-3 flex gap-2">
            <Btn kind="gold" onClick={() => { act((d, t) => L.createOrder(d, { ...req, def: "weapon_iron" }, t)); setReq(null); }}>견적 요청 (골드 차감 없음)</Btn>
            <Btn kind="ghost" onClick={() => setReq(null)}>취소</Btn>
          </div>
        </Panel>
      )}
      <Panel title="내 의뢰" right={<Btn onClick={() => setReq({ title: "토벌대용 철검 제작 요청", minQ: 1, qty: 1, reward: 150 })}>공개 의뢰 작성</Btn>}>
        {myOrders.length === 0 && <p className="text-sm text-sub">작성한 의뢰가 없습니다.</p>}
        <ul className="space-y-2">
          {myOrders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-raised p-2 text-sm">
              <span><b>{o.title}</b> · {QUALITY[o.minQ]} 이상 철검×{o.qty} · 보수 {o.reward}G · {o.to ? `지정: ${o.to}` : "공개"} · <span className="text-gold">{o.state}</span></span>
              <span className="flex flex-wrap gap-1">
                {o.state === "견적" && <Btn kind="gold" onClick={() => act((d, t) => L.confirmOrder(d, o.id, t))}>확정 · 보수 예치</Btn>}
                {(o.state === "견적" || o.state === "모집") && <Btn kind="ghost" onClick={() => act((d, t) => L.cancelOrder(d, o.id, t))}>취소(전액 반환)</Btn>}
                {(o.state === "모집" || o.state === "수락") && <Btn onClick={() => act((d, t) => L.demoArtisanProgress(d, o.id, t))}>{o.state === "모집" ? "데모: 장인 수락" : "데모: 납품·정산"}</Btn>}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={<>공개 주문 <Demo>시드 주문자</Demo></>}>
        <ul className="space-y-2">
          {pub.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-raised p-2 text-sm">
              <span><b>{o.title}</b> · {o.from} · {QUALITY[o.minQ]} 이상 {ITEMS[o.def].name}×{o.qty} · 보수 {o.reward}G (수령 {o.reward - Math.ceil(o.reward * 0.03)}G) · <span className="text-gold">{o.state}</span></span>
              {o.state === "모집" && <Btn kind="gold" onClick={() => act((d) => L.acceptOrder(d, o.id))}>수락</Btn>}
              {o.state === "수락" && <Btn kind="gold" onClick={() => act((d, t) => L.deliverOrder(d, o.id, t))}>납품</Btn>}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="내 공방 등록">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <label>공개명 (12자) <input maxLength={12} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded border border-line bg-raised px-2 py-1" /></label>
          <label>공방명 (16자) <input maxLength={16} value={form.workshop} onChange={(e) => setForm({ ...form, workshop: e.target.value })} className="mt-1 w-full rounded border border-line bg-raised px-2 py-1" />
            {dup && <span className="text-xs text-red-400">이미 사용 중인 공방명입니다.</span>}</label>
          <label className="sm:col-span-2">소개 (60자) <input maxLength={60} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-1 w-full rounded border border-line bg-raised px-2 py-1" /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.accepts} onChange={(e) => setForm({ ...form, accepts: e.target.checked })} />수주 가능</label>
        </div>
        <div className="mt-2"><Btn kind="gold" disabled={dup || !form.name.trim() || !form.workshop.trim()} onClick={() => act((d) => { d.profile = { ...form, name: form.name.trim(), workshop: form.workshop.trim() }; L.log(d, `장인 명부 등록: ${form.name} / ${form.workshop}`); })}>{s.profile ? "수정" : "등록"}</Btn></div>
      </Panel>
    </>
  );
}

// ───────── 길드 ─────────
function Guild({ s, act, go }: { s: State; act: Act; go: Go }) {
  const g = s.guild;
  const irons = s.equips.filter((e) => e.def === "weapon_iron" && !e.locked && e.id !== s.weapon);
  const hunt = [...HUNT_SEED.map((x) => ({ ...x, seed: true })), ...(g.huntBest ? [{ guild: "새벽상회", ...g.huntBest, seed: false }] : [])].sort(L.huntCmp);
  const expo = [...EXPO_SEED.map((x) => ({ ...x, seed: true })), ...(g.expo ? [{ guild: "새벽상회", quality: g.expo.quality, theme: g.expo.theme, item: g.expo.item, seed: false }] : [])].sort((a, b) => b.quality + b.theme - (a.quality + a.theme));
  const rankOf = (i: number) => expo.findIndex((x) => x.quality + x.theme === expo[i].quality + expo[i].theme) + 1; // 동점 공동 순위
  return (
    <>
      <Panel title={<>새벽상회 <span className="text-xs text-sub">혼합 생산 길드 · 6/30명</span></>}>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-sub"><tr><th>멤버</th><th>직위</th><th>권한</th></tr></thead>
          <tbody>
            {[["새벽", "길드장", "가입 승인·계약 수락·금고·공지·직위·급여"], ["담", "부길드장", "계약 수락·공지"], ["이안", "토벌대장", "토벌 등록"], ["루미", "단원", "-"]].map(([n, r, p]) => (
              <tr key={n} className="border-t border-line"><td className="py-1">{n}{n !== "새벽" && <> <Demo>시드</Demo></>}</td><td>{r}</td><td className="text-xs text-sub">{p}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm">길드 금고 {g.treasury.toLocaleString()}G · 권한 변경 이력: 새벽 → 담 계약 수락 권한 부여</p>
      </Panel>
      <Panel title="공동 납품: 토벌 보급 계약" right={<span className="text-xs text-sub">협력 콘텐츠 · 순위 없음</span>}>
        <div className="space-y-2 text-sm">
          <div>생선구이 {g.fish}/30 <Bar v={g.fish} max={30} label="생선구이 납품" /></div>
          <div>작은 체력 포션 {g.potion}/20 <Bar v={g.potion} max={20} label="포션 납품" /></div>
          <p className="text-xs text-sub">보상 1,800G · 수락 시 확정된 배분: 기여 수량 비율 · 내 기여 생선 {g.myFish}, 포션 {g.myPotion} (다른 기여는 시드 길드원)</p>
          <div className="flex flex-wrap gap-2">
            <Btn disabled={g.deliveryDone || g.fish >= 30} onClick={() => act((d) => L.contribute(d, "fish"))}>생선구이 납품 (보유 {L.count(s, "food_fish")})</Btn>
            <Btn disabled={g.deliveryDone || g.potion >= 20} onClick={() => act((d) => L.contribute(d, "potion"))}>포션 납품 (보유 {L.count(s, "potion_hp")})</Btn>
            <Btn kind="gold" disabled={g.deliveryDone || g.fish < 30 || g.potion < 20} onClick={() => act((d, t) => L.claimDelivery(d, t))}>{g.deliveryDone ? "정산 완료" : "계약 정산"}</Btn>
          </div>
        </div>
      </Panel>
      <Panel title="길드 토벌전: 늪의 군주" right={<span className="text-xs text-sub">7일 기간 · 주간 3회</span>}>
        <p className="text-sm">유효 도전 {g.huntAttempts}/3 · 회차당 등록 최대 5명(시작 시 고정) · 제한 60초 · 최고 기록 1개</p>
        <p className="text-xs text-sub">순위: 처치 여부 → 남은 시간 → 남은 보스 HP. 보스는 20초마다 전체 중독을 시도합니다. 보상은 칭호·문장 중심(영구 능력치 없음).</p>
        <div className="my-2"><Btn kind="gold" disabled={g.huntAttempts >= 3 || (!!s.combat && !s.combat.end)} onClick={() => { act((d) => L.startHunt(d)); go("hunt"); }}>토벌 도전</Btn></div>
        <ol className="space-y-1 text-sm">
          {hunt.map((h, i) => <li key={h.guild}>{i + 1}위 {h.guild} — {h.killed ? `처치 (남은 ${Math.round(h.timeLeft / 1000)}초)` : `실패 · 보스 HP ${h.bossHp.toLocaleString()}`} {h.seed && <Demo>시드 기록</Demo>}</li>)}
        </ol>
      </Panel>
      <Panel title="제작 박람회: 철검" right={<span className="text-xs text-sub">길드당 1점 · 7일</span>}>
        <p className="text-xs text-sub">허용 재료: 철 주괴·수지 · 보석 불가 · 품질 60점(불량 0·보통 15·양질 30·우수 45·명품 60) + 테마 “오래 쓰는 검” 40점(기본 20 / 견고 제작 40). 인기투표 없음. 제출품은 마감까지 잠기고 종료 후 반환됩니다.</p>
        {!g.expo ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {irons.length === 0 && <span className="text-sm text-sub">제출 가능한 철검이 없습니다 (장착 중 제외).</span>}
            {irons.map((e) => <Btn key={e.id} onClick={() => act((d) => L.submitExpo(d, e.id))}>{L.equipName(e)} ({QUALITY[e.q]}{e.sturdy ? "·견고" : ""}, {e.makerName}) 제출</Btn>)}
          </div>
        ) : <div className="mt-2"><Btn onClick={() => act((d) => L.endExpo(d))}>데모: 박람회 종료·반환</Btn></div>}
        <ol className="mt-2 space-y-1 text-sm">
          {expo.map((x, i) => <li key={x.guild}>{rankOf(i)}위 {x.guild} — {x.quality + x.theme}점 (품질 {x.quality} + 테마 {x.theme}) · {x.item} {x.seed && <Demo>시드</Demo>}</li>)}
        </ol>
      </Panel>
      <Panel title="급여">
        <p className="text-sm text-sub">지급 내역: 10/31 담 주급 120G (수동) · 10/24 담 주급 120G (수동) <Demo>시드</Demo></p>
        <div className="mt-2"><Unavailable>자동 급여 예약(준비금·계급별 금액)</Unavailable></div>
      </Panel>
    </>
  );
}

// ───────── 은행 ─────────
function Bank({ s, act }: { s: State; act: Act }) {
  const [amt, setAmt] = useState(100);
  return (
    <>
      <Panel title="개인 보관함">
        <p className="text-sm">보관 골드 <b className="text-gold">{s.bank.gold.toLocaleString()}G</b> · 소지 {s.gold.toLocaleString()}G</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="number" min={1} value={amt} onChange={(e) => setAmt(Math.max(1, +e.target.value || 1))} aria-label="금액" className="w-24 rounded border border-line bg-raised px-2 py-1 text-sm" />
          <Btn onClick={() => act((d, t) => L.bankGold(d, amt, t))}>입금</Btn>
          <Btn onClick={() => act((d, t) => L.bankGold(d, -amt, t))}>출금</Btn>
        </div>
        <h3 className="mb-1 mt-3 text-sm font-semibold">보관 물품</h3>
        {s.bank.items.length === 0 && <p className="text-xs text-sub">비어 있음 · 가방에서 “은행 보관”</p>}
        <ul className="space-y-1">
          {s.bank.items.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2"><Icon def={b.def} q={b.q} />{ITEMS[b.def].name} ×{b.qty} <span className="text-xs text-sub">{makerLabel(b.def, b.makerName)}</span></span>
              <Btn onClick={() => act((d) => L.bankItem(d, b.id, false))}>꺼내기</Btn>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="거래·수입·지출 기록">
        {s.ledger.length === 0 && <p className="text-sm text-sub">기록이 없습니다.</p>}
        <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
          {s.ledger.map((x, i) => <li key={i} className="flex justify-between gap-2"><span>{x.text}</span><span className={x.delta >= 0 ? "text-emerald-300" : "text-red-300"}>{x.delta >= 0 ? "+" : ""}{x.delta}G</span></li>)}
        </ul>
      </Panel>
      <Panel title="확장 기능">
        <div className="space-y-2"><Unavailable>예금 이자 (예치 한도·기간·이자 예산)</Unavailable><Unavailable>담보 대출</Unavailable><Unavailable>길드 금고 연결 이체</Unavailable></div>
      </Panel>
    </>
  );
}

// ───────── 업적·기록 ─────────
function Records({ s }: { s: State }) {
  const list: [string, string, boolean][] = [
    ["첫 곡괭이질", "원석 1개 채광", s.stats.mined >= 1],
    ["광맥의 주인", "원석 100개 채광", s.stats.mined >= 100],
    ["철검의 첫걸음", "철검 10회 제작(암기)", (s.runs.recipe_iron_sword ?? 0) >= 10],
    ["숲의 파수꾼", "몬스터 10마리 처치", s.stats.kills >= 10],
    ["첫 거래", "거래소 거래 1회", s.stats.trades >= 1],
    ["성실한 학생", "수업 5회 수강", s.stats.lessons >= 5],
    ["???", "숨겨진 업적", false],
  ];
  const works = s.equips.filter((e) => e.maker === PLAYER.id).sort((a, b) => b.q - a.q).slice(0, 5);
  return (
    <>
      <Panel title="업적">
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.map(([n, d, ok]) => <li key={n} className={`rounded-lg border p-2 text-sm ${ok ? "border-gold/60 bg-gold/10" : "border-line"}`}>{ok ? "🏆" : "▫️"} <b>{n}</b> <span className="text-xs text-sub">— {d}</span></li>)}
        </ul>
      </Panel>
      <Panel title="대표 작품">
        {works.length === 0 ? <p className="text-sm text-sub">직접 제작한 장비가 없습니다.</p> : <ul className="space-y-2">{works.map((e) => <li key={e.id}><EquipLine e={e} /></li>)}</ul>}
      </Panel>
      <Panel title="통계"><p className="text-sm text-sub">채광 {s.stats.mined} · 제작 {s.stats.crafted} · 처치 {s.stats.kills} · 거래 {s.stats.trades} · 수업 {s.stats.lessons}</p></Panel>
    </>
  );
}

// ───────── 개발 옵션 ─────────
function Dev({ act, go }: { act: Act; go: Go }) {
  return (
    <Panel title={<>개발 옵션 <Demo>일반 플레이에 섞이지 않음</Demo></>}>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={() => act((d) => L.devGrant(d))}>재료·데모 장비 지급 (축복과 용기의 검, 분노 검, 격노의 심장)</Btn>
        <Btn onClick={() => act((d) => { d.forceNight = d.forceNight ? false : true; })}>낮/밤 강제 전환</Btn>
        <Btn onClick={() => act((d) => { d.forceNight = null; })}>낮/밤 실제 시간</Btn>
        <Btn onClick={() => act((d, t) => { d.farm.forEach((p) => { if (p.seed) p.readyAt = t; }); if (d.chickenReadyAt) d.chickenReadyAt = t; })}>작물·달걀 즉시 성장</Btn>
        <Btn onClick={() => act((d) => { d.school.points = 3; })}>학습 포인트 3 (테스트)</Btn>
        <Btn onClick={() => { act((d) => L.startCombat(d, "mob_speed_dummy")); go("hunt"); }}>속도 허수아비 (0.5)</Btn>
        <Btn onClick={() => { act((d) => L.startCombat(d, "mob_shield_dummy")); go("hunt"); }}>물리 방어막 허수아비</Btn>
        <Btn onClick={() => act((d) => { d.hp = L.build(d, Date.now()).maxHp; d.mp = L.build(d, Date.now()).maxMp; })}>HP/MP 회복</Btn>
        <Btn onClick={() => { if (confirm("저장 데이터를 초기화할까요?")) { localStorage.removeItem(SAVE_KEY); location.reload(); } }}>저장 초기화</Btn>
      </div>
    </Panel>
  );
}
