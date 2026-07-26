// 生成 dist/preview.html：页面上下文桩 + shell —— 离线交互挽具（不替代真机验收）
// 桩模拟：楼层数组、createChatMessages/triggerSlash（假生成回复+假结算）、Mvu 帧、事件总线。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shell = readFileSync(join(root, 'src/shell/shell.html'), 'utf8');

const stubs = `<script>
// ---- 离线挽具桩（页面上下文，先于 shell 执行）----
(() => {
  const chat = []; // {role, message, data}
  const bus = new Map();
  const chatVars = {};
  let mvuFrame = null;
  window.__harness = { chat, get mvuFrame(){ return mvuFrame; } };

  window.getLastMessageId = () => chat.length - 1 + 1 * (chat.length === 0 ? 0 : 0) || (chat.length === 0 ? 0 : chat.length - 1);
  // 楼层 0 = shell 消息（挽具里虚拟存在）
  chat.push({ role: 'assistant', message: '[[WYXY_SHELL_MOUNT]]' });
  window.getLastMessageId = () => chat.length - 1;
  window.getChatMessages = id => { const i = id < 0 ? chat.length + id : id; return chat[i] ? [chat[i]] : []; };
  window.getVariables = () => JSON.parse(JSON.stringify(chatVars));
  window.insertOrAssignVariables = async (patch) => { Object.assign(chatVars, JSON.parse(JSON.stringify(patch))); };
  window.eventOn = (name, fn) => { (bus.get(name) || bus.set(name, []).get(name)).push(fn); };
  window.eventEmit = (name, payload) => { (bus.get(name) || []).forEach(fn => { try { fn(payload); } catch (e) {} }); };
  window.iframe_events = { GENERATION_ENDED: 'ge' };
  window.tavern_events = { CHARACTER_MESSAGE_RENDERED: 'cmr', CHAT_CHANGED: 'cc' };
  window.triggerSlash = async cmd => {
    if (cmd !== '/trigger') return '';
    // 假生成：800ms 后产出带结算标签的回复并推进假 MVU 帧
    setTimeout(() => {
      const n = chat.length;
      chat.push({ role: 'assistant', message: '（挽具假回复 #' + n + '）走廊尽头的灯还亮着，林晚秋在名单上迟迟没有抬头。\\n<结算 效果="一般"/>' });
      if (!mvuFrame) mvuFrame = { stat_data: { world: { day: 1, ap: 3, parent_pressure: 20, 难度系数: 1, 初始关注: 'linwanqiu' }, girls: Object.fromEntries(['linwanqiu','jiangling','sunian','fangtangtang','guyunlei'].map(k => [k, { 修正值: 25, 信任: 15, 创伤: 0, 心结: 0, 状态: '正常', 标记: { 电疗过: false, 秘密揭示: false }, 结局: null }])), meta: { schema_version: 1, last_settled: null } } };
      else { const w = mvuFrame.stat_data.world; w.ap = Math.max(0, w.ap - 1); }
      window.eventEmit(window.iframe_events.GENERATION_ENDED, '');
      window.eventEmit(window.tavern_events.CHARACTER_MESSAGE_RENDERED, chat.length - 1);
    }, 800);
    return '';
  };
  window.createChatMessages = async (msgs) => { for (const m of msgs) chat.push(JSON.parse(JSON.stringify(m))); };
  window.Mvu = { getMvuData: () => (mvuFrame ? JSON.parse(JSON.stringify(mvuFrame)) : { stat_data: null }) };
})();
</script>`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/preview.html'), '<!-- 生成物：离线挽具，勿手改 -->\n' + stubs + '\n' + shell);
console.log('✅ dist/preview.html generated');
