// 목업 밸런스 정의. 모든 시드 데이터는 이 파일에서만 관리한다.
export const QUALITY = ["불량", "보통", "양질", "우수", "명품"] as const;
export const QUALITY_MULT = [0.85, 1, 1.06, 1.12, 1.2];
export const QUALITY_MAT_SCORE = [-10, 0, 4, 8, 12];

export type Cat = "ore" | "bar" | "rough" | "gem" | "mat" | "part" | "fish" | "seed" | "crop" | "food" | "potion" | "scroll" | "weapon" | "heart" | "tool";

export interface ItemDef {
  name: string;
  cat: Cat;
  price: number;
  icon: string;
  noTrade?: boolean;
  // 장비
  atk?: number; hp?: number; mp?: number; def?: number;
  innate?: { t: string; lv: number }[];
  sockets?: number;
  maxDur?: number;
  // 보석
  trait?: string; nameToken?: string; nameOrder?: number;
  // 음식·포션
  satiety?: number; heal?: number; healMp?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  ore_copper: { name: "구리 원석", cat: "ore", price: 2, icon: "🟤" },
  ore_iron: { name: "철 원석", cat: "ore", price: 3, icon: "⚫" },
  ore_silver: { name: "은 원석", cat: "ore", price: 8, icon: "⚪" },
  ore_mithril: { name: "미스릴 원석", cat: "ore", price: 25, icon: "🔷" },
  bar_copper: { name: "구리 주괴", cat: "bar", price: 22, icon: "🟧" },
  bar_iron: { name: "철 주괴", cat: "bar", price: 34, icon: "⬛" },
  bar_silver: { name: "은 주괴", cat: "bar", price: 90, icon: "⬜" },
  bar_mithril: { name: "미스릴 주괴", cat: "bar", price: 280, icon: "🟦" },
  rough_fire: { name: "불의 보석 원석", cat: "rough", price: 35, icon: "🔶" },
  rough_blessing: { name: "축복의 보석 원석", cat: "rough", price: 50, icon: "🔸" },
  rough_courage: { name: "용기의 보석 원석", cat: "rough", price: 40, icon: "🔻" },
  rough_focus: { name: "집중의 보석 원석", cat: "rough", price: 45, icon: "🔹" },
  gem_fire: { name: "불의 보석", cat: "gem", price: 55, icon: "🔥", trait: "trait_heat", nameToken: "불", nameOrder: 10 },
  gem_blessing: { name: "축복의 보석", cat: "gem", price: 75, icon: "✨", trait: "trait_blessing", nameToken: "축복", nameOrder: 20 },
  gem_courage: { name: "용기의 보석", cat: "gem", price: 65, icon: "♦️", trait: "trait_courage", nameToken: "용기", nameOrder: 30 },
  gem_focus: { name: "집중의 보석", cat: "gem", price: 70, icon: "💠", trait: "trait_focus", nameToken: "집중", nameOrder: 40 },
  mat_resin: { name: "숲의 수지", cat: "mat", price: 4, icon: "🟢" },
  mat_fang: { name: "늑대 송곳니", cat: "mat", price: 12, icon: "🦷" },
  mat_venom: { name: "독액", cat: "mat", price: 15, icon: "🧪" },
  mat_dust: { name: "별가루", cat: "mat", price: 30, icon: "⭐" },
  mat_water: { name: "맑은 물", cat: "mat", price: 0, icon: "💧", noTrade: true },
  mat_scrap: { name: "금속 조각", cat: "mat", price: 3, icon: "🔩" },
  part_repair: { name: "철 수리 부품", cat: "part", price: 8, icon: "🔧" },
  part_extract: { name: "보석 추출제", cat: "part", price: 18, icon: "⚗️" },
  fish_crucian: { name: "붕어", cat: "fish", price: 4, icon: "🐟" },
  fish_carp: { name: "잉어", cat: "fish", price: 7, icon: "🐠" },
  fish_mackerel: { name: "고등어", cat: "fish", price: 8, icon: "🐡" },
  fish_moon: { name: "달빛어", cat: "fish", price: 30, icon: "🌙" },
  seed_wheat: { name: "밀 씨앗", cat: "seed", price: 1, icon: "🌱" },
  seed_potato: { name: "감자 씨앗", cat: "seed", price: 1, icon: "🌱" },
  seed_red: { name: "붉은 약초 씨앗", cat: "seed", price: 3, icon: "🌱" },
  seed_blue: { name: "푸른 약초 씨앗", cat: "seed", price: 3, icon: "🌱" },
  crop_wheat: { name: "밀", cat: "crop", price: 2, icon: "🌾" },
  crop_potato: { name: "감자", cat: "crop", price: 3, icon: "🥔" },
  herb_red: { name: "붉은 약초", cat: "crop", price: 6, icon: "🌺" },
  herb_blue: { name: "푸른 약초", cat: "crop", price: 7, icon: "🪻" },
  crop_gold_wheat: { name: "황금 밀", cat: "crop", price: 25, icon: "🌟" },
  herb_silver: { name: "은빛 약초", cat: "crop", price: 35, icon: "🌿" },
  animal_egg: { name: "달걀", cat: "crop", price: 4, icon: "🥚" },
  food_royal_bread: { name: "왕국 배급 빵", cat: "food", price: 0, icon: "🍞", noTrade: true, satiety: 20 },
  food_bread: { name: "소박한 빵", cat: "food", price: 6, icon: "🥖", satiety: 25, heal: 5 },
  food_fish: { name: "생선구이", cat: "food", price: 10, icon: "🍢", satiety: 35, heal: 15 },
  food_stew: { name: "광부의 스튜", cat: "food", price: 18, icon: "🍲", satiety: 40 },
  food_sea: { name: "해풍 생선찜", cat: "food", price: 18, icon: "🥘", satiety: 40 },
  potion_hp: { name: "작은 체력 포션", cat: "potion", price: 15, icon: "❤️", heal: 35 },
  potion_mp: { name: "작은 마나 포션", cat: "potion", price: 15, icon: "💙", healMp: 20 },
  scroll_moon: { name: "달빛 장막 스크롤", cat: "scroll", price: 120, icon: "📜" },
  scroll_ember: { name: "잔불 폭발 스크롤", cat: "scroll", price: 200, icon: "📜" },
  tool_pickaxe: { name: "입문 곡괭이", cat: "tool", price: 5, icon: "⛏️", maxDur: 100 },
  tool_rod: { name: "입문 낚싯대", cat: "tool", price: 5, icon: "🎣", maxDur: 100 },
  weapon_plain_sword: { name: "검", cat: "weapon", price: 30, icon: "🗡️", atk: 10, sockets: 2, maxDur: 100 },
  weapon_copper: { name: "구리검", cat: "weapon", price: 50, icon: "🗡️", atk: 6, sockets: 2, maxDur: 80 },
  weapon_iron: { name: "철검", cat: "weapon", price: 90, icon: "⚔️", atk: 10, innate: [{ t: "trait_courage", lv: 1 }], sockets: 2, maxDur: 100 },
  weapon_silver: { name: "은빛 검", cat: "weapon", price: 220, icon: "⚔️", atk: 14, innate: [{ t: "trait_focus", lv: 1 }], sockets: 2, maxDur: 100 },
  heart_plain: { name: "평온한 심장", cat: "heart", price: 60, icon: "💚", hp: 20, def: 2, innate: [{ t: "trait_patience", lv: 1 }], sockets: 1 },
  heart_wolf: { name: "늑대의 심장", cat: "heart", price: 90, icon: "🐺", hp: 12, atk: 3, innate: [{ t: "trait_rage", lv: 1 }], sockets: 1 },
  heart_ember: { name: "잔불의 심장", cat: "heart", price: 120, icon: "🧡", hp: 10, mp: 10, innate: [{ t: "trait_heat", lv: 1 }], sockets: 1 },
  heart_demo_rage: { name: "격노의 심장(개발)", cat: "heart", price: 0, icon: "💢", hp: 10, innate: [{ t: "trait_rage", lv: 2 }, { t: "trait_night", lv: 1 }], sockets: 1 },
};

// 특성: 이름 / 단계별 명시 효과(레벨 곱셈 금지)
export interface TraitDef { name: string; kind: "상시" | "조건" | "변칙"; levels: string[]; values: number[]; drawback5?: string }
export const TRAITS: Record<string, TraitDef> = {
  trait_heat: { name: "열기", kind: "상시", levels: ["화염 공격력"], values: [1, 2, 4, 6, 10] },
  trait_courage: { name: "용기", kind: "상시", levels: ["물리 공격력"], values: [2, 4, 6, 9, 13] },
  trait_patience: { name: "인내", kind: "상시", levels: ["방어력"], values: [1, 2, 3, 5, 8] },
  trait_focus: { name: "집중", kind: "상시", levels: ["최대 MP"], values: [5, 10, 16, 24, 35] },
  trait_blessing: { name: "축복", kind: "상시", levels: ["최대 체력"], values: [5, 10, 18, 28, 42] },
  trait_rage: { name: "분노", kind: "상시", levels: ["공격력·공격속도 %"], values: [3, 5, 8, 12, 25], drawback5: "분노는 눈을 멀게 합니다. 명중률 -15%p" },
  trait_night: { name: "야행", kind: "조건", levels: ["밤에 공격력"], values: [2, 4, 6, 9, 13] },
  trait_odd: { name: "기묘함", kind: "변칙", levels: ["적 HP 끝자리 홀수 시 추가 물리 피해"], values: [1, 2, 3, 4, 6] },
};

export type Field = "mining" | "farming" | "fishing" | "adventure" | "smith" | "cook" | "alch";
export const FIELDS: Record<Field, string> = {
  mining: "광부 스킬", farming: "농부 스킬", fishing: "어부 스킬", adventure: "모험가 스킬",
  smith: "대장장이 스킬", cook: "요리사 스킬", alch: "연금술사 스킬",
};

// 채집 작업
export interface GatherDef { name: string; loc: string; out: string; sec: number; field: Field; tool: string; rare?: { id: string; p: number; night?: boolean } }
export const GATHER: Record<string, GatherDef> = {
  mine_copper: { name: "구리 원석 채광", loc: "초입 광산", out: "ore_copper", sec: 8, field: "mining", tool: "tool_pickaxe", rare: { id: "rough_fire", p: 0.005 } },
  mine_iron: { name: "철 원석 채광", loc: "초입 광산", out: "ore_iron", sec: 8, field: "mining", tool: "tool_pickaxe", rare: { id: "rough_fire", p: 0.005 } },
  fish_crucian: { name: "붕어 낚시", loc: "마을 강", out: "fish_crucian", sec: 10, field: "fishing", tool: "tool_rod" },
};

// 잠긴 장소: 조건 표시용
export const LOCKED_PLACES = [
  { name: "철맥 갱도", cond: "광부 스킬 Lv.50 또는 광산 출입증", info: "철 채광 7초, 용기 원석" },
  { name: "은빛 갱도", cond: "광부 스킬 Lv.200 또는 은빛 허가증", info: "은 채광 12초, 축복·집중 원석" },
  { name: "심층 광산", cond: "광부 스킬 Lv.500 그리고 탐사 퀘스트", info: "미스릴 채광 18초" },
  { name: "고요한 호수", cond: "어부 스킬 Lv.50 또는 호수 허가증", info: "잉어, 밤에 달빛어 0.5%" },
  { name: "남쪽 해안", cond: "어부 스킬 Lv.100 또는 항구 의뢰", info: "고등어" },
];

export type RecipeCat = "제련" | "세공" | "제작" | "요리" | "연금";
export interface RecipeDef { out: string; qty: number; inputs: [string, number][]; sec: number; cat: RecipeCat; field: Field; source: string; starter?: boolean }
export const RECIPES: Record<string, RecipeDef> = {
  recipe_bar_copper: { out: "bar_copper", qty: 1, inputs: [["ore_copper", 10]], sec: 15, cat: "제련", field: "mining", source: "기본", starter: true },
  recipe_bar_iron: { out: "bar_iron", qty: 1, inputs: [["ore_iron", 10]], sec: 20, cat: "제련", field: "mining", source: "기본", starter: true },
  recipe_bar_silver: { out: "bar_silver", qty: 1, inputs: [["ore_silver", 10]], sec: 30, cat: "제련", field: "mining", source: "광산 길드" },
  recipe_gem_fire: { out: "gem_fire", qty: 1, inputs: [["rough_fire", 1], ["mat_resin", 1]], sec: 25, cat: "세공", field: "smith", source: "기본", starter: true },
  recipe_gem_courage: { out: "gem_courage", qty: 1, inputs: [["rough_courage", 1], ["mat_resin", 2]], sec: 30, cat: "세공", field: "smith", source: "대장장이 길드" },
  recipe_copper_sword: { out: "weapon_copper", qty: 1, inputs: [["bar_copper", 2]], sec: 30, cat: "제작", field: "smith", source: "기본", starter: true },
  recipe_iron_sword: { out: "weapon_iron", qty: 1, inputs: [["bar_iron", 2], ["mat_resin", 1]], sec: 40, cat: "제작", field: "smith", source: "기본", starter: true },
  recipe_silver_sword: { out: "weapon_silver", qty: 1, inputs: [["bar_silver", 2], ["bar_iron", 1]], sec: 60, cat: "제작", field: "smith", source: "대장장이 길드" },
  recipe_repair: { out: "part_repair", qty: 5, inputs: [["bar_iron", 1]], sec: 20, cat: "제작", field: "smith", source: "기본", starter: true },
  recipe_bread: { out: "food_bread", qty: 3, inputs: [["crop_wheat", 2], ["mat_water", 1]], sec: 15, cat: "요리", field: "cook", source: "기본", starter: true },
  recipe_fish: { out: "food_fish", qty: 1, inputs: [["fish_crucian", 1]], sec: 15, cat: "요리", field: "cook", source: "기본", starter: true },
  recipe_stew: { out: "food_stew", qty: 1, inputs: [["crop_potato", 2], ["fish_carp", 1]], sec: 25, cat: "요리", field: "cook", source: "요리 길드" },
  recipe_hp: { out: "potion_hp", qty: 1, inputs: [["herb_red", 2], ["mat_water", 1]], sec: 20, cat: "연금", field: "alch", source: "기본", starter: true },
  recipe_mp: { out: "potion_mp", qty: 1, inputs: [["herb_blue", 2], ["mat_water", 1]], sec: 20, cat: "연금", field: "alch", source: "기본", starter: true },
};

export const CROPS: Record<string, { name: string; out: string; min: number; per: number; variant?: string }> = {
  seed_wheat: { name: "밀", out: "crop_wheat", min: 5, per: 3, variant: "crop_gold_wheat" },
  seed_potato: { name: "감자", out: "crop_potato", min: 8, per: 3 },
  seed_red: { name: "붉은 약초", out: "herb_red", min: 10, per: 2 },
  seed_blue: { name: "푸른 약초", out: "herb_blue", min: 12, per: 2, variant: "herb_silver" },
};

export interface MobDef { name: string; hp: number; atk: number; def: number; speed: number; drop: string; heart?: string; poison?: number; pShield?: number; mShield?: number; stunImmune?: boolean; dev?: boolean; boss?: boolean }
export const MOBS: Record<string, MobDef> = {
  mob_slime: { name: "숲 슬라임", hp: 25, atk: 3, def: 0, speed: 1, drop: "mat_resin", heart: "heart_plain" },
  mob_wolf: { name: "회색 늑대", hp: 70, atk: 7, def: 2, speed: 1.2, drop: "mat_fang", heart: "heart_wolf" },
  boss_marsh: { name: "늪의 군주", hp: 5000, atk: 12, def: 5, speed: 0.75, drop: "", boss: true, poison: 1, stunImmune: true },
  mob_speed_dummy: { name: "속도 허수아비(개발)", hp: 99999, atk: 1, def: 0, speed: 0.5, drop: "", stunImmune: true, dev: true },
  mob_shield_dummy: { name: "물리 방어막 허수아비(개발)", hp: 9999, atk: 0, def: 0, speed: 0.5, drop: "", pShield: 100, dev: true },
};

export interface SpellDef { name: string; src: "school" | "scroll"; lessons: number; items: [string, number][]; pre?: string; mp: number; cd: number; desc: string; fire?: number; heal?: number; defBuff?: number; mShield?: number }
export const SPELLS: Record<string, SpellDef> = {
  spell_spark: { name: "불씨", src: "school", lessons: 1, items: [], mp: 3, cd: 5, fire: 6, desc: "화염 피해 6" },
  spell_heal: { name: "작은 치유", src: "school", lessons: 5, items: [["herb_red", 10]], mp: 6, cd: 10, heal: 20, desc: "HP 20 회복" },
  spell_shield: { name: "돌의 보호", src: "school", lessons: 5, items: [["bar_iron", 3]], mp: 6, cd: 20, defBuff: 4, desc: "방어 +4 (10초)" },
  spell_flame: { name: "화염구", src: "school", lessons: 10, items: [["gem_fire", 2]], pre: "spell_spark", mp: 10, cd: 12, fire: 20, desc: "화염 피해 20" },
  spell_moon: { name: "달빛 장막", src: "scroll", lessons: 5, items: [["scroll_moon", 1], ["fish_moon", 2]], mp: 8, cd: 20, mShield: 15, desc: "마법 방어막 15 (15초)" },
  spell_ember: { name: "잔불 폭발", src: "scroll", lessons: 10, items: [["scroll_ember", 1], ["mat_dust", 5]], mp: 15, cd: 20, fire: 30, desc: "화염 피해 30" },
};

export const PLAYER = { id: "user_player", name: "새벽" };
export const ARTISANS = [
  { id: "user_harin", name: "하린", workshop: "붉은모루 공방", bio: "철검 전문. 납기 철저.", main: "철검", crafts: 1840, orders: 212, onTime: 98, accepts: true },
  { id: "user_rumi", name: "루미", workshop: "별가루 세공소", bio: "보석 세공 전문.", main: "불의 보석", crafts: 2310, orders: 340, onTime: 95, accepts: true },
  { id: "user_dam", name: "담", workshop: "들꽃식탁", bio: "든든한 토벌 보급식.", main: "생선구이", crafts: 3020, orders: 128, onTime: 99, accepts: false },
];

// 데모 시장 매물(시드 판매자)
export const SEED_LISTINGS = [
  { id: "l1", seller: "하린", kind: "equip" as const, equipId: "instance_demo_iron", price: 260 },
  { id: "l2", seller: "루미", kind: "batch" as const, def: "gem_courage", q: 1, qty: 1, maker: "user_rumi", makerName: "루미", price: 70 },
  { id: "l3", seller: "루미", kind: "batch" as const, def: "gem_blessing", q: 1, qty: 1, maker: "user_rumi", makerName: "루미", price: 80 },
  { id: "l4", seller: "이안", kind: "batch" as const, def: "scroll_moon", q: 1, qty: 1, price: 130 },
  { id: "l5", seller: "담", kind: "batch" as const, def: "food_fish", q: 2, qty: 5, maker: "user_dam", makerName: "담", price: 11 },
  { id: "l6", seller: "이안", kind: "batch" as const, def: "fish_moon", q: 1, qty: 2, price: 32 },
];

export const SEED_TRADES = [
  { item: "철검(보통)", price: 92, at: "2시간 전" },
  { item: "불의 보석(보통)", price: 58, at: "3시간 전" },
  { item: "철 주괴(양질)", price: 37, at: "5시간 전" },
];

export const HUNT_SEED = [
  { guild: "붉은모루단", killed: false, timeLeft: 0, bossHp: 3120 },
  { guild: "강바람회", killed: false, timeLeft: 0, bossHp: 4210 },
];
export const EXPO_SEED = [
  { guild: "붉은모루단", quality: 45, theme: 40, item: "우수 철검 · 제작: 하린" },
  { guild: "강바람회", quality: 30, theme: 20, item: "양질 철검 · 제작: 바람" },
];

export const CHAT_SEED = [
  { who: "하린", text: "철검 주문 받습니다. 붉은모루 공방으로 오세요." },
  { who: "담", text: "토벌 주간이라 생선구이 수요가 많네요." },
  { who: "이안", text: "늪의 군주 토벌대 모집 중!" },
];
