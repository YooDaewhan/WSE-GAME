// 게임 규칙. 순수 함수 + 상태 변경 함수. UI와 저장소에서 분리되어 있어 서버로 옮길 수 있다.
// ponytail: 데모는 브라우저가 판정한다. 실제 서비스에서는 이 모듈을 서버에서 실행하고 클라이언트는 결과만 받는다.
import {
  ITEMS, TRAITS, GATHER, RECIPES, CROPS, MOBS, SPELLS, PLAYER, SEED_LISTINGS, FIELDS,
  QUALITY_MULT, QUALITY_MAT_SCORE, type Field,
} from "./data.ts";

export const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;
const OFFLINE_MAX = 8 * HOUR;
const INV_LIMIT = 80;
const BASE_TURN = 3000;
export const GAUGE_FULL = 1000 * BASE_TURN; // 행동 게이지 1 = 속도(1/1000) × 기준 턴 ms

export interface Batch { id: string; def: string; qty: number; q: number; maker?: string; makerName?: string }
export interface Gem { def: string; q: number; maker?: string; makerName?: string }
export interface Equip {
  id: string; def: string; q: number; maker?: string; makerName?: string;
  dur: number; gems: (Gem | null)[]; innate: { t: string; lv: number }[];
  locked?: string; sturdy?: boolean; history: string[];
}
export interface Work {
  kind: "gather" | "recipe"; target: string; repeat: number; done: number;
  progress: number; reserved: Batch[] | null; paused: boolean; stopAfter: boolean; sturdy?: boolean;
}
export interface Plot { seed: string | null; readyAt: number }
export interface Combat {
  mob: string; mobHp: number; mobMax: number; pShield: number; mShield: number;
  t: number; pG: number; mG: number; pending: string | null; potionAt: number;
  cds: Record<string, number>; poison: { until: number; next: number } | null;
  defBuffUntil: number; myMShield: { amt: number; until: number } | null;
  log: string[]; end?: "승리" | "패배" | "도주" | "시간 종료"; limit?: number; hunt?: boolean;
  auto: boolean; pActs: number; mActs: number;
}
export interface Listing { id: string; seller: string; price: number; batch?: Batch; equip?: Equip }
export interface Order {
  id: string; title: string; from: string; to?: string; def: string; minQ: number; qty: number;
  reward: number; state: "견적" | "모집" | "수락" | "완료" | "취소"; deadline: number;
}
export interface HuntResult { killed: boolean; timeLeft: number; bossHp: number }
export interface State {
  v: 1; gold: number; hp: number; mp: number; satiety: number;
  inv: Batch[]; equips: Equip[]; weapon: string | null; heart: string | null;
  xp: Record<string, number>; runs: Record<string, number>; recipes: string[];
  work: Work | null; boostUntil: number; toolUse: Record<string, number>;
  farm: Plot[]; chickenReadyAt: number | null;
  school: { date: string; points: number; lessons: Record<string, number>; paid: string[]; learned: string[] };
  breadDate: string; starter: boolean;
  bank: { gold: number; items: Batch[] };
  ledger: { at: number; text: string; delta: number }[];
  kdemand: Record<string, { vol: number; at: number }>;
  market: Listing[]; orders: Order[];
  profile: { name: string; workshop: string; bio: string; accepts: boolean } | null;
  guild: {
    fish: number; potion: number; myFish: number; myPotion: number; deliveryDone: boolean;
    huntAttempts: number; huntBest: HuntResult | null; expo: { equipId: string; quality: number; theme: number; item: string } | null;
    treasury: number;
  };
  combat: Combat | null; workBuff: { name: string; until: number } | null;
  traitCap: Record<string, number>; forceNight: boolean | null;
  log: string[]; lastSeen: number;
  stats: { mined: number; crafted: number; kills: number; trades: number; lessons: number };
}

let seq = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ───────── 시간 ─────────
export const kstDate = (now: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
export const msToKstMidnight = (now: number) => DAY - ((now + 9 * HOUR) % DAY);
export function gameClock(s: State, now: number) {
  const phase = now % HOUR; // 목업: 60분 주기, 앞 30분 낮·뒤 30분 밤
  const night = s.forceNight ?? phase >= HOUR / 2;
  const nextSwitch = phase >= HOUR / 2 ? HOUR - phase : HOUR / 2 - phase;
  const seasons = ["봄", "여름", "가을", "겨울"];
  const season = seasons[Math.floor(now / (7 * DAY)) % 4];
  return { night, nextSwitch, season, nextSeason: 7 * DAY - (now % (7 * DAY)) };
}
export function fmtMs(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h}시간 ${m}분` : m ? `${m}분 ${s}초` : `${s}초`;
}

// ───────── 숙련도 ─────────
const needXp = (L: number) => (L === 1 ? 100 : Math.ceil(100 * Math.pow(1 + L / 50, 1.8)));
export const CUM: number[] = [0, 0]; // CUM[L] = Lv.L 도달 누적 XP
for (let L = 1; L < 1000; L++) CUM[L + 1] = CUM[L] + needXp(L);
export function levelOf(xp: number) {
  let lo = 1, hi = 1000;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (CUM[m] <= xp) lo = m; else hi = m - 1; }
  return lo;
}
export function levelInfo(xp: number) {
  const lv = levelOf(xp);
  return { lv, into: xp - CUM[lv], need: lv >= 1000 ? 0 : needXp(lv) };
}
// 개별 Lv 기준점 [Lv, 채집 속도%, 추가 획득%, 숙련 점수]
const MASTERY_PTS = [[1, 0, 0, 0], [50, 8, 3, 10], [200, 18, 8, 25], [500, 30, 16, 50], [800, 40, 25, 75], [1000, 45, 30, 100]];
export function masteryEffect(lv: number) {
  for (let i = 1; i < MASTERY_PTS.length; i++) {
    const [l1, ...a] = MASTERY_PTS[i - 1], [l2, ...b] = MASTERY_PTS[i];
    if (lv <= l2) {
      const f = (lv - l1) / (l2 - l1);
      const [speed, extra, score] = a.map((v, k) => v + (b[k] - v) * f);
      return { speed, extra, score };
    }
  }
  return { speed: 45, extra: 30, score: 100 };
}
export const fieldKey = (f: Field) => `f:${f}`;
export const indivLv = (s: State, key: string) => levelOf(s.xp[key] ?? 0);
export const fieldLv = (s: State, f: Field) => levelOf(s.xp[fieldKey(f)] ?? 0);

// ───────── 품질 ─────────
const QDIST = [[15, 65, 18, 2, 0], [5, 45, 35, 14, 1], [1, 24, 45, 25, 5], [0, 10, 35, 43, 12], [0, 3, 22, 50, 25]];
export function qualityDist(score: number) {
  const x = clamp(score, 0, 100) / 25, i = Math.min(3, Math.floor(x)), f = x - i;
  return QDIST[i].map((v, k) => v + (QDIST[i + 1][k] - v) * f);
}
export function rollQuality(score: number, r = Math.random()) {
  const d = qualityDist(score);
  let acc = 0;
  for (let q = 0; q < 5; q++) { acc += d[q] / 100; if (r < acc) return q; }
  return 4;
}

// ───────── 인벤토리 (배치: 정의·품질·제작자가 같을 때만 합침) ─────────
export const count = (s: State, def: string, minQ = 0) =>
  s.inv.filter((b) => b.def === def && b.q >= minQ).reduce((a, b) => a + b.qty, 0);
export function give(s: State, b: Omit<Batch, "id">) {
  const same = s.inv.find((x) => x.def === b.def && x.q === b.q && x.maker === b.maker);
  if (same) same.qty += b.qty;
  else s.inv.push({ ...b, id: uid("b") });
}
export function take(s: State, def: string, n: number, minQ = 0): Batch[] | null {
  if (count(s, def, minQ) < n) return null;
  const out: Batch[] = [];
  for (const b of s.inv.filter((x) => x.def === def && x.q >= minQ)) {
    if (!n) break;
    const k = Math.min(n, b.qty);
    b.qty -= k; n -= k;
    out.push({ ...b, qty: k });
  }
  s.inv = s.inv.filter((b) => b.qty > 0);
  return out;
}
export function newEquip(def: string, q: number, maker?: string, makerName?: string): Equip {
  const d = ITEMS[def];
  return {
    id: uid("eq"), def, q, maker, makerName, dur: d.maxDur ?? 0,
    gems: Array(d.sockets ?? 0).fill(null), innate: d.innate ? d.innate.map((x) => ({ ...x })) : [], history: [],
  };
}
const playerTool = (s: State, def: string) => s.equips.find((e) => e.def === def && !isBroken(e));
export const log = (s: State, msg: string) => { s.log = [msg, ...s.log].slice(0, 40); };
export function ledger(s: State, delta: number, text: string, now: number) {
  s.gold += delta;
  s.ledger = [{ at: now, text, delta }, ...s.ledger].slice(0, 100);
}

// ───────── 초기 상태 ─────────
export function newState(now: number): State {
  const s: State = {
    v: 1, gold: 300, hp: 100, mp: 30, satiety: 80, inv: [], equips: [], weapon: null, heart: null,
    xp: {}, runs: {}, recipes: Object.keys(RECIPES).filter((r) => RECIPES[r].starter),
    work: null, boostUntil: 0, toolUse: {}, farm: Array.from({ length: 16 }, () => ({ seed: null, readyAt: 0 })),
    chickenReadyAt: null,
    school: { date: "", points: 0, lessons: {}, paid: [], learned: [] }, breadDate: "", starter: false,
    bank: { gold: 0, items: [] }, ledger: [], kdemand: {},
    market: SEED_LISTINGS.map((l) => ({
      id: l.id, seller: l.seller, price: l.price,
      ...(l.kind === "equip" ? { equip: demoIron() } : { batch: { id: uid("b"), def: l.def, qty: l.qty, q: l.q, maker: l.maker, makerName: l.makerName } }),
    })),
    orders: [{
      id: "order_public_01", title: "토벌대 철검 2자루", from: "이안", def: "weapon_iron", minQ: 1, qty: 2,
      reward: 180, state: "모집", deadline: now + DAY,
    }],
    profile: null,
    guild: { fish: 18, potion: 12, myFish: 0, myPotion: 0, deliveryDone: false, huntAttempts: 0, huntBest: null, expo: null, treasury: 4200 },
    combat: null, workBuff: null, traitCap: {}, forceNight: null, log: [], lastSeen: now,
    stats: { mined: 0, crafted: 0, kills: 0, trades: 0, lessons: 0 },
  };
  const pick = newEquip("tool_pickaxe", 1), rod = newEquip("tool_rod", 1);
  const sword = newEquip("weapon_copper", 1, "kingdom", "왕국 보급"), heart = newEquip("heart_plain", 1);
  s.equips.push(pick, rod, sword, heart);
  s.weapon = sword.id; s.heart = heart.id;
  dailyCheck(s, now);
  return s;
}
function demoIron(): Equip {
  const e = newEquip("weapon_iron", 3, "user_harin", "하린");
  e.id = "instance_demo_iron"; e.dur = 82;
  e.gems[0] = { def: "gem_fire", q: 1, maker: "user_rumi", makerName: "루미" };
  e.history.push("세공: 루미 (불의 보석 장착)");
  return e;
}
export function claimStarter(s: State) {
  if (s.starter) return log(s, "시작 보급은 이미 수령했습니다.");
  s.starter = true;
  give(s, { def: "ore_iron", qty: 20, q: 1 });
  give(s, { def: "mat_resin", qty: 3, q: 1 });
  give(s, { def: "rough_fire", qty: 1, q: 1 });
  log(s, "시작 보급 수령: 철 원석 20, 숲의 수지 3, 불의 보석 원석 1");
}
// 접속한 날만 학습 포인트 3 지급(미사용분은 자정 소멸, 결석일 보전 없음), 배급 빵 5개
export function dailyCheck(s: State, now: number) {
  const today = kstDate(now);
  if (s.school.date !== today) {
    s.school.date = today; s.school.points = 3;
    log(s, "오늘의 학습 포인트 3 지급 (자정 소멸)");
  }
  if (s.breadDate !== today) {
    s.breadDate = today;
    give(s, { def: "food_royal_bread", qty: 5, q: 1, maker: "kingdom", makerName: "왕국" });
  }
}

// ───────── 빌드: 특성 합산 → 능력치 ─────────
export interface TraitSum { t: string; raw: number; eff: number; sources: string[]; active: boolean; reason: string }
export function equipName(e: Equip) {
  const base = ITEMS[e.def].name;
  const toks = [...new Set(e.gems.filter(Boolean).map((g) => g!.def))]
    .sort((a, b) => ITEMS[a].nameOrder! - ITEMS[b].nameOrder!)
    .map((d) => ITEMS[d].nameToken!);
  if (!toks.length) return base;
  const josa = (w: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? "과" : "와"; };
  return toks.length === 1 ? `${toks[0]}의 ${base}` : `${toks[0]}${josa(toks[0])} ${toks[1]}의 ${base}`;
}
export const gemLevel = (q: number) => (q >= 3 ? 2 : 1);
export const isBroken = (e: Equip) => !!ITEMS[e.def].maxDur && Math.floor(e.dur) <= 0;

export function build(s: State, now: number, weaponId = s.weapon, heartId = s.heart) {
  const w = s.equips.find((e) => e.id === weaponId), h = s.equips.find((e) => e.id === heartId);
  const map = new Map<string, { raw: number; sources: string[] }>();
  const add = (t: string, lv: number, src: string) => {
    const m = map.get(t) ?? { raw: 0, sources: [] };
    m.raw += lv; m.sources.push(`${src} +${lv}`); map.set(t, m);
  };
  for (const [e, slot] of [[w, "무기"], [h, "심장"]] as const) {
    if (!e || isBroken(e)) continue; // 내구도 0 장비는 수치·특성·보석 전부 비활성
    e.innate.forEach((x) => add(x.t, x.lv, `${slot} 고유`));
    e.gems.forEach((g) => g && add(ITEMS[g.def].trait!, gemLevel(g.q), `${slot} ${ITEMS[g.def].name}${g.makerName ? ` (세공: ${g.makerName})` : ""}`));
  }
  const { night } = gameClock(s, now);
  const traits: TraitSum[] = [...map].map(([t, m]) => {
    const eff = Math.min(m.raw, 5, s.traitCap[t] ?? 5);
    const cond = t === "trait_night";
    return { t, raw: m.raw, eff, sources: m.sources, active: !cond || night, reason: cond ? (night ? "활성: 밤" : "대기: 낮") : "상시" };
  });
  const val = (t: string) => { const x = traits.find((y) => y.t === t && y.active); return x ? TRAITS[t].values[x.eff - 1] : 0; };
  const wm = w && !isBroken(w) ? QUALITY_MULT[w.q] : 0, hm = h ? QUALITY_MULT[h.q] : 0;
  const wd = w ? ITEMS[w.def] : null, hd = h ? ITEMS[h.def] : null;
  // 순서: 기본값+장비 기본 → 특성 고정 가산 → 비율 → 제한
  let atk = 2 + (wd?.atk ?? 0) * wm + (hd?.atk ?? 0) * hm + val("trait_courage") + val("trait_night");
  let speed = 1;
  const rage = val("trait_rage");
  atk *= 1 + rage / 100; speed *= 1 + rage / 100;
  const rage5 = traits.some((x) => x.t === "trait_rage" && x.eff === 5);
  return {
    traits,
    maxHp: Math.max(1, 100 + (hd?.hp ?? 0) * hm + val("trait_blessing")),
    maxMp: Math.max(0, 30 + (hd?.mp ?? 0) * hm + val("trait_focus")),
    atk: Math.max(0, atk),
    def: Math.max(0, 1 + (hd?.def ?? 0) * hm + val("trait_patience")),
    fire: val("trait_heat"),
    odd: val("trait_odd"),
    speed: clamp(speed, 0.1, 5),
    hit: clamp(0.95 - (rage5 ? 0.15 : 0), 0.05, 1),
    crit: 0.05, critMult: 1.5, mcrit: 0.05, mcritMult: 1.5,
  };
}
// 장비 단독 기여(합산 전 미리보기용)
export function equipContribution(e: Equip) {
  const d = ITEMS[e.def], m = QUALITY_MULT[e.q];
  const lines: string[] = [];
  if (d.atk) lines.push(`기본 공격력 ${+(d.atk * m).toFixed(1)}`);
  if (d.hp) lines.push(`기본 최대 체력 +${+(d.hp * m).toFixed(1)}`);
  if (d.mp) lines.push(`기본 최대 MP +${+(d.mp * m).toFixed(1)}`);
  if (d.def) lines.push(`기본 방어력 +${+(d.def * m).toFixed(1)}`);
  const ts: [string, number, string][] = [
    ...e.innate.map((x) => [x.t, x.lv, "고유"] as [string, number, string]),
    ...e.gems.filter(Boolean).map((g) => [ITEMS[g!.def].trait!, gemLevel(g!.q), `${ITEMS[g!.def].name}${g!.makerName ? ` / 세공자: ${g!.makerName}` : ""}`] as [string, number, string]),
  ];
  return { lines, traits: ts.map(([t, lv, src]) => ({ name: `${TRAITS[t].name} Lv.${lv}`, effect: traitEffectText(t, lv), src })) };
}
export function traitEffectText(t: string, lv: number) {
  const d = TRAITS[t], v = d.values[Math.min(lv, 5) - 1];
  if (t === "trait_rage") return `공격력·공격속도 +${v}%${lv >= 5 ? " / 명중률 -15%p" : ""}`;
  return `${d.levels[0]} +${v}`;
}

// ───────── 작업 ─────────
export function workDef(w: Work) {
  if (w.kind === "gather") { const g = GATHER[w.target]; return { name: g.name, sec: g.sec, field: g.field }; }
  const r = RECIPES[w.target];
  return { name: `${ITEMS[r.out].name} ${r.cat}`, sec: r.sec * (w.sturdy ? 1.5 : 1), field: r.field };
}
export function satietyEff(sat: number) { return sat >= 30 ? 1 : sat >= 1 ? 0.9 : 0.8; }
export function workSpeed(s: State, w: Work, now: number, online: boolean) {
  const parts: [string, number][] = [];
  const { field } = workDef(w);
  let m = 1;
  if (w.kind === "gather") {
    const sp = masteryEffect(indivLv(s, w.target)).speed;
    if (sp) { m *= 1 + sp / 100; parts.push([`개별 숙련도`, sp]); }
  } else if ((s.runs[w.target] ?? 0) >= 10) { m *= 1 / 0.98; parts.push(["레시피 암기", 2]); }
  const fb = Math.min(5, (fieldLv(s, field) / 1000) * 5);
  if (fb >= 0.01) { m *= 1 + fb / 100; parts.push([FIELDS[field], +fb.toFixed(2)]); }
  if (s.workBuff && s.workBuff.until > now && w.kind === "gather" && field === "mining") { m *= 1.05; parts.push([s.workBuff.name, 5]); }
  m = Math.min(m, 2); // 전체 속도 상한(최소 완료 시간 보장)
  const se = satietyEff(s.satiety);
  if (se < 1) parts.push(["포만감 부족", Math.round((se - 1) * 100)]);
  m *= se;
  const boosted = online && s.boostUntil > now;
  if (boosted) { m *= 1.2; parts.push(["클릭 가속", 20]); }
  return { mult: m, parts, boosted };
}
export const cycleMs = (s: State, w: Work, now: number, online: boolean) => (workDef(w).sec * SEC) / workSpeed(s, w, now, online).mult;

export function canStart(s: State, kind: Work["kind"], target: string, sturdy = false): string | null {
  if (s.combat && !s.combat.end) return "전투 중에는 생산 작업을 시작할 수 없습니다.";
  if (kind === "gather") {
    if (!playerTool(s, GATHER[target].tool)) return `${ITEMS[GATHER[target].tool].name}이(가) 필요합니다 (내구도 부족 포함).`;
    return null;
  }
  if (!s.recipes.includes(target)) return "등록되지 않은 레시피입니다.";
  const miss = missing(s, target, 1, sturdy);
  return miss.length ? `재료 부족: ${miss.map(([d, n]) => `${ITEMS[d].name} ${n}개`).join(", ")}` : null;
}
export function recipeInputs(id: string, sturdy = false): [string, number][] {
  const r = RECIPES[id];
  return sturdy ? r.inputs.map(([d, n]) => [d, d === "bar_iron" ? n + 1 : n]) : r.inputs;
}
export function missing(s: State, id: string, times: number, sturdy = false) {
  return recipeInputs(id, sturdy).map(([d, n]) => [d, n * times - count(s, d)] as [string, number]).filter(([, n]) => n > 0);
}
export function startWork(s: State, kind: Work["kind"], target: string, repeat: number, sturdy = false) {
  const err = canStart(s, kind, target, sturdy);
  if (err) return log(s, err);
  cancelWork(s);
  s.work = { kind, target, repeat: kind === "gather" ? 0 : Math.max(1, repeat), done: 0, progress: 0, reserved: null, paused: false, stopAfter: false, sturdy };
  if (kind === "recipe") reserve(s);
  log(s, `작업 시작: ${workDef(s.work!).name}`);
}
function reserve(s: State) {
  const w = s.work!;
  const ins = recipeInputs(w.target, w.sturdy);
  if (missing(s, w.target, 1, w.sturdy).length) return false;
  w.reserved = ins.flatMap(([d, n]) => take(s, d, n)!);
  return true;
}
// 완료 전 취소: 예약 재료 반환, 결과·경험치 없음
export function cancelWork(s: State) {
  if (!s.work) return;
  s.work.reserved?.forEach((b) => give(s, b));
  s.work = null;
}
export function clickBoost(s: State, now: number) {
  if (s.work && !s.work.paused) s.boostUntil = now + 3 * SEC; // 갱신만, 중첩 없음
}
function addXp(s: State, key: string, f: Field, sec: number) {
  s.xp[key] = (s.xp[key] ?? 0) + 10;
  s.xp[fieldKey(f)] = (s.xp[fieldKey(f)] ?? 0) + sec;
  s.runs[key] = (s.runs[key] ?? 0) + 1;
}
function stopWork(s: State, reason: string) { log(s, `작업 중단: ${reason}`); cancelWork(s); return reason; }

// 실시간·오프라인 공용 진행. 반환값: 중단 사유
export function workTick(s: State, dt: number, now: number, online: boolean): string | null {
  let w = s.work;
  while (w && !w.paused && dt > 0) {
    if (w.kind === "recipe" && !w.reserved && !reserve(s)) return stopWork(s, "재료 소진");
    const dur = cycleMs(s, w, now, online);
    const need = (1 - w.progress) * dur;
    if (dt < need) { w.progress += dt / dur; return null; }
    dt -= need; w.progress = 0;
    const r = completeCycle(s, w);
    if (r) return stopWork(s, r);
    w.done++;
    if (w.stopAfter || (w.repeat && w.done >= w.repeat)) { log(s, `작업 완료: ${workDef(w).name} ${w.done}회`); s.work = null; return null; }
    w = s.work;
  }
  return null;
}
function completeCycle(s: State, w: Work): string | null {
  const def = workDef(w);
  s.satiety = Math.max(0, s.satiety - 0.2);
  if (w.kind === "gather") {
    const g = GATHER[w.target];
    if (s.inv.length >= INV_LIMIT && !s.inv.some((b) => b.def === g.out && b.q === 1 && !b.maker)) return "인벤토리 한도";
    const eff = masteryEffect(indivLv(s, w.target));
    const n = 1 + (Math.random() < eff.extra / 100 ? 1 : 0); // 추가 획득은 기본 보상 1개당 1회
    give(s, { def: g.out, qty: n, q: 1 });
    if (g.rare && Math.random() < g.rare.p) { give(s, { def: g.rare.id, qty: 1, q: 1 }); log(s, `희귀 발견! ${ITEMS[g.rare.id].name}`); }
    if (g.field === "mining") s.stats.mined += n;
    addXp(s, w.target, g.field, g.sec);
    const tool = playerTool(s, g.tool)!;
    s.toolUse[g.tool] = (s.toolUse[g.tool] ?? 0) + 1;
    if (s.toolUse[g.tool] % 20 === 0) tool.dur -= 1;
    if (isBroken(tool)) return `${ITEMS[g.tool].name} 내구도 0`;
    return null;
  }
  const r = RECIPES[w.target], out = ITEMS[r.out];
  const res = w.reserved!;
  const total = res.reduce((a, b) => a + b.qty, 0);
  const matScore = res.reduce((a, b) => a + QUALITY_MAT_SCORE[b.q] * b.qty, 0) / total;
  const score = clamp(masteryEffect(indivLv(s, w.target)).score + matScore, 0, 100);
  const q = rollQuality(score);
  if (out.cat === "weapon" || out.cat === "heart") {
    const e = newEquip(r.out, q, PLAYER.id, PLAYER.name);
    if (w.sturdy) { e.sturdy = true; e.history.push("박람회 전용 견고 제작"); }
    const src = res.filter((b) => b.makerName).map((b) => `${ITEMS[b.def].name}(제련: ${b.makerName})`);
    if (src.length) e.history.push(`재료 출처: ${[...new Set(src)].join(", ")}`);
    s.equips.push(e);
  } else give(s, { def: r.out, qty: r.qty, q, maker: PLAYER.id, makerName: PLAYER.name });
  w.reserved = null;
  s.stats.crafted++;
  addXp(s, w.target, r.field, def.sec);
  if (s.runs[w.target] === 10) log(s, `레시피 암기 완료: ${out.name} (제작 시간 -2%)`);
  log(s, `${out.name} 완성 · 품질 ${["불량", "보통", "양질", "우수", "명품"][q]}`);
  return null;
}

// 오프라인 정산: 최대 8시간, 클릭 가속 없음, 전투는 중단
export function offlineCatchUp(s: State, now: number) {
  const elapsed = Math.min(OFFLINE_MAX, Math.max(0, now - s.lastSeen));
  s.lastSeen = now;
  if (s.combat && !s.combat.end) { s.combat = null; log(s, "오프라인 중 사냥은 중단되었습니다."); }
  if (elapsed < 5 * SEC || !s.work) return null;
  const before = new Map<string, number>(), name = workDef(s.work).name;
  s.inv.forEach((b) => before.set(b.def, (before.get(b.def) ?? 0) + b.qty));
  const eqBefore = s.equips.length;
  s.boostUntil = 0;
  const reason = workTick(s, elapsed, now, false);
  const gained: string[] = [];
  const after = new Map<string, number>();
  s.inv.forEach((b) => after.set(b.def, (after.get(b.def) ?? 0) + b.qty));
  after.forEach((n, d) => { const k = n - (before.get(d) ?? 0); if (k > 0) gained.push(`${ITEMS[d].name} +${k}`); });
  if (s.equips.length > eqBefore) gained.push(`장비 +${s.equips.length - eqBefore}`);
  return `${fmtMs(elapsed)} 동안 ${name}: ${gained.join(", ") || "획득 없음"}${reason ? ` · 중단 사유: ${reason}` : ""}`;
}

// ───────── 소비·장비 ─────────
export function eat(s: State, batchId: string, now: number) {
  const b = s.inv.find((x) => x.id === batchId);
  if (!b) return;
  const d = ITEMS[b.def];
  if (d.cat === "food" && s.combat && !s.combat.end) return log(s, "음식은 전투 중 사용할 수 없습니다.");
  const bm = build(s, now), qm = QUALITY_MULT[b.q];
  if (d.cat === "potion") {
    if (s.combat && !s.combat.end) {
      if (s.combat.t < s.combat.potionAt) return log(s, `포션 재사용 대기 ${fmtMs(s.combat.potionAt - s.combat.t)}`);
      s.combat.potionAt = s.combat.t + 10 * SEC;
    }
    if (d.heal) s.hp = Math.min(bm.maxHp, s.hp + d.heal * qm);
    if (d.healMp) s.mp = Math.min(bm.maxMp, s.mp + d.healMp * qm);
  } else {
    s.satiety = Math.min(100, s.satiety + (d.satiety ?? 0) * qm);
    if (d.heal) s.hp = Math.min(bm.maxHp, s.hp + d.heal * qm);
    if (b.def === "food_stew") s.workBuff = { name: "광부의 스튜", until: now + 15 * MIN };
  }
  b.qty--; s.inv = s.inv.filter((x) => x.qty > 0); // 선택한 배치를 정확히 소비
  log(s, `${d.name} 사용`);
}
export function equip(s: State, id: string) {
  const e = s.equips.find((x) => x.id === id);
  if (!e || e.locked) return;
  if (s.combat && !s.combat.end) return log(s, "전투 중에는 장비를 바꿀 수 없습니다.");
  const cat = ITEMS[e.def].cat;
  if (cat === "weapon") s.weapon = id; else if (cat === "heart") s.heart = id;
  log(s, `${equipName(e)} 장착`);
}
export function socketGem(s: State, equipId: string, batchId: string) {
  const e = s.equips.find((x) => x.id === equipId), b = s.inv.find((x) => x.id === batchId);
  if (!e || !b || ITEMS[b.def].cat !== "gem") return;
  if (s.combat && !s.combat.end) return log(s, "전투 중에는 보석을 바꿀 수 없습니다.");
  const slot = e.gems.indexOf(null);
  if (slot < 0) return log(s, `보석 홈이 가득 찼습니다 (${e.gems.length}/${e.gems.length}).`);
  b.qty--; s.inv = s.inv.filter((x) => x.qty > 0); // 가방에서 차감 → 장착 귀속
  e.gems[slot] = { def: b.def, q: b.q, maker: b.maker, makerName: b.makerName };
  e.history.push(`보석 장착: ${ITEMS[b.def].name}${b.makerName ? ` (세공: ${b.makerName})` : ""}`);
  log(s, `${ITEMS[b.def].name} 장착 → ${equipName(e)}`);
}
export function removeGem(s: State, equipId: string, slot: number) {
  const e = s.equips.find((x) => x.id === equipId), g = e?.gems[slot];
  if (!e || !g) return;
  if (!take(s, "part_extract", 1)) return log(s, "보석 추출제 1개가 필요합니다.");
  e.gems[slot] = null;
  give(s, { def: g.def, qty: 1, q: g.q, maker: g.maker, makerName: g.makerName }); // 출처 보존
  log(s, `${ITEMS[g.def].name} 추출 → ${equipName(e)}`);
}
export function repair(s: State, id: string) {
  const e = s.equips.find((x) => x.id === id);
  if (!e || !ITEMS[e.def].maxDur) return;
  const max = ITEMS[e.def].maxDur!;
  if (e.dur >= max) return;
  if (!take(s, "part_repair", 1)) return log(s, "철 수리 부품이 필요합니다.");
  e.dur = Math.min(max, e.dur + 20);
  e.history.push(`수리: ${PLAYER.name}`); // 원 제작자는 바뀌지 않음
  log(s, `${equipName(e)} 수리 (+20)`);
}
export function dismantle(s: State, id: string) {
  const e = s.equips.find((x) => x.id === id);
  if (!e || e.locked || id === s.weapon || id === s.heart) return log(s, "장착·잠금 장비는 분해할 수 없습니다.");
  e.gems.forEach((g) => g && give(s, { def: g.def, qty: 1, q: g.q, maker: g.maker, makerName: g.makerName }));
  s.equips = s.equips.filter((x) => x !== e);
  give(s, { def: "mat_scrap", qty: 3, q: 1 });
  log(s, `${equipName(e)} 분해 → 금속 조각 3`);
}

// ───────── 농장·목축 ─────────
export function plant(s: State, i: number, seed: string, now: number) {
  const p = s.farm[i];
  if (p.seed) return;
  if (!take(s, seed, 1)) return log(s, `${ITEMS[seed].name}이 없습니다.`);
  p.seed = seed; p.readyAt = now + CROPS[seed].min * MIN;
  s.satiety = Math.max(0, s.satiety - 0.2);
}
export function harvest(s: State, i: number, now: number) {
  const p = s.farm[i];
  if (!p.seed || p.readyAt > now) return;
  const c = CROPS[p.seed];
  const lv = fieldLv(s, "farming");
  const variantP = 0.005 + Math.min(0.02, (lv / 1000) * 0.02);
  let n = c.per;
  if (c.variant && Math.random() < variantP) { n--; give(s, { def: c.variant, qty: 1, q: 1, maker: PLAYER.id, makerName: PLAYER.name }); log(s, `변종 발견! ${ITEMS[c.variant].name}`); }
  give(s, { def: c.out, qty: n, q: 1, maker: PLAYER.id, makerName: PLAYER.name });
  s.xp[`farm:${p.seed}`] = (s.xp[`farm:${p.seed}`] ?? 0) + 10;
  s.xp[fieldKey("farming")] = (s.xp[fieldKey("farming")] ?? 0) + c.min * 6;
  s.satiety = Math.max(0, s.satiety - 0.2);
  p.seed = null; p.readyAt = 0; // 수확 후 비워서 중복 수확 차단
}
export function feedChicken(s: State, now: number) {
  if (s.chickenReadyAt) return;
  if (!take(s, "crop_wheat", 1)) return log(s, "사료용 밀 1개가 필요합니다.");
  s.chickenReadyAt = now + 10 * MIN;
}
export function collectEggs(s: State, now: number) {
  if (!s.chickenReadyAt || s.chickenReadyAt > now) return;
  s.chickenReadyAt = null;
  give(s, { def: "animal_egg", qty: 2, q: 1, maker: PLAYER.id, makerName: PLAYER.name });
}

// ───────── 전투 ─────────
export const mitigate = (raw: number, def: number, penRate = 0, penFlat = 0) =>
  Math.max(0, raw - Math.max(0, def * (1 - penRate) - penFlat));
// 방어막관통 = 방어막에 가하는 피해 증가. 초과 증폭분은 HP로 넘기지 않는다.
export function shieldAbsorb(D: number, S: number, P = 0) {
  const M = 1 + P, A = Math.min(D, S / M);
  return { shieldLoss: A * M, hp: D - A };
}
export function startCombat(s: State, mob: string, opts: { hunt?: boolean } = {}) {
  if (s.combat && !s.combat.end) return;
  if (s.work) { cancelWork(s); log(s, "사냥을 시작하여 생산 작업을 중단했습니다."); }
  const m = MOBS[mob];
  s.combat = {
    mob, mobHp: m.hp, mobMax: m.hp, pShield: m.pShield ?? 0, mShield: m.mShield ?? 0,
    t: 0, pG: 0, mG: 0, pending: null, potionAt: 0, cds: {}, poison: null, defBuffUntil: 0, myMShield: null,
    log: [`${m.name} 출현!`], auto: !opts.hunt && !m.dev, hunt: opts.hunt, limit: opts.hunt ? 60 * SEC : undefined,
    pActs: 0, mActs: 0,
  };
}
export function queueSpell(s: State, spell: string | null) { if (s.combat && !s.combat.end) s.combat.pending = spell; }
export function flee(s: State) { if (s.combat && !s.combat.end) { s.combat.end = "도주"; s.combat.log.unshift("도주했습니다."); } }

export function combatTick(s: State, dt: number, now: number, r: () => number = Math.random) {
  const c = s.combat;
  if (!c || c.end) return;
  const m = MOBS[c.mob], b = build(s, now);
  const say = (x: string) => { c.log = [x, ...c.log].slice(0, 30); };
  const prevT = c.t;
  c.t += dt;
  const w = s.equips.find((e) => e.id === s.weapon);
  if (w && ITEMS[w.def].maxDur) w.dur = Math.max(0, w.dur - dt / MIN); // 전투 60초당 1, 소수 누적
  s.satiety = Math.max(0, s.satiety - dt / MIN);
  if (m.poison && Math.floor(c.t / 20000) > Math.floor(prevT / 20000)) {
    c.poison = { until: c.t + 10 * SEC, next: c.t + 2 * SEC }; say(`${m.name}의 독안개! 중독 (10초)`);
  }
  if (c.poison) {
    while (c.poison.next <= c.t && c.poison.next <= c.poison.until) { s.hp -= 2; c.poison.next += 2 * SEC; say("중독 피해 2"); }
    if (c.t >= c.poison.until) c.poison = null;
  }
  // 행동 게이지: 공격속도 × 경과시간 / 기준 턴. 소수 보존.
  // 고정소수점 정수(속도 1/1000 × ms)로 누적해 프레임 크기와 무관하게 정확
  c.pG += Math.round(b.speed * 1000) * dt;
  c.mG += Math.round(m.speed * 1000) * dt;
  while (c.pG >= GAUGE_FULL || c.mG >= GAUGE_FULL) {
    // 같은 시각 준비된 행동은 시작 상태로 확정 후 동시 처리
    const pAct = c.pG >= GAUGE_FULL, mAct = c.mG >= GAUGE_FULL;
    if (pAct) { c.pG -= GAUGE_FULL; c.pActs++; playerAct(s, c, b, say, r); }
    if (mAct) {
      c.mG -= GAUGE_FULL; c.mActs++;
      if (m.atk > 0) {
        const def = b.def + (c.defBuffUntil > c.t ? 4 : 0);
        const dmg = mitigate(m.atk, def);
        s.hp -= dmg;
        say(dmg ? `${m.name}의 공격: 피해 ${+dmg.toFixed(1)}` : `${m.name}의 공격: 막힘`);
      }
    }
    if (c.mobHp <= 0 || s.hp <= 0) break;
  }
  if (c.myMShield && c.myMShield.until <= c.t) c.myMShield = null;
  if (s.hp <= 0) {
    c.end = "패배"; s.hp = 1;
    if (w && ITEMS[w.def].maxDur) w.dur = Math.max(0, w.dur - 5);
    say("쓰러졌습니다. 마을로 귀환 (무기 내구도 -5)");
  } else if (c.mobHp <= 0) {
    c.end = "승리"; s.stats.kills++;
    s.xp[fieldKey("adventure")] = (s.xp[fieldKey("adventure")] ?? 0) + Math.round(c.t / SEC);
    s.xp[`hunt:${c.mob}`] = (s.xp[`hunt:${c.mob}`] ?? 0) + 10;
    if (m.drop) { give(s, { def: m.drop, qty: 1, q: 1 }); say(`${ITEMS[m.drop].name} 획득`); }
    if (m.heart && r() < 0.01) { s.equips.push(newEquip(m.heart, 1)); say(`희귀! ${ITEMS[m.heart].name} 획득`); }
  } else if (c.limit && c.t >= c.limit) {
    c.end = "시간 종료"; say("제한 시간 종료");
  }
  if (c.end && c.hunt) recordHunt(s, c);
}
function playerAct(s: State, c: Combat, b: ReturnType<typeof build>, say: (x: string) => void, r: () => number) {
  const m = MOBS[c.mob];
  const sp = c.pending ? SPELLS[c.pending] : null;
  c.pending = null; // 대기열 1개
  if (sp) {
    const id = Object.keys(SPELLS).find((k) => SPELLS[k] === sp)!;
    if (s.mp < sp.mp) say(`${sp.name}: MP 부족 → 기본 공격`);
    else if ((c.cds[id] ?? 0) > c.t) say(`${sp.name}: 재사용 대기 → 기본 공격`);
    else {
      s.mp -= sp.mp; c.cds[id] = c.t + sp.cd * SEC;
      if (sp.fire) {
        // 화염 주문: 장비 화염 공격력을 1회 더한 뒤 마법 판정
        const crit = r() < b.mcrit;
        const raw = (sp.fire + b.fire) * (crit ? b.mcritMult : 1);
        const D = mitigate(raw, 0);
        const sh = shieldAbsorb(D, c.mShield);
        c.mShield -= sh.shieldLoss; c.mobHp -= sh.hp;
        say(`${sp.name}! 화염 마법 피해 ${+D.toFixed(1)}${crit ? " (치명타)" : ""}`);
      }
      if (sp.heal) { s.hp = Math.min(b.maxHp, s.hp + sp.heal); say(`${sp.name}: HP +${sp.heal}`); }
      if (sp.defBuff) { c.defBuffUntil = c.t + 10 * SEC; say(`${sp.name}: 방어 +4 (10초)`); }
      if (sp.mShield) { c.myMShield = { amt: sp.mShield, until: c.t + 15 * SEC }; say(`${sp.name}: 마법 방어막 15`); }
      return;
    }
  }
  if (r() >= b.hit) return say("기본 공격: 빗나감");
  // 물리 성분
  const crit = r() < b.crit;
  const odd = b.odd && Math.floor(c.mobHp) % 2 === 1 ? b.odd : 0; // 피해 직전 HP로 1회 판정
  const pD = mitigate((b.atk + odd) * (crit ? b.critMult : 1), m.def);
  const ps = shieldAbsorb(pD, c.pShield);
  c.pShield -= ps.shieldLoss;
  // 화염 성분(열기): 별도 magic/fire 성분, 마법 치명타·방어 사용
  let fD = 0, fs = { shieldLoss: 0, hp: 0 };
  if (b.fire) {
    const mc = r() < b.mcrit;
    fD = mitigate(b.fire * (mc ? b.mcritMult : 1), 0);
    fs = shieldAbsorb(fD, c.mShield);
    c.mShield -= fs.shieldLoss;
  }
  c.mobHp -= ps.hp + fs.hp;
  const parts = [`물리 ${+pD.toFixed(1)}${crit ? "(치명)" : ""}`];
  if (fD) parts.push(`화염 ${+fD.toFixed(1)}`);
  if (ps.shieldLoss) parts.push(`방어막 -${+ps.shieldLoss.toFixed(1)}`);
  say(`기본 공격: ${pD + fD ? parts.join(" + ") : "막힘"}`);
}
function recordHunt(s: State, c: Combat) {
  const res: HuntResult = { killed: c.mobHp <= 0, timeLeft: Math.max(0, (c.limit ?? 0) - c.t), bossHp: Math.max(0, Math.ceil(c.mobHp)) };
  const best = s.guild.huntBest;
  if (!best || huntCmp(res, best) < 0) s.guild.huntBest = res;
  c.hunt = false; // 1회만 기록
}
// 순위: 처치 여부 → 남은 시간 → 남은 보스 HP
export const huntCmp = (a: HuntResult, b: HuntResult) =>
  Number(b.killed) - Number(a.killed) || b.timeLeft - a.timeLeft || a.bossHp - b.bossHp;
export function startHunt(s: State) {
  if (s.guild.huntAttempts >= 3) return log(s, "이번 주 유효 도전 3회를 모두 사용했습니다.");
  s.guild.huntAttempts++;
  startCombat(s, "boss_marsh", { hunt: true });
}

// ───────── 학교 ─────────
export function attendLesson(s: State, spell: string) {
  const sp = SPELLS[spell], sc = s.school;
  if (sc.learned.includes(spell)) return log(s, "이미 배운 마법입니다.");
  if (sc.points < 1) return log(s, "오늘 학습 포인트를 모두 사용했습니다.");
  if (sp.pre && !sc.learned.includes(sp.pre)) return log(s, `선행 마법 필요: ${SPELLS[sp.pre].name}`);
  if (!sc.paid.includes(spell)) {
    // 첫 수업(첫 해석) 때만 요구 아이템 소비
    const minQ = spell === "spell_flame" ? 1 : 0;
    if (sp.items.some(([d, n]) => count(s, d, minQ) < n)) return log(s, `첫 회차 재료 부족: ${sp.items.map(([d, n]) => `${ITEMS[d].name}×${n}`).join(", ")}`);
    sp.items.forEach(([d, n]) => take(s, d, n, minQ));
    sc.paid.push(spell);
  }
  sc.points--; s.stats.lessons++;
  sc.lessons[spell] = (sc.lessons[spell] ?? 0) + 1;
  if (sc.lessons[spell] >= sp.lessons) { sc.learned.push(spell); log(s, `마법 습득: ${sp.name}`); }
  else log(s, `${sp.name} 진도 ${sc.lessons[spell]}/${sp.lessons}`);
}

// ───────── 왕국 거래 ─────────
export function kingdomPrice(s: State, def: string, q: number, now: number) {
  const d = s.kdemand[def];
  const vol = d ? d.vol * Math.max(0, 1 - (now - d.at) / DAY) : 0; // 24시간에 걸쳐 회복
  const factor = 1.1 - 0.6 * Math.min(1, vol / 50);
  return { unit: ITEMS[def].price * QUALITY_MULT[q] * factor, factor, closed: vol >= 50, vol };
}
export function sellKingdom(s: State, batchId: string, n: number, now: number) {
  const b = s.inv.find((x) => x.id === batchId);
  if (!b || ITEMS[b.def].noTrade) return log(s, "거래할 수 없는 물품입니다.");
  n = Math.min(n, b.qty);
  const p = kingdomPrice(s, b.def, b.q, now);
  if (p.closed) return log(s, "왕국 매입 한도 도달. 회복을 기다려 주세요.");
  const gross = Math.floor(p.unit * n), fee = Math.ceil(gross * 0.01);
  b.qty -= n; s.inv = s.inv.filter((x) => x.qty > 0);
  s.kdemand[b.def] = { vol: p.vol + n, at: now };
  ledger(s, gross - fee, `왕국 매각 ${ITEMS[b.def].name}×${n} (수수료 ${fee})`, now);
}
export const SHOP = ["seed_wheat", "seed_potato", "seed_red", "seed_blue", "tool_pickaxe", "tool_rod", "weapon_copper"];
export function buyKingdom(s: State, def: string, n: number, now: number) {
  const cost = ITEMS[def].price * n;
  if (s.gold < cost) return log(s, "골드가 부족합니다.");
  ledger(s, -cost, `왕국 상점 ${ITEMS[def].name}×${n}`, now);
  const cat = ITEMS[def].cat;
  if (cat === "tool" || cat === "weapon") for (let i = 0; i < n; i++) s.equips.push(newEquip(def, 1, "kingdom", "왕국 보급"));
  else give(s, { def, qty: n, q: 1 });
}

// ───────── 개인 거래 (소유권 이동만, 생성 없음) ─────────
export function buyListing(s: State, id: string, now: number) {
  const l = s.market.find((x) => x.id === id);
  if (!l || l.seller === PLAYER.name) return;
  const total = l.price * (l.batch?.qty ?? 1);
  if (s.gold < total) return log(s, "골드가 부족합니다.");
  ledger(s, -total, `거래소 구매 (판매자 ${l.seller})`, now);
  if (l.equip) s.equips.push(l.equip); else give(s, l.batch!);
  s.market = s.market.filter((x) => x !== l);
  s.stats.trades++;
}
export function listItem(s: State, kind: "batch" | "equip", id: string, qty: number, price: number) {
  if (price < 1) return;
  if (kind === "equip") {
    const e = s.equips.find((x) => x.id === id);
    if (!e || e.locked || id === s.weapon || id === s.heart) return log(s, "장착·잠금 장비는 판매할 수 없습니다.");
    s.equips = s.equips.filter((x) => x !== e);
    s.market.push({ id: uid("l"), seller: PLAYER.name, price, equip: e });
  } else {
    const b = s.inv.find((x) => x.id === id);
    if (!b || ITEMS[b.def].noTrade) return log(s, "거래할 수 없는 물품입니다.");
    qty = Math.min(qty, b.qty);
    b.qty -= qty; s.inv = s.inv.filter((x) => x.qty > 0);
    s.market.push({ id: uid("l"), seller: PLAYER.name, price, batch: { ...b, qty } });
  }
}
export function cancelListing(s: State, id: string) {
  const l = s.market.find((x) => x.id === id && x.seller === PLAYER.name);
  if (!l) return;
  if (l.equip) s.equips.push(l.equip); else give(s, l.batch!);
  s.market = s.market.filter((x) => x !== l);
}
export function demoFillListing(s: State, id: string, now: number) {
  const l = s.market.find((x) => x.id === id && x.seller === PLAYER.name);
  if (!l) return;
  const gross = l.price * (l.batch?.qty ?? 1), fee = Math.ceil(gross * 0.03);
  ledger(s, gross - fee, `거래소 판매 체결 (데모 구매자, 수수료 ${fee})`, now);
  s.market = s.market.filter((x) => x !== l);
  s.stats.trades++;
}

// ───────── 제작 의뢰 ─────────
export function createOrder(s: State, o: { title: string; def: string; minQ: number; qty: number; reward: number; to?: string }, now: number) {
  const title = o.title.trim().slice(0, 40);
  if (!title || o.reward < 1 || o.qty < 1) return log(s, "제목·수량·보수를 확인하세요.");
  s.orders.unshift({ id: uid("order"), title, from: PLAYER.name, to: o.to, def: o.def, minQ: o.minQ, qty: o.qty, reward: o.reward, state: "견적", deadline: now + 2 * DAY });
}
export function confirmOrder(s: State, id: string, now: number) {
  const o = s.orders.find((x) => x.id === id && x.state === "견적");
  if (!o) return;
  if (s.gold < o.reward) return log(s, "보수 예치에 필요한 골드가 부족합니다.");
  ledger(s, -o.reward, `의뢰 보수 예치: ${o.title}`, now);
  o.state = "모집";
}
export function cancelOrder(s: State, id: string, now: number) {
  const o = s.orders.find((x) => x.id === id && x.from === PLAYER.name);
  if (!o || (o.state !== "견적" && o.state !== "모집")) return log(s, "수락 후에는 단독 취소할 수 없습니다.");
  if (o.state === "모집") ledger(s, o.reward, `의뢰 취소 환불: ${o.title}`, now);
  o.state = "취소";
}
export function demoArtisanProgress(s: State, id: string, now: number) {
  const o = s.orders.find((x) => x.id === id && x.from === PLAYER.name);
  if (!o) return;
  if (o.state === "모집") { o.state = "수락"; o.to ??= "하린"; log(s, `${o.to}님이 의뢰를 수락했습니다 (데모).`); return; }
  if (o.state !== "수락") return;
  const maker = o.to ?? "하린";
  for (let i = 0; i < o.qty; i++) s.equips.push(newEquip(o.def, Math.max(o.minQ, 3), `seed_${maker}`, maker));
  o.state = "완료";
  ledger(s, 0, `의뢰 정산: ${o.title} → ${maker} 보수 ${o.reward - Math.ceil(o.reward * 0.03)} (수수료 ${Math.ceil(o.reward * 0.03)})`, now);
}
export function acceptOrder(s: State, id: string) {
  const o = s.orders.find((x) => x.id === id && x.state === "모집" && x.from !== PLAYER.name);
  if (o) { o.state = "수락"; o.to = PLAYER.name; }
}
export function deliverOrder(s: State, id: string, now: number) {
  const o = s.orders.find((x) => x.id === id && x.state === "수락" && x.to === PLAYER.name);
  if (!o) return;
  const ok = s.equips.filter((e) => e.def === o.def && e.q >= o.minQ && !e.locked && e.id !== s.weapon && e.id !== s.heart);
  if (ok.length < o.qty) return log(s, `조건에 맞는 ${ITEMS[o.def].name} ${o.qty}개가 필요합니다 (보유 ${ok.length}). 부분 납품 불가.`);
  const sent = ok.slice(0, o.qty);
  s.equips = s.equips.filter((e) => !sent.includes(e));
  const fee = Math.ceil(o.reward * 0.03);
  ledger(s, o.reward - fee, `의뢰 납품: ${o.title} (수수료 ${fee})`, now);
  o.state = "완료";
}

// ───────── 길드 ─────────
export function contribute(s: State, kind: "fish" | "potion") {
  const g = s.guild, def = kind === "fish" ? "food_fish" : "potion_hp", need = kind === "fish" ? 30 : 20;
  if (g.deliveryDone || g[kind] >= need) return;
  if (!take(s, def, 1)) return log(s, `${ITEMS[def].name}이 없습니다.`);
  g[kind]++;
  if (kind === "fish") g.myFish++; else g.myPotion++;
}
export function claimDelivery(s: State, now: number) {
  const g = s.guild;
  if (g.deliveryDone || g.fish < 30 || g.potion < 20) return;
  g.deliveryDone = true;
  const share = Math.floor((1800 * (g.myFish + g.myPotion)) / 50); // 수락 시 확정된 기여 비율 배분
  ledger(s, share, `토벌 보급 계약 정산 (기여 ${g.myFish + g.myPotion}/50)`, now);
}
export function submitExpo(s: State, equipId: string) {
  const e = s.equips.find((x) => x.id === equipId);
  if (!e || e.def !== "weapon_iron" || s.guild.expo) return;
  if (e.gems.some(Boolean)) return log(s, "박람회 규정: 보석 장착 불가");
  if (e.id === s.weapon) return log(s, "장착 중인 장비는 제출할 수 없습니다.");
  e.locked = "박람회 전시";
  s.guild.expo = { equipId, quality: [0, 15, 30, 45, 60][e.q], theme: e.sturdy ? 40 : 20, item: `${["불량", "보통", "양질", "우수", "명품"][e.q]} 철검 · 제작: ${e.makerName}` };
}
export function endExpo(s: State) {
  const x = s.guild.expo;
  if (!x) return;
  const e = s.equips.find((y) => y.id === x.equipId);
  if (e) delete e.locked; // 종료 후 반환, 소각 아님
  log(s, "박람회 종료: 전시품 반환");
  s.guild.expo = null;
}

// ───────── 은행 ─────────
export function bankGold(s: State, amt: number, now: number) {
  amt = Math.floor(amt);
  if (!amt || (amt > 0 && s.gold < amt) || (amt < 0 && s.bank.gold < -amt)) return log(s, "금액을 확인하세요.");
  s.bank.gold += amt;
  ledger(s, -amt, amt > 0 ? "은행 입금" : "은행 출금", now);
}
export function bankItem(s: State, batchId: string, toBank: boolean) {
  const from = toBank ? s.inv : s.bank.items;
  const b = from.find((x) => x.id === batchId);
  if (!b) return;
  if (toBank) { s.inv = s.inv.filter((x) => x !== b); s.bank.items.push(b); }
  else { s.bank.items = s.bank.items.filter((x) => x !== b); give(s, b); }
}

// ───────── 개발용 ─────────
export function devGrant(s: State) {
  for (const [d, n] of [["ore_iron", 40], ["ore_copper", 20], ["mat_resin", 5], ["rough_fire", 2], ["crop_wheat", 10], ["herb_red", 14], ["herb_blue", 6], ["fish_crucian", 5], ["mat_water", 10], ["part_extract", 2], ["food_fish", 10], ["potion_hp", 6]] as const)
    give(s, { def: d, qty: n, q: 1 });
  const dual = newEquip("weapon_plain_sword", 1);
  dual.id = uid("instance_demo_dual");
  dual.gems = [{ def: "gem_courage", q: 1, makerName: "루미" }, { def: "gem_blessing", q: 1, makerName: "루미" }];
  const rageW = newEquip("weapon_plain_sword", 1);
  rageW.innate = [{ t: "trait_rage", lv: 1 }];
  s.equips.push(dual, rageW, newEquip("heart_demo_rage", 1));
  log(s, "[개발] 재료와 데모 장비 지급");
}
