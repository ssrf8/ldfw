// 阶段映射（bridge 与世界书源共用；心结值 → 阶段条目）
import { GIRL_NAMES } from '../mvu/schema.js';

export const STAGES = ['抵触', '试探', '敞开', '蜕变'];
export const STAGE_OF_KNOT = knot => (knot >= 4 ? '蜕变' : knot >= 2 ? '敞开' : knot >= 1 ? '试探' : '抵触');
export const personaEntryName = (key, stage) => `${GIRL_NAMES[key]}·${stage} [mvu_plot]`;
