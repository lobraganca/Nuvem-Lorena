/**
 * Manter o app instalado sempre na versão publicada — avisando, não à força.
 *
 * O app instalado na tela do celular não recarrega como uma aba do
 * navegador: ele fica aberto em segundo plano por dias, e quando a pessoa
 * volta é a mesma página de antes que reaparece. No iPhone não existe nem o
 * gesto de arrastar para baixo — a barra do Safari não está ali. Sem
 * nenhuma providência, "já publiquei" e "ainda não publiquei" são a mesma
 * coisa do lado de quem usa.
 *
 * A primeira versão disto recarregava sozinha assim que a versão nova
 * chegava. Estava errado: o formulário mais importante deste app é um
 * cadastro longo — foto, endereço, cinco serviços, telefone —, e recarregar
 * no meio dele joga fora o trabalho de quem estava digitando, sem aviso e
 * sem desfazer.
 *
 * A segunda passou a só avisar, com um botão "Atualizar". Também estava
 * errado, e o erro levou mais tempo para aparecer porque acontecia do outro
 * lado: quem publica corrigia alguma coisa, conferia que estava no ar, e a
 * dona do app continuava vendo a tela de três horas antes — três vezes numa
 * semana, cada uma delas terminando em "não mudou nada". Um aviso que
 * depende de alguém notar e tocar não é atualização; é uma tarefa a mais
 * para quem já estava reclamando de um defeito.
 *
 * A terceira, esta, separa as duas coisas em vez de escolher entre elas:
 *
 * - **Na volta ao app**, quando a pessoa acabou de trazê-lo para a frente e
 *   ainda não começou nada, a versão nova entra sozinha e calada. É o
 *   momento em que recarregar não custa absolutamente nada.
 * - **Se houver algo em jogo na tela** — cadastro aberto, folha aberta,
 *   qualquer campo digitado —, não troca: acende o aviso e a decisão volta
 *   a ser de quem está ali. Ver `podeTrocarDeVersaoAgora`.
 * - **Com o app aberto na frente**, nunca troca sozinho. A ronda de hora em
 *   hora e o `focus` continuam só avisando; ninguém pode ter a tela trocada
 *   debaixo do dedo.
 */

import { ehAppDaLoja } from "./plataforma";

/** Quanto tempo de aba aberta já é "isso aqui está parado há tempo demais". */
const DIAS_PARADO = 2;

/**
 * Dá para trocar a versão agora sem jogar fora trabalho de alguém?
 *
 * Esta pergunta é a diferença entre a atualização automática de hoje e a que
 * foi tirada daqui (ver o cabeçalho). Não voltamos a recarregar a qualquer
 * momento: recarregamos só quando não há nada em jogo na tela.
 *
 * As três respostas negativas correspondem a três formas reais de perder o
 * que a pessoa estava fazendo:
 */
export function podeTrocarDeVersaoAgora(): boolean {
  if (typeof document === "undefined") return false;

  /* 1. O cadastro, nunca. É o formulário citado lá em cima — longo, com
     foto e cinco serviços — e boa parte do que já foi preenchido vive no
     estado do React, não nos campos: mesmo com todos os campos visíveis
     vazios (a etapa 3, por exemplo), recarregar apaga as etapas 1 e 2. */
  const caminho = window.location.pathname;
  if (caminho.startsWith("/painel/novo") || caminho.startsWith("/painel/editar")) return false;

  /* 2. Folha aberta é gente no meio de alguma coisa — avaliando, pedindo
     contato, escolhendo cidade. */
  if (document.querySelector(".sheet-panel")) return false;

  /* 3. Qualquer coisa digitada. A exceção é o campo de busca: o que está
     escrito nele sobrevive ao recarregamento, porque a busca mora no
     endereço (`?q=`) — e bloquear por causa dele deixaria o app sem
     atualizar justamente para quem o usa mais. */
  const campos = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  for (const campo of campos) {
    if (campo.classList.contains("search-input")) continue;
    if (campo.type === "hidden" || campo.type === "checkbox" || campo.type === "radio") continue;
    if (campo.value.trim() !== "") return false;
  }

  return true;
}

type Ouvinte = (estado: { versaoNova: boolean; abertoHaMuitoTempo: boolean }) => void;

let ouvinte: Ouvinte | null = null;
let esperando: ServiceWorker | null = null;
let versaoNova = false;
let abertoHaMuitoTempo = false;
const abertoEm = Date.now();

/**
 * Rastro dos últimos passos da checagem, lido pela tela /diagnostico.
 *
 * Sem isto, "não apareceu aviso de versão nova" tem meia dúzia de causas
 * possíveis — sem rede, service worker não registrado, navegador servindo o
 * arquivo do cache — e nenhuma delas dá para distinguir olhando a tela.
 */
const passos: string[] = [];

export function passosDaAtualizacao(): string[] {
  return [...passos];
}

function registrarPasso(texto: string) {
  passos.push(new Date().toLocaleTimeString("pt-BR") + " — " + texto);
  if (passos.length > 12) passos.shift();
}

function avisar() {
  ouvinte?.({ versaoNova, abertoHaMuitoTempo });
}

/**
 * Aplica a versão que está esperando.
 *
 * O recarregamento não acontece aqui: ele vem do `controllerchange`, disparado
 * quando o novo service worker assume. Recarregar antes disso devolveria a
 * mesma versão antiga — e a pessoa tocaria em "Atualizar" de novo, achando
 * que o botão não funciona.
 */
export function aplicarAtualizacao() {
  if (esperando) {
    esperando.postMessage({ type: "SKIP_WAITING" });
    return;
  }
  // Sem ninguém esperando (caso do aviso por tempo de aba), recarregar já
  // resolve: a página principal nunca fica guardada, então volta fresca.
  window.location.reload();
}

/**
 * A saída de emergência: joga fora tudo o que está guardado e recarrega.
 *
 * O caminho normal — aviso na tela, botão "Atualizar" — depende de o
 * navegador ter percebido a versão nova e deixado o novo service worker
 * esperando. Quando essa detecção falha, e ela falha (rede que caiu no meio
 * do download, service worker que travou em `installing`, app instalado que
 * ficou dias em segundo plano), não sobra nada para a pessoa fazer: ela
 * recarrega, fecha, reabre, e continua vendo a versão de antes. Foi o que
 * aconteceu aqui, duas vezes, com quem publica o app.
 *
 * Isto não pede licença ao service worker: remove o registro dele, apaga os
 * caches todos e recarrega. Na volta, o navegador é obrigado a buscar tudo
 * do servidor, e um service worker novo se registra do zero.
 *
 * É seguro: o que está nos caches são cópias de arquivos que estão no
 * servidor. Nada do que a pessoa escreveu mora ali — cadastro e favoritos
 * estão no banco, e as preferências ficam no `localStorage`, que não é
 * tocado aqui.
 */
export async function forcarAtualizacao(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registros.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((n) => caches.delete(n)));
    }
  } catch {
    /* Navegador sem suporte, ou modo privado que recusa: recarregar mesmo
       assim é melhor que parar aqui — sem service worker no caminho, o
       recarregamento simples já resolve. */
  } finally {
    window.location.reload();
  }
}

export function observarAtualizacoes(fn: Ouvinte) {
  ouvinte = fn;
  avisar();
  return () => {
    ouvinte = null;
  };
}

export function cuidarDasAtualizacoes() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  /* Dentro do app da Play Store, o service worker é DESLIGADO — e isto é
     um conserto, não uma otimização.

     Ele existe para o site: guarda cópias dos arquivos para a próxima
     visita abrir rápido. Dentro do app instalado a mesma coisa se inverte
     e vira defeito, porque ali os arquivos já estão no aparelho e quem os
     troca é a loja.

     O estrago: a pessoa atualiza o app pela Play Store, o aparelho passa a
     ter os arquivos novos — e o service worker continua entregando os
     antigos, que ele guardou. App novo instalado, tela velha, nada em
     lugar nenhum explicando. No pior caso a versão nova e a guardada se
     misturam e a tela não abre.

     Ele é registrado pelo próprio index.html (o `registerSW.js` que o
     plugin de PWA injeta), antes de qualquer código nosso rodar. Por isso
     aqui não é "não registrar": é desfazer o registro e apagar o que ele
     guardou. Roda na abertura, e nas vezes seguintes não há mais nada para
     desfazer.

     Nada do que a pessoa escreveu mora nesses caches — cadastro e
     favoritos estão no banco, e as preferências no `localStorage`, que não
     é tocado aqui. */
  if (ehAppDaLoja()) {
    void (async () => {
      try {
        const registros = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registros.map((r) => r.unregister()));
        if ("caches" in window) {
          const nomes = await caches.keys();
          await Promise.all(nomes.map((n) => caches.delete(n)));
        }
      } catch {
        /* Se o aparelho recusar, o pior caso é continuar como estava — não
           vale derrubar a abertura do app por causa disto. */
      }
    })();
    return;
  }

  let recarregando = false;
  /* Liga só depois de a aba voltar do segundo plano. Na primeira carga
     fica desligado: se o app abrir já com uma versão esperando, trocar
     antes de a pessoa ver qualquer coisa faria a tela piscar duas vezes na
     abertura, que é onde a impressão de app quebrado se forma. */
  let aplicarSozinho = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });

  function anotarEspera(registro: ServiceWorkerRegistration) {
    if (!registro.waiting || !navigator.serviceWorker.controller) return;
    // `controller` nulo significa primeira visita: aí não há versão "nova",
    // há a única que existe, e avisar seria confundir quem acabou de entrar.
    esperando = registro.waiting;
    versaoNova = true;
    avisar();
    if (aplicarSozinho) trocarSeDerAgora();
  }

  /**
   * Troca de versão sem perguntar — só na volta ao app, e só se não houver
   * nada em jogo na tela.
   *
   * A dona do app viu três vezes numa semana uma tela velha e concluiu que o
   * conserto não tinha sido feito. Estava tudo publicado; o app instalado é
   * que segurava a versão antiga esperando alguém tocar em "Atualizar".
   * Entre pedir licença e não perder trabalho, dá para ter os dois: pede-se
   * licença quando há o que perder, e troca-se calado quando não há.
   *
   * Se a troca for barrada, o aviso continua na tela e a decisão volta a ser
   * dela — nada se perde, só adia.
   */
  function trocarSeDerAgora() {
    if (!esperando) return;
    if (!podeTrocarDeVersaoAgora()) {
      registrarPasso("versao-nova-mas-tem-coisa-na-tela");
      return;
    }
    registrarPasso("aplicando-sozinho");
    aplicarAtualizacao();
  }

  async function procurarVersaoNova() {
    registrarPasso("chamada");
    if (document.visibilityState !== "visible") {
      registrarPasso("escondido");
      return;
    }

    if (Date.now() - abertoEm > DIAS_PARADO * 24 * 60 * 60 * 1000 && !abertoHaMuitoTempo) {
      abertoHaMuitoTempo = true;
      avisar();
    }

    try {
      const registro = await navigator.serviceWorker.getRegistration();
      if (!registro) {
        registrarPasso("sem-registro");
        return;
      }
      anotarEspera(registro);
      registro.addEventListener("updatefound", () => {
        const novo = registro.installing;
        novo?.addEventListener("statechange", () => {
          if (novo.state === "installed") anotarEspera(registro);
        });
      });
      await registro.update();
      registrarPasso(registro.waiting ? "update-com-espera" : "update-sem-novidade");
    } catch (err) {
      /* sem rede, ou navegador sem suporte: tenta de novo na próxima vez */
      registrarPasso("falhou: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  /* A troca automática acontece só na volta ao app.

     Quem está com o app aberto na frente não pode ter a tela trocada
     debaixo do dedo — por isso o `focus` e a ronda de hora em hora
     continuam apenas avisando. Já a transição "estava em segundo plano →
     voltou" é o momento em que recarregar não custa nada: a pessoa acabou
     de trazer o app para a frente e ainda não começou a fazer nada.

     No celular é justamente essa a transição que importa: o app instalado
     fica dias aberto atrás de outros, e é ao voltar para ele que a versão
     de três horas atrás reaparece como se fosse a atual. */
  document.addEventListener("visibilitychange", () => {
    aplicarSozinho = document.visibilityState === "visible";
    void procurarVersaoNova();
    if (aplicarSozinho) trocarSeDerAgora();
  });
  window.addEventListener("focus", procurarVersaoNova);
  void procurarVersaoNova();
  // Uma aba que fica aberta o dia inteiro nunca dispara `focus` nem
  // `visibilitychange`; sem esta ronda, ela só descobriria a versão nova ao
  // ser fechada e reaberta — que é justamente o que não acontece.
  window.setInterval(procurarVersaoNova, 60 * 60 * 1000);
}
