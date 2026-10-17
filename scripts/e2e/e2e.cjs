const { createRequire } = require('module');
const require2 = createRequire('d:/Program Files/nodejs/node_global/node_modules/@playwright/cli/package.json');
const { chromium } = require2('playwright-core');
const EXEC = process.env.E2E_EDGE || 'c:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const DOC = '---\ntitle: 花粉数据集\naliases: [PollenDB, 花粉库]\ntags: [花粉, 数据集]\n---\n\n数値1~10%很多很多和2~10% 与 ~~双波浪删除线~~ 混排\n\n行内公式 $E=mc^2$ 测试与空链 [[]] 清理\n\n普通段落末尾';

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 900 });
  const logs = [];
  page.on('console', m => logs.push('[console:' + m.type() + '] ' + m.text().slice(0, 160)));
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message.slice(0, 160)));
  await page.goto('http://127.0.0.1:8765/scripts/e2e/e2e.html');
  await page.evaluate(c => window.__openDoc(c), DOC);
  const ok = await page.evaluate(() => window.__waitEditor());
  console.log('editor rendered:', ok);
  await page.waitForTimeout(1500);

  // ===== P1: YAML 属性面板 =====
  const p1 = await page.evaluate(() => {
    const blk = document.querySelector('div[data-type="yaml-front-matter"]');
    const pre = blk && blk.querySelector(':scope > pre');
    const panel = blk && blk.querySelector(':scope > .vditor-properties');
    return {
      panel: !!panel,
      keys: panel ? [...panel.querySelectorAll('.vditor-properties__key-label')].map(k => k.textContent) : [],
      preDisplay: pre ? getComputedStyle(pre).display : null
    };
  });
  console.log('P1 yaml panel:', JSON.stringify(p1));
  const kx = await page.evaluate(() => {
    const k = document.querySelector('.vditor-properties__key-label');
    if (!k) return null;
    const r = k.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (kx) await page.mouse.click(kx.x, kx.y);
  await page.waitForTimeout(250);
  console.log('P1 expanded:', JSON.stringify(await page.evaluate(() => {
    const blk = document.querySelector('div[data-type="yaml-front-matter"]');
    const pre = blk && blk.querySelector(':scope > pre');
    return { active: !!(blk && blk.classList.contains('yaml-collapse--active')), preDisplay: pre ? getComputedStyle(pre).display : null };
  })));

  // ===== P2: 单波浪修正 =====
  console.log('P2 strike:', JSON.stringify(await page.evaluate(() => {
    const single = document.querySelector('.vditor-wysiwyg s[data-marker="~"]');
    const double = document.querySelector('.vditor-wysiwyg s[data-marker="~~"]');
    return {
      single: !!single,
      singleDeco: single ? getComputedStyle(single).textDecorationLine : null,
      singleBefore: single ? getComputedStyle(single, '::before').content : null,
      doubleDeco: double ? getComputedStyle(double).textDecorationLine : null
    };
  })));

  // ===== P3: [[ 补全 + Tab 确认（真实点击保证焦点） =====
  const clickPEnd = async () => {
    const pos = await page.evaluate(() => {
      const ps = [...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')];
      const p = ps[ps.length - 1];
      const r = p.getBoundingClientRect();
      return { x: Math.max(r.x + 4, r.right - 4), y: r.y + Math.min(r.height / 2, 10) };
    });
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(120);
  };
  const HINT = `(() => {
    const hs = [...document.querySelectorAll('.vditor-hint')].filter(x => !x.closest('.vditor-toolbar'));
    const h = hs[hs.length - 1];
    return h ? { display: getComputedStyle(h).display, buttons: h.querySelectorAll('button').length, sample: (h.textContent || '').replace(/\\s+/g, ' ').slice(0, 80) } : null;
  })()`;
  const countWL = () => page.evaluate(`[...document.querySelectorAll('.vditor-wysiwyg [data-type="wikilink"]')].length`);

  await clickPEnd();
  const c0 = await countWL();
  await page.keyboard.type('[[');
  await page.waitForTimeout(600);
  console.log('P3 plain hint:', JSON.stringify(await page.evaluate(HINT)));
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  const c1 = await countWL();
  console.log('P3 tab accept:', c1 > c0, c0, '->', c1);

  // ===== P4: [[page# 章节（mock headings） + [[page| 别名 =====
  await clickPEnd();
  await page.keyboard.type('[[全新世温度#');
  await page.waitForTimeout(800);
  console.log('P4 #mode hint:', JSON.stringify(await page.evaluate(HINT)));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  console.log('P4 #mode inserted:', await page.evaluate(`(() => { const ps=[...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')]; return ps[ps.length-1].textContent.includes('#Methods'); })()`));

  await clickPEnd();
  await page.keyboard.type('[[花粉数据集|Poll');
  await page.waitForTimeout(800);
  console.log('P4 |mode hint:', JSON.stringify(await page.evaluate(HINT)));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  console.log('P4 |mode inserted:', await page.evaluate(`(() => { const ps=[...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')]; return ps[ps.length-1].textContent.includes('PollenDB'); })()`));

  // ===== P5: 行内公式编辑 =====
  const mbox = await page.evaluate(() => {
    const prev = document.querySelector('.vditor-wysiwyg [data-type="math-inline"] .vditor-wysiwyg__preview');
    const el = prev || document.querySelector('.vditor-wysiwyg [data-type="math-inline"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (mbox) await page.mouse.click(mbox.x, mbox.y);
  await page.waitForTimeout(300);
  const m1 = await page.evaluate(() => {
    const code = document.querySelector('.vditor-wysiwyg [data-type="math-inline"] code');
    return code ? getComputedStyle(code).display : null;
  });
  await page.keyboard.type('yz');
  await page.waitForTimeout(400);
  const m2 = await page.evaluate(() => {
    const el = document.querySelector('.vditor-wysiwyg [data-type="math-inline"]');
    const code = el && el.querySelector('code');
    return { display: code ? getComputedStyle(code).display : null, text: code ? code.textContent : null };
  });
  console.log('P5 math click-display:', m1, 'after-type:', JSON.stringify(m2));

  // ===== P6: [[]] 空链清理（光标不在其中时应被清理） =====
  console.log('P6 empty cleaned:', JSON.stringify(await page.evaluate(() => ({
    emptyNodes: document.querySelectorAll('[data-type="wikilink"][data-href=""]').length,
    textKept: [...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')].some(p => p.textContent.includes('[[]]'))
  }))));

  // ===== P7: Obsidian 工具栏按钮 =====
  console.log('P7 obsidian btn:', await page.evaluate(() => [...document.querySelectorAll('.vditor-toolbar button')].some(b => (b.getAttribute('aria-label') || b.title || '').includes('Obsidian'))));


  // ===== P8: 尾部 Backspace 删除 [[x]] —— 无括号汤、光标不离编辑器 =====
  await clickPEnd();
  await page.keyboard.type('[[');
  await page.waitForTimeout(600);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(600);
  await clickPEnd();
  let sawSoup = false, caretLost = false;
  const SOUP_CHECK = "(() => { const t=[...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')].map(p=>p.textContent).join(' '); const sel=getSelection(); const el=sel.anchorNode&&(sel.anchorNode.nodeType===1?sel.anchorNode:sel.anchorNode.parentElement); return { soup: t.indexOf('[[[')>=0, inEditor: !!(el&&el.closest&&el.closest('.vditor-wysiwyg')) }; })()";
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(80);
    const r = await page.evaluate(SOUP_CHECK);
    if (r.soup) sawSoup = true;
    if (!r.inEditor) caretLost = true;
  }
  console.log('P8 backspace: caret-in-editor:', !caretLost);
  await page.waitForTimeout(600);
  const saved = await page.evaluate(() => String(window.__lastSaved || ''));
  console.log('P8 SAVED-MD soup-free:', saved.indexOf('[[[') < 0);
  console.log('P8 SAVED-MD tail:', JSON.stringify(saved.slice(-70)));

  console.log('---- logs ----');
  logs.slice(0, 30).forEach(l => console.log(l));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
