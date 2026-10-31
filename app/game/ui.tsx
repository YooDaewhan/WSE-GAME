import type { ReactNode } from "react";
import { ITEMS, QUALITY } from "./data.ts";
import * as L from "./logic.ts";
import type { Equip } from "./logic.ts";

export type Screen = "work" | "farm" | "hunt" | "char" | "inv" | "skills" | "school" | "market" | "artisan" | "guild" | "bank" | "records" | "dev";
export type Act = (fn: (d: L.State, now: number) => void) => void;
export type Go = (screen: Screen | null) => void;

export const Q_STYLE = ["text-zinc-400 border-zinc-600", "text-slate-200 border-slate-500", "text-emerald-300 border-emerald-600", "text-sky-300 border-sky-500", "text-amber-300 border-amber-500"];
export const n1 = (v: number) => +v.toFixed(1);

// ───────── 공통 UI ─────────
export function Panel({ title, children, right }: { title?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="frame p-4">
      {title && (
        <>
          <div className="mb-2 flex items-center justify-between gap-2"><h2 className="title-solid text-[15px] font-bold">{title}</h2>{right}</div>
          <div className="divider mb-3" />
        </>
      )}
      {children}
    </section>
  );
}
export function Btn({ children, onClick, disabled, kind = "base", title }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "base" | "gold" | "ghost"; title?: string }) {
  const k = kind === "gold" ? "btn btn-gold" : kind === "ghost" ? "border border-transparent text-sub hover:text-ink transition-colors" : "btn";
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      className={`min-h-9 rounded-[4px] px-3 text-sm disabled:cursor-not-allowed disabled:opacity-35 disabled:saturate-0 ${k}`}>
      <span className="relative">{children}</span>
    </button>
  );
}
export function QTag({ q }: { q: number }) {
  return <span className={`rounded-sm border px-1 text-[11px] leading-4 ${Q_STYLE[q]}`}>{QUALITY[q]}</span>;
}
export function Icon({ def, q, big }: { def: string; q?: number; big?: boolean }) {
  return (
    <span className={`slot ${q !== undefined ? `q${q}` : ""} relative inline-flex shrink-0 items-center justify-center rounded-[5px] ${big ? "h-14 w-14 text-3xl" : "h-9 w-9 text-lg"}`} aria-hidden>
      <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{ITEMS[def].icon}</span>
      {q !== undefined && <span className={`absolute -bottom-1 -right-1 rounded-sm border bg-bg px-0.5 text-[9px] leading-3 ${Q_STYLE[q]}`}>{QUALITY[q][0]}</span>}
    </span>
  );
}
// 앞 막대는 즉시, 뒤 잔상 막대는 늦게 줄어드는 MMO식 게이지
export function Bar({ v, max, color = "bg-gradient-to-r from-amber-700 to-gold", label, h = "h-2" }: { v: number; max: number; color?: string; label?: string; h?: string }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className={`bar-track relative ${h} w-full overflow-hidden rounded-[2px]`} role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemax={Math.round(max)}>
      <div className="absolute inset-y-0 left-0 bg-white/40 transition-[width] delay-300 duration-700 ease-out" style={{ width: `${pct}%` }} />
      <div className={`bar-fill absolute inset-y-0 left-0 ${color} transition-[width] duration-200 ease-out`} style={{ width: `${pct}%` }} />
    </div>
  );
}
export function Demo({ children = "데모" }: { children?: ReactNode }) {
  return <span className="rounded-sm border border-violet-400/30 bg-violet-500/15 px-1.5 text-[11px] text-violet-300">{children}</span>;
}
export function Unavailable({ children }: { children: ReactNode }) {
  return <div className="rounded border border-dashed border-line bg-black/20 p-3 text-sm text-sub">🔒 {children} <span className="text-xs">(미구현 · 사용 불가)</span></div>;
}

export const makerLabel = (def: string, name?: string) => {
  if (!name) return null;
  const cat = ITEMS[def].cat;
  const verb = cat === "bar" ? "제련" : cat === "gem" ? "세공" : cat === "weapon" || cat === "heart" ? "제작" : cat === "crop" || cat === "fish" ? "수확" : "제작";
  return `${verb}: ${name}`;
};
export function EquipLine({ e }: { e: Equip }) {
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

export function HudBar({ label, v, max, color, small }: { label: string; v: number; max: number; color: string; small?: boolean }) {
  return (
    <div className="relative">
      <Bar v={v} max={max} color={color} label={label} h={small ? "h-2" : "h-3.5"} />
      {!small && <span className="absolute inset-0 flex items-center justify-between px-1.5 text-[10px] font-semibold leading-none text-white [text-shadow:0_1px_2px_#000]"><span>{label}</span><span className="tabular-nums">{Math.floor(v)} / {Math.floor(max)}</span></span>}
    </div>
  );
}
export const FX_STYLE: Record<L.Fx["kind"], string> = {
  hit: "text-2xl text-white", crit: "text-4xl text-amber-300 [text-shadow:0_0_14px_#ff9d00,0_2px_4px_#000]", fire: "text-2xl text-orange-400 [text-shadow:0_0_10px_#ff4d00,0_2px_4px_#000]",
  miss: "text-lg italic text-zinc-400", heal: "text-2xl text-emerald-300", buff: "text-base text-cyan-300", poison: "text-xl text-fuchsia-400", block: "text-lg text-slate-300",
};
export function SkillSlot({ hotkey, icon, label, sub, cdFrac, cdText, disabled, active, onClick }: { hotkey: string; icon: string; label: string; sub: string; cdFrac: number; cdText: string; disabled?: boolean; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={`${label} (단축키 ${hotkey})`}
      className={`slot group relative flex h-14 w-14 flex-col items-center justify-center rounded-md text-2xl transition-all duration-150 enabled:hover:-translate-y-0.5 enabled:hover:border-mana enabled:hover:shadow-[0_0_14px_-2px_#62d2ff] enabled:active:scale-95 disabled:opacity-60 ${active ? "border-gold shadow-[0_0_16px_-2px_var(--color-gold)]" : ""}`}>
      <span className="drop-shadow-[0_2px_3px_#000]">{icon}</span>
      {sub && <span className="absolute bottom-0.5 right-1 text-[9px] text-ink/80">{sub}</span>}
      <span className="absolute left-1 top-0.5 text-[9px] font-bold text-gold">{hotkey}</span>
      {cdFrac > 0 && (
        <span className="absolute inset-0 flex items-center justify-center rounded-md text-base font-bold text-white" style={{ background: `conic-gradient(rgba(0,0,0,0.72) ${cdFrac * 360}deg, transparent 0)` }}>{cdText}</span>
      )}
    </button>
  );
}

