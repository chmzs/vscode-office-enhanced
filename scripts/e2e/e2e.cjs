const { createRequire } = require('module');
const require2 = createRequire('d:/Program Files/nodejs/node_global/node_modules/@playwright/cli/package.json');
const { chromium } = require2('playwright-core');
const EXEC = process.env.E2E_EDGE || 'c:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const DOC = `---
title: 花粉数据集
aliases: [PollenDB]
tags: [花粉]
---

数値1~10%很多和2~10% 与 ~~双波浪~~ 混排

行内公式 $E=mc^2$ 测试与空链 [[]] 清理

| 方法 | 数据集 | 精度 |
| --- | --- | --- |
| 温度序列 | [[全新世温度]] | 0.3℃ |
| 引用 | [[花粉数据集\\|PollenDB]] | 2.1℃ |

普通段落末尾`;

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

  // ===== P1: YAML 源码常显（折叠机制已移除） =====
  console.log('P1 raw-source:', JSON.stringify(await page.evaluate(() => {
    const blk = document.querySelector('div[data-type="yaml-front-matter"]');
    const pre = blk && blk.querySelector(':scope > pre');
    const panel = blk && blk.querySelector(':scope > .vditor-properties');
    const code = blk && blk.querySelector('pre code');
    return {
      preDisplay: pre ? getComputedStyle(pre).display : null,
      panelDisplay: panel ? getComputedStyle(panel).display : 'no-panel',
      src: code ? (code.textContent || '').slice(0, 14) : null,
      fenceBefore: pre ? getComputedStyle(pre, '::before').content : null
    };
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

  await page.evaluate(c => window.__openDoc(c), DOC);
  await page.evaluate(() => window.__waitEditor());
  await page.waitForTimeout(900);
  // ===== P4: [[page# 章节（mock headings） + [[page| 别名 =====
  await clickPEnd();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.keyboard.type('[[全新世温度#');
  await page.waitForTimeout(800);
  console.log('P4 #mode hint:', JSON.stringify(await page.evaluate(HINT)));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  console.log('P4 #mode inserted:', await page.evaluate(`(() => { const ps=[...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')]; return ps[ps.length-1].textContent.includes('#Methods'); })()`));

  await clickPEnd();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
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
  console.log('P6 empty-as-text:', JSON.stringify(await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-type="wikilink"][data-href=""]')];
    const anyVisible = nodes.map(n => {
      const mk = n.querySelectorAll(':scope > .vditor-ir__marker');
      return mk.length ? getComputedStyle(mk[0]).display : 'no-marker';
    });
    return { emptyNodeCount: nodes.length, markersShown: anyVisible,
      ownPara: [...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')].filter(p => p.textContent.includes('清理')).map(p => ({ soup: p.textContent.indexOf('[[[') >= 0, hasLiteral: p.textContent.includes('[[]]') })) };
  })));

  // ===== P7: Obsidian 工具栏按钮 =====
  console.log('P7 obsidian btn:', await page.evaluate(() => [...document.querySelectorAll('.vditor-toolbar button')].some(b => (b.getAttribute('aria-label') || b.title || '').includes('Obsidian'))));


  // ===== P7b: 同段编辑后首次点击公式应即开源码（节点级守卫快速通道回归） =====
  const mp = await page.evaluate(() => {
    const el = document.querySelector('.vditor-wysiwyg [data-type="math-inline"]');
    const p = el.closest('p') || el;
    const r = p.getBoundingClientRect();
    return { x: r.x + 14, y: r.y + Math.min(r.height / 2, 10) };
  });
  await page.mouse.click(mp.x, mp.y);
  await page.keyboard.type('字');
  await page.waitForTimeout(450);
  const mc = await page.evaluate(() => {
    const el = document.querySelector('.vditor-wysiwyg [data-type="math-inline"] .vditor-wysiwyg__preview') || document.querySelector('.vditor-wysiwyg [data-type="math-inline"]');
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(mc.x, mc.y);
  await page.waitForTimeout(350);
  console.log('P7b first-click-open:', await page.evaluate(() => {
    const code = document.querySelector('.vditor-wysiwyg [data-type="math-inline"] code');
    return code ? getComputedStyle(code).display : 'no-code';
  }));

  await page.evaluate(c => window.__openDoc(c), DOC);
  await page.evaluate(() => window.__waitEditor());
  await page.waitForTimeout(900);
  // ===== P8: 尾部 Backspace 删除 [[x]] —— 无括号汤、光标不离编辑器 =====
  await clickPEnd();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
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
  // ===== P10: 直接编辑常显 YAML 源码 → 持久不弹回、文件同步、失焦后不变 =====
  const cpos = await page.evaluate(() => {
    const blk = document.querySelector('div[data-type="yaml-front-matter"]');
    const code = blk && blk.querySelector('pre code');
    if (!code) return null;
    const r = code.getBoundingClientRect();
    return { x: r.x + 10, y: r.y + Math.min(8, r.height / 2) };
  });
  let editPersists = false;
  if (cpos) {
    await page.mouse.click(cpos.x, cpos.y);
    await page.waitForTimeout(200);
    await page.keyboard.press('End');
    await page.waitForTimeout(150);
    await page.keyboard.type('\nseries: probe');
    await page.waitForTimeout(600);
    editPersists = await page.evaluate(() => {
      const blk = document.querySelector('div[data-type="yaml-front-matter"]');
      const pre = blk && blk.querySelector(':scope > pre');
      const code = pre && pre.querySelector('code');
      return !!(code && (code.textContent || '').includes('series')) && !!pre && getComputedStyle(pre).display !== 'none';
    });
  }
  console.log('P10 direct-edit persists:', editPersists);
  const farpos = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')];
    const r = ps[ps.length - 1].getBoundingClientRect();
    return { x: r.x + 8, y: r.y + 8 };
  });
  await page.mouse.click(farpos.x, farpos.y);
  await page.waitForTimeout(600);
  console.log('P10 stays-source-after-blur:', await page.evaluate(() => {
    const blk = document.querySelector('div[data-type="yaml-front-matter"]');
    const pre = blk && blk.querySelector(':scope > pre');
    const code = pre && pre.querySelector('code');
    return !!(pre && getComputedStyle(pre).display !== 'none' && code && (code.textContent || '').includes('series'));
  }));
  const savedY = await page.evaluate(() => String(window.__lastSaved || ''));
  console.log('P10 saved has new key:', savedY.includes('series'));

  // ===== P11: 表格单元格内双链逐字退格 —— 表格结构不塌 =====
  await page.evaluate(c => window.__openDoc(c), DOC);
  await page.evaluate(() => window.__waitEditor());
  await page.waitForTimeout(900);
  const tr0 = await page.evaluate(`(() => { const t = document.querySelector('.vditor-wysiwyg table'); return t ? t.querySelectorAll('tr').length : 0; })()`);
  const cell = await page.evaluate(() => {
    const n = document.querySelector('.vditor-wysiwyg table [data-type="wikilink"]');
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  console.log('P11 atom-in-cell:', !!cell);
  if (cell) {
    await page.mouse.click(cell.x, cell.y);
    await page.waitForTimeout(200);
    await page.keyboard.press('End');
    await page.waitForTimeout(150);
    for (let k = 0; k < 7; k++) { await page.keyboard.press('Backspace'); await page.waitForTimeout(110); }
  }
  const p11r = await page.evaluate(`(() => {
    const t = document.querySelector('.vditor-wysiwyg table');
    const rows = t ? [...t.querySelectorAll('tr')] : [];
    const texts = rows.map(r => r.textContent);
    return { tr: rows.length, cellText: texts.length > 1 ? texts[1] : null };
  })()`);
  console.log('P11 table:', JSON.stringify(p11r), ' tr-stable:', p11r.tr === tr0, ' cell-cleared:', !!(p11r.cellText && p11r.cellText.indexOf('全新世温度') < 0), ' raw:', JSON.stringify(p11r.cellText));

  // ===== P12/P13: 复制序列化 + 表格内转义双链不误判断链 =====
  await page.evaluate(c => window.__openDoc(c), DOC);
  await page.evaluate(() => window.__waitEditor());
  await page.waitForTimeout(900);
  console.log('P12 atoms:', await page.evaluate(`(() => {
    const ns = [...document.querySelectorAll('.vditor-wysiwyg [data-type="wikilink"]')];
    return JSON.stringify(ns.map(x => ({ href: x.getAttribute('data-href'), kids: [...x.children].map(k => k.className.split('__')[1] || k.className) })));
  })()`));
  const clip = await page.evaluate(() => {
    const n = [...document.querySelectorAll('.vditor-wysiwyg [data-type="wikilink"]')].find(x => (x.getAttribute('data-href') || '').indexOf('花粉数据集') === 0);
    if (!n) return 'NO-ALIAS-ATOM';
    const r = document.createRange(); r.selectNode(n);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    const dt = new DataTransfer();
    const ev = new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true });
    n.dispatchEvent(ev);
    return dt.getData('text/plain');
  });
  console.log('P12 clipboard:', JSON.stringify(clip));
  const p13 = await page.evaluate(() => {
    const n = [...document.querySelectorAll('.vditor-wysiwyg [data-type="wikilink"]')].find(x => (x.getAttribute('data-href') || '').indexOf('花粉数据集') === 0);
    if (!n) return null;
    return { unresolved: n.classList.contains('vditor-wikilink--unresolved'), href: n.getAttribute('data-href') };
  });
  console.log('P13 escaped-link:', JSON.stringify(p13), ' not-broken:', !!(p13 && !p13.unresolved));

  // ===== P9: 节点尾部逐字退格 —— 不跳段、不产生残缺双链 =====
  await clickPEnd();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.type('[[');
  await page.waitForTimeout(600);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  console.log('P9-ATOM:', await page.evaluate(`(() => { const n=[...document.querySelectorAll('.vditor-wysiwyg [data-type=\"wikilink\"]')].pop(); if(!n) return 'NO-ATOM'; const kids=[...n.children].map(x=>x.className+'::'+JSON.stringify(x.textContent)); return JSON.stringify({outer:n.outerHTML.slice(0,200), kids}); })()`));
  let jump9 = false, soup9 = false;
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(110);
    const st = await page.evaluate(`(() => {
      const ps=[...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')];
      const last=ps[ps.length-1];
      const sel=getSelection();
      const el=sel.anchorNode&&(sel.anchorNode.nodeType===1?sel.anchorNode:sel.anchorNode.parentElement);
      return { soup: last ? last.textContent.indexOf('[[[')>=0 : false, inLast: !!(el&&last&&(el===last||last.contains(el))) };
    })()`);
    console.log('P9 step' + i + ':', await page.evaluate(`(() => { const sel=getSelection(); const c=sel.anchorNode; const el=c&&c.nodeType===1?c:c&&c.parentElement; const n=el&&el.closest?el.closest('[data-type=\"wikilink\"]'):null; const kids=n?[...n.children].map(x=>x.className+'::'+JSON.stringify(x.textContent)):null; return JSON.stringify({caretIn: el? (el.className||el.tagName):null, atom: kids, doc: [...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')].pop().textContent.slice(0,40)}); })()`));
    if (st.soup) soup9 = true;
    if (!st.inLast) jump9 = true;
  }
  const txt9 = await page.evaluate(`(() => { const ps=[...document.querySelectorAll('.vditor-wysiwyg .vditor-reset > p')]; return ps[ps.length-1].textContent; })()`);
  console.log('P9 char-backspace: no-jump:', !jump9, ' no-soup:', !soup9, ' final:', JSON.stringify(txt9));


  console.log('---- logs ----');
  logs.slice(0, 30).forEach(l => console.log(l));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
