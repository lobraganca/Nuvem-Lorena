import { useState } from "react";
import { Navigate, Routes, Route, Link, useLocation } from "react-router-dom";
import { Logo } from "./components/Logo";
import { BotaoSuporte } from "./components/BotaoSuporte";
import { AppShell } from "./components/AppShell";
import { SoDesteLado } from "./components/ei/SoDesteLado";
import { BoasVindas, jaViuAsBoasVindas } from "./components/ei/BoasVindas";
import { SplashScreen } from "./components/SplashScreen";
import { BottomSheet } from "./components/BottomSheet";
import { Suspense, lazy } from "react";
import { useAuth } from "./lib/useAuth";
import { sendSuggestion } from "./lib/suggestions";
import { AvisoDeDados } from "./components/AvisoDeDados";
import { RetomarDestinoLogin } from "./components/RetomarDestinoLogin";
import { AvisoErroLogin } from "./components/AvisoErroLogin";
import { CONTATO_EMAIL } from "./config";
import { importarPagina } from "./lib/importarPagina";
import { mensagemDeErro } from "./lib/erros";

/**
 * Telas carregadas sob demanda.
 *
 * Tudo vinha num arquivo só: quem abria a busca baixava junto o painel, a
 * administração, os termos e a tela de números — telas que a maioria das
 * pessoas nunca abre. Em 4G fraco isso é a diferença entre abrir e desistir.
 *
 * Ficam de fora a busca, o anúncio e a apresentação: são a porta de entrada,
 * e adiar o que já vai ser pedido só troca um tempo de espera por outro.
 *
 * Cada `import()` passa por `importarPagina`: como o nome de cada arquivo
 * muda a cada publicação, um app instalado com a versão antiga ainda em
 * segundo plano pode pedir um arquivo que já não existe mais no servidor —
 * e cair na tela de "algo quebrou" em vez de simplesmente atualizar sozinho
 * (ver o comentário em lib/importarPagina.ts).
 */
const LoginPage = lazy(importarPagina(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage }))));
const AdminPage = lazy(importarPagina(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminPage }))));
const TermosPage = lazy(importarPagina(() => import("./pages/TermosPage").then((m) => ({ default: m.TermosPage }))));
const ComoFuncionaPage = lazy(importarPagina(() => import("./pages/ComoFuncionaPage").then((m) => ({ default: m.ComoFuncionaPage }))));
const PrivacidadePage = lazy(importarPagina(() => import("./pages/PrivacidadePage").then((m) => ({ default: m.PrivacidadePage }))));
const DiagnosticoPage = lazy(importarPagina(() => import("./pages/DiagnosticoPage").then((m) => ({ default: m.DiagnosticoPage }))));
const ExcluirContaPage = lazy(importarPagina(() => import("./pages/ExcluirContaPage").then((m) => ({ default: m.ExcluirContaPage }))));
const ConfiguracaoPage = lazy(importarPagina(() => import("./pages/ConfiguracaoPage").then((m) => ({ default: m.ConfiguracaoPage }))));
const PerfilPage = lazy(importarPagina(() => import("./pages/PerfilPage").then((m) => ({ default: m.PerfilPage }))));

// MVP Local Hiring
const CadastroEmpresaPage = lazy(importarPagina(() => import("./pages/CadastroEmpresaPage").then((m) => ({ default: m.CadastroEmpresaPage }))));
const PainelEmpresaPage = lazy(importarPagina(() => import("./pages/PainelEmpresaPage").then((m) => ({ default: m.PainelEmpresaPage }))));
const CriarVagaPage = lazy(importarPagina(() => import("./pages/CriarVagaPage").then((m) => ({ default: m.CriarVagaPage }))));
const ProntoPage = lazy(() => import("./pages/ei/ProntoPage").then((m) => ({ default: m.ProntoPage })));
const EntradaPage = lazy(importarPagina(() => import("./pages/ei/EntradaPage").then((m) => ({ default: m.EntradaPage }))));
const ComecarPage = lazy(importarPagina(() => import("./pages/ei/ComecarPage").then((m) => ({ default: m.ComecarPage }))));
const MeuPerfilPage = lazy(importarPagina(() => import("./pages/ei/MeuPerfilPage").then((m) => ({ default: m.MeuPerfilPage }))));
const ProfissionaisPage = lazy(importarPagina(() => import("./pages/ProfissionaisPage").then((m) => ({ default: m.ProfissionaisPage }))));
const VagasParaMimPage = lazy(importarPagina(() => import("./pages/VagasParaMimPage").then((m) => ({ default: m.VagasParaMimPage }))));
const BancoDeVagasPage = lazy(importarPagina(() => import("./pages/ei/BancoDeVagasPage").then((m) => ({ default: m.BancoDeVagasPage }))));
const MeusCadastrosPage = lazy(importarPagina(() => import("./pages/ei/MeusCadastrosPage").then((m) => ({ default: m.MeusCadastrosPage }))));
const MinhasEmpresasPage = lazy(importarPagina(() => import("./pages/ei/MinhasEmpresasPage").then((m) => ({ default: m.MinhasEmpresasPage }))));
const EmpresaPublicaPage = lazy(importarPagina(() => import("./pages/ei/EmpresaPublicaPage").then((m) => ({ default: m.EmpresaPublicaPage }))));
const FavoritosPage = lazy(importarPagina(() => import("./pages/ei/FavoritosPage").then((m) => ({ default: m.FavoritosPage }))));
const PlanosEmpresaPage = lazy(importarPagina(() => import("./pages/PlanosEmpresaPage").then((m) => ({ default: m.PlanosEmpresaPage }))));
const ReembolsoPage = lazy(importarPagina(() => import("./pages/ei/ReembolsoPage").then((m) => ({ default: m.ReembolsoPage }))));
const DenunciarPage = lazy(importarPagina(() => import("./pages/ei/DenunciarPage").then((m) => ({ default: m.DenunciarPage }))));
const MeuDesempenhoPage = lazy(importarPagina(() => import("./pages/ei/MeuDesempenhoPage").then((m) => ({ default: m.MeuDesempenhoPage }))));
const DestaquePage = lazy(importarPagina(() => import("./pages/ei/DestaquePage").then((m) => ({ default: m.DestaquePage }))));
const DestaqueDaVagaPage = lazy(importarPagina(() => import("./pages/ei/DestaqueDaVagaPage").then((m) => ({ default: m.DestaqueDaVagaPage }))));
const OndasDaVagaPage = lazy(importarPagina(() => import("./pages/OndasDaVagaPage").then((m) => ({ default: m.OndasDaVagaPage }))));
const InteressadosDaVagaPage = lazy(importarPagina(() => import("./pages/InteressadosDaVagaPage").then((m) => ({ default: m.InteressadosDaVagaPage }))));
const DetalheVagaPage = lazy(importarPagina(() => import("./pages/DetalheVagaPage").then((m) => ({ default: m.DetalheVagaPage }))));
const PerfilPublicoPage = lazy(importarPagina(() => import("./pages/PerfilPublicoPage").then((m) => ({ default: m.PerfilPublicoPage }))));
/* A vaga vista por QUEM PROCURA. É outra tela que a `/vaga/:id`, que é o
   painel de quem anunciou (ondas, alcance, lista de interessados). Antes só
   existia a do anunciante — a pessoa decidia se queria a vaga sem nunca ter
   lido a vaga inteira. */
const VagaAbertaPage = lazy(importarPagina(() => import("./pages/ei/VagaAbertaPage").then((m) => ({ default: m.VagaAbertaPage }))));
/* O histórico dos disparos que chegaram para esta pessoa. Diferente de
   "Vagas": lá só o que está aberto, para responder; aqui tudo o que chegou,
   inclusive as vagas já encerradas — senão o aviso some e parece engano. */
const AvisosPage = lazy(importarPagina(() => import("./pages/ei/AvisosPage").then((m) => ({ default: m.AvisosPage }))));


/**
 * BottomSheet acessível de qualquer lugar do app (link no rodapé) para
 * enviar sugestões gerais sobre a plataforma — não exige login; quando o
 * usuário está logado, o user_id é capturado automaticamente.
 */
function SuggestionSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!message.trim()) {
      setError("Escreva sua sugestão antes de enviar.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await sendSuggestion(message.trim(), user?.id ?? null);
      setSent(true);
    } catch (err) {
      setError(mensagemDeErro(err, "Não foi possível enviar a sugestão."));
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet
      title="Enviar sugestão"
      subtitle="Ideias, melhorias, categorias que faltam — qualquer feedback sobre o app é bem-vindo."
      onClose={onClose}
    >
      {sent ? (
        <p className="card">Sugestão enviada. Obrigado pela contribuição!</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {/* Rótulo de verdade no lugar do exemplo dentro do campo — a
              dona: "tire todos os exemplos de dentro dos campos do app".
              Texto que some ao começar a digitar deixa de responder
              "o que era mesmo para escrever aqui?" na hora em que a
              pergunta aparece. */}
          <label htmlFor="sugestao-texto">Sua sugestão</label>
          <textarea
            id="sugestao-texto"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
          {error && <p style={{ color: "var(--color-danger)", margin: 0 }}>{error}</p>}
          <button className="btn btn-primary btn-block" onClick={handleSend} disabled={sending}>
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

/* As telas que são APP, e não site.
   ──────────────────────────────────
   Elas têm a barra de baixo e terminam nela, como nos apps que a dona
   mandou de referência — que não têm rodapé nenhum. O rodapé de links
   embaixo de um cartão de vaga era o que sobrava mais visível do procurô:
   três colunas de letra miúda em versalete, links azuis e um botão verde,
   tudo com o desenho do outro app.

   Ele não sumiu do app: continua nas telas longas (documentos, conta),
   onde é rodapé de página de verdade. E nada se perdeu — Termos,
   Privacidade, sugestão e suporte estão em Conta, que é um dos três itens
   da barra. */
const TELAS_DE_APP = [
  "/",
  "/inicio",
  /* `/login` faltava, e o efeito era o mais visível do app inteiro: a tela
     de entrar — a primeira que qualquer pessoa nova lê — terminava com o
     rodapé de SITE embaixo. Três colunas de links, o e-mail de contato e
     um botão verde de WhatsApp que era, de longe, a coisa mais colorida da
     tela: mais chamativo que o próprio botão de entrar, logo acima dele. */
  "/login",
  /* As duas telas do caminho de criar conta, pelo mesmo motivo do
     `/login`: são passo de app, e traziam o rodapé de site — com "Publicar
     vaga" e "Enviar sugestão" — logo abaixo da pergunta de que lado a
     pessoa está. */
  "/onboarding-tipo",
  /* As telas que "Procuro emprego" e "Quero contratar" abrem — mesmo
     motivo das duas linhas acima: são o passo seguinte da mesma
     sequência, e ficariam com o rodapé de site sem esta linha. */
  "/comecar-profissional",
  "/comecar-empresa",
  "/cadastro-empresa",
  "/vagas-para-mim",
  /* O banco de vagas. Sem esta linha ele terminava com o rodapé de SITE
     embaixo da barra do app — três colunas de links e um botão verde de
     WhatsApp, o pedaço mais visível que sobrou do procurô. É o mesmo
     esquecimento que já aconteceu com `/login` e com `/vaga-aberta`. */
  "/vagas",
  "/minhas-empresas",
  "/empresa",
  "/favoritos",
  "/meu-perfil",
  "/painel",
  "/painel-empresa",
  "/criar-vaga",
  "/pronto",
  "/vaga",
  /* `/vaga-aberta` precisa estar escrito à parte: a comparação é por
     caminho exato ou com barra depois, então "/vaga" casa com "/vaga/123" e
     NÃO casa com "/vaga-aberta/123". Sem esta linha, a tela da vaga de quem
     procura trabalho terminava com o rodapé de links do site embaixo da
     barra do app — o pedaço mais visível que sobrou do procurô. */
  "/vaga-aberta",
  "/avisos",
  /* 04/09: faltava, e o sintoma foi o de sempre — a tela de desempenho
     terminava com o rodapé de SITE (três colunas de links e o botão verde
     do WhatsApp) embaixo da barra do app. É o mesmo esquecimento já
     registrado acima para `/vagas` e `/vaga-aberta`. */
  "/meu-desempenho",
  "/destaque",
  "/reembolso",
  "/meus-cadastros",
  "/planos-empresa",
  "/profissionais",
  "/profissional",
  "/perfil",
];

function Footer() {
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const { pathname } = useLocation();

  if (TELAS_DE_APP.some((r) => pathname === r || pathname.startsWith(r + "/"))) return null;

  return (
    <footer className="footer">
      <div className="container">
        <Logo />

        {/* Dois grupos com título, no lugar de cinco links soltos.

            Estavam todos na mesma fileira, do mesmo tamanho e sem ordem:
            "Termos de Uso", "Privacidade", "Como funciona", "Anuncie aqui"
            e "Enviar sugestão", como se fossem cinco coisas do mesmo tipo.
            Não são. Duas são documento que quase ninguém abre por vontade
            própria; três são caminhos que a pessoa pode querer agora. Sem
            essa separação, o rodapé virava uma lista para procurar dentro,
            e foi assim que a dona o descreveu: confuso.

            Depois dos links vinham três parágrafos soltos — aviso
            jurídico, versão, e-mail —, cada um com um tamanho de letra
            diferente, dois deles escritos direto no atributo `style`. Agora
            são duas linhas quietas, do mesmo tamanho, na ordem de quem
            precisa: quem quer falar com alguém primeiro, o resto depois. */}
        <div className="rodape-grupos">
          <nav className="rodape-grupo" aria-label="O Ei Emprego">
            <h2 className="rodape-grupo-titulo">O Ei Emprego</h2>
            {/* "Anuncie aqui" saiu: levava à venda de espaço de banner, que é
                produto do procurô. Quem contrata neste app publica VAGA, e o
                caminho para isso é o plano — que fica no painel da empresa,
                onde ela já está, e não escondido num link de rodapé. */}
            <Link to="/planos-empresa">Publicar vaga</Link>
            <button type="button" onClick={() => setSuggestionOpen(true)}>
              Enviar sugestão
            </button>
          </nav>

          <nav className="rodape-grupo" aria-label="Documentos">
            <h2 className="rodape-grupo-titulo">Documentos</h2>
            <Link to="/termos">Termos de Uso</Link>
            <Link to="/privacidade">Privacidade</Link>
          </nav>

          {/* Contato: o e-mail escrito, e o WhatsApp só no botão.

              O número também aparecia aqui, por extenso. Era repetição: o
              botão logo abaixo abre a mesma conversa, e ninguém digita um
              telefone à mão tendo o toque ao lado. O e-mail fica porque
              não tem botão — e porque pedido sobre dados pessoais costuma
              vir por escrito, com registro. */}
          <nav className="rodape-grupo" aria-label="Contato">
            <h2 className="rodape-grupo-titulo">Contato</h2>
            <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>
          </nav>
        </div>

        <BotaoSuporte />

      </div>
      {suggestionOpen && <SuggestionSheet onClose={() => setSuggestionOpen(false)} />}
    </footer>
  );
}

export default function App() {
  /* ── As boas-vindas do primeiro acesso ────────────────────────────────
     Ficam ANTES de tudo, cobrindo a tela, e não como uma rota: rota teria
     endereço, e endereço vai parar em link compartilhado, em favorito e no
     botão de voltar. Isto não é uma página do app — é a porta, e ela abre
     uma vez só.

     O estado é lido no primeiro render (função dentro do `useState`, não
     efeito depois): com efeito, a tela do app apareceria por um instante
     antes de a porta cobrir, e o primeiro acesso começaria com um susto. */
  const [mostrarBoasVindas, setMostrarBoasVindas] = useState(() => !jaViuAsBoasVindas());

  return (
    <>
      <SplashScreen />
      {mostrarBoasVindas && <BoasVindas aoTerminar={() => setMostrarBoasVindas(false)} />}
      <AppShell>
      <RetomarDestinoLogin />
      <AvisoErroLogin />
      {/* Enquanto a tela pedida chega, o app não pode piscar em branco: a
          barra de baixo e o cabeçalho continuam, e só o miolo espera. */}
      <Suspense fallback={<div className="container" style={{ paddingTop: 48, textAlign: "center" }}>
        <span className="muted">Carregando…</span>
      </div>}>
      <Routes>
        {/* ── O Ei Emprego ───────────────────────────────────────────
            As telas do procurô saíram daqui inteiras: a busca de serviço,
            o perfil público com avaliações, os anúncios, a venda de
            banner, as categorias, os favoritos, as assinaturas de selo e
            destaque, e os relatórios. Eram o produto daquele app.

            Ficou o que é infraestrutura (entrar, conta, documentos,
            administração) e o que é o Ei. */}
        <Route path="/" element={<EntradaPage />} />
        {/* `/inicio` era a tela das duas portas do procurô. Continua
            existindo porque a marca do cabeçalho aponta para ela e há
            links antigos por aí — leva à entrada nova. */}
        <Route path="/inicio" element={<EntradaPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Quem procura trabalho */}
        <Route path="/vagas-para-mim" element={
          <SoDesteLado lado="professional"><VagasParaMimPage /></SoDesteLado>
        } />
        {/* O banco de vagas: tudo que está no ar, para quem quiser procurar
            sozinha — e não só o que a onda escolheu mandar. Ver a
            BancoDeVagasPage. */}
        <Route path="/vagas" element={<BancoDeVagasPage />} />
        <Route path="/meu-perfil" element={
          <SoDesteLado lado="professional"><MeuPerfilPage /></SoDesteLado>
        } />
        {/* `/painel` era o painel do profissional no procurô, com
            assinaturas, destaque e pedidos de contato. O que resta dele
            neste app é o perfil — e é para lá que ele aponta, para não
            quebrar a barra de baixo nem o que já estava aberto no celular
            de alguém. */}
        <Route path="/painel" element={
          <SoDesteLado lado="professional"><MeuPerfilPage /></SoDesteLado>
        } />
        {/* A tela que "Procuro emprego" abre, na porta de entrada — os
            botões que moraram na EntradaPage até 02/09. Ver ComecarPage. */}
        <Route path="/comecar-profissional" element={
          <SoDesteLado lado="professional"><ComecarPage lado="professional" /></SoDesteLado>
        } />

        {/* Quem contrata */}
        {/* ── A TELA ANTIGA DA ESCOLHA VIROU UM DESVIO — 05/09 ────────
            A dona, com o print dela na mão: "que tela é essa?"

            Era a tela de escolher o lado de quando a pergunta vinha
            DEPOIS do login. A reformulação de 04/09 levou as duas portas
            para a tela de entrar, e esta ficou — alcançável, e dizendo
            regras que já não valem ("dá para trocar de lado a qualquer
            hora, na sua Conta", quando hoje se troca saindo e entrando).

            Duas telas para a mesma pergunta, discordando uma da outra.

            Vira desvio em vez de sumir: o endereço pode estar num
            favorito, no histórico do navegador ou num aviso já enviado, e
            "página não encontrada" seria trocar uma tela errada por um
            beco. */}
        <Route path="/onboarding-tipo" element={<Navigate to="/login" replace />} />
        {/* O par de cima: a tela que "Quero contratar" abre. */}
        <Route path="/comecar-empresa" element={
          <SoDesteLado lado="company"><ComecarPage lado="company" /></SoDesteLado>
        } />
        <Route path="/cadastro-empresa" element={
          <SoDesteLado lado="company"><CadastroEmpresaPage /></SoDesteLado>
        } />
        <Route path="/painel/editar-empresa" element={
          <SoDesteLado lado="company"><CadastroEmpresaPage /></SoDesteLado>
        } />
        {/* A escolha de qual empresa abrir, quando a conta tem mais de
            uma (itens 3, 4 e 6). Com uma só ela desvia sozinha para o
            painel — ver MinhasEmpresasPage. */}
        {/* A mesma pergunta do lado da empresa, do lado de quem procura
            trabalho: qual cadastro eu abro agora? Ver MeusCadastrosPage. */}
        <Route path="/meus-cadastros" element={
          <SoDesteLado lado="professional"><MeusCadastrosPage /></SoDesteLado>
        } />
        <Route path="/minhas-empresas" element={
          <SoDesteLado lado="company"><MinhasEmpresasPage /></SoDesteLado>
        } />
        <Route path="/painel-empresa" element={
          <SoDesteLado lado="company"><PainelEmpresaPage /></SoDesteLado>
        } />
        <Route path="/criar-vaga" element={
          <SoDesteLado lado="company"><CriarVagaPage /></SoDesteLado>
        } />
        {/* "Deu certo" — a confirmação depois de salvar. Ver ProntoPage. */}
        <Route path="/pronto" element={<ProntoPage />} />
        {/* A MESMA tela de criar, no modo edição — ver CriarVagaPage. */}
        <Route path="/vaga/:id/editar" element={
          <SoDesteLado lado="company"><CriarVagaPage /></SoDesteLado>
        } />
        {/* Os dois assuntos que saíram da tela da vaga em 04/09 — ver o
            comentário das duas portas em `DetalheVagaPage`. */}
        {/* Dois endereços para a mesma tela: ela deixou de se chamar
            "Ondas" quando passou a mostrar as pessoas (04/09), e o
            endereço antigo continua valendo — quem tiver o link guardado
            ou o app aberto numa aba velha não cai num "não encontrado". */}
        <Route path="/vaga/:id/compativeis" element={
          <SoDesteLado lado="company"><OndasDaVagaPage /></SoDesteLado>
        } />
        <Route path="/vaga/:id/ondas" element={
          <SoDesteLado lado="company"><OndasDaVagaPage /></SoDesteLado>
        } />
        <Route path="/vaga/:id/interessados" element={
          <SoDesteLado lado="company"><InteressadosDaVagaPage /></SoDesteLado>
        } />
        <Route path="/vaga/:id" element={
          <SoDesteLado lado="company"><DetalheVagaPage /></SoDesteLado>
        } />
        <Route path="/planos-empresa" element={
          <SoDesteLado lado="company"><PlanosEmpresaPage /></SoDesteLado>
        } />
        {/* O pedido de reembolso é tela própria (ver ReembolsoPage): quem
            quer desfazer uma compra não deve ter de pedir isso no meio de
            uma tela que mostra três preços. */}
        <Route path="/reembolso" element={<ReembolsoPage />} />
        {/* A denúncia de uma vaga ou de um cadastro. Ela vai para a seção
            "Denúncias" do painel, com motivo e descrição — antes ia para o
            WhatsApp, e lá não havia fila nem botão de tirar do ar. Ver
            DenunciarPage. Sem `SoDesteLado`: quem contrata denuncia um
            cadastro e quem procura emprego denuncia uma vaga, e a mesma
            conta pode ser os dois lados. */}
        <Route path="/denunciar/:tipo/:id" element={<DenunciarPage />} />
        {/* Os números de quem procura trabalho (ver MeuDesempenhoPage). */}
        <Route path="/meu-desempenho" element={
          <SoDesteLado lado="professional"><MeuDesempenhoPage /></SoDesteLado>
        } />
        {/* ── O DESTAQUE NÃO É DE UM LADO SÓ — 05/09 ─────────────────
            Esta rota estava presa em `SoDesteLado lado="company"`, e a
            tela que ela abre é o destaque de QUEM PROCURA EMPREGO. Ou
            seja: a única pessoa que compra aquilo era a única que não
            conseguia chegar lá — tocar em "Apareça aqui" no banco de
            talentos, ou em "Aparecer primeiro" no desempenho, jogava a
            pessoa de volta. Um recurso pago, invisível para quem paga.

            Sem trava dos dois lados: a mesma conta pode ser as duas
            coisas, e quem entrou como empresa e também tem cadastro de
            profissional pode querer destacar o próprio cadastro. Sem
            cadastro, a própria tela explica e leva a preencher.

            Nenhuma das duas existe dentro do app da Play Store
            (`podeVender`). */}
        <Route path="/destaque" element={<DestaquePage />} />
        {/* O destaque pago de uma VAGA — a página que a dona pediu:
            "explica os benefícios e tem um botão para o pagamento". */}
        <Route path="/destaque-da-vaga" element={<DestaqueDaVagaPage />} />
        <Route path="/profissionais" element={<ProfissionaisPage />} />
        {/* O perfil de uma pessoa, visto por quem contrata. É a metade
            gratuita da oferta da empresa — ver e falar um a um — e não
            existia: a lista não levava a lugar nenhum. */}
        <Route path="/profissional/:id" element={<PerfilPublicoPage />} />
        <Route path="/vaga-aberta/:id" element={
          <SoDesteLado lado="professional"><VagaAbertaPage /></SoDesteLado>
        } />
        {/* A empresa vista por quem procura trabalho, com as vagas dela no
            ar. Ver EmpresaPublicaPage. */}
        <Route path="/empresa/:id" element={<EmpresaPublicaPage />} />
        {/* Empresas e candidatos guardados, na mesma tela: a mesma conta
            pode ser os dois lados. Ver FavoritosPage. */}
        <Route path="/favoritos" element={<FavoritosPage />} />
        <Route path="/avisos" element={<AvisosPage />} />

        {/* Conta e documentos */}
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/configuracao" element={<ConfiguracaoPage />} />
        <Route path="/termos" element={<TermosPage />} />
        <Route path="/como-funciona" element={<ComoFuncionaPage />} />
        <Route path="/privacidade" element={<PrivacidadePage />} />
        <Route path="/excluir-conta" element={<ExcluirContaPage />} />
        {/* Sem link em lugar nenhum: existe para depurar login a distância. */}
        <Route path="/diagnostico" element={<DiagnosticoPage />} />

        {/* Administração */}
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/:secao" element={<AdminPage />} />
        {/* Consertar um cadastro pela administração — uma palavra errada,
            uma foto de lado. Fica FORA de `/admin/:secao` porque leva um id
            junto, e a seção é só o nome da lista. */}
        <Route path="/admin/corrigir/:tipo/:id" element={<AdminPage />} />
      </Routes>
      </Suspense>
      <Footer />
      </AppShell>
      <AvisoDeDados />
    </>
  );
}
