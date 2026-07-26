# 阶段 3 记录 —— 切片·shell + bridge

> 日期：2026-07-26 ｜ 负责技能：sillytavern-embedded-ui ｜ 结论：**实现完成，离线支撑检查全绿；运行时验收移交阶段 4**

## 1. 架构落地

- **mount 展开机制定案**：0 号楼正文只放短标记 `[[WYXY_SHELL_MOUNT]]`（兼作依赖说明文案）；显示层正则（markdownOnly）把标记替换为完整 HTML 代码块 → 酒馆助手渲染器 iframe 化。模型上下文只见短标记，**不触碰 is_hidden 红线**。
- **shell**（[src/shell/shell.html](../src/shell/shell.html)，18.5KB 单文件，无框架）：四视图（loading/broken/wizard/main）；GameStateAdapter 只读快照（message 帧→chat 域回退）；chat-service 收口全部楼层写操作；busy 链 = 事件解锁 + 120s 超时对账；心跳每 3s 发 `wyxy:heartbeat`。
- **bridge**（[src/bridge/index.js](../src/bridge/index.js)，与 schema/settle-core/stages 拼为 dist/bridge.js 12.5KB）：`waitGlobalInitialized('Mvu')` → 挂 `Mvu.events.VARIABLE_UPDATE_ENDED` 结算钩子；心结变更→`updateWorldbookWith` 切阶段条目 enabled；presentation mode（仅注样式折叠非 0 楼，心跳丢失 10s/切聊天/逃生开关即恢复原生显示，选择器失效安全失败为可见）。
- **构建**：[tools/build.js](../tools/build.js)（窄规则拼接器 + node --check 双重语法验证）；[tools/make-preview.js](../tools/make-preview.js) 生成离线挽具（页面上下文桩：楼层数组/假生成/假 MVU 帧/事件总线）。

## 2. 状态所有权（契约 §4.4 落实）

| 状态 | 位置 | 实现 |
|---|---|---|
| 游戏状态 | MVU 帧 | shell 经 adapter 只读 |
| 开局草稿 | chat 域 `same_floor_ui.wizard_draft` | 改动即存，重载恢复 |
| 行动元数据 | user 楼 `data.same_floor_ui`（protocol_version=1, action_id=UUID, type, target, opening） | createChatMessages 时写入 |
| UI 瞬态 | iframe 内存 | 刷新即弃，仅凭持久数据重建 |

## 3. 安全与可访问性

- 全部动态文本用 `textContent`/DOM 构造，零 innerHTML 注入；剧情镜像先剥系统标签再渲染。
- 语义控件（button/fieldset/radiogroup/dialog）；焦点可见；busy 用 aria-live；Modal 用原生 dialog（Esc 关闭、焦点困留）；触控目标 ≥40px；prefers-reduced-motion 停转 spinner。
- 命名空间：`wyxy` 前缀（事件/样式 id/变量键）。

## 4. 离线支撑检查证据（dist/preview.html 挽具）

| 用例 | 结果 |
|---|---|
| 依赖缺失 → broken 视图 + 可读文案 + 原生消息不隐藏 | ✅（10s 探测超时路径实测） |
| 向导：5 关注选项、预览生成设定块开场、确认解锁、改草稿重新锁定 | ✅ |
| 确认开局 → 真实 user 楼 + 冻结元数据（含改动后的怀柔）+ busy → 假生成 → main 视图 | ✅ |
| 主界面：Day/AP/压力渲染、剧情镜像剥净 `<结算/>`/`<UpdateVariable>` | ✅ |
| 行动链：选人 Modal 5 人 → 选中即发 → busy 开/关 → AP 2 → 元数据正确 | ✅ |
| 回归：阶段 1 全部 14 测试 + build 语法检查 | ✅ |

## 5. 运行时交接清单（→ 阶段 4 runtime-debug）

工件：dist/bridge.js + dist/shell.html（本次 commit 版本）。请求证据：

- 渲染：导入建卡、新聊天、0 号楼 iframe 实际渲染、刷新/切聊天/重绘后重建。
- 数据：VARIABLE_UPDATE_ENDED 实际触发时序（Swipe/编辑/删楼/重生成各场景）；结算幂等；`_.set` 方言被 CDN bundle 解析；EJS 投影取帧语义。
- 交互：开局全链（草稿恢复→预览→确认→真实楼层→生成→初始化落库）；行动链；busy 超时对账。
- presentation mode：折叠生效、逃生开关、心跳丢失恢复、切聊天恢复。
- 布局：窄容器（~320px）与移动端（离线挽具面板隐藏无法测宽度，此项完全依赖真机）。
- 事件桥：shell iframe 的 eventEmit 与 bridge 脚本的 eventOn 是否同总线（若不通，改用 window.parent 转发——已知备选）。

## 6. 已知限制

- 少女页/回看页按切片范围未实现（阶段 5）。
- 结算钩子里 `wyxyFindLastAction` 仅回溯 4 层，长闲聊后追加行动无影响（行动楼必在末端），但真机需确认 Swipe 时 getLastMessageId 语义。
