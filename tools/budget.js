// 提示词预算门实测工具（契约 §3.4）：CJK≈1 token/字、ASCII≈1 token/4 字的粗估，
// 上限打八折使用；真机 tokenizer 复核在阶段 4/8。
import { buildEntries } from '../src/lorebook/entries.js';

const estTokens = s => {
  let cjk = 0, ascii = 0;
  for (const ch of s) (ch.codePointAt(0) > 0x2e00 ? cjk++ : ascii++);
  return Math.round(cjk + ascii / 4);
};

const entries = buildEntries();
let plot = 0, update = 0, inactive = 0;
console.log('条目名 | 字符 | 估token | 计入');
for (const e of entries) {
  const t = estTokens(e.content);
  const name = e.name;
  let bucket = '';
  if (!e.enabled && !name.includes('InitialVariables')) { inactive += t; bucket = '未激活'; }
  else if (name.includes('InitialVariables')) bucket = '不进提示词';
  else if (name.includes('[mvu_update]')) { update += t; plot += t; bucket = '同代=剧情侧'; }
  else { plot += t; bucket = '剧情侧'; }
  console.log(`${name} | ${e.content.length} | ${t} | ${bucket}`);
}
console.log('---');
console.log(`剧情模型常驻估计（同代模式，含投影模板渲染前体量）: ${plot} tokens（预算 ≤3500）`);
console.log(`未激活条目合计: ${inactive} tokens（不计入）`);
if (plot > 3500 * 0.8) console.log('⚠ 超过预算八折线，需去重删减');
else console.log('✅ 预算门通过（八折线内）');
