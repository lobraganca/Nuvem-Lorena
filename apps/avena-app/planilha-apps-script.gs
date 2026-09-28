/*
  Recebe cada diagnóstico da página do avena.app e escreve na planilha
  "avena · Diagnósticos", uma linha por pessoa.

  Como instalar (uma vez só, de preferência no computador):
    1. Abrir a planilha > Extensões > Apps Script
    2. Apagar o que estiver lá, colar este arquivo inteiro, salvar
    3. Implantar > Nova implantação > tipo "App da Web"
       - Executar como: Eu
       - Quem pode acessar: Qualquer pessoa
    4. Autorizar (o Google avisa que o app "não foi verificado": é o seu
       próprio script; Avançado > Acessar)
    5. Copiar o endereço que termina em /exec — é ele que vai no
       CONFIG.webhook do index.html

  A página manda cada pessoa duas vezes: ao passar do primeiro passo (só
  nome e WhatsApp) e ao terminar (tudo). A primeira vira uma linha
  "Só deixou o contato"; a segunda SUBSTITUI essa mesma linha, que vira
  "Completo". Quem fica em "Só deixou o contato" desistiu no meio — e o
  telefone está ali para você chamar.
*/

// [título da coluna, nome do campo que a página manda] — na ordem da planilha
const COLUNAS = [
  ["Data", "enviado_em"],
  ["Situação", "etapa"],
  ["Nome", "nome"],
  ["WhatsApp", "whatsapp"],
  ["E-mail", "email"],
  ["Empresa", "empresa"],
  ["Cidade", "cidade"],
  ["Formato", "modo"],
  ["Para", "perfil"],
  ["Área", "segmento"],
  ["O que atrapalha", "dores"],
  ["Nas palavras da pessoa", "dor_texto"],
  ["Como é hoje", "hoje"],
  ["Usa hoje", "sistema_atual"],
  ["Imagina", "tipo"],
  ["Precisa ter", "funcoes"],
  ["Arquivos", "arquivos"],
  ["Mais alguma coisa", "funcoes_outras"],
  ["Quem usa", "usuarios"],
  ["Quantas pessoas", "quantos"],
  ["Endereço", "endereco"],
  ["Lojas", "lojas"],
  ["Prazo", "prazo"],
  ["Investimento", "investimento"],
  ["Pagamento", "pagamento"],
  ["Sessão ao vivo", "sessao"],
  ["Melhores dias", "dias_sessao"],
  ["Conheceu por", "origem"],
  ["Observações", "obs"],
  ["Diagnóstico", "diagnostico"],
  ["Tamanho", "nivel"]
];
const COL_SITUACAO = 2;
const COL_WHATSAPP = 4;

function doPost(e) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000); // duas pessoas ao mesmo tempo não escrevem na mesma linha
  try {
    const d = JSON.parse(e.postData.contents);
    const aba = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    if (d.segmento === "Outra" && d.segmento_outro) d.segmento = d.segmento_outro;
    const completo = d.etapa === "completo";
    d.etapa = completo ? "Completo" : "Só deixou o contato";
    d.enviado_em = new Date();

    const linha = COLUNAS.map(([, campo]) => seguro(d[campo]));
    linha[COL_WHATSAPP - 1] = "'" + String(d.whatsapp || ""); // telefone fica texto, sem virar número

    const existente = completo ? linhaDoContato(aba, d.whatsapp) : 0;
    if (existente) aba.getRange(existente, 1, 1, linha.length).setValues([linha]);
    else aba.appendRow(linha);

    return ContentService.createTextOutput("ok");
  } finally {
    trava.releaseLock();
  }
}

// Abrir o endereço /exec no navegador mostra isto: serve para conferir.
function doGet() {
  return ContentService.createTextOutput("A planilha do avena.app está recebendo diagnósticos.");
}

// A linha "Só deixou o contato" mais recente com o mesmo WhatsApp (0 = nenhuma)
function linhaDoContato(aba, whatsapp) {
  const alvo = String(whatsapp || "").replace(/\D/g, "");
  const ultima = aba.getLastRow();
  if (!alvo || ultima < 2) return 0;
  const dados = aba.getRange(2, 1, ultima - 1, COL_WHATSAPP).getValues();
  for (let i = dados.length - 1; i >= 0; i--) {
    const tel = String(dados[i][COL_WHATSAPP - 1]).replace(/\D/g, "");
    if (tel === alvo && dados[i][COL_SITUACAO - 1] === "Só deixou o contato") return i + 2;
  }
  return 0;
}

// O texto vem de quem preencheu a página. Começando com = + - ou @, a
// planilha o trataria como fórmula — um apóstrofo na frente o mantém texto.
function seguro(v) {
  if (v instanceof Date) return v;
  const t = v == null ? "" : String(v);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}
