// 本地假 LLM（OpenAI 兼容 /v1/chat/completions）—— E2E 全链路测试用，不消耗真实配额
// 响应按回合脚本化：开局叙事 / 行动叙事+结算标签 / 语义更新（心结推进）测试条目切换
import { createServer } from 'node:http';

const PORT = 5199;
let turn = 0;

function scriptedReply(lastUser) {
  turn++;
  const t = String(lastUser || '');
  if (t.includes('【开局设定】')) {
    return `清晨的青禾修正学园安静得像一张还没写字的表格。你在办公室里翻完五份档案，走廊尽头传来早训的口令声。窗外，林晚秋站在队列末尾，风把她的刘海吹开了一瞬，她立刻低头躲了回去。\n<结算 效果="一般"/>`;
  }
  if (t.includes('谈话室')) {
    return `谈话室里，她在你对面坐下，手指在膝盖上敲着无形的键盘。你没有拿记录本，这让她愣了一下。沉默持续了很久，久到你以为今天就这样了——她忽然用几乎听不见的声音说：「……你们这里，能写字吗。」\n<结算 效果="显著"/>\n<UpdateVariable>\n_.set('girls.linwanqiu.心结', 0, 1); //她主动开口提出了请求\n</UpdateVariable>`;
  }
  if (t.includes('纪律训练')) {
    return `操场上，教官的哨声一遍遍响。江铃把每个动作都做得比标准更狠，像是在跟谁赌气。收操时她路过你身边，压着声音："满意了？报表上又能加几分了。"\n<结算 效果="一般"/>\n<UpdateVariable>\n_.set('girls.jiangling.状态', '抵触', '低落'); //高压之后的消沉\n</UpdateVariable>`;
  }
  if (t.includes('熄灯就寝')) {
    return `熄灯铃响过，走廊的灯一盏盏灭下去。你在值班日志上签下名字。宿舍里，有人已经睡了，有人在黑暗里睁着眼睛。明天还有明天的报表。\n<结算 效果="一般"/>`;
  }
  return `日子在修正学园按部就班地过。她们各自守着各自的沉默，你守着你的钥匙串。\n<结算 效果="一般"/>`;
}

createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.includes('/chat/completions')) {
    if (req.url.includes('/models')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: [{ id: 'fake-e2e', object: 'model' }] }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }
  let body = '';
  req.on('data', d => { body += d; });
  req.on('end', () => {
    let payload = {};
    try { payload = JSON.parse(body); } catch (e) { /* 忽略 */ }
    const msgs = payload.messages || [];
    const lastUser = [...msgs].reverse().find(m => m.role === 'user');
    const content = scriptedReply(lastUser && (typeof lastUser.content === 'string' ? lastUser.content : JSON.stringify(lastUser.content)));
    console.log(`[fake-llm] turn=${turn} stream=${!!payload.stream} reply=${content.slice(0, 30)}...`);
    if (payload.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const id = 'chatcmpl-fake' + turn;
      for (const piece of content.match(/[\s\S]{1,60}/g) || []) {
        res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: piece } }] })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'chatcmpl-fake' + turn, object: 'chat.completion', model: 'fake-e2e',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }));
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`[fake-llm] listening on http://127.0.0.1:${PORT}/v1`));
