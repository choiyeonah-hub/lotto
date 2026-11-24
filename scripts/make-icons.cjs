// public/icons/icon.svg → 192/512 PNG (PWA 설치 아이콘)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const svg = fs.readFileSync('public/icons/icon.svg', 'utf8');
  const b = await chromium.launch();
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}`);
    await p.screenshot({ path: `public/icons/icon-${s}.png`, omitBackground: true });
  }
  await b.close();
})();
