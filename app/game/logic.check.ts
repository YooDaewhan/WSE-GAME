// 핵심 규칙 자체 검사: node --experimental-strip-types app/game/logic.check.ts
import assert from "node:assert/strict";
import * as L from "./logic.ts";

const now = Date.UTC(2026, 10, 1, 3, 10); // 낮(주기 앞 30분)
const fresh = () => L.newState(now);

// 숙련도 곡선: Lv.1→1000 누적 8,982,183 XP, Lv.1→2 = 100
assert.equal(L.CUM[1000], 8982183);
assert.equal(L.levelOf(100), 2);
assert.equal(L.masteryEffect(1000).speed, 45);
assert.equal(L.masteryEffect(125).speed, 13);

// 클릭 가속은 정확히 ×1.2, 중첩 없음
{
  const s = fresh();
  L.startWork(s, "gather", "mine_iron", 0);
  const base = L.cycleMs(s, s.work!, now, true);
  L.clickBoost(s, now); L.clickBoost(s, now); L.clickBoost(s, now);
  assert.equal(Math.round((base / L.cycleMs(s, s.work!, now, true)) * 1000) / 1000, 1.2);
  // 클릭 없이도 자동 완료
  L.workTick(s, 8000, now, false);
  assert.ok(L.count(s, "ore_iron") >= 1);
}

// 원석 10개 → 주괴 1개, 부족하면 시작 불가, 취소 시 예약 반환
{
  const s = fresh();
  L.startWork(s, "recipe", "recipe_bar_iron", 1);
  assert.equal(s.work, null);
  L.claimStarter(s); L.claimStarter(s);
  assert.equal(L.count(s, "ore_iron"), 20); // 중복 수령 불가
  L.startWork(s, "recipe", "recipe_bar_iron", 1);
  assert.equal(L.count(s, "ore_iron"), 10);
  L.cancelWork(s);
  assert.equal(L.count(s, "ore_iron"), 20);
  L.startWork(s, "recipe", "recipe_bar_iron", 2);
  L.workTick(s, 60000, now, false);
  assert.equal(L.count(s, "bar_iron"), 2);
  assert.equal(L.count(s, "ore_iron"), 0);
  assert.ok(s.inv.find((b) => b.def === "bar_iron")!.makerName === "새벽");
}

// 철검 10회 → 암기 + Lv.2
{
  const s = fresh();
  L.give(s, { def: "bar_iron", qty: 20, q: 1 });
  L.give(s, { def: "mat_resin", qty: 10, q: 1 });
  L.startWork(s, "recipe", "recipe_iron_sword", 10);
  L.workTick(s, 3600000, now, false);
  assert.equal(s.runs.recipe_iron_sword, 10);
  assert.equal(L.indivLv(s, "recipe_iron_sword"), 2);
  assert.equal(s.equips.filter((e) => e.def === "weapon_iron" && e.makerName === "새벽").length, 10);
}

// 이름 합성·보석 3번째 홈 거부·기여 표시
{
  const s = fresh();
  const e = L.newEquip("weapon_plain_sword", 1);
  s.equips.push(e);
  L.give(s, { def: "gem_courage", qty: 1, q: 1 });
  L.give(s, { def: "gem_blessing", qty: 1, q: 1 });
  L.give(s, { def: "gem_fire", qty: 1, q: 1 });
  const id = (d: string) => s.inv.find((b) => b.def === d)!.id;
  L.socketGem(s, e.id, id("gem_courage"));
  assert.equal(L.equipName(e), "용기의 검");
  L.socketGem(s, e.id, id("gem_blessing"));
  assert.equal(L.equipName(e), "축복과 용기의 검");
  L.socketGem(s, e.id, id("gem_fire"));
  assert.equal(L.count(s, "gem_fire"), 1); // 거부되어 가방에 남음
  L.equip(s, e.id);
  const b = L.build(s, now);
  assert.equal(b.atk, 2 + 10 + 2); // 기본 2 + 검 10 + 용기 Lv.1
  assert.equal(b.maxHp, 100 + 20 + 5); // 심장 20 + 축복 Lv.1
  assert.equal(L.equipContribution(e).lines[0], "기본 공격력 10"); // 기본 수치는 덮어쓰지 않음
}

// 불의 보석 → 열기 Lv.1 → 화염 공격력 +1, 동일 보석 중복 이름
{
  const s = fresh();
  const e = L.newEquip("weapon_iron", 1);
  s.equips.push(e);
  L.give(s, { def: "gem_fire", qty: 2, q: 1 });
  L.socketGem(s, e.id, s.inv.find((x) => x.def === "gem_fire")!.id);
  L.equip(s, e.id);
  assert.equal(L.equipName(e), "불의 철검");
  assert.equal(L.build(s, now).fire, 1);
  L.socketGem(s, e.id, s.inv.find((x) => x.def === "gem_fire")!.id);
  assert.equal(L.equipName(e), "불의 철검");
  assert.equal(L.build(s, now).fire, 2);
}

// 분노1 + 분노2·야행1 → 분노3(+8%) 한 번 적용, 야행은 밤에만
{
  const s = fresh();
  const w = L.newEquip("weapon_plain_sword", 1); w.innate = [{ t: "trait_rage", lv: 1 }];
  const h = L.newEquip("heart_demo_rage", 1);
  s.equips.push(w, h); L.equip(s, w.id); L.equip(s, h.id);
  const day = L.build(s, now);
  assert.equal(day.traits.find((t) => t.t === "trait_rage")!.eff, 3);
  assert.equal(day.traits.find((t) => t.t === "trait_night")!.active, false);
  assert.ok(Math.abs(day.speed - 1.08) < 1e-9);
  s.forceNight = true;
  assert.ok(Math.abs(L.build(s, now).atk - (12 + 2) * 1.08) < 1e-9);
}

// 방어막관통: D=80,S=100,+100% → 방어막 100, HP 30
assert.deepEqual(L.shieldAbsorb(80, 100, 1), { shieldLoss: 100, hp: 30 });
assert.deepEqual(L.shieldAbsorb(80, 100, 0), { shieldLoss: 80, hp: 0 });
assert.deepEqual(L.shieldAbsorb(80, 0, 1), { shieldLoss: 0, hp: 80 });

// 속도 1 : 0.5 → 60초에 20 : 10 (프레임 크기와 무관)
{
  const s = fresh();
  const plain = L.newEquip("weapon_plain_sword", 1);
  s.equips.push(plain); L.equip(s, plain.id);
  L.startCombat(s, "mob_speed_dummy");
  s.hp = 1e9;
  for (const dt of [...Array(399).fill(137), 60000 - 399 * 137]) L.combatTick(s, dt, now, () => 0.5);
  assert.equal(s.combat!.pActs, 20);
  assert.equal(s.combat!.mActs, 10);
}

// 학교: 하루 3포인트, 같은 날 재지급 없음, 첫 회차만 재료 소비
{
  const s = fresh();
  assert.equal(s.school.points, 3);
  L.dailyCheck(s, now + 1000);
  assert.equal(s.school.points, 3);
  L.give(s, { def: "herb_red", qty: 10, q: 1 });
  L.attendLesson(s, "spell_heal"); L.attendLesson(s, "spell_heal");
  assert.equal(L.count(s, "herb_red"), 0);
  assert.equal(s.school.points, 1);
  L.dailyCheck(s, now + L.DAY);
  assert.equal(s.school.points, 3); // 누적 아님
  assert.equal(s.school.lessons.spell_heal, 2); // 진도 유지
  L.attendLesson(s, "spell_moon");
  assert.equal(s.school.lessons.spell_moon ?? 0, 0); // 스크롤 없이 불가
}

// 의뢰 취소 시 보수 전액 반환, 골드 보존
{
  const s = fresh();
  L.createOrder(s, { title: "테스트", def: "weapon_iron", minQ: 1, qty: 1, reward: 100 }, now);
  const o = s.orders[0];
  L.confirmOrder(s, o.id, now);
  assert.equal(s.gold, 200);
  L.cancelOrder(s, o.id, now);
  assert.equal(s.gold, 300);
}

console.log("모든 규칙 검사 통과");
