package br.com.eiitabirito.app;

import com.getcapacitor.BridgeActivity;

/**
 * A única classe Java do app. O Capacitor faz o resto.
 *
 * ── Ela estava no pacote errado — 06/09 ───────────────────────────────
 *
 * Este arquivo morava em `br.com.procuroapp.app`, de quando o projeto
 * Android nasceu. Em 29/08 o `namespace` e o `applicationId` do
 * build.gradle viraram `br.com.eiitabirito.app` — e o arquivo ficou onde
 * estava.
 *
 * O AndroidManifest declara a tela como `.MainActivity`, e esse ponto na
 * frente quer dizer "a partir do namespace". Ou seja: o Android passou a
 * procurar `br.com.eiitabirito.app.MainActivity`, que não existia em lugar
 * nenhum. O pior desse defeito é que ele NÃO aparece na montagem — o
 * arquivo é gerado, assinado e entregue igual. Só quem instala descobre,
 * quando o app fecha sozinho na abertura.
 *
 * Como as montagens só foram feitas antes de alguém abrir o resultado,
 * ninguém tinha visto. Achado ao conferir o que faltava para enviar à
 * Play Store.
 */
public class MainActivity extends BridgeActivity {}
