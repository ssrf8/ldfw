// E2E 真机驱动（Puppeteer + luker@127.0.0.1:8000 + fake-llm@5199）
// 覆盖：扩展装载、MVU 加载、shell 渲染、开局链、行动链、结算、阶段条目切换、Swipe 重算、presentation mode。
// API 设置：运行前快照 → 切到假端点 → 结束后还原（finally 保证）。
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'dist', 'e2e');
mkdirSync(OUT, { recursive: true });

const report = { started: new Date().toISOString(), steps: [] };
const step = (name, ok, detail) => {
  report.steps.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + String(detail).slice(0, 160) : ''}`);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--window-size=1280,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on('console', m => { if (/\[wyxy\]|\[fake|MVU|Mvu error/i.test(m.text())) console.log('  [console]', m.text().slice(0, 140)); });

let apiSnapshot = null;
try {
  await page.goto('http://127.0.0.1:8000', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // 1. 等 ST 与扩展就绪
  await page.waitForFunction(() => window.SillyTavern && window.SillyTavern.getContext, { timeout: 60000 });
  const thReady = await page.waitForFunction(() => typeof window.TavernHelper === 'object' || typeof window.getTavernHelperVersion === 'function', { timeout: 90000 }).then(() => true).catch(() => false);
  step('酒馆助手扩展装载', thReady, thReady ? await page.evaluate(() => window.TavernHelper && window.TavernHelper.getTavernHelperVersion ? window.TavernHelper.getTavernHelperVersion() : 'global present') : 'TavernHelper 未出现');
  if (!thReady) throw new Error('TH 未装载，终止');

  // 2. API 快照 → 切假端点（Chat Completion / Custom）
  apiSnapshot = await page.evaluate(() => {
    const s = window.SillyTavern.getContext().chatCompletionSettings || {};
    return { source: s.chat_completion_source, url: s.custom_url, model: s.custom_model, mainApi: window.SillyTavern.getContext().mainApi };
  });
  await page.evaluate(() => {
    const ctx = window.SillyTavern.getContext();
    const s = ctx.chatCompletionSettings;
    s.chat_completion_source = 'custom';
    s.custom_url = 'http://127.0.0.1:5199/v1';
    s.custom_model = 'fake-e2e';
    ctx.saveSettingsDebounced();
  });
  step('API 切换到假端点', true, JSON.stringify(apiSnapshot));

  // 3. 选卡开新聊天
  await page.evaluate(async () => { await window.SillyTavern.getContext().getCharacters(); });
  const idx = await page.evaluate(() => window.SillyTavern.getContext().characters.findIndex(c => c.name === '网瘾学园·修正日志'));
  if (idx < 0) throw new Error('卡不在列表');
  await page.evaluate(async i => { await window.SillyTavern.getContext().selectCharacterById(i); }, idx);
  await sleep(2000);
  await page.evaluate(async () => { const c = window.SillyTavern.getContext(); if (c.chat.length > 1) await c.doNewChat({ deleteCurrentChat: false }); });
  await sleep(1500);

  // 4. shell iframe 渲染
  const frameOk = await page.waitForFunction(() => {
    const f = document.querySelector('#chat .mes[mesid="0"] iframe');
    return f && f.contentDocument && f.contentDocument.getElementById('wyxy-app');
  }, { timeout: 60000 }).then(() => true).catch(() => false);
  step('0号楼 shell iframe 渲染', frameOk);
  await page.screenshot({ path: join(OUT, '01-chat.png') });
  if (!frameOk) throw new Error('shell 未渲染，终止');

  const shellFrame = () => page.frames().find(f => f.url() !== page.url() && f.evaluate(() => !!document.getElementById('wyxy-app')).catch(() => false));
  // puppeteer frames() 同步列表：找含 wyxy-app 的 frame
  let shell = null;
  for (const f of page.frames()) {
    if (await f.evaluate(() => !!document.getElementById('wyxy-app')).catch(() => false)) { shell = f; break; }
  }
  if (!shell) throw new Error('找不到 shell frame');

  // 5. MVU 加载（CDN 双源）
  const mvuOk = await page.waitForFunction(() => typeof window.Mvu === 'object' && window.Mvu && window.Mvu.events, { timeout: 90000 }).then(() => true).catch(() => false);
  step('MVU 框架加载（CDN）', mvuOk);

  // 6. 向导视图与草稿
  await shell.waitForFunction(() => document.getElementById('wyxy-app').dataset.view === 'wizard', { timeout: 30000 });
  step('向导视图', true);
  await shell.evaluate(() => {
    const app = document.getElementById('wyxy-app');
    app.querySelector('input[name="理念"][value="怀柔"]').click();
    app.querySelector('input[name="关注"][value="linwanqiu"]').click();
    app.querySelector('[data-act="preview"]').click();
  });
  await sleep(400);
  await shell.evaluate(() => document.getElementById('wyxy-app').querySelector('[data-act="confirm"]').click());
  step('开局确认已提交', true);

  // 7. 等生成完成 → main 视图 + 初始化落库
  const mainOk = await shell.waitForFunction(() => document.getElementById('wyxy-app').dataset.view === 'main' && document.getElementById('wyxy-app').dataset.busy !== '1', { timeout: 90000 }).then(() => true).catch(() => false);
  step('开局生成完成 → 主界面', mainOk);
  await page.screenshot({ path: join(OUT, '02-main.png') });
  const initState = await page.evaluate(() => {
    const d = window.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    return d && d.stat_data && d.stat_data.world;
  });
  const initOk = initState && initState.parent_pressure === 15 && initState.难度系数 === 1 && initState.初始关注 === 'linwanqiu';
  step('开局设定落库（怀柔15/标准1.0/关注林晚秋）', !!initOk, JSON.stringify(initState));

  // 8. 行动链：个别谈话（林晚秋）→ 心结+1 → 阶段条目切换
  await shell.evaluate(() => document.getElementById('wyxy-app').querySelector('[data-act="talk"]').click());
  await sleep(400);
  await shell.evaluate(() => document.querySelector('[data-bind="picker"] .wy-girls button').click());
  const talkOk = await shell.waitForFunction(() => document.getElementById('wyxy-app').dataset.busy !== '1' && document.getElementById('wyxy-app').querySelector('[data-bind="ap"]').textContent === '2', { timeout: 90000 }).then(() => true).catch(() => false);
  step('谈话链（真实楼层→生成→结算→AP=2）', talkOk);
  const afterTalk = await page.evaluate(() => {
    const d = window.Mvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data;
    return { 心结: d.girls.linwanqiu.心结, 信任: d.girls.linwanqiu.信任, ap: d.world.ap };
  });
  step('语义写(心结=1)+脚本写(信任↑显著)共存', afterTalk.心结 === 1 && afterTalk.信任 > 13, JSON.stringify(afterTalk));
  const stageSwitch = await page.evaluate(async () => {
    const books = await window.TavernHelper.getCharWorldbookNames('current');
    const name = books.primary || (books.additional && books.additional[0]);
    const book = await window.TavernHelper.getWorldbook(name);
    const on = book.find(e => e.name.includes('林晚秋·试探'));
    const off = book.find(e => e.name.includes('林晚秋·抵触'));
    return { 试探: on && on.enabled, 抵触: off && off.enabled };
  }).catch(e => ({ err: e.message }));
  step('阶段条目切换（抵触→试探）', stageSwitch.试探 === true && stageSwitch.抵触 === false, JSON.stringify(stageSwitch));

  // 9. 纪律训练（江铃）→ 状态语义写 + 数值
  await shell.evaluate(() => document.getElementById('wyxy-app').querySelector('[data-act="drill"]').click());
  await sleep(400);
  await shell.evaluate(() => document.querySelectorAll('[data-bind="picker"] .wy-girls button')[1].click());
  await shell.waitForFunction(() => document.getElementById('wyxy-app').dataset.busy !== '1', { timeout: 90000 });
  const afterDrill = await page.evaluate(() => {
    const d = window.Mvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data;
    return { 修正: d.girls.jiangling.修正值, 信任: d.girls.jiangling.信任, 创伤: d.girls.jiangling.创伤, 状态: d.girls.jiangling.状态, ap: d.world.ap };
  });
  step('纪律训练结算（修正+8/信任-4/创伤+3/状态=低落）', afterDrill.修正 === 28 && afterDrill.创伤 === 3 && afterDrill.状态 === '低落' && afterDrill.ap === 1, JSON.stringify(afterDrill));

  // 10. Swipe 重算一致性：对最新 AI 楼 swipe → 相同前帧重结算
  const swipeOk = await page.evaluate(async () => {
    const before = window.Mvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data.girls.jiangling.修正值;
    document.querySelector('#chat .mes.last_mes .swipe_right, .swipe_right')?.click();
    await new Promise(r => setTimeout(r, 15000));
    const after = window.Mvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data.girls.jiangling.修正值;
    return { before, after };
  }).catch(e => ({ err: e.message }));
  step('Swipe 重生成后重结算（无双计）', swipeOk.after === swipeOk.before, JSON.stringify(swipeOk));

  // 11. presentation mode + 逃生开关
  const pres = await page.evaluate(() => !!document.getElementById('wyxy-presentation-style'));
  step('presentation mode 生效（非0楼折叠）', pres);
  await shell.evaluate(() => { const cb = document.querySelector('[data-act="escape"]'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(800);
  const presOff = await page.evaluate(() => !document.getElementById('wyxy-presentation-style'));
  step('逃生开关恢复原生显示', presOff);
  await shell.evaluate(() => { const cb = document.querySelector('[data-act="escape"]'); cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); });

  // 12. 刷新重建：reload 后仅凭持久数据回到 main
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext().chat && window.SillyTavern.getContext().chat.length > 0, { timeout: 90000 });
  const rebuiltOk = await page.waitForFunction(() => {
    const f = document.querySelector('#chat .mes[mesid="0"] iframe');
    return f && f.contentDocument && f.contentDocument.getElementById('wyxy-app') && f.contentDocument.getElementById('wyxy-app').dataset.view === 'main';
  }, { timeout: 90000 }).then(() => true).catch(() => false);
  step('刷新后 shell 仅凭持久数据重建到主界面', rebuiltOk);
  await page.screenshot({ path: join(OUT, '03-rebuilt.png') });

  report.ok = report.steps.every(s => s.ok);
} catch (e) {
  report.error = String(e && e.message || e);
  console.error('❌ E2E 中断:', report.error);
  try { await page.screenshot({ path: join(OUT, '99-error.png') }); } catch (e2) { /* */ }
} finally {
  // 还原 API 设置
  try {
    if (apiSnapshot) {
      await page.evaluate(snap => {
        const ctx = window.SillyTavern.getContext();
        const s = ctx.chatCompletionSettings;
        s.chat_completion_source = snap.source;
        s.custom_url = snap.url;
        s.custom_model = snap.model;
        ctx.saveSettingsDebounced();
      }, apiSnapshot);
      console.log('✅ API 设置已还原');
    }
  } catch (e) { console.error('⚠ API 还原失败（需手动检查连接面板）', e.message); }
  report.finished = new Date().toISOString();
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
  console.log(`\n结果：${report.steps.filter(s => s.ok).length}/${report.steps.length} 通过${report.ok ? '' : '（存在失败项）'}`);
}
