import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useRascunho, CHAVE_RASCUNHO_VAGA } from "../lib/rascunho";
import {
  empresaAtual,
  obterVaga,
  atualizarVaga,
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
  /* ── A MESMA TELA CRIA E EDITA — 02/09 ───────────────────────────────
     A dona: "opção de editar uma vaga feita."

     Com `:id` na rota (/vaga/:id/editar) a tela abre a vaga do banco e
     salva por cima; sem ele, cria uma nova. É a mesma tela de propósito:
     são os mesmos vinte e poucos campos, com as mesmas regras de conferir
     etapa por etapa, e manter duas cópias disso é garantir que um dia elas
     divirjam — a segunda esquece um campo, e a empresa edita a vaga e
     apaga o horário sem saber.

     O que MUDA no modo edição: não tem prévia de ondas (a vaga já foi
     disparada; disparar de novo é outro botão, na tela da vaga), não tem
     rascunho (o formulário vem do banco), e o botão diz "Salvar". */
  const { id: idParaEditar } = useParams<{ id: string }>();
  const editando = !!idParaEditar;
  const { user, loading: carregandoConta } = useAuth();

  /* ── RASCUNHO AUTOMÁTICO ─────────────────────────────────────────────
     A dona: "ter opção de salvar rascunho nas telas de cadastro pra evitar
     de ter que reescrever tudo quando não tem um dado. Verifique se tem
     como salvar automático."

     Tem, e é este. O formulário começa do que estava guardado no aparelho
     — se houver — em vez do vazio. Ver `useRascunho`. */
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [passo, setPasso] = useState<"formulario" | "preview">("formulario");
  /* Em qual tema a empresa está. Começa no 1 e nunca pula: cada um confere
     o que é dele antes de deixar seguir, para o erro aparecer ao lado do
     que acabou de ser digitado — e não quatro telas adiante, no clique de
     publicar, como acontecia antes. */
  const [etapa, setEtapa] = useState(1);
  /* `prontoParaGravar` só liga depois que a empresa foi lida do banco: até
     lá o formulário ainda é o vazio, e gravá-lo apagaria o rascunho de quem
     voltou para continuar. */
  const [prontoParaGravar, setProntoParaGravar] = useState(false);
  const rascunho = useRascunho(CHAVE_RASCUNHO_VAGA, form, etapa, prontoParaGravar);
  const [avisoRascunho, setAvisoRascunho] = useState(false);
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
      /* Editando: os dados vêm da VAGA, e não do rascunho nem do vazio. */
      if (idParaEditar) {
        obterVaga(idParaEditar)
          .then((vaga) => {
            if (!vaga) {
              setErro("Não achei esta vaga.");
              return;
            }
            setForm((f) => ({ ...f, ...vaga }));
          })
          .catch((err) => setErro(mensagemDeErro(err, "Não consegui abrir esta vaga.")));
        return;
      }

      /* O rascunho entra por baixo dos dados da empresa: o que foi
         digitado volta, mas a empresa é sempre a que está selecionada
         AGORA — quem trocou de loja no meio do caminho não pode publicar a
         vaga na errada por causa de um rascunho antigo. */
      const guardado = rascunho.inicial;
      setForm((f) => ({
        ...f,
        ...(guardado ? guardado.dados : null),
        company_id: empresa.id,
        city: empresa.city,
        uf: empresa.uf,
        neighborhood: empresa.neighborhood,
      }));
      if (guardado) {
        setEtapa(guardado.etapa);
        setAvisoRascunho(true);
      }
      setProntoParaGravar(true);

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
  }, [user, carregandoConta, navegar, idParaEditar]);

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

  /**
   * Grava as mudanças de uma vaga que já existe.
   *
   * Confere as mesmas etapas que a criação — uma edição pode apagar o
   * salário ou o horário do mesmo jeito que um cadastro incompleto, e a
   * vaga já está NO AR enquanto isso: uma vaga publicada sem horário é
   * pior que um formulário mal preenchido.
   *
   * `company_id` e `status` ficam de fora do que é enviado (ver
   * `atualizarVaga`): mudar a empresa levaria os interessados junto, e
   * pausar/arquivar têm botões próprios com as regras de plano.
   */
  async function salvarEdicao() {
    if (!idParaEditar) return;

    for (let n = 1; n <= ETAPAS.length; n++) {
      const problema = conferirEtapa(n);
      if (problema) {
        setErro(problema);
        setEtapa(n);
        window.scrollTo({ top: 0 });
        return;
      }
    }

    setSalvando(true);
    setErro("");
    try {
      /* `status` já está fora do FormState (ver o tipo, no topo). Aqui sai
         só a empresa: mudar o dono de uma vaga que já recebeu gente levaria
         os interessados junto. */
      const { company_id: _empresa, ...mudancas } = form;
      void _empresa;
      await atualizarVaga(idParaEditar, {
        ...mudancas,
        quantidade_vagas: form.quantidade_vagas < 1 ? 1 : form.quantidade_vagas,
      });
      navegar(`/vaga/${idParaEditar}`, { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui salvar as mudanças."));
      setSalvando(false);
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

    /* Guardado fora do `try` para o `catch` saber se a vaga chegou a
       existir: é a diferença entre "não deu" e "deu, mas faltou o resto". */
    let vagaCriada: string | null = null;

    try {
      const vaga = await criarVaga({
        ...form,
        /* O campo pode estar vazio (0) se a pessoa tocou em publicar sem
           sair dele. O banco recusaria com um `check`, e a recusa chegaria
           como texto técnico depois de a vaga inteira escrita. */
        quantidade_vagas: form.quantidade_vagas < 1 ? 1 : form.quantidade_vagas,
        status: "active",
      });
      vagaCriada = vaga.id;

      /* A vaga saiu: o rascunho cumpriu o papel e vai embora. Sem isto ele
         reapareceria dentro da PRÓXIMA vaga, já preenchido com a anterior —
         que é o jeito mais fácil de publicar duas vagas iguais sem
         perceber. */
      rascunho.limpar();

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

      /* A confirmação, e não a vaga direto: quem escreveu vinte campos
         precisa ler que deu certo, e precisa saber o que fazer agora — ver
         ProntoPage. */
      navegar("/pronto?tipo=vaga", { replace: true });
    } catch (err) {
      /* ── "DIZ QUE NÃO SALVOU, MAS SALVOU" — 02/09 ─────────────────────
         A dona: "ao salvar a vaga fala que não é possível salvar. Mas
         depois salvou."

         Era isto: o `try` fazia TRÊS coisas — criar a vaga, abrir a onda 1
         e (às vezes) anunciar. A vaga é a primeira. Se qualquer uma das
         seguintes falhasse, o `catch` dizia "não foi possível criar a
         vaga" — e a vaga já estava criada. A empresa lia o erro, achava
         que tinha perdido tudo, e encontrava a vaga publicada depois.

         Agora o erro sabe onde parou. Com a vaga já criada, a tela LEVA
         para ela e conta o que faltou: a vaga existe, e o que falhou (o
         aviso às pessoas, o anúncio) tem botão próprio lá dentro. Voltar
         para o formulário seria pior — a empresa preencheria tudo de novo
         e publicaria a segunda cópia da mesma vaga. */
      if (vagaCriada) {
        navegar(`/vaga/${vagaCriada}?parcial=1`, { replace: true });
        return;
      }
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
                torpedo de vaga. SMS no Ei Emprego existe só para o código
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
          {/* ── ESTA TELA GANHOU IMPORTÂNCIA — 03/09 ──────────────────
              A dona: "ao tentar cadastrar uma vaga quando já extrapolou o
              limite das vagas do plano, ter uma tela onde explica que as
              vagas do plano extrapolaram e encaminhar para fazer upgrade."

              A tela existia, mas quase ninguém chegava nela: o painel
              trocava o "+ Nova vaga" por "Aumentar plano" antes, e levava
              direto aos preços — sem dizer o que tinha acontecido. Agora o
              painel não desvia mais ninguém (ver `PainelEmpresaPage`), e é
              AQUI que a empresa descobre o que houve.

              Por isso o texto passou a dizer a conta inteira, com números:
              "3 de 3 no ar" responde sozinho a pergunta que vem em
              seguida, que é "cheio como?". */}
          <Pagina titulo="O plano já está cheio" voltar="/painel-empresa">
            <p className="ei-corpo ei-margem">
              Seu plano permite {plano.limite}{" "}
              {plano.limite === 1 ? "vaga aberta" : "vagas abertas"} por vez, e você já
              tem {plano.abertas} no ar. Para publicar esta vaga, aumente o plano — ou
              feche uma das que já estão publicadas.
            </p>
          </Pagina>

          <div className="ei-margem" style={{ display: "grid", gap: 10, marginTop: 18 }}>
            {/* O upgrade é o botão principal, a pedido da dona
                ("encaminhar para fazer upgrade"). Antes o principal era
                "ver minhas vagas", e quem quisesse mais vagas tinha de
                achar o botão de contorno embaixo.

                Fechar uma vaga continua logo abaixo, e continua dito com
                todas as letras no texto: quem só precisa de espaço não
                pode sair daqui achando que a única saída é pagar. */}
            {podeVender() && (
              <button
                type="button"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                onClick={() => navegar("/planos-empresa")}
              >
                Aumentar meu plano
              </button>
            )}
            <button
              type="button"
              className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
              onClick={() => navegar("/painel-empresa")}
            >
              Ver minhas vagas e fechar uma
            </button>
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
        <Pagina
          titulo={editando ? "Editar vaga" : "Nova vaga"}
          voltar={editando ? `/vaga/${idParaEditar}` : "/painel-empresa"}
        />

        {passo === "formulario" && <Etapas passos={ETAPAS} atual={etapa} />}

        {/* ── "VOLTAMOS DE ONDE VOCÊ PAROU" ──────────────────────────────
            O aviso existe por uma razão só: sem ele, quem abre a tela para
            publicar uma vaga NOVA encontra os campos preenchidos com a
            anterior e acha que o app se confundiu. Dizer que é rascunho, e
            dar o botão de zerar ao lado, transforma um susto em uma
            comodidade.

            Some depois do primeiro toque em qualquer coisa? Não: fica até
            a pessoa fechar ou zerar. Ele é discreto, e sumir sozinho
            deixaria sem saída quem leu tarde. */}
        {avisoRascunho && passo === "formulario" && (
          <div className="ei-rascunho ei-margem" role="status">
            <span>
              <strong>Voltamos de onde você parou.</strong> O que você escreve aqui fica
              guardado neste aparelho até publicar.
            </span>
            <button
              type="button"
              className="ei-btn-inline"
              onClick={() => {
                rascunho.descartar();
                setForm((f) => ({
                  ...EMPTY_FORM,
                  /* A empresa e o endereço dela não são rascunho: vieram do
                     cadastro, e zerá-los deixaria a vaga sem dono. */
                  company_id: f.company_id,
                  city: f.city,
                  uf: f.uf,
                  neighborhood: f.neighborhood,
                }));
                setEtapa(1);
                setAvisoRascunho(false);
              }}
            >
              Começar do zero
            </button>
          </div>
        )}

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
            <input
              id="profession"
              type="text"
              list="lista-profissoes"
              autoComplete="off"
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
            <input
              id="specialty"
              type="text"
              value={form.specialty || ""}
              onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value || null }))}
            />
          </div>

          <div className="ei-campo">
            <label htmlFor="description">O que a pessoa vai fazer? *</label>
            <textarea
              id="description"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          </section>
        )}

        {/* ── 2. Horário e local ─────────────────────────────────────── */}
        {mostra(2) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Horário e local</h2>

          {/* Tipo de contrato e jornada são NOVOS, e são as duas perguntas
              que mais decidem se alguém responde. Antes não existiam em
              campo nenhum: quem procurava só descobria no telefonema se a
              vaga era registrada ou diária, integral ou de fim de semana —
              e o telefonema é justamente o que o app existe para não
              desperdiçar. */}
          <div className="ei-campo">
            <label htmlFor="tipo_contrato">Como é a contratação? *</label>
            {/* A dica que estava aqui — "quase toda vaga aqui é no local" —
                é do campo "Onde a pessoa trabalha?", e voltou para lá. Ela
                tinha sido movida para cá por engano num conserto de posição
                de dicas feito com busca e troca, e não dizia nada sobre
                contratação. */}
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

          {/* ── O QUE É OPCIONAL FICA GUARDADO — 02/09 ─────────────────
              A dona: "a tela de cadastro de vaga está muito quebrada e bem
              difícil de cadastrar. Tem que ser algo fácil."

              A etapa tinha dez campos seguidos, e só dois são obrigatórios.
              Os outros oito são refinamentos — horário exato, escala,
              bairro, prazo — que quase nenhuma vaga de balcão precisa. Uma
              coluna de dez perguntas não parece "preencha o que quiser":
              parece uma prova, e é aí que a pessoa fecha o app.

              Agora a etapa mostra as duas que decidem se alguém responde, e
              o resto fica atrás de "Mais detalhes (opcional)" — fechado por
              padrão, aberto com um toque, e com a palavra "opcional" no
              rótulo para ninguém achar que está pulando algo obrigatório.

              É um `<details>` do HTML, sem biblioteca: abre e fecha sozinho,
              funciona sem JavaScript e o leitor de tela já sabe anunciá-lo.
              Um acordeão escrito à mão precisaria de foco, teclado e
              animação — e é justamente o tipo de coisa que quebra no
              celular. */}
          <details className="ei-mais">
            <summary>Mais detalhes (opcional)</summary>
            <div className="ei-mais-corpo">
              {/* Quantidade e datas: uma por linha.

                  Antes "Quantas vagas" e "Começa quando" dividiam uma
                  linha de duas colunas de larguras fixas — rótulos de
                  tamanhos diferentes, uma caixa de número ao lado de um
                  seletor de data, nada alinhava. Era isso que lia como
                  tela quebrada.

                  E a dica "sem prazo, a vaga fica no ar até você fechar"
                  estava pendurada em "Quantas vagas", onde não faz sentido
                  nenhum: ela é do prazo de candidatura, e foi parar ali num
                  conserto de posição de dicas feito por busca e troca. */}
          <div className="ei-campo">
            <label htmlFor="quantidade_vagas">Quantas vagas</label>
            {/* ── NÃO DAVA PARA TROCAR O NÚMERO — 02/09 ──────────────────
                A dona: "não dá pra alterar a quantidade de vagas."

                E não dava mesmo. O campo forçava o valor para 1 a CADA
                tecla: apagar o "1" para escrever "2" fazia o `Number("")`
                virar 0, o `|| 1` devolver 1, e o campo se reescrever com 1
                antes de a segunda tecla chegar. Só quem digitasse por cima
                do dígito selecionado conseguia — o que no celular
                praticamente ninguém faz.

                Agora o campo aceita ficar VAZIO enquanto se digita, e o
                mínimo é cobrado ao SAIR do campo (`onBlur`). O banco
                continua sendo a garantia final: ele tem um `check` de 1 a
                999, e um campo vazio no envio vira 1. */}
            <input
              id="quantidade_vagas"
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              value={form.quantidade_vagas === 0 ? "" : form.quantidade_vagas}
              onChange={(e) => {
                const cru = e.target.value;
                /* 0 é o "vazio" interno: `quantidade_vagas` é `number` no
                   tipo da vaga, e usar `null` aqui obrigaria a mexer no
                   tipo inteiro só para um estado que dura dois segundos. */
                if (cru === "") {
                  setForm((f) => ({ ...f, quantidade_vagas: 0 }));
                  return;
                }
                const n = Number(cru);
                if (!Number.isFinite(n)) return;
                setForm((f) => ({ ...f, quantidade_vagas: Math.min(999, Math.max(0, Math.floor(n))) }));
              }}
              onBlur={() =>
                setForm((f) => ({
                  ...f,
                  quantidade_vagas: f.quantidade_vagas < 1 ? 1 : f.quantidade_vagas,
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
            <input
              id="horario"
              type="text"
              value={form.horario ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value || null }))}
            />
          </div>

          <div className="ei-campo">
            <label htmlFor="escala">Escala (se tiver)</label>
            <input
              id="escala"
              type="text"
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
          </div>

            </div>
          </details>

          </section>
        )}

        {/* ── 3. Salário e benefícios ────────────────────────────────── */}
        {mostra(3) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Salário e benefícios</h2>

          {/* Benefícios: sugestões para tocar, e campo livre ao lado.
              Lista fechada não caberia — "cesta básica" e "plano
              odontológico" existem em Itabirito. E vale-transporte decide
              quem mora longe; refeição pesa num salário de piso. */}
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
            {/* A dica estava pendurada em "Tem comissão?", onde não dizia
                nada — é desta caixa que ela fala, e voltou para cá. */}
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
                  value={form.salary_range_min ? form.salary_range_min / 100 : ""}
                  onChange={(e) => setForm((f) => ({ ...f, salary_range_min: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))}
                />
              </div>

              <div className="ei-campo">
                <label htmlFor="salary_max">Até quanto pode pagar? (R$)</label>
                {/* Esta dica estava em "O salário é", falando de uma coisa
                    que aquele campo não faz. É deste, e voltou. */}
                <input
                  id="salary_max"
                  type="number"
                  inputMode="decimal"
                  value={form.salary_range_max ? form.salary_range_max / 100 : ""}
                  onChange={(e) => setForm((f) => ({ ...f, salary_range_max: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))}
                />
              </div>
            </>
          )}

        {/* ── 4. Requisitos ──────────────────────────────────────────── */}
        
          {/* Benefícios, comissão e "outros" são refinamento: a etapa é
              sobre SALÁRIO, e era ele que estava lá embaixo, depois de três
              campos de benefício. Quem abre esta tela vem escrever quanto
              paga. */}
          <details className="ei-mais">
            <summary>Benefícios e comissão (opcional)</summary>
            <div className="ei-mais-corpo">
          <div className="ei-campo">
            <label htmlFor="beneficio-novo">O que a vaga oferece além do salário?</label>
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
            <input
              id="comissao"
              type="text"
              value={form.comissao ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, comissao: e.target.value || null }))}
            />
          </div>

          <div className="ei-campo">
            <label htmlFor="outros_beneficios">Outros benefícios</label>
            <textarea
              id="outros_beneficios"
              rows={2}
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
            </div>
          </details>

          </section>
        )}

{mostra(4) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Requisitos</h2>

            <div className="ei-campo">
              <label htmlFor="required_experience">Precisa de experiência?</label>
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

            {/* Curso, CNH, viagem, idioma e observações são exigências
                que quase nenhuma vaga de cidade pequena tem — e cinco
                campos vazios seguidos fazem a etapa parecer um formulário
                de concurso. Ficam guardados; experiência e escolaridade,
                que toda vaga responde, ficam à vista. */}
            <details className="ei-mais">
              <summary>Outras exigências (opcional)</summary>
              <div className="ei-mais-corpo">
            <div className="ei-campo">
              <label htmlFor="curso_especifico">Precisa de algum curso?</label>
              <input
                id="curso_especifico"
                type="text"
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
              {/* A dica estava em "Precisa de algum curso?", falando de
                  viagem. É deste campo, e voltou para cá. */}
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
            </div>

            {/* Informações complementares: o campo aberto que a dona pediu
                como sexto tema. Fica no fim porque é o que sobra depois de
                as perguntas fechadas terem sido feitas — e um campo aberto
                no começo faz a empresa escrever ali o que os campos de
                baixo já perguntam. */}
            <div className="ei-campo">
              <label htmlFor="observacoes">Mais alguma coisa?</label>
              {/* Era um texto sobre quem NÃO bate com a vaga poder
                  responder — que é a caixa da etapa 5, e não este campo.
                  Foi parar aqui num conserto de posição de dicas feito por
                  busca e troca, e ficou dizendo uma coisa que o campo não
                  faz. */}
              <textarea
                id="observacoes"
                rows={3}
                value={form.observacoes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value || null }))}
              />
            </div>
              </div>
            </details>

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
            /* Editando não há prévia de ondas: a vaga já foi disparada, e
               disparar de novo é outro botão, na tela dela. Aqui o fim do
               caminho é gravar. */
            editando ? (
              <button className="ei-btn ei-btn-cheio" onClick={salvarEdicao} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar as mudanças"}
              </button>
            ) : (
              <button
                className="ei-btn ei-btn-cheio"
                onClick={previsualizarOndas}
                disabled={conferindo}
              >
                {conferindo ? "Contando…" : "Ver quem esta vaga alcança"}
              </button>
            )
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
              onClick={() => navegar(editando ? `/vaga/${idParaEditar}` : "/painel-empresa")}
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
              é avisada ao confirmar; as outras duas são suas para usar quando
              quiser — se ninguém responder, você abre a seguinte num toque, na tela
              da vaga. Ou já escolhe aqui.
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
