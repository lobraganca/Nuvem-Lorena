import { useEffect, useState } from "react";

/**
 * Se o aparelho está com internet agora.
 *
 * Existe porque "sem internet" e "deu erro" são coisas diferentes e o app
 * tratava as duas igual. Sem sinal, cada tela mostrava a sua própria
 * mensagem de falha — "não foi possível carregar" —, e quem lia entendia
 * que o procurô tinha quebrado. Quebrado, a pessoa desinstala; sem sinal,
 * ela espera.
 *
 * `navigator.onLine` responde à pergunta errada com precisão: ele diz se
 * existe uma rede ligada, não se essa rede chega a algum lugar. Wi-Fi de
 * praça, portal de hotel e sinal de uma barra dão `true` e não carregam
 * nada. Por isso ele serve para o caso claro — o rádio desligado, o modo
 * avião — e nada mais: quando ele diz que está desligado, está mesmo.
 *
 * É de propósito que este arquivo não tenta descobrir mais do que isso.
 * "Testar" a internet exigiria bater num endereço de tempos em tempos, o
 * que gasta bateria e dados de quem já está com pouco dos dois — e daria
 * um alarme falso toda vez que a rede oscilasse por dois segundos.
 */
export function useEstaOnline(): boolean {
  /* Começa otimista, e não lendo `navigator.onLine`, porque o valor inicial
     em alguns navegadores é `false` por um instante durante a abertura. Um
     aviso de "sem internet" que pisca na primeira tela é pior que aviso
     nenhum: ele aparece justamente quando a pessoa está julgando se o app
     funciona. */
  const [online, setOnline] = useState(true);

  useEffect(() => {
    /* Só depois de montado o valor de verdade é lido — aí ele já é
       confiável. */
    setOnline(navigator.onLine);
    const voltou = () => setOnline(true);
    const caiu = () => setOnline(false);
    window.addEventListener("online", voltou);
    window.addEventListener("offline", caiu);
    return () => {
      window.removeEventListener("online", voltou);
      window.removeEventListener("offline", caiu);
    };
  }, []);

  return online;
}
