import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', colorScheme: 'light', deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
// The service worker can answer navigations from cache; unregister it so each
// route is a genuine load.
await p.goto('http://localhost:4200/');
await p.evaluate(async () => {
  const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
  for (const r of regs) await r.unregister();
});
await p.evaluate(() => {
  const k = 'avena-data-v18';
  const d = JSON.parse(localStorage.getItem(k) || '{}');
  d.user = { ...(d.user || {}), accountType: 'viajante' };
  localStorage.setItem(k, JSON.stringify(d));
});
await p.reload(); await p.waitForTimeout(1200);
await p.getByRole('button', { name: /essenciais/i }).first().click().catch(()=>{});
await p.waitForTimeout(500);

const shots = [
  ['web-1-inicio', '/', false],
  ['web-2-buscar', '/destination', true],
  ['web-3-empresa', '/business/b1', true],
  ['web-4-pessoas', '/feed', false],
  ['web-5-perfil', '/profile', true],
  ['web-6-baixar-app', '/app', false],
];
for (const [name, route, full] of shots) {
  await p.goto('http://localhost:4200' + route);
  await p.waitForTimeout(1200);
  const h1 = await p.locator('h1').first().innerText().catch(() => '(sem h1)');
  await p.screenshot({ path: `${name}.png`, fullPage: full });
  console.log(name.padEnd(18), p.url().replace('http://localhost:4200',''), '->', h1.replace(/\n/g,' '));
}
console.log('erros:', errs);
await ctx.close(); await b.close();
