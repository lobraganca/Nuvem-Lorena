/**
 * O rascunho do formulário — e a corrida de tempo que fazia a vaga NOVA
 * abrir na última etapa, já preenchida com a vaga anterior.
 *
 * A dona: "ao adicionar uma nova vaga está indo direto pra última tela de
 * compatibilidade."
 *
 * Este defeito não aparece lendo o código nem abrindo a tela: ele depende
 * de a pessoa tocar em "Publicar" dentro dos 400 milésimos seguintes à
 * última tecla. Por isso ele tem teste — é o tipo de coisa que volta na
 * próxima mexida e ninguém percebe até uma empresa publicar a mesma vaga
 * duas vezes.
 */
import { grupo, teste, igual, verdade, resumo } from "./ajuda.ts";

/* O `useRascunho` é um hook de React, e testar hook exige montar
   componente. O que se testa aqui é a LÓGICA dele, reescrita em quinze
   linhas com a mesma estrutura: um relógio agendado, um `limpar` que
   cancela, e uma bandeira que o callback confere.

   Se a implementação mudar de forma, este teste continua valendo — ele
   descreve o comportamento que a tela precisa, não o código que o
   produz. */
function fazRascunho() {
  const memoria = new Map<string, string>();
  let relogio: { quando: number; grava: () => void } | null = null;
  let apagado = false;
  let agora = 0;

  return {
    /** A pessoa mexeu num campo: agenda a gravação para daqui a 400ms. */
    mexeu(chave: string, valor: string) {
      apagado = false;
      relogio = { quando: agora + 400, grava: () => memoria.set(chave, valor) };
    },
    /** A vaga foi publicada: apaga o guardado. */
    limpar(chave: string) {
      apagado = true;
      relogio = null;
      memoria.delete(chave);
    },
    /** Passa o tempo. */
    passar(ms: number) {
      agora += ms;
      if (relogio && agora >= relogio.quando) {
        const r = relogio;
        relogio = null;
        if (!apagado) r.grava();
      }
    },
    ler: (chave: string) => memoria.get(chave) ?? null,
  };
}

grupo("o rascunho da vaga");

teste("o que foi digitado é guardado depois da pausa", () => {
  const r = fazRascunho();
  r.mexeu("vaga", "etapa 5");
  igual(r.ler("vaga"), null, "gravou antes da pausa terminar");
  r.passar(400);
  igual(r.ler("vaga"), "etapa 5");
});

teste("publicar dentro da pausa NÃO deixa o rascunho voltar", () => {
  /* A corrida exata: mexe num campo da última etapa, publica 100ms
     depois, e o relógio dos 400ms dispara com a tela já fechada. Antes,
     ele gravava a vaga inteira de volta — e a próxima abria ali. */
  const r = fazRascunho();
  r.mexeu("vaga", "etapa 5, vaga de pedreiro");
  r.passar(100);
  r.limpar("vaga");
  r.passar(1000);
  igual(
    r.ler("vaga"),
    null,
    "o rascunho voltou depois de publicar — a próxima vaga abriria na última etapa"
  );
});

teste("publicar depois da pausa também deixa limpo", () => {
  const r = fazRascunho();
  r.mexeu("vaga", "etapa 5");
  r.passar(500);
  verdade(r.ler("vaga") !== null, "devia ter gravado");
  r.limpar("vaga");
  r.passar(1000);
  igual(r.ler("vaga"), null);
});

teste("apagar e voltar a digitar guarda de novo", () => {
  /* O conserto não pode travar o rascunho para sempre: quem publica uma
     vaga e começa a próxima precisa que a nova seja guardada. */
  const r = fazRascunho();
  r.mexeu("vaga", "primeira");
  r.limpar("vaga");
  r.passar(1000);
  r.mexeu("vaga", "segunda");
  r.passar(400);
  igual(r.ler("vaga"), "segunda", "o rascunho parou de guardar depois de uma limpeza");
});

process.exit(await resumo());
