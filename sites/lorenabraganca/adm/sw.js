// O "funcionário de fundo" do /adm: é ele que recebe a notificação com o painel
// fechado e a mostra na tela do celular. Não guarda cópia de nada: o painel sempre
// busca a lista nova, e um diagnóstico velho na tela seria pior que nenhum.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.titulo || "Novo diagnóstico", {
      body: d.corpo || "Alguém fez o diagnóstico no site.",
      icon: "/adm/icone-192.png",
      badge: "/adm/icone-192.png",
      tag: d.tag || undefined,
      data: { url: d.url || "/adm/" },
    });
    // se o painel estiver aberto, ele já atualiza a lista
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) c.postMessage("atualizar");
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const url = new URL((e.notification.data && e.notification.data.url) || "/adm/", self.location.origin).href;
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
      if (c.url.startsWith(self.location.origin + "/adm")) { c.postMessage("atualizar"); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
