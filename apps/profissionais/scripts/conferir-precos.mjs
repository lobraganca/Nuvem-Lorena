/**
 * Os preços do servidor batem com os da tela?
 *
 * ── POR QUE ISTO PRECISA EXISTIR ───────────────────────────────────────
 *
 * A tabela de preços vive em dois lugares, e não dá para ser diferente: a
 * tela roda no navegador e lê `src/types/domain.ts`; a cobrança roda numa
 * Edge Function, em Deno, no servidor do Supabase, e não consegue importar
 * um arquivo do app. São dois programas em máquinas diferentes.
 *
 * Só que preço copiado não sobrevive à primeira mudança. Este repositório
 * já tem a cicatriz: `supabase/functions/_shared/precos.ts` nasceu porque a
 * mesma tabela estava em QUATRO arquivos, e bastava esquecer um para o
 * anual cobrar um valor e o mensal outro.
 *
 * O estrago aqui seria pior que o de sempre, porque é silencioso nos dois
 * sentidos: a tela mostra R$ 89,90, o Mercado Pago cobra R$ 59,90 (ou o
 * contrário), e nada na tela denuncia. Quem descobre é quem pagou, olhando
 * a fatura.
 *
 * Então a montagem PARA se um número divergir. Roda no `verificar-app.yml`,
 * a cada push, junto da conferência de tipos.
 *
 * ── POR QUE LER O TEXTO EM VEZ DE IMPORTAR ─────────────────────────────
 *
 * Importar o `.ts` exigiria compilar o app inteiro só para ler cinco
 * números, e importar o arquivo do Deno num Node não funciona. Ler o texto
 * é feio e é o certo: uma conferência que depende de o app compilar não
 * roda justamente no dia em que o app não compila.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const ler = (caminho) => readFileSync(join(APP, caminho), "utf8");

const falhas = [];
const confere = (o, esperado, achado) => {
  const ok = esperado === achado;
  console.log(`   ${ok ? "ok  " : "NÃO "} ${o}${ok ? "" : `  (tela ${esperado} × servidor ${achado})`}`);
  if (!ok) falhas.push(o);
};

/* ── Os preços da TELA ──────────────────────────────────────────────── */
const domain = ler("src/types/domain.ts");

/* Cada plano em PLANOS_EMPRESA aparece como `chave: { nome: "...",
   centavos: NNNN, ...}`. A busca é pela chave seguida de `nome` e
   `centavos` na mesma vizinhança, para não capturar outro objeto qualquer
   que tenha um campo `centavos`. */
function planoDaTela(chave) {
  const bloco = new RegExp(
    `\\b${chave}:\\s*\\{[\\s\\S]{0,400}?nome:\\s*"([^"]+)"[\\s\\S]{0,200}?centavos:\\s*(\\d+)`
  ).exec(domain);
  if (!bloco) throw new Error(`não achei o plano '${chave}' em src/types/domain.ts`);
  return { nome: bloco[1], centavos: Number(bloco[2]) };
}

const destaqueTs = ler("src/lib/destaque.ts");
const precoDestaque = /DESTAQUE_PRECO\s*=\s*([\d.]+)/.exec(destaqueTs);
const diasDestaque = /DESTAQUE_DIAS\s*=\s*(\d+)/.exec(destaqueTs);
if (!precoDestaque || !diasDestaque) {
  console.error("não achei DESTAQUE_PRECO / DESTAQUE_DIAS em src/lib/destaque.ts");
  process.exit(1);
}
/* `10.9` na tela é 1090 centavos. O arredondamento evita o clássico
   10.9 * 100 = 1089.9999999999999 do ponto flutuante. */
const destaqueDaTela = {
  centavos: Math.round(Number(precoDestaque[1]) * 100),
  dias: Number(diasDestaque[1]),
};

/* Quantos dias vale o plano pago, na tela. */
const diasAnuncio = /DIAS_ANUNCIO_VAGA\s*=\s*(\d+)/.exec(domain);

/* ── Os preços do SERVIDOR ──────────────────────────────────────────── */
const servidor = ler("supabase/functions/_shared/precosDoEi.ts");

function planoDoServidor(chave) {
  const bloco = new RegExp(
    `\\b${chave}:\\s*\\{\\s*nome:\\s*"([^"]+)",\\s*centavos:\\s*(\\d+)`
  ).exec(servidor);
  if (!bloco) throw new Error(`não achei o plano '${chave}' em _shared/precosDoEi.ts`);
  return { nome: bloco[1], centavos: Number(bloco[2]) };
}

const destaqueDoServidor = /DESTAQUE\s*=\s*\{[^}]*centavos:\s*(\d+),\s*dias:\s*(\d+)/.exec(servidor);
const diasDoPlano = /DIAS_DO_PLANO\s*=\s*(\d+)/.exec(servidor);

/* ── A conferência ──────────────────────────────────────────────────── */
console.log("\n════ OS PLANOS DA EMPRESA ════");
for (const chave of ["pro", "tres", "cinco", "dez"]) {
  const tela = planoDaTela(chave);
  const srv = planoDoServidor(chave);
  confere(`${chave} — preço`, tela.centavos, srv.centavos);
  confere(`${chave} — nome`, tela.nome, srv.nome);
}

console.log("\n════ O DESTAQUE DE QUEM PROCURA EMPREGO ════");
confere("destaque — preço", destaqueDaTela.centavos, Number(destaqueDoServidor?.[1]));
confere("destaque — dias", destaqueDaTela.dias, Number(destaqueDoServidor?.[2]));

console.log("\n════ POR QUANTOS DIAS O PLANO VALE ════");
if (diasAnuncio) {
  confere("plano — dias", Number(diasAnuncio[1]), Number(diasDoPlano?.[1]));
} else {
  console.log("   --   não achei DIAS_ANUNCIO_VAGA na tela; conferência pulada");
}

/* O `ilimitado` NÃO é conferido: ele é sob consulta e, de propósito, não
   existe na tabela do servidor. Se um dia aparecer lá com um valor
   inventado, é aqui que se lembra de por quê. */
if (/\bilimitado:\s*\{/.test(servidor)) {
  falhas.push("o plano sob consulta ganhou preço no servidor");
  console.log("\n   NÃO  o 'ilimitado' é sob consulta e não pode ter preço no servidor");
}

if (falhas.length) {
  console.error(`\n✘ ${falhas.length} diferença(s) entre o preço da tela e o do servidor.`);
  console.error("  Quem muda preço muda nos DOIS: src/types/domain.ts (ou src/lib/destaque.ts)");
  console.error("  e supabase/functions/_shared/precosDoEi.ts.");
  process.exit(1);
}
console.log("\n✔ a tela e o servidor cobram a mesma coisa");
