import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuração do app instalável — o que vai para a Play Store.
 *
 * O Capacitor NÃO reescreve o procurô. Ele embrulha o mesmo app que roda
 * no site: os arquivos construídos em `dist` vão para DENTRO do aplicativo
 * e são lidos do próprio aparelho. É essa a diferença para o caminho que
 * carrega o site — aqui não há endereço nenhum sendo aberto, o app abre
 * sem internet, e ele passa a ter acesso ao que é do celular (notificação,
 * câmera, cobrança da Google).
 *
 * O preço, que precisa ser dito: como o código vai dentro do arquivo
 * instalado, uma correção só chega em quem tem o app depois de uma versão
 * nova ser enviada à loja e revisada. O site continua se atualizando na
 * hora; o app da loja, não.
 */
const config: CapacitorConfig = {
  /**
   * A identidade do app na Play Store, e ela é PARA SEMPRE.
   *
   * Depois de publicado, este nome não pode ser trocado: mudá-lo cria um
   * aplicativo diferente aos olhos da loja, com outro endereço, e as
   * pessoas que já instalaram não recebem mais atualização. É o domínio
   * escrito ao contrário, que é a convenção do Android.
   */
  appId: "br.com.procuroapp.app",

  /** O nome que aparece embaixo do ícone, na tela do celular. */
  appName: "procurô",

  /**
   * De onde vêm os arquivos do app: a mesma pasta que o site publica.
   * É isto que garante que o app da loja e o site sejam o mesmo procurô, e
   * não duas versões que se afastam uma da outra.
   */
  webDir: "dist",

  android: {
    /* A tela de fundo enquanto o app abre. Branco, como o app. */
    backgroundColor: "#ffffff",
  },
};

export default config;
