// stat_data 结构与默认值 —— 唯一事实来源：设计契约 §3 账本
// 本文件是账本的可执行投影：schema 默认值即「未开局安全态」。

export const SCHEMA_VERSION = 1;

export const GIRL_KEYS = ['linwanqiu', 'jiangling', 'sunian', 'fangtangtang', 'guyunlei'];

export const GIRL_NAMES = {
  linwanqiu: '林晚秋',
  jiangling: '江铃',
  sunian: '苏念',
  fangtangtang: '方糖糖',
  guyunlei: '顾云蕾',
};

// 各人初值（契约 §3：信任 10-25 按人设，创伤仅林晚秋 15）
const GIRL_DEFAULTS = {
  linwanqiu:   { 修正值: 30, 信任: 10, 创伤: 15, 状态: '低落' },
  jiangling:   { 修正值: 20, 信任: 15, 创伤: 0,  状态: '抵触' },
  sunian:      { 修正值: 25, 信任: 20, 创伤: 0,  状态: '正常' },
  fangtangtang:{ 修正值: 35, 信任: 25, 创伤: 0,  状态: '正常' },
  guyunlei:    { 修正值: 25, 信任: 12, 创伤: 0,  状态: '抵触' },
};

export function buildInitialStatData() {
  const girls = {};
  for (const key of GIRL_KEYS) {
    girls[key] = {
      修正值: GIRL_DEFAULTS[key].修正值,
      信任: GIRL_DEFAULTS[key].信任,
      创伤: GIRL_DEFAULTS[key].创伤,
      心结: 0,
      状态: GIRL_DEFAULTS[key].状态,
      标记: { 电疗过: false, 秘密揭示: false },
      结局: null,
    };
  }
  return {
    world: {
      day: 1,
      ap: 3,
      parent_pressure: 20,
      难度系数: 1.0,
      初始关注: null,
    },
    girls,
    meta: { schema_version: SCHEMA_VERSION, last_settled: null },
  };
}
