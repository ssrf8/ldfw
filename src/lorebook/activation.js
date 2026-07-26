// 条目激活决策（纯函数，bridge 与测试共用）—— 契约 §3.3 + 条件内容条目
// 返回 Map<条目名, 应否启用>；未列出的条目不受 bridge 管理。
import { GIRL_KEYS } from '../mvu/schema.js';
import { STAGES, STAGE_OF_KNOT, personaEntryName } from './stages.js';

export const COND = {
  VISIT: '[mvu_plot]探视日指引',
  EVAL: '[mvu_plot]评估日指引',
  COLLAPSE: '[mvu_plot]崩溃警报',
  DAY1: '[mvu_plot]首日关注事件',
};

export function wantedEntryStates(statData) {
  const wanted = new Map();
  const w = statData.world || {};
  const girls = statData.girls || {};
  // 分阶段人设：每人恰好 1 条（心结映射）
  for (const key of GIRL_KEYS) {
    if (!girls[key]) continue;
    const stage = STAGE_OF_KNOT(girls[key].心结 | 0);
    for (const s of STAGES) wanted.set(personaEntryName(key, s), s === stage);
  }
  // 条件内容条目
  const anyTrauma70 = GIRL_KEYS.some(k => girls[k] && girls[k].创伤 >= 70 && girls[k].结局 === null);
  const anyCollapsed = GIRL_KEYS.some(k => girls[k] && girls[k].结局 === '崩溃');
  wanted.set(COND.VISIT, (w.day | 0) % 7 === 0 && (w.day | 0) > 0 && !w.总结局);
  wanted.set(COND.EVAL, (w.day | 0) >= 30 && !w.总结局);
  wanted.set(COND.COLLAPSE, anyTrauma70 || anyCollapsed);
  wanted.set(COND.DAY1, (w.day | 0) === 1 && !!w.初始关注);
  return wanted;
}
