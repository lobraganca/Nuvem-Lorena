// Exercita o Mapa Digital de verdade no navegador: navegar, digitar, sair,
// voltar e conferir que o texto continua lá.
//
// Como rodar, da raiz do repositório (é lá que o playwright é instalado):
//
//   cd apps/mapa-digital && npm run build
//   npx vite preview --port 4173 --strictPort &
//   cd ../.. && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright --no-save
//   node apps/mapa-digital/testes/navegador.mjs
//
// Existe porque dois defeitos desta tela não apareciam em tipo nem em build:
// o "salvo" que acendia sozinho em todos os campos, e o menu fechado que
// continuava navegável pelo teclado.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4173";
const FOTOS = process.env.FOTOS ?? "/tmp";
const FRASE = "\"conserto de geladeira em itabirito\" — anotado da busca";

const erros = [];
function conferir(certo, oque) {
  console.log(`${certo ? "ok  " : "FALHOU"} ${oque}`);
  if (!certo) erros.push(oque);
}

const navegador = await chromium.launch({
  // O Chromium do container é mais antigo que o playwright instalado agora;
  // sem apontar o caminho, ele procura uma versão que não existe aqui.
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 } });
pagina.on("pageerror", (e) => erros.push(`erro de javascript: ${e.message}`));

await pagina.goto(BASE + "/");
await pagina.waitForSelector("h1");
conferir(await pagina.getByRole("link", { name: /Come\u00e7ar pelo Pilar 1/ }).isVisible(), "início mostra o botão de começar");
await pagina.screenshot({ path: `${FOTOS}/01-inicio.png`, fullPage: true });

// Endereço igual ao da plataforma de referência.
await pagina.goto(BASE + "/pilar/1/pesquisa-passiva");
await pagina.waitForSelector("h1");
conferir((await pagina.locator("h1").innerText()) === "Pesquisa passiva", "/pilar/1/pesquisa-passiva abre a etapa certa");
conferir((await pagina.locator("textarea").count()) === 6, "a etapa tem os 6 campos");

// O "salvo" não pode acender sozinho: antes ele acendia em todos os campos
// meio segundo depois de abrir a tela.
await pagina.waitForTimeout(900);
conferir(
  (await pagina.locator(".salvo-aviso-visivel").count()) === 0,
  'nenhum campo diz "salvo" antes de alguém escrever',
);

const primeiro = pagina.locator("textarea").first();
await primeiro.fill(FRASE);
await pagina.waitForTimeout(800); // o salvamento espera meio segundo
conferir(
  (await pagina.locator(".salvo-aviso-visivel").count()) === 1,
  'só o campo escrito diz "salvo"',
);
await pagina.screenshot({ path: `${FOTOS}/02-pesquisa-passiva.png`, fullPage: true });

// Sair da etapa, voltar, e conferir que não sumiu.
await pagina.goto(BASE + "/pilar/3/promessa");
await pagina.goto(BASE + "/pilar/1/pesquisa-passiva");
await pagina.waitForSelector("textarea");
conferir((await pagina.locator("textarea").first().inputValue()) === FRASE, "o texto continua lá depois de sair e voltar");

// Recarregar do zero (é o teste que pega salvamento só em memória).
await pagina.reload();
await pagina.waitForSelector("textarea");
conferir((await pagina.locator("textarea").first().inputValue()) === FRASE, "o texto sobrevive a recarregar a página");

// Progresso andou?
const conta = await pagina.locator(".progresso-da-etapa span").innerText();
conferir(conta === "1/6", `o contador da etapa marcou o que foi respondido (achei "${conta}")`);

// Digitar e sair sem esperar o meio segundo — o caso que perderia a frase.
const segundo = pagina.locator("textarea").nth(1);
await segundo.fill("no grupo Itabirito Empregos, no Facebook");
await pagina.locator(".pe-da-pagina .botao").click(); // o "próxima etapa" do rodapé
await pagina.waitForSelector("h1");
await pagina.goBack();
await pagina.waitForSelector("textarea");
conferir(
  (await pagina.locator("textarea").nth(1).inputValue()) === "no grupo Itabirito Empregos, no Facebook",
  "não perde a frase de quem digita e troca de tela na hora",
);

// Menu do celular.
await pagina.getByRole("button", { name: /Abrir o menu/ }).click();
await pagina.waitForTimeout(300);
conferir(await pagina.locator("#menu-lateral.menu-aberto").isVisible(), "o menu abre no celular");
await pagina.screenshot({ path: `${FOTOS}/03-menu.png` });
await pagina.locator(".veu-visivel").click({ position: { x: 370, y: 400 } });
await pagina.waitForTimeout(300);
conferir(!(await pagina.locator("#menu-lateral.menu-aberto").count()), "o menu fecha ao tocar fora");
conferir(await pagina.locator("#menu-lateral").isHidden(), "menu fechado some do teclado e do leitor de tela");

// Relatório.
await pagina.goto(BASE + "/relatorio");
await pagina.waitForSelector("h1");
conferir((await pagina.getByText(FRASE).count()) > 0, "o relatório mostra o que foi respondido");
conferir((await pagina.getByText("em branco").count()) > 0, "o relatório aponta o que falta");
await pagina.screenshot({ path: `${FOTOS}/04-relatorio.png`, fullPage: true });

// Endereço inventado.
await pagina.goto(BASE + "/pilar/9/nao-existe");
await pagina.waitForSelector("h1");
conferir((await pagina.locator("h1").innerText()).includes("não existe"), "endereço inventado não abre tela vazia");

// Tela grande.
const largo = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
await largo.goto(BASE + "/pilar/1/pesquisa-passiva");
await largo.waitForSelector("#menu-lateral");
conferir(await largo.locator("#menu-lateral").isVisible(), "no computador o menu fica sempre visível");
await largo.screenshot({ path: `${FOTOS}/05-computador.png` });

await navegador.close();
console.log(erros.length ? `\n${erros.length} PROBLEMA(S):\n- ${erros.join("\n- ")}` : "\nTudo passou.");
process.exit(erros.length ? 1 : 0);
