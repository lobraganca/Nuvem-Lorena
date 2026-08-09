import { credenciaisSupabase, supabase } from "./supabase";
import { PROFESSIONAL_PHOTOS_BUCKET } from "./storage";

/**
 * Verificação automática do que está configurado no app.
 *
 * Existe porque a configuração deste app mora em cinco lugares diferentes —
 * banco, storage, funções de servidor, segredos e painéis externos — e nada
 * avisa quando falta uma peça: a tela simplesmente para de funcionar em um
 * canto, às vezes semanas depois. Cada item aqui é uma pergunta feita ao
 * servidor de verdade, não uma lista para marcar à mão.
 *
 * O que não dá para verificar de fora (segredos e painéis de terceiros)
 * aparece como "conferir à mão", e não como aprovado — dizer "ok" sem ter
 * checado seria pior do que não checar.
 */
export type EstadoItem = "ok" | "faltando" | "manual" | "checando";

export interface ItemConfig {
  id: string;
  grupo: string;
  titulo: string;
  /** O que quebra no app quando este item falta. */
  consequencia: string;
  /** Onde e como resolver. */
  comoResolver: string;
  estado: EstadoItem;
  detalhe?: string;
}

async function existeColuna(tabela: string, coluna: string): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { error } = await client.from(tabela).select(coluna).limit(1);
  // 42703 = coluna inexistente; 42P01 = tabela inexistente.
  return !error || (error.code !== "42703" && error.code !== "42P01");
}

async function existeTabela(tabela: string): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { error } = await client.from(tabela).select("*").limit(1);
  return !error || error.code !== "42P01";
}

async function existeFuncao(nome: string, args: Record<string, unknown>): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { error } = await client.rpc(nome, args);
  // PGRST202 = função não encontrada no schema exposto.
  return !error || error.code !== "PGRST202";
}

/**
 * Uma Edge Function publicada responde qualquer coisa menos 404. Sem token,
 * o esperado é 401 — o que já prova que ela existe.
 */
async function funcaoPublicada(nome: string): Promise<boolean> {
  const { url, key } = credenciaisSupabase();
  if (!url) return false;
  try {
    const resposta = await fetch(`${url}/functions/v1/${nome}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
    });
    return resposta.status !== 404;
  } catch {
    return false;
  }
}

async function bucketExiste(): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { error } = await client.storage.from(PROFESSIONAL_PHOTOS_BUCKET).list("", { limit: 1 });
  return !error;
}

async function temAdmin(): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { count } = await client.from("admins").select("user_id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

export async function verificarConfiguracao(): Promise<ItemConfig[]> {
  const [
    colWhats,
    colEndereco,
    colPausado,
    colPagamento,
    tabFila,
    fnVagas,
    bucket,
    admin,
    fnExcluir,
    fnCancelar,
    fnAssinatura,
    fnWebhook,
  ] = await Promise.all([
    existeColuna("professionals", "whatsapp_verified"),
    existeColuna("professionals", "cep"),
    existeColuna("professionals", "paused"),
    existeColuna("processed_payments", "subscription_id"),
    existeTabela("destaque_espera"),
    existeFuncao("vagas_de_destaque", { p_category: "x", p_city: "y" }),
    bucketExiste(),
    temAdmin(),
    funcaoPublicada("delete-account"),
    funcaoPublicada("cancel-subscription"),
    funcaoPublicada("mercadopago-create-subscription"),
    funcaoPublicada("mercadopago-webhook"),
  ]);

  const bool = (v: boolean): EstadoItem => (v ? "ok" : "faltando");

  return [
    {
      id: "sql-whatsapp",
      grupo: "Banco de dados",
      titulo: "Confirmação de WhatsApp",
      consequencia: "Sem isto, o botão de confirmar número dá erro e o selo não pode ser vendido.",
      comoResolver: "SQL Editor do Supabase → rodar a migration 0024.",
      estado: bool(colWhats),
    },
    {
      id: "sql-endereco",
      grupo: "Banco de dados",
      titulo: "Endereço no anúncio",
      consequencia: "Sem isto, salvar o anúncio com CEP falha.",
      comoResolver: "SQL Editor → migration 0025.",
      estado: bool(colEndereco),
    },
    {
      id: "sql-pausar",
      grupo: "Banco de dados",
      titulo: "Pausar anúncio e proteger suspensão",
      consequencia:
        "Sem isto, pausar dá erro — e o dono de um anúncio suspenso consegue se reativar sozinho.",
      comoResolver: "SQL Editor → migration 0027.",
      estado: bool(colPausado),
    },
    {
      id: "sql-abuso",
      grupo: "Banco de dados",
      titulo: "Freios de abuso e expurgo (LGPD)",
      consequencia:
        "Sem isto, dá para encher o painel de um profissional com pedidos falsos, e nada é apagado depois de 12 meses.",
      comoResolver: "SQL Editor → migration 0028.",
      estado: "manual",
      detalhe: "Não dá para verificar daqui: são gatilhos, e testá-los criaria lixo no banco.",
    },
    {
      id: "sql-repetidos",
      grupo: "Banco de dados",
      titulo: "Travas contra anúncio repetido",
      consequencia: "Sem isto, uma pessoa pode ocupar a busca com cinco anúncios do mesmo serviço.",
      comoResolver: "SQL Editor → migration 0029.",
      estado: "manual",
      detalhe: "Mesma coisa: é gatilho, só se prova tentando cadastrar repetido.",
    },
    {
      id: "sql-reembolso",
      grupo: "Banco de dados",
      titulo: "Vínculo pagamento ↔ assinatura",
      consequencia: "Sem isto, o reembolso dos 7 dias não sabe qual cobrança devolver.",
      comoResolver: "SQL Editor → migration 0030.",
      estado: bool(colPagamento),
    },
    {
      id: "sql-destaques",
      grupo: "Banco de dados",
      titulo: "Teto de destaques e fila de espera",
      consequencia: "Sem isto, não há limite de 5 por categoria e a fila de espera não existe.",
      comoResolver: "SQL Editor → migration 0031.",
      estado: bool(tabFila && fnVagas),
    },
    {
      id: "bucket",
      grupo: "Fotos",
      titulo: `Bucket "${PROFESSIONAL_PHOTOS_BUCKET}"`,
      consequencia: "Sem isto, ninguém consegue publicar anúncio com foto.",
      comoResolver: "Supabase → Storage → New bucket, público, com esse nome exato.",
      estado: bool(bucket),
    },
    {
      id: "admin",
      grupo: "Acesso",
      titulo: "Existe pelo menos uma administradora",
      consequencia: "Sem isto, ninguém vê denúncias nem consegue tirar anúncio do ar.",
      comoResolver: "SQL Editor → insert into public.admins (user_id) values ('seu-uid').",
      estado: bool(admin),
    },
    {
      id: "fn-excluir",
      grupo: "Funções de servidor",
      titulo: "delete-account",
      consequencia:
        "Sem isto, 'Excluir minha conta' dá erro — e a Política de Privacidade promete que funciona (risco de LGPD).",
      comoResolver: "No computador: supabase functions deploy delete-account",
      estado: bool(fnExcluir),
    },
    {
      id: "fn-cancelar",
      grupo: "Funções de servidor",
      titulo: "cancel-subscription",
      consequencia: "Sem isto, ninguém consegue cancelar assinatura pelo app (exigência do CDC).",
      comoResolver: "supabase functions deploy cancel-subscription",
      estado: bool(fnCancelar),
    },
    {
      id: "fn-assinatura",
      grupo: "Funções de servidor",
      titulo: "Checkout do Mercado Pago",
      consequencia: "Sem isto, nenhum botão de assinar funciona — nenhuma receita entra.",
      comoResolver: "supabase functions deploy mercadopago-create-subscription (e as demais mercadopago-*)",
      estado: bool(fnAssinatura),
    },
    {
      id: "fn-webhook",
      grupo: "Funções de servidor",
      titulo: "Webhook do Mercado Pago",
      consequencia:
        "Sem isto, o pagamento é feito e o benefício nunca é liberado — o pior cenário possível: cobrado e não entregue.",
      comoResolver: "supabase functions deploy mercadopago-webhook + cadastrar a URL no painel do Mercado Pago.",
      estado: bool(fnWebhook),
    },
    {
      id: "mp-token",
      grupo: "Segredos",
      titulo: "MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET",
      consequencia: "Sem eles, o checkout falha e o webhook aceita aviso não assinado.",
      comoResolver: "Supabase → Edge Functions → Secrets. Valores no painel do Mercado Pago.",
      estado: "manual",
      detalhe: "Segredos não são legíveis pelo app, e é assim que tem que ser.",
    },
    {
      id: "twilio",
      grupo: "Segredos",
      titulo: "Envio de código por WhatsApp/SMS",
      consequencia: "Sem isto, o botão de confirmar WhatsApp diz que o envio não está ligado.",
      comoResolver: "Supabase → Authentication → Providers → Phone → Twilio.",
      estado: "manual",
    },
    {
      id: "google",
      grupo: "Painéis externos",
      titulo: "Login do Google publicado",
      consequencia:
        "Em modo de teste, só quem você autoriza consegue criar conta — todo o resto vê erro do Google.",
      comoResolver: "Google Cloud → Tela de permissão OAuth → Publicar aplicativo.",
      estado: "manual",
    },
    {
      id: "cron",
      grupo: "Painéis externos",
      titulo: "Expurgo automático agendado",
      consequencia: "Sem isto, os dados de terceiros nunca são apagados (prazo da LGPD).",
      comoResolver:
        "Supabase → Database → Extensions → pg_cron, depois: select cron.schedule('expurgo','0 4 * * *','select public.expurgar_dados_antigos()');",
      estado: "manual",
    },
  ];
}
