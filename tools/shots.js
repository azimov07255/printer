/* Yoʻriqnoma uchun ilova skrinshotlarini yasaydi (shots/s1..s3.png).
   Ishlatish: NODE_PATH=$(npm root -g) node tools/shots.js
   Keyin PNG ni WebP ga aylantiring: python3 tools/to_webp.py */
const { chromium } = require('playwright');
const path = require('path');
const root = path.resolve(__dirname, '..');

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const pg = await ctx.newPage();
  async function jump(sel, offset) {
    await pg.evaluate(([s, o]) => {
      const y = document.querySelector(s).getBoundingClientRect().top + window.scrollY - o;
      window.scrollTo({ top: y, behavior: 'instant' });
    }, [sel, offset]);
    await pg.mouse.move(0, 0);
    await pg.waitForTimeout(350);
  }
  await pg.goto('file://' + root + '/index.html');
  await pg.waitForTimeout(300);
  // 1: fayl tanlash
  await jump('#stepFile', 12);
  await pg.screenshot({ path: root + '/shots/s1.png' });
  // 2: namuna yuklanadi, usul tanlanadi
  await pg.click('#sampleBtn');
  await pg.waitForSelector('#settings:not(.hidden)', { timeout: 30000 });
  await pg.waitForTimeout(500);
  await pg.click('.mode[data-key="cards8"]');
  await jump('#modeGrid', 100);
  await pg.screenshot({ path: root + '/shots/s2.png' });
  // 3: tayyor fayllar
  await jump('#outputs', 100);
  await pg.screenshot({ path: root + '/shots/s3.png' });
  await br.close();
})();
