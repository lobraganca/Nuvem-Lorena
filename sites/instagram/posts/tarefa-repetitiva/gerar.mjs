// Gera as 5 telas do carrossel em PNG (1080 × 1350), na mesma pasta: tela-1.png … tela-5.png.
// Rodar de qualquer lugar: node sites/instagram/posts/tarefa-repetitiva/gerar.mjs
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
const pasta = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 1400 } });
await p.goto('file://' + join(pasta, 'carrossel.html'));
await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready);
const telas = await p.$$('.tela');
for (const [i, t] of telas.entries()) { await t.screenshot({ path: join(pasta, `tela-${i + 1}.png`) }); console.log(`tela-${i + 1}.png`); }
await b.close();
