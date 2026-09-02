import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  empresaAtual,
  criarVaga,
  abrirOnda,
  calcularOndas,
  situacaoDoPlano,
  anunciarVaga,
} from "../lib/company";
import {
  CATEGORIES,
  DEFAULT_CITY,
  DEFAULT_UF,
  DIAS_ANUNCIO_VAGA,
  ONDAS,
  ONDAS_POR_VAGA,
  BENEFICIOS_SUGERIDOS,
  CAMPOS_DE_COMPATIBILIDADE,
  PERIODOS_DE_SALARIO,
  JORNADAS,
  TIPOS_DE_CONTRATO,
  type Jornada,
  type JobListing,
  type TipoContrato,
  type WaveNumber,
  type WorkModality,
} from "../types/domain";
import { podeVender } from "../lib/plataforma";
import { mensagemDeErro } from "../lib/erros";
import { Callout, Pagina } from "../components/ei/Pagina";
import { Etapas } from "../components/ei/Etapas";

/* `anunciada_ate` fica de fora: ela é gravada depois que a vaga existe, por
   `anunciarVaga`. O plano é que dá direito ao anúncio — quem não tem plano
   não chega nem a criar a vaga (migration 0073). */
type FormState = Omit<
  JobListing,
  "id" | "created_at" | "closed_at" | "status" | "anunciada_ate"
>;

const EMPTY_FORM: FormState = {
  company_id: "",
  title: "",
  description: "",
  profession: "",
  specialty: null,
  required_experience: null,
  skills: [],
  salary_range_min: null,
  salary_range_max: null,
  available_immediately: true,
  work_modality: "presencial",
  city: DEFAULT_CITY,
  uf: DEFAULT_UF,
  neighborhood: null,
  tipo_contrato: null,
  jornada: null,
  beneficios: [],
  salario_a_combinar: false,
  /* Mês, que é o caso da maioria das vagas com carteira. Um período em
     branco faria a tela escolher um por conta própria, e escolher errado
     é o que o campo existe para evitar. */
  salario_periodo: "mes",
  /* ── A VAGA INTEIRA (migration 0105, item 15) ─────────────────────
     Os campos que a dona listou por tema. Os padrões não são neutros:

     `quantidade_vagas` começa em 1 porque é o caso comum, e "2 vagas"
     muda quem responde — numa vaga só, quem se acha segundo colocado nem
     tenta.

     `aceita_outras_cidades` começa em TRUE, e isso é uma decisão:
     Itabirito faz par com Ouro Preto, Moeda e Rio Acima todo dia. Fechar
     por omissão cortaria metade de quem serviria, sem ninguém ter
     marcado nada. */
  quantidade_vagas: 1,
  data_inicio: null,
  prazo_candidatura: null,
  horario: null,
  escala: null,
  aceita_outras_cidades: true,
  comissao: null,
  outros_beneficios: null,
  escolaridade_minima: null,
  curso_especifico: null,
  cnh_exigida: false,
  cnh_categorias: [],
  exige_viagem: false,
  idiomas: [],
  observacoes: null,
  /* Lista vazia = a empresa não escolheu, e vale a comparação padrão
     (função e cidade). É diferente de uma lista com um item só. */
  campos_compatibilidade: [],
  aceita_sem_compatibilidade: true,
};

/* ── OS TEMAS DA VAGA (item 13) ──────────────────────────────────────
   A dona: "a tela de abertura de vaga está horrível, seguir o mesmo
   esquema do cadastro da empresa em sequência de telas por tema."

   Ela estava certa por dois motivos, e o segundo é o que mais custava.

   O primeiro é o tamanho: eram TREZE campos empilhados numa coluna só —
   título, profissão, especialidade, descrição, contrato, jornada,
   experiência, modalidade, urgência, benefícios, "a combinar", salário
   mínimo e máximo. Num celular são cinco dobras de rolagem antes de
   qualquer botão, e a empresa desiste no meio.

   O segundo é que esta tela nunca saiu do visual do procurô: `container`,
   `card`, `btn btn-primary`, cores por `style` inline. Era a única tela do
   lado da empresa ainda no desenho antigo, e por isso parecia de outro
   app — que é exatamente a palavra que ela usou.

   Os nomes dos temas são os que ela escreveu no item 15, na ordem dela.
   Os campos de cada um também: o que ainda não existe no banco entra
   quando a 0105 for aplicada, e o lugar dele já está reservado aqui. */
const ETAPAS = [
  "Sobre a vaga",
  "Horário e local",
  "Salário",
  "Requisitos",
  "Compatibilidade",
];

/**
 * Criar uma vaga de trabalho.
 *
 * Dois passos: o formulário (em etapas por tema) e a conferência. Na conferência a tela mostra
 * quantas pessoas cada onda alcançaria — números lidos do banco, não
 * estimados. Uma versão anterior desta tela sorteava os três números com
 * `Math.random()` para "ilustrar", e ilustração com cara de dado é a
 * mentira mais barata que existe: a empresa decidiria disparar olhando um
 * número que não veio de lugar nenhum.
 *
 * Ao confirmar, **só a onda 1 abre**. As outras duas ficam esperando um
 * toque na tela da vaga — ver `ONDAS` e o cabeçalho da migration 0068.
 */
export function CriarVagaPage() {
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [passo, setPasso] = useState<"formulario" | "preview">("formulario");
  /* Em qual tema a empresa está. Começa no 1 e nunca pula: cada um confere
     o que é dele antes de deixar seguir, para o erro aparecer ao lado do
     que acabou de ser digitado — e não quatro telas adiante, no clique de
     publicar, como acontecia antes. */
  const [etapa, setEtapa] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [ondaPreview, setOndaPreview] = useState<Array<{ onda: WaveNumber; novos: number }>>([]);

  /* A segunda onda desta vaga, se a empresa quiser usá-la já.
     ────────────────────────────────────────────────────────
     Cada vaga tem direito a `ONDAS_POR_VAGA` ondas; a 1 sai na criação, e
     sobra uma. `null` = guardar para depois, que é o padrão: avisar mais
     gente do que o necessário é a única decisão desta tela que não dá para
     desfazer, então ela é sempre um ato, nunca um esquecimento. */
  const [ondaExtra, setOndaExtra] = useState<2 | 3 | null>(null);

  /* O anúncio vem junto do plano, então nasce MARCADO: quem pagou para
     publicar quer ser encontrado, e desmarcado por padrão ele viraria um
     benefício que a maioria nunca liga. Continua sendo escolha porque nem
     toda contratação é para se expor — substituir alguém que ainda está na
     empresa é o caso de avisar só quem encaixa, sem cartaz. */
  const [anunciar, setAnunciar] = useState(true);

  /* O que a empresa está escrevendo no campo livre de benefício, antes de
     apertar Enter. Fica fora do `form` porque não é dado da vaga — é
     rascunho de tela. */
  const [beneficioNovo, setBeneficioNovo] = useState("");

  const [plano, setPlano] = useState<{
    limite: number;
    abertas: number;
    temPlano: boolean;
    cabeMais: boolean;
  } | null>(null);
  const [empresaConfirmada, setEmpresaConfirmada] = useState(false);

  useEffect(() => {
    if (carregandoConta || !user) return;

    /* `empresaAtual` e não "a minha empresa": desde a 0102 a conta pode
       ter várias, e a vaga é publicada na que está SELECIONADA na tela de
       escolha. Ver o comentário em obterMinhaEmpresa, que saiu por isto. */
    empresaAtual(user.id).then((empresa) => {
      if (!empresa) {
        navegar("/cadastro-empresa", { replace: true });
        return;
      }
      setForm((f) => ({
        ...f,
        company_id: empresa.id,
        city: empresa.city,
        uf: empresa.uf,
        neighborhood: empresa.neighborhood,
      }));

      /* O telefone da empresa também precisa estar confirmado. Vale para
         todo mundo, e aqui tem uma razão a mais: quem responde à vaga vai
         procurar essa empresa de volta, e um número não provado do lado de
         quem contrata é onde mora o golpe do falso emprego. */
      setEmpresaConfirmada(empresa.phone_verified);
      if (!empresa.phone_verified) {
        setErro(
          "Confirme o telefone da sua empresa antes de publicar vagas. " +
            "Dá para fazer isso no seu painel, no aviso do topo."
        );
      }

      /* O plano é buscado AQUI, ao abrir a tela, e não no fim: a empresa
         precisa saber que o plano dela já está cheio antes de escrever a
         vaga inteira, não depois de confirmar. */
      situacaoDoPlano(empresa.id)
        .then(setPlano)
        .catch(() => {
          /* Sem a resposta, a tela continua funcionando — quem realmente
             recusa o anúncio é o banco. Deixar `null` faz o aviso sumir em
             vez de mostrar "0 de 1", que seria um número inventado no lugar
             de um que não se sabe. */
          setPlano(null);
        });
    });
  }, [user, carregandoConta, navegar]);

  async function previsualizarOndas() {
    setErro("");

    /* ── A vaga tem que sair completa ─────────────────────────────────
       A dona: "tem que ter todos os campos descritos."

       Eram dois campos obrigatórios de nove. Dava para publicar "Vendedor"
       + categoria e mais nada — e uma vaga assim chega em dezenas de
       celulares sem dizer se é registrado, que horário nem quanto paga. A
       pessoa responde no escuro, ou não responde.

       Cada recusa aponta O CAMPO e diz por que ele importa. "Preencha os
       campos obrigatórios" manda a empresa procurar sozinha qual é. */
    /* Um campo só desde 02/09: `title` e `profession` são preenchidos
       juntos, então uma recusa basta — e ela nomeia o campo como ele está
       escrito na tela. Duas mensagens para um campo mandavam a empresa
       procurar um segundo que não existe mais. */
    if (!form.profession.trim()) {
      setErro("Escreva qual profissional você procura — é a primeira linha que a pessoa lê.");
      return;
    }

    if (!form.description.trim()) {
      setErro("Escreva o que a pessoa vai fazer no dia a dia. Sem isso quase ninguém responde.");
      return;
    }

    if (!form.tipo_contrato) {
      setErro("Diga se é registrado em carteira, diária, temporário ou freelance.");
      return;
    }

    if (!form.jornada) {
      setErro("Diga o horário. Quem tem filho na escola ou outro trabalho decide por aqui.");
      return;
    }

    /* Salário: ou um valor, ou "a combinar" escrito. O que não pode é o
       silêncio — em branco some da tela e vira indistinguível de
       esquecimento, e salário ausente é o que mais faz gente não responder. */
    if (
      !form.salario_a_combinar &&
      form.salary_range_min == null &&
      form.salary_range_max == null
    ) {
      setErro("Informe o salário, ou marque “a combinar”. Vaga sem essa resposta quase não recebe gente.");
      return;
    }

    if (
      form.salary_range_min != null &&
      form.salary_range_max != null &&
      form.salary_range_max < form.salary_range_min
    ) {
      setErro("O salário máximo está menor que o mínimo. Confira os dois valores.");
      return;
    }

    setConferindo(true);
    try {
      /* A vaga ainda não existe no banco — a contagem é feita sobre o que
         está no formulário. Os campos que `calcularOndas` lê (cidade,
         estado, profissão, especialidade) já estão todos preenchidos aqui. */
      const ondas = await calcularOndas(form as JobListing);
      setOndaPreview(ondas.map(({ onda, novos }) => ({ onda, novos })));
      setPasso("preview");
    } catch (err) {
      /* Contagem que falha não é contagem zero. Mostrar "0 profissionais"
         quando o banco recusou a consulta faria a empresa concluir que não
         há ninguém na cidade — e desistir de uma vaga que teria enchido. */
      setErro(mensagemDeErro(err, "Não foi possível contar os profissionais."));
    } finally {
      setConferindo(false);
    }
  }

  async function confirmarEAbrirPrimeiraOnda() {
    /* A trava de verdade, e não só o aviso lá de cima. Sem esta linha o
       aviso seria decoração: a empresa leria "confirme o telefone" e
       publicaria a vaga do mesmo jeito, tocando o botão de baixo.

       Quem recusa de verdade é o banco — a policy de INSERT em
       `job_listings` exige `phone_verified` (migration 0071). Esta linha
       existe para a empresa ler uma frase que explica, em vez de um erro de
       permissão que não diz o que fazer. */
    if (!empresaConfirmada) {
      setErro(
        "Confirme o telefone da sua empresa antes de publicar. " +
          "É por ele que os profissionais vão te procurar de volta."
      );
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const vaga = await criarVaga({ ...form, status: "active" });

      /* A onda 1 sempre sai — é o disparo. As outras só se a empresa
         marcou, e em ordem: a 2 antes da 3, porque cada onda desconta quem
         as anteriores já alcançaram, e fora de ordem a conta sai errada. */
      await abrirOnda(vaga, 1);
      if (ondaExtra) await abrirOnda(vaga, ondaExtra);

      /* O anúncio depois do disparo, e não antes: se a gravação do anúncio
         falhar, a vaga já saiu para as pessoas — que é o que a empresa veio
         fazer. Na ordem inversa, um erro no disparo deixaria uma vaga
         anunciada que nunca avisou ninguém.

         Sem `podeVender()` aqui: o anúncio deixou de ser compra à parte e
         virou parte do plano, então marcá-lo dentro do app da loja não é
         venda nenhuma — é usar o que já foi pago. */
      if (anunciar) {
        await anunciarVaga(vaga.id);
      }

      navegar(`/vaga/${vaga.id}`, { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível criar a vaga."));
      setSalvando(false);
    }
  }

  if (carregandoConta) {
    return <div className="container" style={{ paddingTop: 48 }}>
      <span className="muted">Carregando…</span>
    </div>;
  }

  /* Sem plano, o formulário nem abre.
     ─────────────────────────────────
     Deixar escrever a vaga inteira e recusar no fim é a pior forma de
     cobrar: a pessoa fez o trabalho, se animou, e leva um "não" na hora de
     confirmar. Aqui ela sabe antes de digitar a primeira letra.

     E a tela diz o que ela JÁ PODE fazer sem pagar — procurar e falar com
     os profissionais um a um. Sem essa frase, "assine para publicar" soa
     como se o app inteiro estivesse trancado, e ela vai embora sem
     descobrir a busca, que é de graça e resolve o problema de muita gente. */
  if (plano && !plano.temPlano) {
    return (
      /* No visual do resto do app, e não no antigo.
         ───────────────────────────────────────────
         Estas duas telas de bloqueio tinham ficado para trás no redesenho:
         `container`, `card`, botão laranja cheio — o único laranja gritante
         que sobrou no app. E é a tela que a empresa vê quando leva um
         "não": justo nela o app parecia outro produto, o que faz um
         bloqueio comum parecer defeito.

         O caminho de saída também é o mesmo: cabeçalho de página, aviso e
         a fila de ações. Nada aqui é decoração — o que muda é a empresa
         reconhecer onde está. */
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Precisa de um plano" voltar="/painel-empresa">
            {/* "por SMS" era MENTIRA, e a única do app.
                ─────────────────────────────────────────
                O aviso de vaga sempre foi notificação no celular — a
                `enviar-avisos-de-vaga` manda por Firebase no app da loja e
                por Web Push no site, e não há uma linha de código que mande
                torpedo de vaga. SMS no Ei Itabirito existe só para o código
                de entrar.

                Prometer SMS aqui criava dois problemas de uma vez: a
                empresa comprava esperando uma coisa que o app não faz, e
                quem não instalou o app achava que seria avisado do mesmo
                jeito — e ficava esperando um torpedo que nunca vem. */}
            <p className="ei-corpo ei-margem">
              Com o plano, sua vaga vira notificação no celular de quem faz aquele
              serviço na cidade, e as pessoas interessadas chegam até você.
            </p>
          </Pagina>

          <Callout>
            <strong>Sem plano você já pode, agora:</strong> ver e procurar todos os
            profissionais de Itabirito, e falar com cada um direto, pelo telefone que
            está no cadastro. É grátis e não precisa nem de conta — o plano serve para
            não ter que chamar um por um.
          </Callout>

          <div className="ei-margem" style={{ display: "grid", gap: 10, marginTop: 18 }}>
            {podeVender() && (
              <button
                type="button"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                onClick={() => navegar("/planos-empresa")}
              >
                Ver os planos
              </button>
            )}
            <button
              type="button"
              className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
              onClick={() => navegar("/profissionais")}
            >
              Procurar profissionais
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* Plano cheio: mesma ideia, motivo diferente. E o caminho de saída é
     fechar uma vaga, não pagar mais — quem já paga não deve ser empurrado
     para o upgrade antes de saber que basta fechar a que já encheu. */
  if (plano && plano.temPlano && !plano.cabeMais) {
    return (
      <div className="ei">
        <div className="ei-tela">
          {/* O título dizia "Suas vagas já estão todas abertas" — que lido
              rápido soa a elogio, e não a "não dá para abrir mais uma". A
              empresa veio publicar; o título tem que dizer o que houve com
              o que ela veio fazer. */}
          <Pagina titulo="O plano já está cheio" voltar="/painel-empresa">
            <p className="ei-corpo ei-margem">
              Seu plano permite {plano.limite}{" "}
              {plano.limite === 1 ? "vaga aberta" : "vagas abertas"} por vez, e{" "}
              {plano.limite === 1 ? "ela já está no ar" : "todas já estão no ar"}. Feche
              uma que já encheu para abrir outra — ou mude de plano.
            </p>
          </Pagina>

          <div className="ei-margem" style={{ display: "grid", gap: 10, marginTop: 18 }}>
            <button
              type="button"
              className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
              onClick={() => navegar("/painel-empresa")}
            >
              Ver minhas vagas
            </button>
            {podeVender() && (
              <button
                type="button"
                className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
                onClick={() => navegar("/planos-empresa")}
              >
                Ver os planos
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /** Esta etapa está visível? Fora do modo de etapas, todas estão. */
  const mostra = (n: number) => passo !== "formulario" || etapa === n;

  /**
   * O que cada tema exige para deixar seguir. Devolve o erro, ou "".
   *
   * A conferência mudou de lugar junto com as etapas. Antes tudo era
   * conferido no clique de publicar: quem esquecia o salário descobria
   * depois de preencher treze campos, e ainda tinha de achar qual era.
   * Agora o erro aparece ao lado do que acabou de ser digitado.
   */
  function conferirEtapa(n: number): string {
    if (n === 1) {
      if (!form.profession.trim()) return "Escreva qual profissional você procura.";
      if (!form.description.trim()) return "Escreva o que a pessoa vai fazer.";
      /* Prazo depois do início é erro de digitação, e é silencioso: a vaga
         sai do banco de vagas antes de a empresa entender por quê. O banco
         também recusa (0105), mas aqui o erro aparece ao lado dos campos
         em vez de chegar como texto técnico no fim. */
      if (
        form.data_inicio &&
        form.prazo_candidatura &&
        form.prazo_candidatura > form.data_inicio
      ) {
        return "O prazo para receber candidatura tem que ser ANTES do começo.";
      }
    }
    if (n === 2) {
      if (!form.tipo_contrato) return "Diga como é a contratação.";
      if (!form.jornada) return "Diga que horário é.";
    }
    if (n === 3) {
      /* Ou um valor, ou "a combinar" — nunca os dois em branco. Salário
         ausente some da tela e vira indistinguível de esquecimento, e é o
         que mais faz gente não responder. */
      if (!form.salario_a_combinar && !form.salary_range_min)
        return "Escreva o salário, ou marque “a combinar”.";
      if (
        form.salary_range_min &&
        form.salary_range_max &&
        form.salary_range_max < form.salary_range_min
      )
        return "O valor máximo não pode ser menor que o mínimo.";
    }
    return "";
  }

  function continuarEtapa() {
    const problema = conferirEtapa(etapa);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro("");
    setEtapa((e) => e + 1);
    /* Volta ao topo: sem isto, quem rolou até o fim de uma etapa começa a
       seguinte no meio dela, e parece que nada mudou. */
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="ei">
      <div className="ei-tela criar-vaga">
        <Pagina titulo="Nova vaga" voltar="/painel-empresa" />

        {passo === "formulario" && <Etapas passos={ETAPAS} atual={etapa} />}

        {erro && (
          <p className="ei-campo-erro ei-margem" role="alert">{erro}</p>
        )}

      {passo === "formulario" ? (
        // FORMULÁRIO, em etapas por tema
        <>
          {/* Cada campo tem uma linha embaixo dizendo O QUE ESCREVER e
              POR QUE importa.
              ──────────────────────────────────────────────────────────
              A dona: "tem que ter todos os campos descritos", com
              "explicações breves". Antes havia só o nome do campo —
              "Especialidade", "Experiência requerida" —, e nome de campo
              não ensina nada a quem nunca publicou uma vaga.

              A explicação diz a consequência, e não a regra: "sem isso
              quase ninguém responde" faz a empresa preencher; "campo
              obrigatório" faz ela procurar um jeito de pular. */}

        {/* ── 1. Sobre a vaga ────────────────────────────────────────── */}
        {mostra(1) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Sobre a vaga</h2>
            <p className="ei-etapa-apoio">
              É o que aparece primeiro para quem procura trabalho.
            </p>

          {/* ── UM CAMPO SÓ, E NÃO DOIS DIZENDO O MESMO — 02/09 ───────
              A dona: "no cadastro da vaga está redundante qual profissão
              procura e qual profissão é. Troque por qual profissional você
              procura."

              Estava mesmo. Eram dois campos seguidos — "Qual profissional
              você procura?" e "Que profissão é?" — e a resposta honesta
              dos dois é a mesma palavra: "Vendedor". A empresa escrevia
              "Vendedor", lia a pergunta seguinte, e ficava procurando que
              diferença o app esperava. Quem inventasse uma diferença para
              justificar o segundo campo ("Vendedor de loja") estragava a
              busca sem saber: é ele, e não o primeiro, que a onda compara
              com o cadastro de quem procura trabalho.

              Agora é um campo, e ele preenche os dois por baixo: o título
              da vaga e o ofício que a onda procura passam a ser sempre a
              mesma palavra — que é o que já acontecia quando alguém
              respondia direito.

              O `input` com `list` fica: escreve-se à vontade e o navegador
              oferece a lista enquanto se digita. A lista tem 80 ofícios do
              outro produto e não cobre "auxiliar de produção" nem
              "operador de empilhadeira" — e a dona já tinha pedido que
              desse para escrever ("pode ser que a vaga não tenha na
              lista"). O que diferencia uma vaga da outra dentro do mesmo
              ofício é a Especialidade, logo abaixo. */}
          <div className="ei-campo">
            <label htmlFor="profession">Qual profissional você procura? *</label>
            <span className="ei-campo-ajuda">
              É a primeira linha que a pessoa lê. Não achou na lista? Escreva do seu jeito.
            </span>
            <input
              id="profession"
              type="text"
              list="lista-profissoes"
              autoComplete="off"
              placeholder="Ex: Vendedor, Recepcionista, Eletricista"
              value={form.profession}
              onChange={(e) =>
                setForm((f) => ({ ...f, profession: e.target.value, title: e.target.value }))
              }
            />
            <datalist id="lista-profissoes">
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="ei-campo">
            <label htmlFor="specialty">Especialidade (opcional)</label>
            <span className="ei-campo-ajuda">
              Deixe em branco se qualquer um do ofício serve.
            </span>
            <input
              id="specialty"
              type="text"
              placeholder="Ex: Vendas em loja de roupas"
              value={form.specialty || ""}
              onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value || null }))}
            />
          </div>

          <div className="ei-campo">
            <label htmlFor="description">O que a pessoa vai fazer? *</label>
            <span className="ei-campo-ajuda">
              Duas ou três linhas. Vaga sem isso quase não recebe resposta.
            </span>
            <textarea
              id="description"
              placeholder="Ex: Atender no balcão, organizar as prateleiras e fechar o caixa no fim do dia."
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Quantidade e as duas datas (item 15, colunas da 0105).
              "2 vagas" muda quem responde: numa vaga só, quem se acha
              segundo colocado nem tenta. E as datas são o que a pessoa
              pergunta no telefonema — o telefonema que o app existe para
              não desperdiçar. */}
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10 }}>
            <div className="ei-campo">
              <label htmlFor="quantidade_vagas">Quantas vagas</label>
            <span className="ei-campo-ajuda">
              Sem prazo, a vaga fica no ar até você fechar.
            </span>
            <input
                id="quantidade_vagas"
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                value={form.quantidade_vagas}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    /* Nunca abaixo de 1: o banco recusa com um `check`, e a
                       recusa chegaria como texto técnico na hora de
                       publicar, depois de quatro telas preenchidas. */
                    quantidade_vagas: Math.max(1, Math.min(999, Number(e.target.value) || 1)),
                  }))
                }
              />
            </div>
            <div className="ei-campo">
              <label htmlFor="data_inicio">Começa quando</label>
              <input
                id="data_inicio"
                type="date"
                value={form.data_inicio ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value || null }))}
              />
            </div>
          </div>

          <div className="ei-campo">
            <label htmlFor="prazo_candidatura">Recebe candidatura até</label>
            <input
              id="prazo_candidatura"
              type="date"
              value={form.prazo_candidatura ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, prazo_candidatura: e.target.value || null }))
              }
            />
          </div>

          </section>
        )}

        {/* ── 2. Horário e local ─────────────────────────────────────── */}
        {mostra(2) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Horário e local</h2>
            <p className="ei-etapa-apoio">
              As perguntas que fazem alguém desistir sem nunca ter ligado.
            </p>

          {/* Tipo de contrato e jornada são NOVOS, e são as duas perguntas
              que mais decidem se alguém responde. Antes não existiam em
              campo nenhum: quem procurava só descobria no telefonema se a
              vaga era registrada ou diária, integral ou de fim de semana —
              e o telefonema é justamente o que o app existe para não
              desperdiçar. */}
          <div className="ei-campo">
            <label htmlFor="tipo_contrato">Como é a contratação? *</label>
            <span className="ei-campo-ajuda">
              Quase toda vaga aqui é no local.
            </span>
            <select
              id="tipo_contrato"
              value={form.tipo_contrato || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, tipo_contrato: (e.target.value || null) as TipoContrato | null }))
              }
            >
              <option value="">Escolha</option>
              {TIPOS_DE_CONTRATO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="ei-campo">
            <label htmlFor="jornada">Que horário? *</label>
            <select
              id="jornada"
              value={form.jornada || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, jornada: (e.target.value || null) as Jornada | null }))
              }
            >
              <option value="">Escolha</option>
              {JORNADAS.map((j) => (
                <option key={j.valor} value={j.valor}>
                  {j.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="ei-campo">
            <label htmlFor="work_modality">Onde a pessoa trabalha?</label>
            <select
              id="work_modality"
              value={form.work_modality}
              onChange={(e) => setForm((f) => ({ ...f, work_modality: e.target.value as WorkModality }))}
            >
              <option value="presencial">No local da empresa</option>
              <option value="remoto">De casa</option>
              <option value="hibrido">Parte no local, parte de casa</option>
            </select>
          </div>

          {/* Horário e escala em TEXTO, e não em lista (item 15, 0105).
              `jornada`, logo acima, já classifica em integral, meio
              período e turnos. Aqui é o "8h às 18h, de segunda a sexta" e
              o "12x36" que ninguém consegue escolher numa lista — e uma
              lista fechada faria a empresa marcar a opção mais parecida,
              com o candidato descobrindo a verdade depois. */}
          <div className="ei-campo">
            <label htmlFor="horario">Que horas entra e sai?</label>
            <span className="ei-campo-ajuda">
              Ouro Preto e Rio Acima ficam a meia hora.
            </span>
            <input
              id="horario"
              type="text"
              placeholder="8h às 18h, de segunda a sexta"
              value={form.horario ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value || null }))}
            />
          </div>

          <div className="ei-campo">
            <label htmlFor="escala">Escala (se tiver)</label>
            <input
              id="escala"
              type="text"
              placeholder="6x1, 12x36, de segunda a sábado"
              value={form.escala ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, escala: e.target.value || null }))}
            />
          </div>

          {/* Aceita gente de fora: marcado por padrão, e isso é decisão.
              Itabirito faz par com Ouro Preto, Moeda e Rio Acima todo dia.
              Fechar por omissão cortaria metade de quem serviria, sem
              ninguém ter marcado nada. */}
          <div className="ei-campo">
            <label className="ei-caixa">
              <input
                type="checkbox"
                checked={form.aceita_outras_cidades}
                onChange={(e) =>
                  setForm((f) => ({ ...f, aceita_outras_cidades: e.target.checked }))
                }
              />
              <span>Aceito candidato de outras cidades</span>
            </label>
          </div>

          {/* Caixa e texto na mesma linha, e a ajuda embaixo dos dois.
              Sem a moldura, a caixinha flutuava acima do rótulo e a linha
              de ajuda colava no fim dele — "começar logoA vaga ganha a
              etiqueta". */}
          <div className="ei-campo">
            <label className="ei-caixa">
              <input
                type="checkbox"
                checked={form.available_immediately}
                onChange={(e) => setForm((f) => ({ ...f, available_immediately: e.target.checked }))}
              />
              <span>Preciso de alguém para começar logo</span>
            </label>
            <span className="ei-campo-ajuda">
              A vaga ganha a etiqueta “Urgente”.
            </span>
          </div>

          </section>
        )}

        {/* ── 3. Salário e benefícios ────────────────────────────────── */}
        {mostra(3) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Salário e benefícios</h2>
            <p className="ei-etapa-apoio">
              Salário em branco é o que mais faz gente não responder.
            </p>

          {/* Benefícios: sugestões para tocar, e campo livre ao lado.
              Lista fechada não caberia — "cesta básica" e "plano
              odontológico" existem em Itabirito. E vale-transporte decide
              quem mora longe; refeição pesa num salário de piso. */}
          <div className="ei-campo">
            <label htmlFor="beneficio-novo">O que a vaga oferece além do salário?</label>
            <span className="ei-campo-ajuda">
              Vale-transporte decide quem mora longe.
            </span>
            <div className="ei-chips" style={{ marginBottom: 8 }}>
              {BENEFICIOS_SUGERIDOS.map((b) => {
                const marcado = form.beneficios.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    className="ei-chip"
                    /* `aria-pressed` e não uma classe: é assim que o resto
                       do app acende chip, e de quebra o leitor de tela
                       anuncia "marcado" em vez de só ler o texto. */
                    aria-pressed={marcado}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        beneficios: marcado
                          ? f.beneficios.filter((x) => x !== b)
                          : [...f.beneficios, b],
                      }))
                    }
                  >
                    {b}
                  </button>
                );
              })}
            </div>
            {form.beneficios.filter((b) => !BENEFICIOS_SUGERIDOS.includes(b)).length > 0 && (
              <div className="ei-chips" style={{ marginBottom: 8 }}>
                {form.beneficios
                  .filter((b) => !BENEFICIOS_SUGERIDOS.includes(b))
                  .map((b) => (
                    <button
                      key={b}
                      type="button"
                      className="ei-chip"
                      aria-pressed={true}
                      onClick={() =>
                        setForm((f) => ({ ...f, beneficios: f.beneficios.filter((x) => x !== b) }))
                      }
                    >
                      {b} ✕
                    </button>
                  ))}
              </div>
            )}
            <input
              id="beneficio-novo"
              type="text"
              placeholder="Outro benefício — escreva e aperte Enter"
              value={beneficioNovo}
              onChange={(e) => setBeneficioNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                /* Sem isto, o Enter envia o formulário — e a empresa perde
                   o que digitou junto com o benefício que ela ia
                   acrescentar. */
                e.preventDefault();
                const novo = beneficioNovo.trim();
                if (!novo || form.beneficios.includes(novo)) return;
                setForm((f) => ({ ...f, beneficios: [...f.beneficios, novo] }));
                setBeneficioNovo("");
              }}
            />
          </div>

          {/* Comissão em TEXTO (item 15, 0105): "5% sobre a venda" e "R$ 50
              por entrega" não cabem no mesmo número, e é assim que se fala
              de comissão aqui. */}
          <div className="ei-campo">
            <label htmlFor="comissao">Tem comissão?</label>
            <span className="ei-campo-ajuda">
              A vaga vai dizer “A combinar”, que é melhor que não dizer nada.
            </span>
            <input
              id="comissao"
              type="text"
              placeholder="5% sobre a venda, ou R$ 50 por entrega"
              value={form.comissao ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, comissao: e.target.value || null }))}
            />
          </div>

          <div className="ei-campo">
            <label htmlFor="outros_beneficios">Outros benefícios</label>
            <textarea
              id="outros_beneficios"
              rows={2}
              placeholder="Cesta básica, plano odontológico, folga no aniversário"
              value={form.outros_beneficios ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, outros_beneficios: e.target.value || null }))
              }
            />
          </div>

          {/* Não há campo de raio em quilômetros, e não é esquecimento: o
              cadastro de profissional não guarda latitude nem longitude, e
              Itabirito inteira se atravessa em dez minutos. Ver `ONDAS` em
              types/domain.ts. */}

          {/* Salário: um valor, uma faixa, ou "a combinar" ESCRITO.
              ──────────────────────────────────────────────────────
              Os dois campos eram opcionais e o resultado era o silêncio:
              em branco some da tela e vira indistinguível de esquecimento.
              Salário ausente é o que mais faz gente não responder a uma
              vaga — e "a combinar", dito com todas as letras, é uma
              resposta: a pessoa sabe que o assunto se conversa, em vez de
              suspeitar que estão escondendo. */}
          <div className="ei-campo">
            <label className="ei-caixa">
              <input
                type="checkbox"
                checked={form.salario_a_combinar}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    salario_a_combinar: e.target.checked,
                    /* Marcar "a combinar" limpa os valores: a vaga não pode
                       dizer as duas coisas ao mesmo tempo. */
                    salary_range_min: e.target.checked ? null : f.salary_range_min,
                    salary_range_max: e.target.checked ? null : f.salary_range_max,
                  }))
                }
              />
              <span>Salário a combinar</span>
            </label>
          </div>

          {!form.salario_a_combinar && (
            <>
              {/* O período ANTES do valor (a dona: "na opção de salário
                  colocar opção da de mensal / hora / diária").

                  Nesta ordem de propósito: quem vai escrever "180" precisa
                  ter dito "por dia" ANTES, senão digita pensando no mês e
                  corrige depois — e é aí que fica um salário de pedreiro
                  publicado como mensal. */}
              <div className="ei-campo">
                <label htmlFor="salario_periodo">O salário é</label>
                <span className="ei-campo-ajuda">
                  Só se você paga mais conforme a experiência.
                </span>
                <select
                  id="salario_periodo"
                  value={form.salario_periodo}
                  onChange={(e) => setForm((f) => ({ ...f, salario_periodo: e.target.value }))}
                >
                  {PERIODOS_DE_SALARIO.map((per) => (
                    <option key={per.valor} value={per.valor}>
                      {per.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ei-campo">
                <label htmlFor="salary_min">
                  {form.salario_periodo === "dia"
                    ? "Valor da diária (R$) *"
                    : form.salario_periodo === "hora"
                      ? "Valor da hora (R$) *"
                      : "Salário por mês (R$) *"}
                </label>
                <input
                  id="salary_min"
                  type="number"
                  inputMode="decimal"
                  placeholder="Ex: 1800"
                  value={form.salary_range_min ? form.salary_range_min / 100 : ""}
                  onChange={(e) => setForm((f) => ({ ...f, salary_range_min: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))}
                />
              </div>

              <div className="ei-campo">
                <label htmlFor="salary_max">Até quanto pode pagar? (R$)</label>
                <input
                  id="salary_max"
                  type="number"
                  inputMode="decimal"
                  placeholder="Deixe em branco se o valor é fixo"
                  value={form.salary_range_max ? form.salary_range_max / 100 : ""}
                  onChange={(e) => setForm((f) => ({ ...f, salary_range_max: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))}
                />
              </div>
            </>
          )}

          </section>
        )}

        {/* ── 4. Requisitos ──────────────────────────────────────────── */}
        {mostra(4) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Requisitos</h2>
            <p className="ei-etapa-apoio">
              Só o que a vaga realmente exige. Aqui a fila é curta.
            </p>

            <div className="ei-campo">
              <label htmlFor="required_experience">Precisa de experiência?</label>
              <span className="ei-campo-ajuda">
                Exigir o que a vaga não pede afasta gente boa.
              </span>
              <select
                id="required_experience"
                value={form.required_experience || ""}
                onChange={(e) => setForm((f) => ({ ...f, required_experience: e.target.value || null }))}
              >
                <option value="">Não precisa de experiência</option>
                <option value="0-2 anos">Até 2 anos</option>
                <option value="2-5 anos">De 2 a 5 anos</option>
                <option value="5+ anos">Mais de 5 anos</option>
              </select>
            </div>

            {/* Escolaridade mínima: os MESMOS valores que o candidato usa
                na formação dele (0104). Os dois lados falando a mesma
                língua é o que permite comparar por conta, e não por
                leitura humana. */}
            <div className="ei-campo">
              <label htmlFor="escolaridade_minima">Escolaridade mínima</label>
              <span className="ei-campo-ajuda">
                Exigir demais é o jeito mais rápido de ficar sem candidato.
              </span>
              <select
                id="escolaridade_minima"
                value={form.escolaridade_minima ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, escolaridade_minima: e.target.value || null }))
                }
              >
                <option value="">Não exijo escolaridade</option>
                <option value="fundamental">Ensino fundamental</option>
                <option value="medio">Ensino médio</option>
                <option value="tecnico">Técnico</option>
                <option value="superior">Superior</option>
                <option value="pos">Pós-graduação</option>
                <option value="mestrado">Mestrado</option>
                <option value="doutorado">Doutorado</option>
              </select>
            </div>

            <div className="ei-campo">
              <label htmlFor="curso_especifico">Precisa de algum curso?</label>
              <span className="ei-campo-ajuda">
                A vaga só alcança quem aceita sair da cidade.
              </span>
              <input
                id="curso_especifico"
                type="text"
                placeholder="NR-35, curso de cabeleireiro, manipulação de alimentos"
                value={form.curso_especifico ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, curso_especifico: e.target.value || null }))
                }
              />
            </div>

            {/* CNH: exigência e categoria separadas, como no cadastro de
                quem procura. "Não exijo" e "exijo, mas não disse qual" são
                coisas diferentes, e num campo só virariam o mesmo vazio. */}
            <div className="ei-campo">
              <label className="ei-caixa">
                <input
                  type="checkbox"
                  checked={form.cnh_exigida}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cnh_exigida: e.target.checked,
                      /* Desmarcar limpa as categorias: senão a vaga guarda
                         a exigência de uma CNH que a empresa acabou de
                         dizer que não pede — e a comparação usaria isso. */
                      cnh_categorias: e.target.checked ? f.cnh_categorias : [],
                    }))
                  }
                />
                <span>Precisa ter CNH</span>
              </label>
              {form.cnh_exigida && (
                <div className="ei-chips" style={{ marginTop: 10 }}>
                  {["A", "B", "C", "D", "E", "AB"].map((cat) => {
                    const marcada = form.cnh_categorias.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        className="ei-chip"
                        aria-pressed={marcada}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            cnh_categorias: marcada
                              ? f.cnh_categorias.filter((c) => c !== cat)
                              : [...f.cnh_categorias, cat],
                          }))
                        }
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="ei-campo">
              <label className="ei-caixa">
                <input
                  type="checkbox"
                  checked={form.exige_viagem}
                  onChange={(e) => setForm((f) => ({ ...f, exige_viagem: e.target.checked }))}
                />
                <span>A vaga exige viajar</span>
              </label>
            </div>

            <div className="ei-campo">
              <label htmlFor="idiomas">Precisa de algum idioma?</label>
              <div className="ei-chips" style={{ marginBottom: 8 }}>
                {["Inglês", "Espanhol", "Libras"].map((idioma) => {
                  const marcado = form.idiomas.includes(idioma);
                  return (
                    <button
                      key={idioma}
                      type="button"
                      className="ei-chip"
                      aria-pressed={marcado}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          idiomas: marcado
                            ? f.idiomas.filter((x) => x !== idioma)
                            : [...f.idiomas, idioma],
                        }))
                      }
                    >
                      {idioma}
                    </button>
                  );
                })}
              </div>
              <span className="ei-campo-ajuda">
                Quase nenhuma vaga aqui precisa.
              </span>
            </div>

            {/* Informações complementares: o campo aberto que a dona pediu
                como sexto tema. Fica no fim porque é o que sobra depois de
                as perguntas fechadas terem sido feitas — e um campo aberto
                no começo faz a empresa escrever ali o que os campos de
                baixo já perguntam. */}
            <div className="ei-campo">
              <label htmlFor="observacoes">Mais alguma coisa?</label>
              <span className="ei-campo-ajuda">
                {form.aceita_sem_compatibilidade
                  ? "Quem não bate consegue responder, e a tela dela mostra o quanto combina."
                  : "Quem não bate é avisado ANTES, em vez de responder e nunca receber retorno."}
              </span>
              <textarea
                id="observacoes"
                rows={3}
                placeholder="O que mais a pessoa precisa saber antes de responder"
                value={form.observacoes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value || null }))}
              />
            </div>
          </section>
        )}

        {/* ── 5. Compatibilidade (item 16) ────────────────────────────
            A dona: "depois de cadastrar, ter opção de marcar os campos que
            terão a compatibilidade."

            Marcado ou não, e nunca um peso de 0 a 10: "quanto vale a
            escolaridade nesta vaga?" é um formulário que ninguém termina, e
            a resposta seria inventada. Duas caixinhas se respondem em dois
            toques.

            Nenhum marcado tem significado próprio — a empresa não quis
            escolher, e aí vale a comparação padrão (função e cidade). É
            diferente de marcar um só. */}
        {mostra(5) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">O que pesa nesta vaga</h2>
            <p className="ei-etapa-apoio">
              O app usa isso para ordenar quem aparece primeiro.
            </p>

            <div className="ei-chips" style={{ marginTop: 12 }}>
              {CAMPOS_DE_COMPATIBILIDADE.map((c) => {
                const marcado = form.campos_compatibilidade.includes(c.valor);
                return (
                  <button
                    key={c.valor}
                    type="button"
                    className="ei-chip"
                    aria-pressed={marcado}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        campos_compatibilidade: marcado
                          ? f.campos_compatibilidade.filter((x) => x !== c.valor)
                          : [...f.campos_compatibilidade, c.valor],
                      }))
                    }
                  >
                    {c.nome}
                  </button>
                );
              })}
            </div>

            {form.campos_compatibilidade.length === 0 && (
              <p className="ei-campo-ajuda" style={{ marginTop: 12 }}>
                Nenhum marcado: o app compara pela função e pela cidade, que é o
                que ele sempre fez. Está tudo bem deixar assim.
              </p>
            )}

            {/* A pergunta que a dona deixou em aberto no item 11:
                "verificar se poderão se candidatar sem ter compatibilidade
                / perguntar isso pra empresa ao cadastrar a vaga?"

                Pergunta-se, e o padrão é SIM. A compatibilidade é um
                palpite sobre texto que duas pessoas escreveram à mão;
                barrar por ele descarta justamente quem não sabe se
                descrever — que costuma ser quem mais precisa. */}
            <div className="ei-campo" style={{ marginTop: 18 }}>
              <label className="ei-caixa">
                <input
                  type="checkbox"
                  checked={form.aceita_sem_compatibilidade}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, aceita_sem_compatibilidade: e.target.checked }))
                  }
                />
                <span>Aceito candidatura de quem não bate com tudo isso</span>
              </label>
            </div>
          </section>
        )}

        {/* O rodapé muda com a etapa: no meio do caminho leva adiante, no
            fim confere quem a vaga alcança. Um "publicar" visível na etapa 1
            convidaria a criar vaga sem salário e sem horário. */}
        <div className="ei-margem ei-pe-etapas">
          {etapa < ETAPAS.length ? (
            <button className="ei-btn ei-btn-cheio" onClick={continuarEtapa}>
              Continuar
            </button>
          ) : (
            <button
              className="ei-btn ei-btn-cheio"
              onClick={previsualizarOndas}
              disabled={conferindo}
            >
              {conferindo ? "Contando…" : "Ver quem esta vaga alcança"}
            </button>
          )}
          {etapa > 1 ? (
            <button
              className="ei-btn ei-btn-contorno"
              onClick={() => {
                setErro("");
                setEtapa((e) => e - 1);
                window.scrollTo({ top: 0 });
              }}
            >
              Voltar
            </button>
          ) : (
            <button
              className="ei-btn ei-btn-contorno"
              onClick={() => navegar("/painel-empresa")}
            >
              Cancelar
            </button>
          )}
        </div>
        </>
      ) : (
        // PREVIEW DAS ONDAS
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card" style={{ padding: 16 }}>
            <h2 style={{ margin: "0 0 8px 0" }}>Quem esta vaga alcança</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Cada vaga tem direito a <strong>{ONDAS_POR_VAGA} ondas</strong>. A onda 1
              é avisada ao confirmar; a segunda é sua para usar quando quiser — se
              ninguém responder, você escolhe qual abrir, num toque na tela da vaga.
              Ou já escolhe aqui.
            </p>

            {/* Disparar não depende de plano — qualquer vaga publicada
                avisa as pessoas. O que o plano limita é o ANÚNCIO, e o
                aviso disso mora no bloco do anúncio, mais abaixo. */}

            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {ondaPreview.map(({ onda, novos }) => (
                <div
                  key={onda}
                  style={{
                    padding: 12,
                    backgroundColor: "var(--color-bg-input)",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    /* As ondas que não vão sair ficam mais apagadas — sem
                       isso a tela parecia prometer três disparos. Marcar a
                       caixinha acende a onda, que é a confirmação visual de
                       que ela passou a valer. */
                    opacity: onda === 1 || ondaExtra === onda ? 1 : 0.62,
                  }}
                >
                  <div>
                    <strong>
                      Onda {onda} — {ONDAS[onda].titulo}
                    </strong>
                    <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9em" }}>
                      {ONDAS[onda].explicacao}
                    </p>

                    {/* A onda 1 não tem escolha — ela É o disparo. As
                        outras duas ganham caixinha aqui, para quem tem
                        pressa não precisar voltar à tela da vaga depois.
                        Continuam desmarcadas por padrão: avisar gente
                        demais é a única coisa nesta tela que não dá para
                        desfazer. */}
                    {onda === 1 ? (
                      <p style={{ margin: "6px 0 0", fontSize: "0.9em" }}>Sai agora.</p>
                    ) : (
                      /* Cada vaga tem direito a 2 ondas, e a 1 já é uma
                         delas — então sobra UMA. São botões de rádio, e não
                         caixinhas: com caixinha a pessoa marca as duas,
                         confirma, e o banco recusa a segunda com um erro
                         que ela não tem como prever. A forma do controle é
                         o que ensina a regra, antes de qualquer texto. */
                      <label style={{ display: "flex", gap: 8, marginTop: 8, fontSize: "0.9em" }}>
                        <input
                          type="radio"
                          name="onda-extra"
                          checked={ondaExtra === onda}
                          disabled={novos === 0}
                          onChange={() => setOndaExtra(onda as 2 | 3)}
                        />
                        <span>
                          {novos === 0
                            ? "Não há mais ninguém nesta onda"
                            : "Usar minha segunda onda nesta, agora"}
                        </span>
                      </label>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "1.5em", fontWeight: "bold", color: "var(--color-primary)" }}>
                      {novos}
                    </div>
                    <div className="muted" style={{ fontSize: "0.9em" }}>
                      {novos === 1 ? "pessoa" : "pessoas"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cada onda conta só quem as anteriores não alcançaram, então
                somar os três números dá o total de verdade. Sem o desconto,
                "12, 30, 45" para 45 pessoas seria lido como 87. */}
            <p className="muted" style={{ marginTop: 16, fontSize: "0.9em" }}>
              No total, {ondaPreview.reduce((soma, o) => soma + o.novos, 0)} pessoas em{" "}
              {form.city} podem ser avisadas — nenhuma duas vezes.
            </p>

            {ondaPreview[0]?.novos === 0 && (
              <p style={{ marginTop: 12, fontSize: "0.9em" }}>
                Ninguém com esse encaixe exato hoje. A vaga pode ser criada do
                mesmo jeito — e a onda 2 provavelmente tem gente.
              </p>
            )}
          </div>

          {/* Anunciar a vaga na área de anúncios.
              ─────────────────────────────────────
              Bloco separado das ondas de propósito: são coisas diferentes.
              A onda EMPURRA a vaga para quem encaixa; o anúncio a deixa
              PARADA onde quem está procurando passa. Uma alcança quem não
              estava olhando, a outra atende quem está.

              Some inteiro dentro do app da loja. A Google não permite
              vender bem digital por fora da cobrança dela, e "vender por
              fora" inclui mostrar o preço aqui. Some inteiro, e não
              desabilitado: um bloco cinza com preço continua sendo uma
              oferta. E em lugar nenhum aparece "assine no site" — convidar
              a pagar fora é a mesma violação que vender. */}
          {/* O anúncio vem junto do plano — não custa nada a mais.
              Continua sendo escolha porque nem toda contratação é para se
              expor: uma vaga que substitui alguém que ainda está lá é
              exatamente o caso de avisar só quem encaixa, sem cartaz.

              Sem `podeVender()` em volta: não há preço nesta tela, e o que
              a regra da loja proíbe é vender, não escolher. */}
          <div className="card" style={{ padding: 16 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={anunciar}
                style={{ marginTop: 3 }}
                onChange={(e) => setAnunciar(e.target.checked)}
              />
              <span>
                <strong>Deixar também na área de anúncios</strong>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9em" }}>
                  Além do aviso das ondas, a vaga fica {DIAS_ANUNCIO_VAGA} dias na tela
                  onde as pessoas procuram — quem não recebeu o aviso ainda encontra.
                  Já está no seu plano.
                </p>
              </span>
            </label>
          </div>


          {/* Os dois botões no desenho do app, e não os do procurô: esta
              era a última tela ainda com `btn btn-primary` — o azul do
              outro produto, no fim do caminho mais importante do lado da
              empresa. */}
          <div className="ei-margem ei-pe-etapas">
            <button
              className="ei-btn ei-btn-cheio"
              onClick={confirmarEAbrirPrimeiraOnda}
              disabled={salvando}
            >
              {salvando ? "Criando…" : "Criar vaga e avisar a onda 1"}
            </button>
            <button
              className="ei-btn ei-btn-contorno"
              onClick={() => {
                setPasso("formulario");
                /* Volta na ÚLTIMA etapa, e não na primeira: quem chegou até
                   a conferência e quer mudar algo não deve percorrer os
                   quatro temas de novo. */
                setEtapa(ETAPAS.length);
              }}
              disabled={salvando}
            >
              Voltar e mudar alguma coisa
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
