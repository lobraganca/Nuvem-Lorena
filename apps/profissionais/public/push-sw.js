/* O pedaço do service worker que recebe notificação (Web Push).
   ─────────────────────────────────────────────────────────────
   Fica num arquivo separado e é puxado por `importScripts` na configuração
   do VitePWA. O service worker principal é GERADO pelo Workbox, com uma
   configuração de cache que custou caro para acertar (ver os comentários no
   vite.config.ts). Trocar o modo de geração para escrever push no mesmo
   arquivo obrigaria a reescrever tudo aquilo à mão — e o primeiro erro ali
   não aparece como erro, aparece como app servindo a versão de ontem.

   Isto vale só para o SITE. Dentro do app da Play Store o service worker é
   desligado de propósito, e quem entrega a notificação é o Firebase, pelo
   Android. */

self.addEventListener("push", (event) => {
  /* Sem dados não há o que mostrar — mas o navegador EXIGE que todo push
     vire uma notificação visível (é a regra do `userVisibleOnly`). Ignorar
     em silêncio faz o Chrome punir o app: depois de algumas vezes ele
     revoga a inscrição, e aí a pessoa para de receber sem nunca saber. Por
     isso o texto genérico em vez de um `return`. */
  let dados = { titulo: "Ei Itabirito", corpo: "Apareceu novidade para você.", url: "/vagas-para-mim" };

  try {
    if (event.data) dados = { ...dados, ...event.data.json() };
  } catch {
    /* Veio texto puro em vez de JSON. Melhor mostrar o genérico do que
       deixar de mostrar. */
  }

  event.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      /* Agrupa por vaga: dois avisos da mesma vaga viram um só, em vez de
         empilhar. Quem recebe três notificações da mesma coisa desliga o
         aviso — e aí não recebe nem a próxima, que era a que importava. */
      tag: dados.tag || "vaga",
      renotify: false,
      data: { url: dados.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || "/vagas-para-mim";

  /* Se o app já está aberto numa aba, usa ELA em vez de abrir outra. Sem
     isto, quem toca no aviso com o app aberto ganha uma segunda janela do
     mesmo app — e fica com duas, sem entender qual é a certa. */
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ("focus" in janela) {
          janela.navigate(destino);
          return janela.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
