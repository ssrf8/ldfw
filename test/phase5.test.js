// 阶段 5 阶段门自测：结局公式 / 条目激活决策 / 人设条目完整性 / 预算
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialStatData, GIRL_KEYS } from '../src/mvu/schema.js';
import { settleAction } from '../src/bridge/settle-core.js';
import { wantedEntryStates, COND } from '../src/lorebook/activation.js';
import { buildPersonaEntries } from '../src/lorebook/personas.js';
import { buildEntries, STAGES, personaEntryName } from '../src/lorebook/entries.js';

const opening = { action_id: 'a0', type: '开局设定', opening: { 理念: '平衡', 难度: '标准', 关注: 'sunian' } };
const night = id => ({ action_id: id, type: '结束今天' });

function toDay30(s) { s.world.day = 30; }

test('评估日：蜕变/假性修正/未完成 判定与结局冻结', () => {
  const s = buildInitialStatData();
  settleAction(s, opening, '一般');
  // 构造终局数据（测试捷径：直接摆值——这是测试代码，不违反运行期写者账本）
  s.girls.linwanqiu = { ...s.girls.linwanqiu, 信任: 80, 心结: 4 };            // 蜕变
  s.girls.jiangling = { ...s.girls.jiangling, 修正值: 85, 信任: 20 };          // 假性修正
  s.girls.sunian = { ...s.girls.sunian, 修正值: 40, 信任: 50, 心结: 2 };       // 未完成
  s.girls.guyunlei = { ...s.girls.guyunlei, 结局: '崩溃' };                    // 已冻结
  toDay30(s);
  const r = settleAction(s, night('n30'), '一般');
  assert.equal(s.girls.linwanqiu.结局, '蜕变');
  assert.equal(s.girls.jiangling.结局, '假性修正');
  assert.equal(s.girls.sunian.结局, '未完成');
  assert.equal(s.girls.guyunlei.结局, '崩溃'); // 冻结不改写
  assert.ok(s.world.总结局);
  assert.ok(r.events.some(e => e.startsWith('园长总结局')));
  // 总结局冻结：再过一夜不重算
  const total = s.world.总结局;
  settleAction(s, night('n31'), '一般');
  assert.equal(s.world.总结局, total);
});

test('园长总结局矩阵：改革者/共犯/被吞噬/未完待续', () => {
  const mk = setup => {
    const s = buildInitialStatData();
    settleAction(s, opening, '一般');
    setup(s);
    toDay30(s);
    settleAction(s, night('n'), '一般');
    return s.world.总结局;
  };
  assert.equal(mk(s => { for (const k of ['linwanqiu', 'jiangling', 'sunian']) { s.girls[k].信任 = 80; s.girls[k].心结 = 4; } }), '改革者');
  assert.equal(mk(s => { for (const k of ['linwanqiu', 'jiangling', 'sunian']) { s.girls[k].修正值 = 80; s.girls[k].信任 = 10; } }), '共犯');
  assert.equal(mk(s => { s.girls.linwanqiu.结局 = '崩溃'; s.girls.jiangling.结局 = '崩溃'; }), '被吞噬');
  assert.equal(mk(() => {}), '未完待续');
});

test('条目激活决策：阶段互斥 + 条件条目', () => {
  const s = buildInitialStatData();
  s.world.初始关注 = 'sunian';
  let w = wantedEntryStates(s);
  // day1：首日事件开，探视/评估/崩溃关
  assert.equal(w.get(COND.DAY1), true);
  assert.equal(w.get(COND.VISIT), false);
  assert.equal(w.get(COND.EVAL), false);
  assert.equal(w.get(COND.COLLAPSE), false);
  // 每人恰好 1 条人设激活
  for (const k of GIRL_KEYS) {
    const on = STAGES.filter(st => w.get(personaEntryName(k, st)));
    assert.equal(on.length, 1, k);
  }
  // 心结推进 → 阶段切换互斥
  s.girls.linwanqiu.心结 = 2;
  w = wantedEntryStates(s);
  assert.equal(w.get(personaEntryName('linwanqiu', '敞开')), true);
  assert.equal(w.get(personaEntryName('linwanqiu', '抵触')), false);
  // 探视日 / 评估日 / 崩溃
  s.world.day = 7;
  w = wantedEntryStates(s);
  assert.equal(w.get(COND.VISIT), true);
  assert.equal(w.get(COND.DAY1), false);
  s.world.day = 30;
  s.girls.jiangling.创伤 = 75;
  w = wantedEntryStates(s);
  assert.equal(w.get(COND.EVAL), true);
  assert.equal(w.get(COND.COLLAPSE), true);
  // 总结局后条件条目全关
  s.world.总结局 = '未完待续';
  w = wantedEntryStates(s);
  assert.equal(w.get(COND.VISIT), false);
  assert.equal(w.get(COND.EVAL), false);
});

test('人设条目：20 份、外壳 ID 一致、初始仅抵触激活、预算 ≤500 token/份', () => {
  const personas = buildPersonaEntries();
  assert.equal(personas.length, 20);
  const est = s => { let c = 0, a = 0; for (const ch of s) (ch.codePointAt(0) > 0x2e00 ? c++ : a++); return Math.round(c + a / 4); };
  const shells = { linwanqiu: '林晚秋_lwq', jiangling: '江铃_jl', sunian: '苏念_sn', fangtangtang: '方糖糖_ftt', guyunlei: '顾云蕾_gyl' };
  for (const p of personas) {
    assert.ok(est(p.content) <= 500, `${p.name} 超预算: ${est(p.content)}`);
    const shell = Object.values(shells).find(id => p.content.includes(`<${id}>`) && p.content.includes(`</${id}>`));
    assert.ok(shell, `${p.name} 缺外壳`);
  }
  const active = personas.filter(p => p.enabled);
  assert.equal(active.length, 5);
  for (const p of active) assert.ok(p.name.includes('抵触'));
});

test('全量条目集合：无重名、路由标记齐全', () => {
  const entries = buildEntries();
  const names = entries.map(e => e.name);
  assert.equal(new Set(names).size, names.length, '存在重名条目');
  assert.ok(names.some(n => n.includes('[InitialVariables]')));
  assert.ok(names.some(n => n.includes('[mvu_context]')));
  assert.equal(entries.filter(e => e.name.includes('[mvu_update]')).length, 1);
});
