// Transforma cada capas/*.svg em PNG de 1080x1920, que é o que o celular
// consegue escolher na galeria. Usa o Chromium do container (o mesmo do
// playwright), porque o Python daqui não sabe desenhar SVG.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizGlobal = execSync('npm root -g').toString().trim();
const { chromium } = await import(join(raizGlobal, 'playwright', 'index.mjs'));
const pasta = join(dirname(fileURLToPath(import.meta.url)), 'capas');

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
for (const arquivo of readdirSync(pasta).filter(f => f.endsWith('.svg')).sort()) {
  const svg = readFileSync(join(pasta, arquivo), 'utf8');
  await pagina.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await pagina.screenshot({ path: join(pasta, arquivo.replace('.svg', '.png')), clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  console.log(arquivo.replace('.svg', '.png'));
}
await navegador.close();
