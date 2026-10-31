"use client";
// 게임 클라이언트 셸: 월드 위에 HUD와 창을 띄운다.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ITEMS, SPELLS, FIELDS, CHAT_SEED, PLAYER, type Field } from "./data.ts";
import * as L from "./logic.ts";
import type { State } from "./logic.ts";
import { Bar, Btn, Demo, HudBar, SkillSlot, type Act, type Go, type Screen } from "./ui.tsx";
import { WorkScreen, Farm, Hunt, Character, Inventory, Skills, School, Market, Artisan, Guild, Bank, Records, Dev } from "./screens.tsx";
import { World, ZONES, zoneById, type Zone, type Npc, type WalkReq } from "./World.tsx";

const SAVE_KEY = "mcm-demo-v1", LOCK_KEY = "mcm-demo-tab";
const WIN: Record<Screen, [string, string, string?]> = {
  work: ["작업장", "⚒️"], farm: ["새벽 농장", "🌾"], hunt: ["마을 숲", "🌲"], char: ["캐릭터", "🧙", "C"], inv: ["가방", "🎒", "I"],
  skills: ["숙련도", "📈", "K"], school: ["왕립 학교", "🏫"], market: ["시장 광장", "⚖️"], artisan: ["장인 게시판", "📜"],
  guild: ["새벽상회", "🛡️", "G"], bank: ["왕국 은행", "🏛️"], records: ["업적·기록", "🏆"], dev: ["개발 옵션", "🛠️"],
};
const MENU: Screen[] = ["char", "inv", "skills", "guild", "records", "dev"];
interface Dialog { icon: string; name: string; text: string; actions: [string, () => void][] }

export default function Game() {
  const [s, setS] = useState<State | null>(null);
  const [now, setNow] = useState(0);
  const [win, setWin] = useState<Screen | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [otherTab, setOtherTab] = useState(false);
  const [workTab, setWorkTab] = useState<string>("채집");
  const [returnRecipe, setReturnRecipe] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pulse, setPulse] = useState(0);
  const [pos, setPos] = useState(1250);
  const [banner, setBanner] = useState<{ n: number; name: string } | null>(null);
  const [walkReq, setWalkReq] = useState<WalkReq | null>(null);
  const tabId = useRef("");
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
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* 다음 틱에 재시도 */ }
  }, [s, now, otherTab]);

  const act: Act = (fn) => setS((p) => { if (!p) return p; const d = structuredClone(p); fn(d, Date.now()); return d; });
  const go: Go = (x) => setWin(x);
  const boost = () => { act((d, t) => L.clickBoost(d, t)); setPulse((p) => p + 1); };
  const travel = (zoneId: string, then?: () => void) => setWalkReq({ n: Date.now(), x: zoneById(zoneId).x, then });
  const openZone = (z: Zone) => {
    if (z.id === "plaza") return setDialog({ icon: "⛲", name: "광장 분수", text: "맑은 물이 솟아오릅니다. 요리와 연금에 쓰이는 물은 누구나 무료로 받을 수 있습니다. (거래 불가)", actions: [["💧 맑은 물 10개 받기", () => act((d) => L.give(d, { def: "mat_water", qty: 10, q: 1 }))]] });
    if (z.tab) setWorkTab(z.tab);
    if (z.open) setWin(z.open);
  };
  const talk = (n: Npc) => {
    if (n.id === "herald") {
      return setDialog({ icon: n.icon, name: n.name, text: s?.starter ? "보급품은 잘 쓰고 계신가요? 광산은 서쪽, 대장간은 광장 동쪽에 있습니다." : `${n.line} 이 보급품으로 광산에서 첫 원석을 캐 보세요.`,
        actions: s?.starter ? [] : [["🎁 시작 보급 받기 (철 원석 20 · 수지 3 · 불의 보석 원석 1)", () => act((d) => L.claimStarter(d))]] });
    }
    setDialog({ icon: n.icon, name: n.name, text: n.line, actions: n.open ? [[`${WIN[n.open][1]} ${WIN[n.open][0]} 열기`, () => { if (n.tab) setWorkTab(n.tab); setWin(n.open!); }]] : [] });
  };

  // 전역 단축키
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      if (k === "escape") { setDialog(null); setWin(null); return; }
      const hot = (Object.keys(WIN) as Screen[]).find((x) => WIN[x][2]?.toLowerCase() === k);
      if (hot) { setWin((w) => (w === hot ? null : hot)); return; }
      if (!s) return;
      const live = s.combat && !s.combat.end;
      if (k === " " && s.work && !live) { e.preventDefault(); boost(); }
      const i = "12345".indexOf(k);
      const slots = hotbar(s);
      if (i >= 0 && slots[i]?.use) slots[i].use!(act);
      if (k === "r" && live) act((d) => L.flee(d));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  if (!s) return <Loading />;
  const b = L.build(s, now);
  const clock = L.gameClock(s, now);
  const live = !!s.combat && !s.combat.end;

  return (
    <div className="fixed inset-0 overflow-clip bg-black text-ink">
      <World s={s} now={now} pulse={pulse} walkReq={walkReq} onZone={openZone} onNpc={talk} onBoost={boost} onPos={setPos}
        onNear={(name) => name && setBanner((x) => (x?.name === name ? x : { n: Date.now(), name }))} onFight={(m) => act((d) => L.startCombat(d, m))} />

      {/* 지역명 배너 */}
      {banner && <div key={banner.n} className="pointer-events-none absolute left-1/2 top-[13%] -translate-x-1/2 text-center animate-[zone-banner_2.6s_ease-out_forwards]">
        <p className="frame-title whitespace-nowrap text-3xl font-bold sm:text-5xl [filter:drop-shadow(0_2px_6px_#000)]">{banner.name}</p>
        <div className="mx-auto mt-1 h-px w-64 bg-gradient-to-r from-transparent via-gold to-transparent" />
      </div>}
      <Toasts s={s} />

      {/* 좌상단: 초상화 */}
      <div className="absolute left-2 top-2 sm:left-4 sm:top-4">
        <Portrait s={s} maxHp={b.maxHp} maxMp={b.maxMp} onClick={() => setWin("char")} />
        <div className="ml-[76px] mt-1 flex gap-1">
          {s.workBuff && s.workBuff.until > now && <Buff icon="🍲" label={`${s.workBuff.name} · 채광 +5% · ${L.fmtMs(s.workBuff.until - now)}`} />}
          {s.satiety < 30 && <Buff icon="🥣" label={`배고픔 · 작업 효율 ${Math.round(L.satietyEff(s.satiety) * 100)}%`} bad />}
          {live && s.combat?.poison && <Buff icon="☠️" label="중독" bad />}
        </div>
      </div>

      {/* 우상단: 미니맵 */}
      <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5 sm:right-4 sm:top-4">
        <Minimap pos={pos} night={clock.night} onPick={(z) => travel(z.id, () => openZone(z))} />
        <div className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs backdrop-blur [text-shadow:0_1px_2px_#000]">
          <span>{clock.night ? "🌙 밤" : "☀️ 낮"} · {clock.season}</span><span className="text-sub">{L.fmtMs(clock.nextSwitch)}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-sm backdrop-blur">
          <span className="inline-block h-3.5 w-3.5 rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-700 shadow-[0_0_8px_rgba(255,200,80,0.7)]" />
          <b className="tabular-nums text-gold">{s.gold.toLocaleString()}</b>
        </div>
      </div>

      {/* 우측: 퀘스트 추적 */}
      <div className="absolute right-2 top-[290px] hidden w-64 sm:right-4 md:block">
        <QuestTracker s={s} travel={travel} setWin={setWin} setWorkTab={setWorkTab} />
      </div>

      {/* 좌하단: 채팅 */}
      <div className="absolute bottom-3 left-3 hidden w-[340px] lg:block"><ChatBox s={s} /></div>

      {/* 하단 중앙: 액션바 */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-2">
        <ActionBar s={s} now={now} act={act} maxHp={b.maxHp} maxMp={b.maxMp} onBoost={boost} openWork={() => setWin("work")} />
      </div>

      {/* 우하단: 메뉴 */}
      <div className="absolute bottom-[136px] right-2 grid grid-cols-3 gap-1.5 sm:right-4 lg:bottom-3 lg:grid-cols-6">
        {MENU.map((k) => (
          <button key={k} onClick={() => setWin(win === k ? null : k)} title={`${WIN[k][0]}${WIN[k][2] ? ` (${WIN[k][2]})` : ""}`}
            className={`relative flex h-11 w-11 items-center justify-center rounded-full border text-xl backdrop-blur transition hover:-translate-y-0.5 hover:border-gold hover:shadow-[0_0_14px_rgba(227,195,123,0.6)] ${win === k ? "border-gold bg-gold/25" : "border-white/15 bg-black/60"}`}>
            {WIN[k][1]}
            {WIN[k][2] && <span className="absolute -bottom-0.5 -right-0.5 rounded-sm bg-black px-1 text-[9px] text-gold">{WIN[k][2]}</span>}
          </button>
        ))}
      </div>

      {/* 창 */}
      {win && (
        <GameWindow key={win} title={WIN[win][0]} icon={WIN[win][1]} onClose={() => setWin(null)}>
          {win === "work" && <WorkScreen s={s} now={now} act={act} go={go} tab={workTab} setTab={setWorkTab} returnRecipe={returnRecipe} setReturnRecipe={setReturnRecipe} />}
          {win === "farm" && <Farm s={s} now={now} act={act} />}
          {win === "hunt" && <Hunt s={s} now={now} act={(fn) => { act(fn); setWin(null); }} />}
          {win === "char" && <Character s={s} now={now} act={act} />}
          {win === "inv" && <Inventory s={s} now={now} act={act} />}
          {win === "skills" && <Skills s={s} />}
          {win === "school" && <School s={s} now={now} act={act} />}
          {win === "market" && <Market s={s} act={act} />}
          {win === "artisan" && <Artisan s={s} act={act} />}
          {win === "guild" && <Guild s={s} act={act} go={go} />}
          {win === "bank" && <Bank s={s} act={act} />}
          {win === "records" && <Records s={s} />}
          {win === "dev" && <Dev act={act} go={go} />}
        </GameWindow>
      )}
      {dialog && <DialogBox d={dialog} onClose={() => setDialog(null)} />}
      {summary && (
        <div className="absolute left-1/2 top-1/3 w-[min(92vw,460px)] -translate-x-1/2 animate-[pop-in_400ms_ease-out]">
          <div className="frame p-5 text-center">
            <p className="frame-title mb-2 text-xl">돌아오신 걸 환영합니다</p>
            <p className="text-sm">{summary}</p>
            <div className="mt-4"><Btn kind="gold" onClick={() => setSummary(null)}>확인</Btn></div>
          </div>
        </div>
      )}
      {otherTab && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="frame max-w-sm p-6 text-center">
            <p className="frame-title mb-2 text-lg">다른 탭에서 접속 중</p>
            <p className="text-sm text-sub">진행이 중복되지 않도록 이 탭은 멈춰 있습니다. 다른 탭을 닫으면 자동으로 이어집니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── HUD 부품 ─────────
function Loading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_center,#1a2236,#05070c)]">
      <div className="h-14 w-14 rounded-full border-2 border-gold/20 border-t-gold animate-[spin-slow_1s_linear_infinite]" />
      <p className="frame-title text-4xl animate-[title-in_1.2s_ease-out_both]">MCM 왕국</p>
      <p className="text-xs text-sub">월드에 접속하는 중…</p>
    </div>
  );
}
function Portrait({ s, maxHp, maxMp, onClick }: { s: State; maxHp: number; maxMp: number; onClick: () => void }) {
  const top = (Object.keys(FIELDS) as Field[]).map((f) => [f, L.fieldLv(s, f)] as const).sort((a, b) => b[1] - a[1])[0];
  const title = top[1] > 1 ? `${FIELDS[top[0]].replace(" 스킬", "")} Lv.${top[1]}` : "초보 모험가";
  return (
    <div className="flex items-center gap-2">
      <button onClick={onClick} aria-label="캐릭터 정보 (C)" className="relative h-[68px] w-[68px] shrink-0 rounded-full p-[3px] shadow-[0_0_20px_rgba(0,0,0,0.8)] transition hover:scale-105" style={{ background: "conic-gradient(from 200deg,#fff2c5,#c99a45,#6b4a1c,#c99a45,#fff2c5)" }}>
        <span className="flex h-full w-full items-center justify-center rounded-full bg-[radial-gradient(circle_at_40%_30%,#3a4566,#0b0f19)] text-4xl">🧙</span>
      </button>
      <div className="w-36 space-y-1 rounded-r-lg bg-gradient-to-r from-black/70 to-transparent py-1 pl-1 pr-4 sm:w-60 sm:pr-6">
        <div className="flex items-baseline gap-2 [text-shadow:0_1px_2px_#000]"><span className="frame-title text-base">새벽</span><span className="hidden text-[11px] text-sub sm:inline">{title}</span><span className="hidden sm:inline"><Demo>데모</Demo></span></div>
        <HudBar label="HP" v={s.hp} max={maxHp} color="bg-gradient-to-r from-red-800 via-red-500 to-rose-400" />
        <HudBar label="MP" v={s.mp} max={maxMp} color="bg-gradient-to-r from-blue-800 via-sky-500 to-cyan-300" />
        <div title={`포만감 ${Math.floor(s.satiety)}/100`}><HudBar label="포만감" v={s.satiety} max={100} color="bg-gradient-to-r from-amber-800 via-amber-500 to-yellow-300" small /></div>
      </div>
    </div>
  );
}
function Buff({ icon, label, bad }: { icon: string; label: string; bad?: boolean }) {
  return <span title={label} className={`flex h-7 w-7 items-center justify-center rounded border text-sm ${bad ? "border-red-500/70 bg-red-950/70" : "border-gold/50 bg-black/70"}`}>{icon}</span>;
}
function Minimap({ pos, night, onPick }: { pos: number; night: boolean; onPick: (z: Zone) => void }) {
  const R = 700;
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-gold/70 shadow-[0_0_0_3px_rgba(0,0,0,0.6),0_0_24px_rgba(0,0,0,0.8)] sm:h-44 sm:w-44 md:h-40 md:w-40 lg:h-44 lg:w-44"
      style={{ background: night ? "radial-gradient(circle,#1a2a2a,#0a1210)" : "radial-gradient(circle,#5d7d44,#2c4425)" }}>
      <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 bg-[#b39363]/60" />
      {ZONES.map((z, i) => {
        const dx = (z.x - pos) / R;
        if (Math.abs(dx) > 1.05) return null;
        return (
          <button key={z.id} onClick={() => onPick(z)} title={z.name} className="absolute -translate-x-1/2 -translate-y-1/2 text-base transition hover:scale-125"
            style={{ left: `${50 + dx * 46}%`, top: `${50 + (i % 2 ? -1 : 1) * 16}%` }}>{z.icon}</button>
        );
      })}
      <span className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 border-x-[6px] border-b-[11px] border-x-transparent border-b-sky-300 [filter:drop-shadow(0_0_4px_#62d2ff)]" />
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(98,210,255,0.18)_40deg,transparent_60deg)] animate-[spin-slow_6s_linear_infinite]" />
      <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[10px] font-bold text-gold">N</span>
    </div>
  );
}
function Toasts({ s }: { s: State }) {
  const [base] = useState(() => s.logN ?? 0); // 접속 후 생긴 알림만
  const n = s.logN ?? 0, fresh = Math.min(3, n - base);
  return (
    <div className="pointer-events-none absolute left-1/2 top-[22%] w-[min(92vw,460px)] -translate-x-1/2 space-y-1" aria-live="polite">
      {s.log.slice(0, Math.max(0, fresh)).map((x, i) => (
        <p key={n - i} className="text-center text-sm font-semibold text-amber-100 [text-shadow:0_0_8px_#000,0_1px_2px_#000] animate-[toast_3.6s_ease-out_forwards]">{x}</p>
      ))}
    </div>
  );
}
function QuestTracker({ s, travel, setWin, setWorkTab }: { s: State; travel: (z: string, then?: () => void) => void; setWin: (w: Screen) => void; setWorkTab: (t: string) => void }) {
  const w = s.equips.find((e) => e.id === s.weapon);
  const at = (zone: string, win?: Screen, tab?: string) => () => travel(zone, () => { if (tab) setWorkTab(tab); if (win) setWin(win); });
  const steps: [string, boolean, () => void][] = [
    ["왕국 보급관에게 보급 받기", s.starter, () => travel("plaza")],
    ["광산에서 철 원석 채광", s.stats.mined >= 1, at("mine", "work", "채집")],
    ["대장간에서 철 주괴 제련", (s.runs.recipe_bar_iron ?? 0) >= 1, at("forge", "work", "제련")],
    ["철검 제작", (s.runs.recipe_iron_sword ?? 0) >= 1, at("forge", "work", "제작")],
    ["불의 보석 세공", (s.runs.recipe_gem_fire ?? 0) >= 1, at("forge", "work", "세공")],
    ["무기에 보석 장착", !!w?.gems.some(Boolean), () => setWin("char")],
    ["생선구이 요리", (s.runs.recipe_fish ?? 0) >= 1, at("market", "work", "요리")],
    ["마을 숲에서 첫 사냥", s.stats.kills >= 1, at("forest", "hunt")],
    ["학교에서 수업 듣기", s.stats.lessons >= 1, at("school", "school")],
    ["이안의 공개 주문 납품", s.orders.some((o) => o.id === "order_public_01" && o.state === "완료"), at("board", "artisan")],
    ["새벽상회 보급 기여", s.guild.myFish + s.guild.myPotion >= 1, at("guild", "guild")],
  ];
  const cur = steps.findIndex((x) => !x[1]);
  return (
    <div className="[text-shadow:0_1px_3px_#000,0_0_6px_#000]">
      <p className="mb-1 flex items-center justify-between border-b border-gold/40 pb-1 text-xs"><span className="font-[family-name:var(--font-title)] text-gold">◆ 가이드 퀘스트</span><span className="text-sub">{steps.filter((x) => x[1]).length}/{steps.length}</span></p>
      {cur === -1 ? <p className="text-sm text-gold">모든 가이드 완료!</p> : (
        <ul className="space-y-1 text-[13px]">
          {steps.slice(Math.max(0, cur - 1), cur + 3).map(([name, ok, onGo]) => (
            <li key={name}>
              <button onClick={onGo} className={`w-full text-left transition hover:text-gold ${ok ? "text-sub line-through" : name === steps[cur][0] ? "font-semibold text-amber-200" : "text-ink/80"}`}>
                {ok ? "✔" : name === steps[cur][0] ? "▶" : "·"} {name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-b border-fuchsia-400/40 pb-1 text-xs text-fuchsia-300">◆ MCM 사건</p>
      <p className="text-[13px]">독안개 토벌 주간 — 해독 재료·요리 수요 증가</p>
    </div>
  );
}
function ChatBox({ s }: { s: State }) {
  const [tab, setTab] = useState<"all" | "sys">("all");
  const [msgs, setMsgs] = useState(CHAT_SEED);
  const [text, setText] = useState("");
  return (
    <div className="rounded-md bg-gradient-to-t from-black/75 to-black/35 p-2 text-xs backdrop-blur-[2px]">
      <div className="mb-1 flex gap-1">
        {(["all", "sys"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-sm px-2 py-0.5 ${tab === t ? "bg-gold/25 text-gold" : "text-sub"}`}>{t === "all" ? "지역" : "시스템"}</button>)}
        <Demo>시드 채팅</Demo>
      </div>
      <ul className="flex h-28 flex-col-reverse overflow-y-auto [text-shadow:0_1px_2px_#000]">
        {tab === "all"
          ? [...msgs].reverse().map((m, i) => <li key={i}><b className="text-sky-300">[{m.who}]</b> {m.text}</li>)
          : s.log.slice(0, 30).map((x, i) => <li key={i} className="text-amber-100/90">[시스템] {x}</li>)}
      </ul>
      <form className="mt-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { setMsgs([...msgs, { who: PLAYER.name, text: text.trim() }]); setText(""); setTab("all"); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder="Enter로 대화 (100자)" aria-label="채팅 입력"
          className="min-w-0 flex-1 rounded-sm border border-white/10 bg-black/50 px-2 py-1 focus:border-mana/60 focus:outline-none" />
      </form>
    </div>
  );
}
// 단축 슬롯: 1~3 마법(전투), 4 포션, 5 음식
interface Slot { icon: string; label: string; sub: string; use?: (act: Act) => void; cd?: number; cdMax?: number; disabled?: boolean; active?: boolean }
function hotbar(s: State): Slot[] {
  const c = s.combat && !s.combat.end ? s.combat : null;
  const spells: Slot[] = [0, 1, 2].map((i) => {
    const id = s.school.learned[i], sp = id ? SPELLS[id] : null;
    if (!sp) return { icon: "", label: "빈 슬롯 (학교에서 마법 습득)", sub: "", disabled: true };
    const cd = c ? Math.max(0, (c.cds[id] ?? 0) - c.t) : 0;
    return { icon: sp.fire ? "🔥" : sp.heal ? "💚" : sp.defBuff ? "🛡️" : "🌙", label: `${sp.name} · ${sp.desc}`, sub: `MP ${sp.mp}`, cd, cdMax: sp.cd * 1000,
      disabled: !c || s.mp < sp.mp || cd > 0, active: c?.pending === id, use: c ? (act) => act((d) => L.queueSpell(d, id)) : undefined };
  });
  const potion = s.inv.find((x) => ITEMS[x.def].cat === "potion");
  const food = s.inv.find((x) => ITEMS[x.def].cat === "food");
  const pcd = c ? Math.max(0, c.potionAt - c.t) : 0;
  return [...spells,
    potion ? { icon: ITEMS[potion.def].icon, label: ITEMS[potion.def].name, sub: `×${count(s, potion.def)}`, cd: pcd, cdMax: 10000, disabled: pcd > 0, use: (act) => act((d, t) => L.eat(d, potion.id, t)) } : { icon: "", label: "포션 없음", sub: "", disabled: true },
    food ? { icon: ITEMS[food.def].icon, label: `${ITEMS[food.def].name}${c ? " (전투 중 불가)" : ""}`, sub: `×${count(s, food.def)}`, disabled: !!c, use: c ? undefined : (act) => act((d, t) => L.eat(d, food.id, t)) } : { icon: "", label: "음식 없음", sub: "", disabled: true },
  ];
}
const count = (s: State, def: string) => s.inv.filter((b) => b.def === def).reduce((a, b) => a + b.qty, 0);
function Orb({ v, max, color, label }: { v: number; max: number; color: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className="relative hidden h-[72px] w-[72px] overflow-hidden rounded-full border-2 border-gold/60 sm:block bg-black/80 shadow-[0_0_0_3px_rgba(0,0,0,0.6),inset_0_0_14px_#000] sm:h-20 sm:w-20" role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemax={Math.round(max)}>
      <div className="absolute inset-x-0 bottom-0 transition-[height] duration-300" style={{ height: `${pct}%`, background: color }}>
        <div className="absolute -top-2 left-[-50%] h-4 w-[200%] rounded-[45%] bg-white/25 animate-[wave-x_3s_linear_infinite]" />
      </div>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.45),transparent_40%)]" />
      <span className="absolute inset-0 flex flex-col items-center justify-center text-[11px] font-bold leading-tight [text-shadow:0_1px_2px_#000]"><span className="text-[9px] text-white/70">{label}</span>{Math.floor(v)}</span>
    </div>
  );
}
function ActionBar({ s, now, act, maxHp, maxMp, onBoost, openWork }: { s: State; now: number; act: Act; maxHp: number; maxMp: number; onBoost: () => void; openWork: () => void }) {
  const c = s.combat && !s.combat.end ? s.combat : null;
  const w = s.work;
  const slots = hotbar(s);
  const key = w?.target;
  const info = key ? L.levelInfo(s.xp[key] ?? 0) : null;
  return (
    <div className="flex w-full max-w-[720px] flex-col items-center px-2">
      {w && !c && (
        <div className="mb-2 flex w-full max-w-md items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs backdrop-blur animate-[pop-in_250ms_ease-out]">
          <button onClick={openWork} className="truncate font-semibold text-gold hover:underline">{L.workDef(w).name}</button>
          <div className="flex-1"><Bar v={w.progress} max={1} color={s.boostUntil > now ? "bg-gradient-to-r from-sky-600 to-cyan-300" : undefined} label="작업 진행" h="h-2" /></div>
          <span className="tabular-nums text-sub">{w.done}{w.repeat ? `/${w.repeat}` : ""}</span>
          <button onClick={onBoost} className={`rounded-full border px-2 py-0.5 text-[11px] transition ${s.boostUntil > now ? "border-mana text-mana shadow-[0_0_10px_#62d2ff]" : "border-gold/50 text-gold hover:bg-gold/20"}`}>SPACE 가속</button>
          <button onClick={() => act((d) => { if (d.work) d.work.paused = !d.work.paused; })} className="text-sub hover:text-ink" title="일시정지">{w.paused ? "▶" : "⏸"}</button>
          <button onClick={() => act((d) => L.cancelWork(d))} className="text-sub hover:text-red-300" title="즉시 중단 (예약 재료 반환)">■</button>
        </div>
      )}
      {c && <p className="mb-1 text-xs text-sub [text-shadow:0_1px_2px_#000]">⚔️ {c.hunt ? "길드 토벌" : "전투"} 중 · 스킬은 다음 행동을 대체 · R 도주{c.limit ? ` · 남은 ${Math.max(0, Math.ceil((c.limit - c.t) / 1000))}초` : ""}{!c.hunt && <> · <button className="underline" onClick={() => act((d) => { if (d.combat) d.combat.auto = !d.combat.auto; })}>자동 반복 {c.auto ? "켬" : "끔"}</button></>}</p>}
      <div className="flex items-end gap-2 sm:gap-3">
        <Orb v={s.hp} max={maxHp} color="linear-gradient(180deg,#ff6b6b,#a1121d)" label="HP" />
        <div className="rounded-lg border border-gold/30 bg-gradient-to-b from-black/60 to-black/85 p-1.5 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur">
          <div className="flex gap-1.5">
            {slots.map((x, i) => (
              <SkillSlot key={i} hotkey={String(i + 1)} icon={x.icon} label={x.label} sub={x.sub} disabled={x.disabled || !x.use} active={x.active}
                cdFrac={x.cd && x.cdMax ? x.cd / x.cdMax : 0} cdText={x.cd ? String(Math.ceil(x.cd / 1000)) : ""} onClick={() => x.use?.(act)} />
            ))}
            {c && <SkillSlot hotkey="R" icon="🏃" label="도주" sub="" cdFrac={0} cdText="" onClick={() => act((d) => L.flee(d))} />}
          </div>
        </div>
        <Orb v={s.mp} max={maxMp} color="linear-gradient(180deg,#6fd8ff,#103f9e)" label="MP" />
      </div>
      {/* 숙련도 경험치 줄 */}
      <div className="mt-1.5 w-full max-w-[560px]" title={info ? `개별 숙련 Lv.${info.lv} ${info.into}/${info.need}` : "작업 중인 숙련도"}>
        <Bar v={info?.into ?? 0} max={info?.need || 1} color="bg-gradient-to-r from-violet-700 via-fuchsia-500 to-amber-300" label="숙련도 경험치" h="h-1" />
        {info && <p className="text-center text-[10px] text-sub [text-shadow:0_1px_2px_#000]">{L.workDef(w!).name} 숙련 Lv.{info.lv} · {info.into}/{info.need} XP</p>}
      </div>
    </div>
  );
}
function GameWindow({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: ReactNode }) {
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2 sm:p-6" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="frame flex max-h-full w-full max-w-[920px] flex-col overflow-hidden !bg-[linear-gradient(180deg,rgba(18,23,36,0.96),rgba(8,10,16,0.97))] animate-[window-in_220ms_ease-out] sm:max-h-[82vh]"
        style={{ transform: `translate(${off.x}px, ${off.y}px)` }} role="dialog" aria-label={title}>
        <div className="flex cursor-move touch-none items-center gap-2 border-b border-gold/30 bg-gradient-to-r from-gold/15 via-transparent to-transparent px-4 py-2"
          onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { const d = drag.current; if (d) setOff({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }); }}
          onPointerUp={() => { drag.current = null; }}>
          <span className="text-xl">{icon}</span>
          <h2 className="frame-title flex-1 text-lg font-bold">{title}</h2>
          <span className="hidden text-[10px] text-sub sm:inline">드래그로 이동 · Esc 닫기</span>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="닫기" className="flex h-7 w-7 items-center justify-center rounded border border-white/15 text-sub transition hover:border-red-400 hover:text-red-300">✕</button>
        </div>
        <div className="space-y-4 overflow-y-auto p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}
function DialogBox({ d, onClose }: { d: Dialog; onClose: () => void }) {
  return (
    <div className="absolute inset-x-2 bottom-44 z-30 mx-auto max-w-2xl animate-[pop-in_250ms_ease-out] sm:bottom-40">
      <div className="frame flex gap-4 p-4">
        <span className="slot q4 flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-5xl">{d.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="title-solid text-base">{d.name}</p>
          <p key={d.text} className="mt-1 text-sm leading-relaxed animate-[type-in_900ms_steps(40)_both]">“{d.text}”</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {d.actions.map(([label, fn]) => <Btn key={label} kind="gold" onClick={() => { fn(); onClose(); }}>{label}</Btn>)}
            <Btn onClick={onClose}>{d.actions.length ? "나중에" : "대화 종료"}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
