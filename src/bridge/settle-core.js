// 结算核心（纯函数，无 ST 依赖）—— 契约 §3.5
// 运行时接线（挂 Mvu.events.VARIABLE_UPDATE_ENDED）在 bridge/index 中完成；
// 本模块只做：给定 stat_data + 行动 + 效果类别，原地计算全部脚本写者字段。
// 写者分区（契约 §3 账本）：本模块只写 修正值/信任/创伤/AP/day/压力/结局/电疗过/难度系数/初始关注/meta；
// 心结/状态/秘密揭示 是模型写者字段，本模块绝不触碰。

import { GIRL_KEYS } from '../mvu/schema.js';

// ---- 基础增量表（契约 §2.3，数值真机调参期可改，结构不可改）----
export const ACTION_TABLE = {
  个别谈话:   { cost: 1, target: 'one',  修正值: 0,  信任: 6,  创伤: 0 },
  陪同活动:   { cost: 1, target: 'one',  修正值: 3,  信任: 8,  创伤: 0 },
  团体课程:   { cost: 1, target: 'all',  修正值: 3,  信任: 1,  创伤: 0 },
  纪律训练:   { cost: 1, target: 'one',  修正值: 8,  信任: -4, 创伤: 3 },
  禁闭:       { cost: 1, target: 'one',  修正值: 12, 信任: -8, 创伤: 8 },
  电疗:       { cost: 1, target: 'one',  dose: {
                 1: { 修正值: 15, 信任: -10, 创伤: 12 },
                 2: { 修正值: 18, 信任: -14, 创伤: 16 },
                 3: { 修正值: 22, 信任: -18, 创伤: 22 },
               } },
  处理园务文书: { cost: 1, target: 'none', pressure: -10 },
  结束今天:   { cost: 0, target: 'none', night: true },
};

export const EFFECT_COEF = { 显著: 1.5, 一般: 1.0, 受阻: 0.5 };

// 单次行动数值变动上限（契约 §3；电疗剂量表除外）
const DELTA_CAP = { 修正值: 15, 信任: 10, 创伤: 20 };

// 开局向导映射（契约 §3.2 / §4.3）
export const OPENING_MAP = {
  理念: {
    铁腕: { pressure: 30, trustShift: -3 },
    平衡: { pressure: 20, trustShift: 0 },
    怀柔: { pressure: 15, trustShift: 3 },
  },
  难度: { 简单: 1.2, 标准: 1.0, 困难: 0.8 },
};

const ELECTRO_UNLOCK_PRESSURE = 60; // 契约 §3：≥60 解锁电疗
const COLLAPSE_TRAUMA = 80;         // 契约 §2.4：创伤≥80 即时崩溃
const VISIT_INTERVAL = 7;           // 契约 §2.1：每 7 天探视日
const TOTAL_DAYS = 30;

const clamp01 = v => Math.max(0, Math.min(100, Math.round(v)));

function capDelta(field, delta, uncapped) {
  if (uncapped) return delta;
  const cap = DELTA_CAP[field];
  return Math.max(-cap, Math.min(cap, delta));
}

function applyGirlDeltas(girl, deltas, effectCoef, difficulty, { uncapped = false } = {}) {
  for (const field of ['修正值', '信任', '创伤']) {
    let d = (deltas[field] ?? 0) * effectCoef;
    if (d > 0 && field !== '创伤') d *= difficulty; // 难度系数只放大收益，代价不减免
    d = capDelta(field, d, uncapped);
    girl[field] = clamp01(girl[field] + d);
  }
}

function girlsAvg修正(girls) {
  const ks = GIRL_KEYS.filter(k => girls[k]);
  return ks.reduce((s, k) => s + girls[k].修正值, 0) / ks.length;
}

// 结局冻结不变量：结局非 null 后一切数值结算跳过该人（契约 §2.4）
const isFinished = girl => girl.结局 !== null;

/**
 * 主入口：对一帧 stat_data 原地结算一个 PlayerAction。
 * @param statData  当前帧 stat_data（原地修改）
 * @param action    { action_id, type, target?, dose?, opening? } | null（null=无行动闲聊轮，零结算）
 * @param effect    '显著'|'一般'|'受阻'（缺失/非法降级为 一般，契约 §2.3）
 * @returns {object} { settled, skipped, reason?, events: string[] }  events 供 UI/叙事参考
 */
export function settleAction(statData, action, effect) {
  const events = [];
  if (!action || !action.type) return { settled: false, skipped: true, reason: 'no-action', events };
  if (statData.meta.last_settled === action.action_id) {
    return { settled: false, skipped: true, reason: 'already-settled', events };
  }

  const effectCoef = EFFECT_COEF[effect] ?? EFFECT_COEF.一般;
  const w = statData.world;

  if (action.type === '开局设定') {
    applyOpening(statData, action.opening ?? {}, events);
    statData.meta.last_settled = action.action_id;
    return { settled: true, skipped: false, events };
  }

  const spec = ACTION_TABLE[action.type];
  if (!spec) return { settled: false, skipped: true, reason: 'unknown-action:' + action.type, events };

  // AP 扣减（结束今天 cost=0）
  if (spec.cost > 0) {
    if (w.ap <= 0) return { settled: false, skipped: true, reason: 'no-ap', events };
    w.ap -= spec.cost;
  }

  // 数值结算
  if (spec.dose) {
    const d = spec.dose[action.dose] ?? spec.dose[1];
    const girl = statData.girls[action.target];
    if (girl && !isFinished(girl)) {
      applyGirlDeltas(girl, d, effectCoef, w.难度系数, { uncapped: true }); // 电疗按剂量表，不受单次上限
      girl.标记.电疗过 = true; // 单向不可逆（契约 §3 不变量）
      events.push(`电疗:${action.target}:剂量${action.dose ?? 1}`);
    }
  } else if (spec.target === 'one') {
    const girl = statData.girls[action.target];
    if (girl && !isFinished(girl)) {
      applyGirlDeltas(girl, spec, effectCoef, w.难度系数);
      events.push(`${action.type}:${action.target}`);
    }
  } else if (spec.target === 'all') {
    for (const k of GIRL_KEYS) {
      const girl = statData.girls[k];
      if (girl && !isFinished(girl)) applyGirlDeltas(girl, spec, effectCoef, w.难度系数);
    }
    events.push(`${action.type}:全员`);
  }

  if (spec.pressure) {
    w.parent_pressure = clamp01(w.parent_pressure + spec.pressure);
    events.push(`家长压力${spec.pressure > 0 ? '+' : ''}${spec.pressure}`);
  }

  // 崩溃阈值即时判定（契约 §2.4：不等评估日；结局冻结）
  for (const k of GIRL_KEYS) {
    const girl = statData.girls[k];
    if (girl && !isFinished(girl) && girl.创伤 >= COLLAPSE_TRAUMA) {
      girl.结局 = '崩溃';
      w.parent_pressure = clamp01(w.parent_pressure + 30);
      events.push(`崩溃:${k}`);
    }
  }

  // 夜晚结算
  if (spec.night) {
    nightSettle(statData, events);
  }

  statData.meta.last_settled = action.action_id;
  return { settled: true, skipped: false, events };
}

function applyOpening(statData, opening, events) {
  const w = statData.world;
  const idea = OPENING_MAP.理念[opening.理念] ?? OPENING_MAP.理念.平衡;
  w.parent_pressure = idea.pressure;
  w.难度系数 = OPENING_MAP.难度[opening.难度] ?? 1.0;
  w.初始关注 = GIRL_KEYS.includes(opening.关注) ? opening.关注 : null;
  for (const k of GIRL_KEYS) {
    const girl = statData.girls[k];
    girl.信任 = clamp01(girl.信任 + idea.trustShift);
  }
  events.push(`开局:理念=${opening.理念 ?? '平衡'},难度=${opening.难度 ?? '标准'},关注=${w.初始关注 ?? '无'}`);
}

function nightSettle(statData, events) {
  const w = statData.world;
  // 探视日压力结算（契约 §2.3：结束的这一天是探视日时按均值调压）
  if (w.day % VISIT_INTERVAL === 0) {
    const avg = girlsAvg修正(statData.girls);
    const delta = avg >= 50 ? -10 : 15;
    w.parent_pressure = clamp01(w.parent_pressure + delta);
    events.push(`探视日:均值${Math.round(avg)}:压力${delta > 0 ? '+' : ''}${delta}`);
  }
  // 第 30 天夜晚 = 评估日逐人结算 + 园长总结局（契约 §2.4）
  if (w.day >= TOTAL_DAYS && !w.总结局) {
    assignEndings(statData, events);
  }
  w.day += 1;
  w.ap = 3;
  events.push(`夜晚结算:day=${w.day}`);
}

function assignEndings(statData, events) {
  for (const k of GIRL_KEYS) {
    const g = statData.girls[k];
    if (!g || g.结局 !== null) continue; // 崩溃已冻结者不改写
    if (g.信任 >= 70 && g.心结 >= 4) g.结局 = '蜕变';
    else if (g.修正值 >= 70 && g.信任 < 40) g.结局 = '假性修正';
    else g.结局 = '未完成';
    events.push(`结局:${k}=${g.结局}`);
  }
  const count = v => GIRL_KEYS.filter(k => statData.girls[k] && statData.girls[k].结局 === v).length;
  const collapsed = count('崩溃');
  const fake = count('假性修正');
  const grown = count('蜕变');
  const electroed = GIRL_KEYS.filter(k => statData.girls[k] && statData.girls[k].标记.电疗过).length;
  let total;
  if (collapsed >= 2 || (collapsed >= 1 && fake >= 2)) total = '被吞噬';
  else if (fake >= 3 || electroed >= 3) total = '共犯';
  else if (grown >= 3 && collapsed === 0) total = '改革者';
  else total = '未完待续';
  statData.world.总结局 = total;
  events.push(`园长总结局:${total}`);
}

/** 电疗是否解锁（UI/规则共用的只读判断，不写状态） */
export function electroUnlocked(statData) {
  return statData.world.parent_pressure >= ELECTRO_UNLOCK_PRESSURE;
}

/**
 * 效果类别提取：从 AI 楼层文本解析 <结算 效果="…"/>；缺失/非法 → 一般（契约 §2.3 降级）。
 */
export function parseEffect(messageText) {
  const m = /<结算\s+效果="([^"]+)"\s*\/>/.exec(messageText ?? '');
  return m && EFFECT_COEF[m[1]] !== undefined ? m[1] : '一般';
}

/**
 * 对账工具（契约 §3.5：重放降级为自检）：从初始帧重放行动序列，返回终态。
 */
export function replay(initialStatData, steps) {
  const state = structuredClone(initialStatData);
  for (const step of steps) {
    settleAction(state, step.action, step.effect);
  }
  return state;
}
