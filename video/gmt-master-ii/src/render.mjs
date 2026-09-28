import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const [,, start, end, step, outDir] = process.argv;
const FPS = +process.env.FPS || 30;
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', m => console.log('console:', m.text()));
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto('file://' + process.cwd() + '/rolex.html');
await page.evaluate(() => window.ready);
const t0 = Date.now();
for (let f = +start; f < +end; f += +step) {
  const url = await page.evaluate(t => window.frame(t), f / FPS);
  fs.writeFileSync(`${outDir}/f${String(f).padStart(4, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
}
console.log('done', start, end, (Date.now() - t0) / 1000 + 's');
await browser.close();
