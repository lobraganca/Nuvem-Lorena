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
 * chegava. Está errado: o formulário mais importante deste app é um cadastro
 * longo — foto, endereço, cinco serviços, telefone —, e recarregar no meio
 * dele joga fora o trabalho de quem estava digitando, sem aviso e sem
 * desfazer. O ganho de estar atualizado cinco minutos antes não paga isso.
 *
 * Agora a versão nova fica esperando em segundo plano e quem decide a hora é
 * a pessoa, por um aviso na tela. Enquanto ela não decidir, o app continua
 * funcionando na versão antiga, inteiro.
 */

/** Quanto tempo de aba aberta já é "isso aqui está parado há tempo demais". */
const DIAS_PARADO = 2;

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

export function observarAtualizacoes(fn: Ouvinte) {
  ouvinte = fn;
  avisar();
  return () => {
    ouvinte = null;
  };
}

export function cuidarDasAtualizacoes() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  let recarregando = false;
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

  document.addEventListener("visibilitychange", procurarVersaoNova);
  window.addEventListener("focus", procurarVersaoNova);
  void procurarVersaoNova();
  // Uma aba que fica aberta o dia inteiro nunca dispara `focus` nem
  // `visibilitychange`; sem esta ronda, ela só descobriria a versão nova ao
  // ser fechada e reaberta — que é justamente o que não acontece.
  window.setInterval(procurarVersaoNova, 60 * 60 * 1000);
}
