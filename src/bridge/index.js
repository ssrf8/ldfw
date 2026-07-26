// bridge 常驻脚本（酒馆助手全局脚本）—— 契约 §4.1/§3.5/§4.5
// 打包时由 tools/build.js 将 schema.js + settle-core.js + entries.js(阶段映射) 与本文件拼为单文件 dist/bridge.js。
// 依赖的全局：TavernHelper 注入 API + Mvu（等待后使用）。
/* global waitGlobalInitialized, eventOn, eventEmit, getChatMessages, getLastMessageId,
          getCharWorldbookNames, getWorldbook, updateWorldbookWith, Mvu, tavern_events, iframe_events */

const WYXY_NS = 'wyxy';
const WYXY_STYLE_ID = 'wyxy-presentation-style';

// ---- 结算接线（契约 §3.5 定案：挂 VARIABLE_UPDATE_ENDED 原地计算）----
function wyxyFindLastAction() {
  try {
    const lastId = getLastMessageId();
    for (let i = lastId; i >= 0 && i >= lastId - 4; i--) {
      const msgs = getChatMessages(i);
      const m = msgs && msgs[0];
      if (m && m.role === 'user' && m.data && m.data.same_floor_ui && m.data.same_floor_ui.type) {
        return m.data.same_floor_ui;
      }
    }
  } catch (e) { console.warn('[wyxy] 读取行动元数据失败', e); }
  return null;
}

function wyxyReadEffect() {
  try {
    const lastId = getLastMessageId();
    const msgs = getChatMessages(lastId);
    const m = msgs && msgs[0];
    if (m && m.role === 'assistant') return parseEffect(m.message);
  } catch (e) { /* 降级一般 */ }
  return '一般';
}

function wyxySettleHook(variables /* , variables_before_update */) {
  try {
    if (!variables || !variables.stat_data || !variables.stat_data.world) return;
    const action = wyxyFindLastAction();
    const effect = wyxyReadEffect();
    const result = settleAction(variables.stat_data, action, effect);
    if (result.settled) {
      console.info('[wyxy] 结算完成', result.events);
      wyxySyncStageEntries(variables.stat_data).catch(e => console.warn('[wyxy] 阶段条目同步失败', e));
      eventEmit(`${WYXY_NS}:settled`, { events: result.events });
    }
  } catch (e) {
    // 失败原子性：settleAction 内部无半写路径；此处仅报告，不做补写（契约 §3.5）
    console.error('[wyxy] 结算失败（本轮跳过，无半结算）', e);
    eventEmit(`${WYXY_NS}:settle-error`, { message: String(e && e.message || e) });
  }
}

// ---- 条目同步（契约 §3.3 定案：阶段人设 + 条件内容，决策见 activation.js 纯函数）----
async function wyxySyncStageEntries(statData) {
  const books = await getCharWorldbookNames('current');
  const bookName = books && (books.primary || (books.additional && books.additional[0]));
  if (!bookName) return;
  const book = await getWorldbook(bookName);
  const wanted = wantedEntryStates(statData);
  let dirty = false;
  for (const entry of book) {
    if (wanted.has(entry.name) && entry.enabled !== wanted.get(entry.name)) {
      entry.enabled = wanted.get(entry.name);
      dirty = true;
    }
  }
  if (dirty) {
    await updateWorldbookWith(bookName, () => book);
    console.info('[wyxy] 条目同步完成');
  }
}

// ---- presentation mode（契约 §4.5 红线：仅视觉折叠，不写 is_hidden，不动消息）----
let wyxyLastHeartbeat = 0;
let wyxyEscape = false;

function wyxyApplyPresentation(on) {
  try {
    const doc = window.top && window.top.document ? window.top.document : document;
    let style = doc.getElementById(WYXY_STYLE_ID);
    if (on && !wyxyEscape) {
      if (!style) {
        style = doc.createElement('style');
        style.id = WYXY_STYLE_ID;
        // 仅折叠非 0 号消息容器；选择器失效 = 安全失败为全部可见
        style.textContent = '#chat .mes:not([mesid="0"]) { display: none !important; }';
        doc.head.appendChild(style);
      }
    } else if (style) {
      style.remove();
    }
  } catch (e) { /* 跨域/结构变化 → 安全失败为可见 */ }
}

function wyxyPresentationTick() {
  const alive = Date.now() - wyxyLastHeartbeat < 10000;
  wyxyApplyPresentation(alive);
}

// ---- 启动 ----
(async () => {
  try {
    await waitGlobalInitialized('Mvu');
  } catch (e) {
    console.warn('[wyxy] MVU 未初始化，bridge 待机（不隐藏原生消息）');
    return;
  }
  // 事件常量必须经 Mvu.events.* 引用（存在历史拼写，契约 §3.5）
  eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, wyxySettleHook);

  eventOn(`${WYXY_NS}:heartbeat`, () => { wyxyLastHeartbeat = Date.now(); wyxyPresentationTick(); });
  eventOn(`${WYXY_NS}:escape`, payload => {
    wyxyEscape = !!(payload && payload.show_native);
    wyxyApplyPresentation(!wyxyEscape);
  });
  eventOn(tavern_events.CHAT_CHANGED, () => {
    wyxyLastHeartbeat = 0;
    wyxyApplyPresentation(false); // 切聊天自动恢复原生显示（契约 §4.5）
  });
  setInterval(wyxyPresentationTick, 5000);
  console.info('[wyxy] bridge 就绪（结算钩子 + 阶段条目同步 + presentation mode）');
})();
