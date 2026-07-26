// 阶段 1 阶段门自测：模拟楼层序列验证结算核心（无 ST 依赖）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialStatData, GIRL_KEYS } from '../src/mvu/schema.js';
import { settleAction, parseEffect, replay, electroUnlocked, EFFECT_COEF } from '../src/bridge/settle-core.js';

const opening = (id = 'a0') => ({
  action_id: id, type: '开局设定',
  opening: { 理念: '怀柔', 难度: '标准', 关注: 'linwanqiu' },
});
const act = (id, type, target, extra = {}) => ({ action_id: id, type, target, ...extra });

// 模型写者字段快照（双写检查用）
function semanticSnapshot(s) {
  return JSON.stringify(GIRL_KEYS.map(k => [s.girls[k].心结, s.girls[k].状态, s.girls[k].标记.秘密揭示]));
}

test('schema 默认值即未开局安全态', () => {
  const s = buildInitialStatData();
  assert.equal(s.world.day, 1);
  assert.equal(s.world.ap, 3);
  assert.equal(s.world.parent_pressure, 20);
  assert.equal(s.world.难度系数, 1.0);
  assert.equal(s.girls.linwanqiu.创伤, 15);
  assert.equal(s.girls.linwanqiu.结局, null);
  assert.equal(s.meta.schema_version, 1);
});

test('开局设定：理念/难度/关注落库，信任偏移', () => {
  const s = buildInitialStatData();
  const before信任 = s.girls.sunian.信任;
  const r = settleAction(s, opening(), '一般');
  assert.equal(r.settled, true);
  assert.equal(s.world.parent_pressure, 15);       // 怀柔
  assert.equal(s.world.难度系数, 1.0);              // 标准
  assert.equal(s.world.初始关注, 'linwanqiu');
  assert.equal(s.girls.sunian.信任, before信任 + 3); // 怀柔全员+3
});

test('个别谈话：信任按效果系数增长，其余不动', () => {
  const s = buildInitialStatData();
  settleAction(s, opening(), '一般');
  const r = settleAction(s, act('a1', '个别谈话', 'linwanqiu'), '显著');
  assert.equal(r.settled, true);
  assert.equal(s.world.ap, 2);
  assert.equal(s.girls.linwanqiu.信任, 13 + 9);     // 10+3(怀柔) + 6*1.5
  assert.equal(s.girls.linwanqiu.修正值, 30);
  assert.equal(s.girls.jiangling.信任, 15 + 3);     // 未被行动波及
});

test('单次上限：陪同活动 显著 信任增量被夹到 +10', () => {
  const s = buildInitialStatData();
  settleAction(s, opening(), '一般');
  const before = s.girls.sunian.信任;
  settleAction(s, act('a1', '陪同活动', 'sunian'), '显著'); // 8*1.5=12 → cap 10
  assert.equal(s.girls.sunian.信任, before + 10);
});

test('AP 链：3 行动耗尽 → 仅结束今天可结算 → day+1 ap=3', () => {
  const s = buildInitialStatData();
  settleAction(s, opening(), '一般');
  settleAction(s, act('a1', '个别谈话', 'linwanqiu'), '一般');
  settleAction(s, act('a2', '纪律训练', 'jiangling'), '一般');
  settleAction(s, act('a3', '团体课程'), '一般');
  assert.equal(s.world.ap, 0);
  const blocked = settleAction(s, act('a4', '个别谈话', 'sunian'), '一般');
  assert.equal(blocked.skipped, true);
  assert.equal(blocked.reason, 'no-ap');
  const night = settleAction(s, act('a5', '结束今天'), '一般');
  assert.equal(night.settled, true);
  assert.equal(s.world.day, 2);
  assert.equal(s.world.ap, 3);
});

test('幂等：同 action_id 二次触发跳过，数值不变', () => {
  const s = buildInitialStatData();
  settleAction(s, opening(), '一般');
  settleAction(s, act('a1', '个别谈话', 'linwanqiu'), '一般');
  const snap = JSON.stringify(s);
  const again = settleAction(s, act('a1', '个别谈话', 'linwanqiu'), '一般');
  assert.equal(again.skipped, true);
  assert.equal(again.reason, 'already-settled');
  assert.equal(JSON.stringify(s), snap);
});

test('Swipe 一致性：同一前帧不同效果 → 确定性分叉；重放=逐步', () => {
  const base = buildInitialStatData();
  settleAction(base, opening(), '一般');
  const swipeA = structuredClone(base);
  const swipeB = structuredClone(base);
  settleAction(swipeA, act('a1', '纪律训练', 'jiangling'), '显著');
  settleAction(swipeB, act('a1', '纪律训练', 'jiangling'), '受阻');
  assert.notEqual(swipeA.girls.jiangling.修正值, swipeB.girls.jiangling.修正值);
  // 重放对账
  const replayed = replay(buildInitialStatData(), [
    { action: opening(), effect: '一般' },
    { action: act('a1', '纪律训练', 'jiangling'), effect: '显著' },
  ]);
  assert.deepEqual(replayed, swipeA);
});

test('崩溃阈值：创伤≥80 即时结局=崩溃、压力+30、冻结后免疫结算', () => {
  const s = buildInitialStatData();
  settleAction(s, opening('a0'), '一般');
  let i = 1;
  while (s.girls.jiangling.结局 === null && i < 20) {
    settleAction(s, act('e' + i, '电疗', 'jiangling', { dose: 3 }), '一般');
    if (s.world.ap === 0) settleAction(s, act('n' + i, '结束今天'), '一般');
    i++;
  }
  assert.equal(s.girls.jiangling.结局, '崩溃');
  const frozen = JSON.stringify(s.girls.jiangling);
  settleAction(s, act('post', '纪律训练', 'jiangling'), '显著');
  assert.equal(JSON.stringify(s.girls.jiangling), frozen); // 冻结不变量
});

test('电疗标记单向且不受单次上限', () => {
  const s = buildInitialStatData();
  settleAction(s, opening(), '一般');
  settleAction(s, act('a1', '电疗', 'guyunlei', { dose: 3 }), '一般');
  assert.equal(s.girls.guyunlei.标记.电疗过, true);
  assert.equal(s.girls.guyunlei.创伤, 22); // 剂量表原值，未被 ±20 夹
});

test('探视日：第 7 天夜晚按全员修正值均值调压', () => {
  const s = buildInitialStatData();
  settleAction(s, opening(), '一般'); // 压力 15
  s.world.day = 7;                     // 直接推到探视日（测试捷径）
  const r = settleAction(s, act('n', '结束今天'), '一般');
  assert.ok(r.events.some(e => e.startsWith('探视日')));
  assert.equal(s.world.parent_pressure, 30); // 均值(30+20+25+35+25)/5=27 <50 → +15
});

test('双写检查：结算全程不触碰模型写者字段（心结/状态/秘密揭示）', () => {
  const s = buildInitialStatData();
  const sem0 = semanticSnapshot(s);
  settleAction(s, opening(), '一般');
  settleAction(s, act('a1', '禁闭', 'sunian'), '显著');
  settleAction(s, act('a2', '电疗', 'sunian', { dose: 2 }), '一般');
  settleAction(s, act('a3', '结束今天'), '一般');
  assert.equal(semanticSnapshot(s), sem0);
});

test('电疗解锁只读判断', () => {
  const s = buildInitialStatData();
  settleAction(s, opening(), '一般'); // 怀柔 15
  assert.equal(electroUnlocked(s), false);
  s.world.parent_pressure = 60;
  assert.equal(electroUnlocked(s), true);
});

test('parseEffect：合法/非法/缺失', () => {
  assert.equal(parseEffect('剧情……<结算 效果="显著"/>'), '显著');
  assert.equal(parseEffect('剧情……<结算 效果="爆炸"/>'), '一般');
  assert.equal(parseEffect('没有标签'), '一般');
  assert.equal(parseEffect(null), '一般');
  assert.deepEqual(Object.keys(EFFECT_COEF), ['显著', '一般', '受阻']);
});

test('无行动闲聊轮零结算', () => {
  const s = buildInitialStatData();
  settleAction(s, opening(), '一般');
  const snap = JSON.stringify(s);
  const r = settleAction(s, null, '一般');
  assert.equal(r.skipped, true);
  assert.equal(JSON.stringify(s), snap);
});
