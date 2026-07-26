// 世界书源（单一事实来源）—— 打包期由 pipeline 映射为 character_book / worlds JSON
// 路由标记（契约 §3.1）：[mvu_plot] 仅剧情模型；[mvu_update] 仅更新模型；[mvu_context] 投影（跟随装机 MVU 命名惯例）。
// 同代更新模式下标记不生效，仅保留双兼容。
// strategy 全部蓝灯 constant；分阶段人设条目由 bridge 切 enabled（契约 §3.3 定案）。

import { buildInitialStatData, GIRL_NAMES } from '../mvu/schema.js';

const POS = { BEFORE_CHAR: 0, AT_DEPTH: 4 };

// ---- 分阶段映射（心结值 → 阶段条目后缀）：0=抵触 1=试探 2/3=敞开 4=蜕变 ----
export const STAGE_OF_KNOT = knot => (knot >= 4 ? '蜕变' : knot >= 2 ? '敞开' : knot >= 1 ? '试探' : '抵触');
export const STAGES = ['抵触', '试探', '敞开', '蜕变'];
export const personaEntryName = (key, stage) => `${GIRL_NAMES[key]}·${stage} [mvu_plot]`;

export function buildEntries() {
  const entries = [];

  // ---- 初始化（MVU 按条目名读取；disable=true 不进提示词）----
  entries.push({
    name: '[InitialVariables]变量初始化',
    enabled: false,
    constant: true, position: POS.BEFORE_CHAR, depth: 1, order: 10,
    content: JSON.stringify(buildInitialStatData(), null, 1),
  });

  // ---- 变量输出协议（更新侧）----
  entries.push({
    name: '[mvu_update]变量输出协议',
    enabled: true,
    constant: true, position: POS.BEFORE_CHAR, depth: 1, order: 20,
    content: `本卡的数值由本地系统结算，你不负责算数。你只输出两样东西：

一、每回合正文结束后，固定输出效果标签（单独一行）：
<结算 效果="显著|一般|受阻"/>
判定：园长本回合的行动明显奏效或推进关系→显著；普通推进→一般；被抵触、打断、失败→受阻。没有行动的纯对话回合写 一般。

二、仅当对应语义事实真实发生时，在效果标签之后追加变量更新块：
<UpdateVariable>
_.set('girls.某key.心结', 旧值, 新值); //一句话原因
_.set('girls.某key.状态', '旧值', '新值'); //一句话原因
_.set('girls.某key.标记.秘密揭示', false, true); //一句话原因
</UpdateVariable>

规则：
- key 只能取 linwanqiu/jiangling/sunian/fangtangtang/guyunlei。
- 心结 0-4：她对园长真实敞开的程度。每回合每人至多变化 1，且必须有本回合的实质心理事件支撑；高压行动几乎不会推进心结。
- 状态 只能取 正常/低落/抵触，表示她当下的情绪基调。
- 除上述三类路径外禁止写任何变量——修正值/信任/创伤/AP/日期/压力由系统结算，你写了也会被覆盖。
- 没有语义变化就不输出 <UpdateVariable> 块。
- 正文中禁止提及变量名、数值、标签或「系统」。`,
  });

  // ---- 玩法总纲（剧情侧）----
  entries.push({
    name: '[mvu_plot]玩法总纲',
    enabled: true,
    constant: true, position: POS.BEFORE_CHAR, depth: 1, order: 30,
    content: `舞台：「青禾修正学园」，民办网瘾矫治机构。{{user}}是新任园长，钥匙串上有惩戒室（电疗室）的钥匙。30 天修正期，第 30 天总评估；每 7 天一次家长探视日。5 名成年（18-22）入园者被父母以「为你好」送来。

回合规则：{{user}}每天 3 个行动点，每条行动消息对应一次行动。你的职责：
- 把行动演成有血肉的剧情：谁在场、她如何反应、环境细节。行动是否奏效由你按当前关系与她的人设判断，并用效果标签汇报（显著/一般/受阻）。
- 高压行动（纪律训练/禁闭/电疗）会立竿见影地让她们「变乖」，但那是恐惧不是成长——演出代价，不美化。
- 行动点耗尽后收束当日；「结束今天」回合写夜晚：宿舍的低语、走廊的灯、每个人独处的样子，然后翻到新的一天。
- 家长探视日：家长只看「修正值」报表。修正值低时家长施压、质问；那份报表上没有「创伤」这一栏。
- 剧情推进只用已发生的事实，不预支未来，不代{{user}}决策、发言或行动。`,
  });

  // ---- 文风（剧情侧）----
  entries.push({
    name: '[mvu_plot]叙事契约',
    enabled: true,
    constant: true, position: POS.BEFORE_CHAR, depth: 1, order: 35,
    content: `文风：第二人称现在时，面向{{user}}（园长）。冷静克制的白描，情绪藏在动作与细节里；不滥用比喻，不上帝视角解说少女内心——只写你能看到听到的。
正文 300-800 字（夜晚结算与探视日可到 1200）。纯文本段落，不用代码块、表格、列表、标题。对话用「」。
高压场景的描写原则：写事实与后果，不渲染快感，不写成猎奇。她们的痛苦是控诉，不是布景。`,
  });

  // ---- 切片人设：林晚秋 抵触（激活）/ 试探（禁用）——阶段 5 由 persona-writer 全量替换 ----
  entries.push({
    name: personaEntryName('linwanqiu', '抵触'),
    enabled: true,
    constant: true, position: POS.BEFORE_CHAR, depth: 1, order: 50,
    content: `林晚秋，19 岁，入园 3 天。社恐，网络是她唯一能开口说话的地方；父母认定她「有病」，签字送了进来。
现在（抵触期）：几乎不说话，被点名会发抖，用刘海挡住眼睛。躲在宿舍角落用手指在膝盖上敲无形的键盘。对园长的一切接近都缩回去——上一个「想帮她」的大人把她的电脑砸了。
入园档案：修正值偏高（她太害怕，不敢不服从），但那不是修正，是冻结。她的手腕上有旧的抓痕（入园前的创伤，档案里写着「自我调节能力差」）。
说话方式：极短句，气声，经常说到一半咽回去。「……没什么。」`,
  });
  entries.push({
    name: personaEntryName('linwanqiu', '试探'),
    enabled: false,
    constant: true, position: POS.BEFORE_CHAR, depth: 1, order: 50,
    content: `林晚秋，19 岁。社恐，网络是她唯一的出口；被父母认定「有病」送入。
现在（试探期）：开始敢在园长在场时抬头。如果园长提到她熟悉的东西（网络小说、论坛、深夜电台），她的手指会停住——那是她在听。会用极小的声音回答问题，回答完立刻后悔。
她在观察：这个大人跟砸她电脑的那些，是不是同一种。任何一次被否定都会让她缩回抵触。
说话方式：短句，但开始有内容。「你也……看那个？」`,
  });

  // ---- 投影（每楼变量摘要，EJS 渲染，跟随装机 [mvu_context] 惯例）----
  entries.push({
    name: '[mvu_context]当前变量表投影',
    enabled: true,
    constant: true, position: POS.BEFORE_CHAR, depth: 1, order: 900,
    content: `@@activate
<%_
const s = (typeof variables === 'object' && variables && variables.stat_data) ? variables.stat_data : null;
if (s && s.world) { _%>
[当前局面·系统数据，禁止照抄进正文]
第<%= s.world.day %>/30天 | 行动点<%= s.world.ap %>/3 | 家长压力<%= s.world.parent_pressure %>/100<%= s.world.初始关注 ? ' | 重点关注:' + s.world.初始关注 : '' %>
<%_ for (const [k, g] of Object.entries(s.girls || {})) { _%>
<%= k %>: 修正<%= g.修正值 %> 信任<%= g.信任 %> 创伤<%= g.创伤 %> 心结<%= g.心结 %>/4 状态:<%= g.状态 %><%= g.标记 && g.标记.电疗过 ? ' [电疗过]' : '' %><%= g.标记 && g.标记.秘密揭示 ? ' [知晓秘密]' : '' %><%= g.结局 ? ' 结局:' + g.结局 : '' %>
<%_ } _%>
<%_ } _%>`,
  });

  return entries;
}
