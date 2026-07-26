// 构建：src → dist（契约 §5：dist 永不手改）
// dist/bridge.js  = schema + settle-core + stages + bridge/index 拼接（去 import/export 的单文件酒馆助手脚本）
// dist/shell.html = shell 单文件应用（打包期作为 mount 展开正则的替换体嵌入卡）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

// 仅处理本仓库源文件的窄规则拼接器（非通用 bundler）
const strip = src => src
  .split('\n')
  .filter(line => !/^\s*import\s/.test(line))
  .map(line => line
    .replace(/^export\s+\{[^}]*\}.*$/, '')
    .replace(/^export\s+const\s/, 'const ')
    .replace(/^export\s+function\s/, 'function '))
  .join('\n');

mkdirSync(join(root, 'dist'), { recursive: true });

// ---- bridge ----
const bridge = [
  '// 网瘾学园 bridge（生成物，勿手改；源：src/）',
  strip(read('src/mvu/schema.js')),
  strip(read('src/bridge/settle-core.js')),
  strip(read('src/lorebook/stages.js')),
  strip(read('src/bridge/index.js')),
].join('\n');
writeFileSync(join(root, 'dist/bridge.js'), bridge);

// ---- shell ----
const shell = read('src/shell/shell.html');
writeFileSync(join(root, 'dist/shell.html'), shell);

// ---- 验证：bridge 整体与 shell 内联脚本语法检查 ----
writeFileSync(join(root, 'dist/.shell-script-check.js'), (shell.match(/<script>([\s\S]*?)<\/script>/) || ['', ''])[1]);
try {
  execFileSync(process.execPath, ['--check', join(root, 'dist/bridge.js')], { stdio: 'inherit' });
  execFileSync(process.execPath, ['--check', join(root, 'dist/.shell-script-check.js')], { stdio: 'inherit' });
  console.log('✅ build ok: dist/bridge.js (' + bridge.length + ' chars), dist/shell.html (' + shell.length + ' chars)');
} catch (e) {
  console.error('❌ 语法检查失败');
  process.exit(1);
}
