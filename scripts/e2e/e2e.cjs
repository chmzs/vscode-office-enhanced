const { createRequire } = require('module');
const require2 = createRequire('d:/Program Files/nodejs/node_global/node_modules/@playwright/cli/package.json');
const { chromium } = require2('playwright-core');

const EXEC = process.env.E2E_EDGE || 'c:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const HINT_PROBE = `(() => {
  const hs = [...document.querySelectorAll('.vditor-hint')].filter(x => !x.closest('.vditor-toolbar'));
  const h = hs[0];
  return h ? { display: getComputedStyle(h).display, buttons: h.querySelectorAll('button').length, sample: (h.textContent || '').slice(0, 100) } : null;
})()`;

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push('[console:' + m.type() + '] ' + m.text()));
  page.on('requestfailed', r => logs.push('[404?] ' + r.url()));
  page.on('pageerror', e => {
    const st = String(e.stack || '').split(String.fromCharCode(10)).slice(1, 3).join(' | ');
    logs.push('[pageerror] ' + e.message + ' @ ' + st);
  });
  await page.goto('http://127.0.0.1:8765/scripts/e2e/e2e.html');

  await page.evaluate(() => window.__openDoc(
    '---\ntitle: 测试笔记\naliases: [别名一, A1]\ntags: [气候]\n---\n\n行内公式 $E=mc^2$ 测试 [[别名一]] 结束\n\n普通段落'
  ));
  const ok = await page.evaluate(() => window.__waitEditor());
  console.log('editor rendered:', ok);
  await page.waitForTimeout(1200);

  // ---- Probe 1: YAML 折叠与点击展开 ----
  const yaml1 = await page.evaluate(() => {
    const blk = document.querySelector('div[data-type="yaml-front-matter"]');
    if (!blk) return { found: false };
    const pre = blk.querySelector(':scope > pre');
    return {
      found: true, cls: blk.className,
      preDisplay: pre ? getComputedStyle(pre).display : 'no-pre',
      badge: getComputedStyle(blk, '::before').content
    };
  });
  console.log('YAML collapsed:', JSON.stringify(yaml1));

  await page.evaluate(() => {
    const blk = document.querySelector('div[data-type="yaml-front-matter"]');
    if (!blk) return;
    const r = blk.getBoundingClientRect();
    blk.__cx = r.x + r.width / 2; blk.__cy = r.y + r.height / 2;
  });
  const box = await page.evaluate(() => {
    const blk = document.querySelector('div[data-type="yaml-front-matter"]');
    return blk ? { x: blk.__cx, y: blk.__cy } : null;
  });
  if (box) await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(300);
  const yaml2 = await page.evaluate(() => {
    const blk = document.querySelector('div[data-type="yaml-front-matter"]');
    const pre = blk && blk.querySelector(':scope > pre');
    return { active: !!(blk && blk.classList.contains('yaml-collapse--active')), preDisplay: pre ? getComputedStyle(pre).display : null };
  });
  console.log('YAML after real click:', JSON.stringify(yaml2));

  // ---- Probe 2: [[ hint ----
  await page.evaluate(() => {
    const ps = document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p');
    const last = ps[ps.length - 1];
    const r = document.createRange();
    r.selectNodeContents(last);
    r.collapse(false);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  });
  await page.keyboard.type('引用 [[');
  await page.waitForTimeout(500);
  console.log('HINT after [[ :', JSON.stringify(await page.evaluate(HINT_PROBE)));
  await page.keyboard.type('全新');
  await page.waitForTimeout(500);
  console.log('HINT after [[全新 :', JSON.stringify(await page.evaluate(HINT_PROBE)));

  // Enter 选中第一项
  const before = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')];
    return ps[ps.length - 1].textContent;
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')];
    return ps[ps.length - 1].textContent;
  });
  console.log('ENTER result before:', JSON.stringify(before), ' after:', JSON.stringify(after));

  // ---- Probe 3: inline math edit ----
  const mathInfo = await page.evaluate(() => {
    const el = document.querySelector('.vditor-wysiwyg [data-type="math-inline"]');
    if (!el) return { found: false };
    const code = el.querySelector('code');
    const prev = el.querySelector('.vditor-wysiwyg__preview');
    return {
      found: true, cls: el.className,
      codeDisplay: code ? getComputedStyle(code).display : null,
      codeInlineStyle: code ? code.style.display : null,
      hasPreview: !!prev
    };
  });
  console.log('MATH initial:', JSON.stringify(mathInfo));

  const mbox = await page.evaluate(() => {
    const prev = document.querySelector('.vditor-wysiwyg [data-type="math-inline"] .vditor-wysiwyg__preview');
    const el = prev || document.querySelector('.vditor-wysiwyg [data-type="math-inline"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (mbox) await page.mouse.click(mbox.x, mbox.y);
  await page.waitForTimeout(400);
  const math2 = await page.evaluate(() => {
    const el = document.querySelector('.vditor-wysiwyg [data-type="math-inline"]');
    const code = el && el.querySelector('code');
    return {
      codeDisplay: code ? getComputedStyle(code).display : null,
      codeInlineStyle: code ? code.style.display : null,
      cls: el ? el.className : null
    };
  });
  console.log('MATH after real click:', JSON.stringify(math2));
  // 连续输入 'yz'，验证编辑态不被重渲染打断
  await page.keyboard.type('yz');
  await page.waitForTimeout(400);
  const math3 = await page.evaluate(() => {
    const el = document.querySelector('.vditor-wysiwyg [data-type="math-inline"]');
    const code = el && el.querySelector('code');
    return { codeText: code ? code.textContent : null, codeDisplay: code ? getComputedStyle(code).display : null };
  });
  console.log('MATH after typing yz:', JSON.stringify(math3));
  // 点击段落其它位置 → 应收起
  await page.evaluate(() => {
    const ps = document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p');
    const last = ps[ps.length - 1];
    const r = document.createRange();
    r.selectNodeContents(last);
    r.collapse(false);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    s.dispatchEvent && document.dispatchEvent(new Event('selectionchange'));
  });
  await page.waitForTimeout(300);
  const math4 = await page.evaluate(() => {
    const code = document.querySelector('.vditor-wysiwyg [data-type="math-inline"] code');
    return code ? getComputedStyle(code).display : null;
  });
  console.log('MATH collapsed after leaving:', math4);

  // ---- Probe 4: 空双链 [[]] 清理 ----
  const empty = await page.evaluate(() => !!document.querySelector('[data-href=""][data-type="wikilink"], [data-href=""][data-type="wikilink-embed"]'));
  console.log('EMPTY wikilink node remains:', empty);

  // ---- Probe 5: 保存回调拿到的 markdown 是否完好 ----
  const saved = await page.evaluate(() => {
    try { return window.__lastSaved || null; } catch { return null; }
  });
  console.log('saved md:', JSON.stringify(saved));

  console.log('---- browser logs ----');
  logs.slice(0, 40).forEach(l => console.log(l));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
