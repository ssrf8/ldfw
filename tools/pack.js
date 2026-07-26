// 打包器（简装版，格式权威=本机样例卡「交错宙域 MVU2.6.0」逆向结构，见 记录/阶段4）
// 产出：dist/网瘾学园.json + dist/网瘾学园.png（tEXt chara 载荷）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEntries } from '../src/lorebook/entries.js';
import { REGEX_SCRIPTS } from '../src/regex/regex.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

export const CARD_VERSION = '0.1.0-slice';
const BOOK_NAME = '网瘾学园·修正日志';

// ---- 世界书条目映射（样例卡 v3 字段全集）----
const POSITION_NAME = { 0: 'before_char', 4: 'at_depth' };
function mapEntry(e, i) {
  return {
    id: i,
    keys: [], secondary_keys: [],
    comment: e.name,
    content: e.content,
    constant: !!e.constant,
    selective: true,
    insertion_order: e.order,
    enabled: !!e.enabled,
    position: POSITION_NAME[e.position] ?? 'before_char',
    use_regex: true,
    extensions: {
      position: e.position, exclude_recursion: false, display_index: i,
      probability: 100, useProbability: true, depth: e.depth ?? 1,
      selectiveLogic: 0, group: '', group_override: false, group_weight: 100,
      prevent_recursion: false, delay_until_recursion: false, scan_depth: null,
      match_whole_words: false, use_group_scoring: false, case_sensitive: null,
      automation_id: '', role: 0, vectorized: false, sticky: 0, cooldown: 0, delay: 0,
      match_persona_description: false, match_character_description: false,
      match_character_personality: false, match_character_depth_prompt: false,
      match_scenario: false, match_creator_notes: false, triggers: [],
      ignore_budget: false, outlet_name: '',
    },
  };
}

// ---- 正则映射（样例卡字段结构）----
const mapRegex = (r, i) => ({
  id: `wyxy-regex-${i}`,
  scriptName: r.scriptName,
  findRegex: r.findRegex,
  replaceString: r.replaceString,
  trimStrings: [], placement: r.placement,
  disabled: !!r.disabled, markdownOnly: !!r.markdownOnly, promptOnly: !!r.promptOnly,
  runOnEdit: !!r.runOnEdit, substituteRegex: 0, minDepth: null, maxDepth: null,
});

export function buildCard() {
  const shellHtml = read('dist/shell.html');
  const bridgeJs = read('dist/bridge.js');

  const firstMes = `「网瘾学园 · 修正日志」控制台加载中……

（本卡需要「酒馆助手 JS-Slash-Runner」扩展并开启前端渲染，变量由 MVU 框架管理（卡内脚本自动联网加载）。若你只看到这段文字而没有界面，请检查上述依赖；原生消息始终可用。）

[[WYXY_SHELL_MOUNT]]`;

  // mount 展开：显示层把短标记替换为完整 shell 代码块（$ 转义为 $$ 防替换语义）
  const mountRegex = mapRegex({
    scriptName: '网瘾学园-展开控制台',
    findRegex: '/\\[\\[WYXY_SHELL_MOUNT\\]\\]/g',
    replaceString: '```html\n' + shellHtml.replace(/\$/g, '$$$$') + '\n```',
    placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true,
  }, 99);

  const mvuLoader = {
    type: 'script', enabled: true, name: 'MVU 框架加载器（双源）', id: 'wyxy-mvu-loader',
    content: `try {
  await import('https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js');
} catch (e) {
  console.warn('[wyxy] 主源加载失败，切国内源', e);
  await import('https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js');
}`,
    info: 'MVU Zod 框架双源加载（MIT，MagicalAstrogy/MagVarUpdate）', button: { enabled: false, buttons: [] },
    data: {}, export_with: { data: true, button: true },
  };
  const bridgeScript = {
    type: 'script', enabled: true, name: '网瘾学园 bridge（结算+阶段同步+显示适配）', id: 'wyxy-bridge',
    content: bridgeJs, info: '生成物，源在仓库 src/；勿手改',
    button: { enabled: false, buttons: [] }, data: {}, export_with: { data: true, button: true },
  };

  return {
    spec: 'chara_card_v3', spec_version: '3.0',
    data: {
      name: '网瘾学园·修正日志',
      description: `【本卡为同层前端混合卡：全部交互经 0 号楼控制台完成】
「青禾修正学园」——一所民办网瘾矫治机构。{{user}}是新任园长，抽屉里放着 30 天修正期的考核表，钥匙串上挂着惩戒室的钥匙。五名成年（18-22 岁）入园者被父母以「为你好」的名义送进来。家长们只看「修正值」报表；而报表上，没有「创伤」这一栏。`,
      personality: '', scenario: '', mes_example: '',
      first_mes: firstMes,
      creator_notes: `切片验证版 ${CARD_VERSION}。依赖：酒馆助手（JS-Slash-Runner）+ 前端渲染开启；MVU 框架由卡内脚本联网加载（jsdelivr 双源）。源仓库：https://github.com/ssrf8/ldfw`,
      system_prompt: '', post_history_instructions: '',
      tags: ['同层前端', 'MVU', '模拟经营', '群像'],
      creator: 'ssrf8', character_version: CARD_VERSION,
      alternate_greetings: [], group_only_greetings: [],
      extensions: {
        talkativeness: '0.5', fav: false, world: BOOK_NAME,
        regex_scripts: [...REGEX_SCRIPTS.map(mapRegex), mountRegex],
        tavern_helper: { scripts: [mvuLoader, bridgeScript] },
      },
      character_book: {
        name: BOOK_NAME,
        description: `网瘾学园世界书 ${CARD_VERSION}：初始化(10)/更新协议(20)/玩法(30)/文风(35)/人设(50+)/投影(900)`,
        extensions: {},
        entries: buildEntries().map(mapEntry),
      },
    },
  };
}

// ---- PNG 生成（384x576 深色底 + tEXt chara 载荷）----
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
export function makePng(cardJson) {
  const W = 384, H = 576;
  const raw = Buffer.alloc(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) {
    const rowStart = y * (W * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < W; x++) {
      const i = rowStart + 1 + x * 3;
      // 深色渐变底 + 中央亮带（占位立绘，阶段 7 换正式图）
      const band = Math.abs(y - H / 2) < 60 ? 26 : 0;
      raw[i] = 18 + band; raw[i + 1] = 20 + band; raw[i + 2] = 26 + band + Math.floor(14 * y / H);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8bit RGB
  const payload = Buffer.concat([Buffer.from('chara\0', 'ascii'), Buffer.from(Buffer.from(cardJson, 'utf8').toString('base64'), 'ascii')]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('tEXt', payload),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const card = buildCard();
const json = JSON.stringify(card, null, 1);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/网瘾学园.json'), json);
writeFileSync(join(root, 'dist/网瘾学园.png'), makePng(json));

// ---- 载荷一致性自检：从 PNG 读回并与 JSON 深比对 ----
const png = readFileSync(join(root, 'dist/网瘾学园.png'));
let off = 8, back = null;
while (off < png.length) {
  const len = png.readUInt32BE(off);
  const type = png.toString('ascii', off + 4, off + 8);
  if (type === 'tEXt') {
    const data = png.subarray(off + 8, off + 8 + len);
    const nul = data.indexOf(0);
    if (data.toString('ascii', 0, nul) === 'chara') back = Buffer.from(data.subarray(nul + 1).toString('ascii'), 'base64').toString('utf8');
  }
  off += 12 + len;
}
if (back !== json) { console.error('❌ PNG 载荷回读不一致'); process.exit(1); }
console.log(`✅ pack ok: dist/网瘾学园.json (${json.length} chars) + dist/网瘾学园.png (${png.length} bytes)，载荷回读一致`);
