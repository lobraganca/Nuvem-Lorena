// Transforma cada arquivo de fontes/ em PNG nesta pasta: SVG no tamanho dos seus
// width/height; HTML no tamanho do <meta name="tamanho">. Usa o Chromium do container
// (o mesmo do playwright) e espera as fontes do Google carregarem antes da foto.
//   cd /home/user/Nuvem-Lorena/sites/marca && node gerar.mjs
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(join(execSync("npm root -g").toString().trim(), "playwright", "index.mjs"));
const aqui = dirname(fileURLToPath(import.meta.url));
const fontes = join(aqui, "fontes");
const navegador = await chromium.launch();
for (const arquivo of readdirSync(fontes).filter((f) => /\.(svg|html)$/.test(f)).sort()) {
  const texto = readFileSync(join(fontes, arquivo), "utf8");
  const [l, a] = arquivo.endsWith(".svg")
    ? [Number(texto.match(/width="(\d+)"/)[1]), Number(texto.match(/height="(\d+)"/)[1])]
    : texto.match(/name="tamanho" content="(\d+)x(\d+)"/).slice(1).map(Number);
  const pagina = await navegador.newPage({ viewport: { width: l, height: a } });
  if (arquivo.endsWith(".svg")) await pagina.setContent(`<html><body style="margin:0">${texto}</body></html>`);
  else await pagina.goto("file://" + join(fontes, arquivo));
  await pagina.waitForLoadState("networkidle");
  await pagina.evaluate(() => document.fonts.ready);
  const saida = join(aqui, arquivo.replace(/\.(svg|html)$/, ".png"));
  await pagina.screenshot({ path: saida, clip: { x: 0, y: 0, width: l, height: a } });
  console.log(arquivo, "->", saida.split("/").pop(), `${l}x${a}`);
  await pagina.close();
}
await navegador.close();
