"use client";
// 걸어 다니는 2.5D 마을. 카메라·이동은 화면 연출이며 게임 판정과 무관하다.
/* eslint-disable react-hooks/refs, react-hooks/purity -- 카메라·이동은 rAF에서 ref로 직접 갱신하는 명령형 애니메이션 루프 */
import { useEffect, useRef, useState } from "react";
import { ITEMS, MOBS, GATHER, RECIPES } from "./data.ts";
import * as L from "./logic.ts";
import type { State, Work } from "./logic.ts";
import { FX_STYLE, Bar, Q_STYLE, type Screen } from "./ui.tsx";

export const WORLD_W = 4000;
export interface Zone { id: string; name: string; x: number; icon: string; size: number; open?: Screen; tab?: string }
export const ZONES: Zone[] = [
  { id: "mine", name: "초입 광산", x: 230, icon: "⛰️", size: 190, open: "work", tab: "채집" },
  { id: "river", name: "마을 강", x: 600, icon: "🛶", size: 90, open: "work", tab: "채집" },
  { id: "farm", name: "새벽 농장", x: 930, icon: "🏡", size: 130, open: "farm" },
  { id: "plaza", name: "광장 분수", x: 1250, icon: "⛲", size: 120 },
  { id: "forge", name: "대장간", x: 1560, icon: "🏚️", size: 150, open: "work", tab: "제작" },
  { id: "market", name: "시장 광장", x: 1880, icon: "⛺", size: 130, open: "market" },
  { id: "board", name: "장인 게시판", x: 2160, icon: "📜", size: 80, open: "artisan" },
  { id: "bank", name: "왕국 은행", x: 2400, icon: "🏛️", size: 150, open: "bank" },
  { id: "school", name: "왕립 학교", x: 2700, icon: "🏫", size: 160, open: "school" },
  { id: "guild", name: "새벽상회", x: 3000, icon: "🏰", size: 170, open: "guild" },
  { id: "forest", name: "마을 숲", x: 3330, icon: "🌲", size: 170, open: "hunt" },
];
export interface Npc { id: string; name: string; icon: string; x: number; line: string; open?: Screen; tab?: string }
export const NPCS: Npc[] = [
  { id: "herald", name: "왕국 보급관", icon: "🤴", x: 1340, line: "새벽님, MCM 왕국에 오신 걸 환영합니다. 장인은 오래 손을 쓴 사람만이 될 수 있답니다." },
  { id: "harin", name: "하린", icon: "👩‍🔧", x: 1660, line: "철검이라면 붉은모루 공방이죠. 지정 의뢰는 장인 게시판에 남겨 주세요.", open: "artisan" },
  { id: "dam", name: "담", icon: "👨‍🍳", x: 1790, line: "토벌 주간이라 생선구이가 불티나요! 여기서 요리해 가세요.", open: "work", tab: "요리" },
  { id: "rumi", name: "루미", icon: "🧝‍♀️", x: 1990, line: "보석 세공은 섬세함이 전부예요. 시장에 제 보석이 올라가 있어요.", open: "market" },
  { id: "ian", name: "이안", icon: "🤺", x: 3110, line: "늪의 군주 토벌대 모집 중! 길드 창에서 도전할 수 있어요.", open: "guild" },
];
export const zoneById = (id: string) => ZONES.find((z) => z.id === id)!;
export function workZone(w: Work | null): string | null {
  if (!w) return null;
  if (w.kind === "gather") return GATHER[w.target].field === "fishing" ? "river" : "mine";
  const c = RECIPES[w.target].cat;
  return c === "요리" ? "market" : c === "연금" ? "school" : "forge";
}
const TOOL: Record<string, string> = { mine: "⛏️", river: "🎣", forge: "🔨", market: "🍳", school: "⚗️" };
const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const MID = Array.from({ length: 70 }, (_, i) => ({ x: i * 80 + rnd(i, 1) * 50, icon: ["🌳", "🌲", "🏠", "🌳", "🏡", "🌲", "🌳"][i % 7], size: 44 + rnd(i, 2) * 34, b: 35 + rnd(i, 3) * 4 }));
const FG = Array.from({ length: 34 }, (_, i) => ({ x: i * 150 + rnd(i, 4) * 90, icon: ["🌿", "🌾", "🌱", "🌼", "🌿"][i % 5], size: 60 + rnd(i, 5) * 40 }));

export interface WalkReq { n: number; x: number; then?: () => void }
export function World({ s, now, pulse, walkReq, onZone, onNpc, onBoost, onPos, onNear, onFight }: {
  s: State; now: number; pulse: number; walkReq: WalkReq | null;
  onZone: (z: Zone) => void; onNpc: (n: Npc) => void; onBoost: () => void;
  onPos: (x: number) => void; onNear: (name: string | null) => void; onFight: (mob: string) => void;
}) {
  const px = useRef(1250), target = useRef<number | null>(null), cam = useRef(0), focus = useRef(0), pending = useRef<(() => void) | null>(null);
  const keys = useRef(new Set<string>());
  const farRef = useRef<HTMLDivElement>(null), midRef = useRef<HTMLDivElement>(null), groundRef = useRef<HTMLDivElement>(null), mainRef = useRef<HTMLDivElement>(null), fgRef = useRef<HTMLDivElement>(null), playerRef = useRef<HTMLDivElement>(null), bodyRef = useRef<HTMLSpanElement>(null);
  const cb = useRef({ onPos, onNear, onZone, onNpc, onFight });
  const [near, setNear] = useState<string | null>(null);
  useEffect(() => { cb.current = { onPos, onNear, onZone, onNpc, onFight }; });

  const walkTo = (x: number, then?: () => void) => { target.current = clamp(x, 60, WORLD_W - 60); pending.current = then ?? null; };
  const fight = (m: string) => walkTo(zoneById("forest").x - 40, () => cb.current.onFight(m));

  // 이동·카메라 루프 (DOM 직접 갱신, React 재렌더 없음)
  useEffect(() => {
    let raf = 0, last = performance.now(), lastPos = 0, nearId: string | null = null;
    const loop = (t: number) => {
      const dt = Math.min(50, t - last); last = t;
      const vw = window.innerWidth;
      let dir = 0;
      if (keys.current.has("l")) dir = -1; else if (keys.current.has("r")) dir = 1;
      if (dir) { target.current = null; pending.current = null; }
      else if (target.current !== null) {
        const d = target.current - px.current;
        if (Math.abs(d) <= 0.34 * dt) { px.current = target.current; target.current = null; const p = pending.current; pending.current = null; p?.(); }
        else dir = Math.sign(d);
      }
      if (dir) px.current = clamp(px.current + dir * 0.34 * dt, 60, WORLD_W - 60);
      cam.current += (clamp(px.current + focus.current - vw / 2, 0, WORLD_W - vw) - cam.current) * Math.min(1, dt / 160);
      const c = cam.current;
      const set = (r: React.RefObject<HTMLElement | null>, v: string) => { if (r.current) r.current.style.transform = v; };
      set(farRef, `translateX(${-c * 0.12}px)`);
      set(midRef, `translateX(${-c * 0.45}px)`);
      set(groundRef, `translateX(${-c}px) rotateX(64deg)`);
      set(mainRef, `translateX(${-c}px)`);
      set(fgRef, `translateX(${-c * 1.3}px)`);
      set(playerRef, `translateX(${px.current}px)`);
      if (bodyRef.current) {
        bodyRef.current.dataset.walk = dir ? "1" : "0";
        if (dir) bodyRef.current.style.transform = `scaleX(${dir > 0 ? -1 : 1})`;
      }
      if (t - lastPos > 250) { lastPos = t; cb.current.onPos(px.current); }
      let best: string | null = null, bd = 120;
      for (const z of [...ZONES, ...NPCS]) { const d = Math.abs(z.x - px.current); if (d < bd) { bd = d; best = z.id; } }
      if (best !== nearId) {
        nearId = best; setNear(best);
        const z = ZONES.find((x) => x.id === best);
        cb.current.onNear(z ? z.name : null);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 키보드: ←→/AD 이동, F 상호작용
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    const dn = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") keys.current.add("l");
      if (k === "arrowright" || k === "d") keys.current.add("r");
      if (k === "f" && near) {
        const z = ZONES.find((x) => x.id === near), n = NPCS.find((x) => x.id === near);
        if (z) cb.current.onZone(z); else if (n) cb.current.onNpc(n);
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") keys.current.delete("l");
      if (k === "arrowright" || k === "d") keys.current.delete("r");
    };
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [near]);

  // 외부 이동 요청(퀘스트 클릭 등), 작업 시작·전투 시작 시 해당 장소로 이동
  useEffect(() => { if (walkReq) walkTo(walkReq.x, walkReq.then); }, [walkReq]);
  const wz = workZone(s.work);
  useEffect(() => { if (wz) walkTo(zoneById(wz).x + 70); }, [wz]);
  const live = !!s.combat && !s.combat.end;
  useEffect(() => { focus.current = live ? 80 : 0; if (live) walkTo(zoneById("forest").x - 40); }, [live]);

  const clock = L.gameClock(s, now);
  const night = clock.night;
  const c = s.combat;
  const fxs = live ? c!.fx ?? [] : [];
  const mobHit = [...fxs].reverse().find((f) => f.to === "mob" && f.kind !== "miss");
  const meHit = [...fxs].reverse().find((f) => f.to === "me" && (f.kind === "hit" || f.kind === "poison"));
  const phase = (now % L.HOUR) / (L.HOUR / 2) % 1; // 해·달 위치
  const forest = zoneById("forest").x;
  const workOut = s.work ? (s.work.kind === "gather" ? GATHER[s.work.target].out : RECIPES[s.work.target].out) : null;

  return (
    <div className="absolute inset-0 select-none overflow-clip" aria-label="마을 월드">
      {/* 하늘 */}
      <div className="absolute inset-0 transition-[background] duration-[2000ms]" style={{ background: night ? "linear-gradient(180deg,#02040d 0%,#0b1433 45%,#1f2b55 68%,#2a2438 75%)" : "linear-gradient(180deg,#3d7cc9 0%,#86b8e6 40%,#f4d6a0 68%,#e8a86a 75%)" }} />
      {night && Array.from({ length: 70 }, (_, i) => (
        <span key={`star${i}`} className="absolute rounded-full bg-white" style={{ left: `${rnd(i, 6) * 100}%`, top: `${rnd(i, 7) * 55}%`, width: 1 + rnd(i, 8) * 2, height: 1 + rnd(i, 8) * 2, opacity: 0.3 + rnd(i, 9) * 0.7, animation: `twinkle ${2 + rnd(i, 10) * 4}s ease-in-out infinite` }} />
      ))}
      <span className="absolute text-6xl [filter:drop-shadow(0_0_30px_rgba(255,240,180,0.9))]" style={{ left: `${8 + phase * 84}%`, top: `${30 - Math.sin(phase * Math.PI) * 22}%` }}>{night ? "🌕" : "☀️"}</span>
      {[0, 1, 2, 3].map((i) => (
        <span key={`cloud${i}`} className="absolute text-[90px] opacity-70" style={{ top: `${6 + i * 9}%`, animation: `cloud ${90 + i * 35}s linear infinite`, animationDelay: `${-i * 30}s`, filter: night ? "brightness(0.35)" : "none" }}>☁️</span>
      ))}

      {/* 먼 산 */}
      <div ref={farRef} className="absolute bottom-[30%] left-0 h-[36%] will-change-transform" style={{ width: 4000 }}>
        <svg className="h-full w-full" viewBox="0 0 4000 300" preserveAspectRatio="none" aria-hidden>
          <path d="M0 220 L180 120 L330 180 L520 60 L700 170 L880 100 L1060 190 L1260 50 L1450 160 L1640 90 L1840 200 L2050 70 L2250 170 L2450 110 L2650 190 L2860 60 L3060 180 L3270 100 L3480 170 L3700 80 L4000 190 L4000 300 L0 300Z" fill={night ? "#141b38" : "#6b86b0"} />
          <path d="M0 250 L220 190 L420 240 L640 170 L860 245 L1080 200 L1300 250 L1520 180 L1760 240 L1980 190 L2200 250 L2420 200 L2640 245 L2860 185 L3080 240 L3300 200 L3520 250 L3760 190 L4000 240 L4000 300 L0 300Z" fill={night ? "#0e1428" : "#4f6b8f"} />
        </svg>
      </div>
      {/* 중경: 나무·집 */}
      <div ref={midRef} className="absolute inset-y-0 left-0 will-change-transform" style={{ width: 6000, filter: night ? "brightness(0.35) saturate(0.6)" : "brightness(0.75) saturate(0.8) blur(0.4px)" }}>
        {MID.map((m, i) => <span key={i} className="absolute -translate-x-1/2" style={{ left: m.x, bottom: `${m.b}%`, fontSize: m.size }}>{m.icon}</span>)}
      </div>
      {/* 지면: 원근 평면 */}
      <div className="absolute inset-x-0 bottom-0 h-[36%] overflow-clip [perspective:520px] [perspective-origin:50%_0%]">
        <div className={`absolute inset-0 ${night ? "bg-[#14241a]" : "bg-[#5d8a3e]"}`} />
        <div ref={groundRef} className="absolute bottom-0 h-[260%] origin-bottom will-change-transform" style={{ left: -1200, width: WORLD_W + 2400 }}>
          <div className="absolute inset-0" style={{ background: night ? "repeating-linear-gradient(90deg,#1c3322 0 90px,#18301f 90px 180px)" : "repeating-linear-gradient(90deg,#6b9a48 0 90px,#628f41 90px 180px)" }} />
          {/* 길 */}
          <div className="absolute inset-x-0 bottom-[34%] h-[16%]" style={{ background: night ? "repeating-linear-gradient(90deg,#3a3326 0 60px,#332d22 60px 62px),#3a3326" : "repeating-linear-gradient(90deg,#c8a674 0 60px,#b39363 60px 62px)", boxShadow: "0 0 40px rgba(0,0,0,0.25)" }} />
          {/* 강 */}
          <div className="absolute inset-y-0 overflow-hidden" style={{ left: 1200 + 480, width: 260, background: night ? "#0d2547" : "#3d8fd1" }}>
            <div className="absolute inset-0 opacity-50 animate-[river_3s_linear_infinite]" style={{ background: "repeating-linear-gradient(0deg,transparent 0 30px,rgba(255,255,255,0.35) 30px 34px)" }} />
          </div>
          {/* 밭 */}
          <div className="absolute bottom-[52%] h-[20%] rounded" style={{ left: 1200 + 820, width: 260, background: "repeating-linear-gradient(90deg,#6b4a2a 0 22px,#5a3d22 22px 30px)" }} />
        </div>
        <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/30 to-transparent" />
      </div>

      {/* 주 레이어 */}
      <div ref={mainRef} className="absolute inset-y-0 left-0 will-change-transform" style={{ width: WORLD_W }}
        onPointerDown={(e) => { if (e.target === e.currentTarget) walkTo(e.clientX + cam.current); }}>
        {ZONES.map((z) => (
          <button key={z.id} onPointerDown={(e) => e.stopPropagation()} onClick={() => walkTo(z.x, () => cb.current.onZone(z))}
            className="group absolute flex -translate-x-1/2 flex-col items-center" style={{ left: z.x, bottom: "29%", zIndex: 5 }}>
            <span className={`mb-1 whitespace-nowrap font-[family-name:var(--font-title)] text-sm font-bold [text-shadow:0_0_6px_#000,0_2px_2px_#000] transition ${near === z.id ? "text-gold" : "text-ink/85"}`}>{z.name}</span>
            <span className="relative leading-none transition-[filter,transform] duration-200 [filter:drop-shadow(0_10px_10px_rgba(0,0,0,0.5))] group-hover:-translate-y-1 group-hover:[filter:drop-shadow(0_0_16px_rgba(255,220,140,0.9))]" style={{ fontSize: z.size }}>
              {z.icon}
              <ZoneDeco z={z} s={s} now={now} night={night} />
            </span>
            {near === z.id && <span className="absolute -top-8 whitespace-nowrap rounded border border-gold/60 bg-black/75 px-2 py-0.5 text-xs text-gold animate-[pop-in_200ms_ease-out]"><b className="mr-1 rounded-sm bg-gold px-1 text-bg">F</b>{z.open || z.id === "plaza" ? "상호작용" : "살펴보기"}</span>}
            {night && <span className="pointer-events-none absolute -bottom-6 h-24 w-56 rounded-full bg-[radial-gradient(ellipse,rgba(255,190,90,0.35),transparent_70%)]" />}
          </button>
        ))}
        {NPCS.map((n, i) => {
          const quest = n.id === "herald" && !s.starter;
          return (
            <button key={n.id} onPointerDown={(e) => e.stopPropagation()} onClick={() => walkTo(n.x - 50, () => cb.current.onNpc(n))}
              className="group absolute flex -translate-x-1/2 flex-col items-center" style={{ left: n.x, bottom: "22%", zIndex: 10 }}>
              {quest && <span className="text-3xl font-black text-gold [text-shadow:0_0_12px_#ffb400,0_2px_2px_#000] animate-[bob_1s_ease-in-out_infinite]">!</span>}
              <span className="whitespace-nowrap text-xs font-semibold text-emerald-300 [text-shadow:0_1px_2px_#000,0_0_4px_#000]">{n.name}</span>
              <span className="text-6xl leading-none transition group-hover:[filter:drop-shadow(0_0_10px_#7fffb0)]" style={{ animation: `bob ${2.4 + i * 0.3}s ease-in-out infinite` }}>{n.icon}</span>
              <span className="h-2 w-12 rounded-full bg-black/40 blur-[2px]" />
            </button>
          );
        })}
        {/* 숲의 몬스터 */}
        {!live && (["mob_slime", "mob_wolf"] as const).map((m, i) => (
          <button key={m} onPointerDown={(e) => e.stopPropagation()} onClick={() => fight(m)}
            className="group absolute flex -translate-x-1/2 flex-col items-center" style={{ left: forest + 120 + i * 120, bottom: "18%", zIndex: 12 }}>
            <span className="whitespace-nowrap text-xs font-semibold text-red-300 [text-shadow:0_1px_2px_#000]">{MOBS[m].name}</span>
            <span className="text-6xl leading-none transition group-hover:[filter:drop-shadow(0_0_12px_#ff5050)]" style={{ animation: `bob ${1.6 + i * 0.5}s ease-in-out infinite` }}>{MOBS[m].icon}</span>
          </button>
        ))}
        {live && c && (
          <div className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: forest + 110, bottom: "18%", zIndex: 12 }}>
            <span className="whitespace-nowrap text-xs font-bold text-red-300 [text-shadow:0_1px_2px_#000]">{MOBS[c.mob].name}</span>
            <div className="mb-1 w-28"><Bar v={c.mobHp} max={c.mobMax} color="bg-gradient-to-r from-red-900 via-red-600 to-orange-400" label="적 체력" h="h-2" /></div>
            <div key={`m${c.mActs}`} className="animate-[lunge-l_420ms_ease-out]">
              <span key={`h${mobHit?.id ?? 0}`} className={`relative block leading-none ${MOBS[c.mob].boss ? "text-[150px]" : "text-8xl"} ${mobHit ? "animate-[shake_300ms_ease-out,flash_220ms_ease-out]" : ""}`}>
                {MOBS[c.mob].icon}
                {c.pShield > 0 && <span className="absolute -inset-3 rounded-full border-2 border-cyan-200/70 shadow-[0_0_24px_#7fe9ff]" />}
              </span>
            </div>
            {fxs.filter((f) => f.to === "mob").map((f) => <Floater key={f.id} id={f.id} cls={FX_STYLE[f.kind]} text={f.kind === "crit" ? `치명! ${f.text}` : f.text} />)}
          </div>
        )}

        {/* 플레이어 */}
        <div ref={playerRef} className="absolute left-0 will-change-transform" style={{ bottom: "17%", zIndex: 20 }}>
          <div className="relative flex -translate-x-1/2 flex-col items-center">
            {s.work && !live && (
              <button onPointerDown={(e) => e.stopPropagation()} onClick={onBoost} aria-label="작업 가속 (Space)"
                className="relative mb-1 flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `conic-gradient(${s.boostUntil > now ? "#62d2ff" : "#e3c37b"} ${s.work.progress * 360}deg, rgba(0,0,0,0.6) 0)` }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/80 text-lg">{workOut && ITEMS[workOut].icon}</span>
                {s.boostUntil > now && <span className="absolute inset-0 rounded-full border-2 border-mana animate-[ring-out_0.9s_ease-out_infinite]" />}
              </button>
            )}
            <span className="whitespace-nowrap rounded-sm bg-black/50 px-1.5 text-xs font-bold text-sky-200 [text-shadow:0_1px_2px_#000]">새벽</span>
            <div key={live ? `p${c!.pActs}` : "idle"} className={live ? "animate-[lunge_420ms_ease-out]" : ""}>
              <span ref={bodyRef} className="player-body relative block text-7xl leading-none">
                <span className="block">🧙</span>
              </span>
            </div>
            {s.work && !live && wz && <span className="absolute bottom-6 -right-6 origin-bottom-left text-3xl animate-[swing_0.7s_ease-in-out_infinite]">{TOOL[wz]}</span>}
            <span className="h-3 w-16 rounded-full bg-black/45 blur-[3px]" />
            {s.gain && !live && <Floater key={`g${s.gain.id}`} id={0} cls={`text-base ${s.gain.q !== undefined ? Q_STYLE[s.gain.q].split(" ")[0] : "text-gold"}`} text={`${s.gain.text}${s.gain.q !== undefined ? ` · ${["불량", "보통", "양질", "우수", "명품"][s.gain.q]}` : ""}`} top={-40} />}
            {pulse > 0 && Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2 + pulse;
              return <span key={`${pulse}-${i}`} className="pointer-events-none absolute left-1/2 top-4 h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_8px_#ffcf6a] animate-[burst_520ms_ease-out_forwards]" style={{ ["--dx" as string]: `${Math.cos(a) * 70}px`, ["--dy" as string]: `${Math.sin(a) * 70}px` }} />;
            })}
            {fxs.filter((f) => f.to === "me").map((f) => <Floater key={f.id} id={f.id} cls={FX_STYLE[f.kind]} text={f.text} />)}
            {c?.myMShield && live && <span className="pointer-events-none absolute -inset-4 top-6 rounded-full border-2 border-indigo-300/70 shadow-[0_0_20px_#8ea0ff]" />}
          </div>
        </div>
      </div>

      {/* 전경 풀 */}
      <div ref={fgRef} className="pointer-events-none absolute inset-y-0 left-0 will-change-transform" style={{ width: 6000 }}>
        {FG.map((g, i) => <span key={i} className="absolute -translate-x-1/2 opacity-90 [filter:blur(1.5px)]" style={{ left: g.x, bottom: -18, fontSize: g.size, filter: night ? "blur(1.5px) brightness(0.4)" : "blur(1.5px)" }}>{g.icon}</span>)}
      </div>
      {/* 조명 */}
      {night && <div className="pointer-events-none absolute inset-0 bg-[#0a1240]/40 mix-blend-multiply" />}
      {meHit && <span key={`hurt${meHit.id}`} className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(255,0,0,0.6)] animate-[hurt-edge_500ms_ease-out_forwards]" />}
      {live && c?.poison && <span className="pointer-events-none absolute inset-0 bg-fuchsia-900/15 animate-[glow-pulse_1.2s_ease-in-out_infinite]" />}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55))]" />
    </div>
  );
}
function Floater({ id, cls, text, top = -10 }: { id: number; cls: string; text: string; top?: number }) {
  return (
    <span className={`pointer-events-none absolute left-1/2 z-30 whitespace-nowrap font-black [text-shadow:0_2px_4px_#000] animate-[float-up_1.1s_ease-out_forwards] ${cls}`}
      style={{ top, marginLeft: ((id * 37) % 50) - 25 }}>{text}</span>
  );
}
// 장소별 장식(불꽃·연기·작물·깃발 등)
function ZoneDeco({ z, s, now, night }: { z: Zone; s: State; now: number; night: boolean }) {
  const abs = "pointer-events-none absolute leading-none";
  if (z.id === "mine") return <><span className={`${abs} bottom-2 left-1/2 h-16 w-20 -translate-x-1/2 rounded-t-full bg-black/80`} /><span className={`${abs} bottom-0 -right-6 text-4xl`}>💎</span><span className={`${abs} bottom-0 -left-4 text-3xl`}>⚫</span></>;
  if (z.id === "forge") return <><span className={`${abs} -right-10 bottom-0 text-5xl animate-[flicker_0.4s_ease-in-out_infinite_alternate]`}>🔥</span><span className={`${abs} -left-8 bottom-0 text-4xl`}>⚒️</span>{[0, 1, 2].map((i) => <span key={i} className={`${abs} left-1/3 top-0 text-3xl opacity-0 animate-[smoke_4s_ease-out_infinite]`} style={{ animationDelay: `${i * 1.3}s` }}>💨</span>)}</>;
  if (z.id === "farm") return <span className={`${abs} -bottom-2 left-full ml-2 grid grid-cols-4 gap-0.5 text-2xl`}>{s.farm.slice(0, 8).map((p, i) => <span key={i}>{p.seed ? (p.readyAt <= now ? "🌾" : "🌱") : "🟫"}</span>)}<span className="absolute -right-8 bottom-0 text-3xl">🐔</span></span>;
  if (z.id === "plaza") return <><span className={`${abs} -top-4 left-0 text-2xl animate-[bob_2s_ease-in-out_infinite]`}>🕊️</span>{night && <span className={`${abs} -right-6 top-0 text-3xl`}>🏮</span>}</>;
  if (z.id === "market") return <><span className={`${abs} -right-14 bottom-0 text-7xl`}>⛺</span><span className={`${abs} bottom-0 left-1/2 text-3xl`}>🍎</span><span className={`${abs} -right-4 bottom-0 text-3xl`}>🧺</span></>;
  if (z.id === "school") return <span className={`${abs} -right-6 bottom-0 text-4xl`}>📚</span>;
  if (z.id === "guild") return <span className={`${abs} -top-6 right-2 text-5xl origin-bottom-left animate-[wave_1.6s_ease-in-out_infinite]`}>🚩</span>;
  if (z.id === "bank") return <span className={`${abs} -right-6 bottom-0 text-4xl`}>💰</span>;
  if (z.id === "forest") return <><span className={`${abs} -left-16 bottom-0 text-[120px]`}>🌳</span><span className={`${abs} -right-20 bottom-4 text-[140px]`}>🌲</span></>;
  if (z.id === "river") return <span className={`${abs} -right-10 bottom-0 text-4xl animate-[bob_2.5s_ease-in-out_infinite]`}>🐟</span>;
  return null;
}
