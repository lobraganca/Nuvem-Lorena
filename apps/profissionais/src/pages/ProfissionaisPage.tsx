import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { mensagemDeErro } from "../lib/erros";
import { supabase } from "../lib/supabase";
import { lerTudo } from "../lib/lerTudo";
import { DEFAULT_CITY, DEFAULT_UF } from "../types/domain";
import { Pagina } from "../components/ei/Pagina";
import { useAuth } from "../lib/useAuth";
import { useOnboardingStatus } from "../lib/useOnboardingStatus";
import { empresaAtual } from "../lib/company";
import { BottomSheet } from "../components/BottomSheet";
import { BotaoFavorito } from "../components/ei/BotaoFavorito";
import { lerFavoritos, SEM_FAVORITOS, type Favoritos } from "../lib/favoritos";

type Disponivel = {
  id: string;
  name: string;
  photo_url: string | null;
  areas_de_interesse: string[];
  especialidade: string | null;
  neighborhood: string | null;
  /* ── O QUE OS FILTROS PRECISAM (colunas da 0101 e da 0103) ─────────
     A dona: "fazer filtros na busca do banco de talentos."

     A lista tinha uma busca por texto e uma fileira de ofícios, e mais
     nada. Numa cidade com poucas centenas de cadastros isso basta para
     achar UMA pessoa pelo nome — mas quem contrata não procura uma
     pessoa, procura QUEM SERVE: quem pode no fim de semana, quem tem
     CNH, quem começa segunda. Sem isso a empresa lê a lista inteira e
     liga para descobrir. */
  disponivel: boolean | null;
  aceita_viajar: boolean | null;
  fim_de_semana: boolean | null;
  inicio_imediato: boolean | null;
  cnh: boolean | null;
  disponibilidade: string[] | null;
};

/** Os filtros de sim/não da folha. A chave é a que vai para a URL. */
const FILTROS_SIM = [
  { chave: "d", campo: "disponivel", nome: "Disponível agora" },
  { chave: "i", campo: "inicio_imediato", nome: "Começa imediato" },
  { chave: "f", campo: "fim_de_semana", nome: "Trabalha fim de semana" },
  { chave: "v", campo: "aceita_viajar", nome: "Aceita viajar" },
  { chave: "c", campo: "cnh", nome: "Tem CNH" },
] as const;

/**
 * Quem está disponível na cidade.
 *
 * É o que a empresa vê SEM plano nenhum — e é de propósito: ver quem existe
 * é o que faz ela entender que vale a pena publicar uma vaga. Cobrar para
 * olhar afastaria os dois lados de uma cidade que ainda não tem nenhum.
 *
 * A lista NÃO é a busca do procurô. Lá o assunto era "quem conserta o meu
 * chuveiro": categoria, avaliação, selo, destaque pago. Aqui é "quem está
 * procurando trabalho agora", e a única ordenação que importa é essa. Sem
 * nota, sem selo, sem quem pagou para aparecer na frente.
 *
 * Quem escolheu ficar oculto não aparece aqui — só recebe vaga pelas ondas.
 * É uma decisão de quem está empregado e não quer ser encontrado pelo
 * patrão, e o app precisa respeitá-la sem exigir explicação.
 *
 * ── O desenho ─────────────────────────────────────────────────────────
 *
 * Era uma pilha de linhas: bolinha de 48px, nome, funções em cinza. A dona
 * mandou telas de referência quatro vezes e disse que o app não parecia com
 * elas; eu respondi trocando cor três vezes, até ela dizer "mais uma vez só
 * mudou as cores".
 *
 * Depois vieram os cartões com foto grande, dois por linha — e a dona
 * apontou o problema deles: "não precisa ter o baixo na foto da pessoa". O
 * bloco de texto pendurado embaixo da foto existia só para caber nome e
 * ofício, e era ele que dava altura desigual aos cartões, cortava o ofício
 * no meio da palavra e obrigava a espremer o bairro numa etiqueta.
 *
 * Agora cada pessoa é uma LINHA, no modelo do Notion: retrato quadrado,
 * nome, ofício em cinza, fio embaixo. Nada corta e nada fica pendurado
 * embaixo da foto.
 *
 * O retrato começou com 36px e a dona voltou pedindo "colocar foto no card"
 * — com a foto já lá. É que 36px é tamanho de ícone: a lista lia como uma
 * lista de nomes, com um carimbo do lado. Agora são 64px, e o rosto vira
 * rosto: numa cidade em que as pessoas se conhecem, reconhecer alguém é
 * metade do motivo de a lista existir.
 */
export function ProfissionaisPage() {
  useTituloDaPagina("Profissionais disponíveis");

  const { user } = useAuth();

  /* ── O BANCO DE TALENTOS PEDE EMPRESA CADASTRADA ────────────────────
     A dona: "senão ela consegue verificar o banco de talentos e eu não
     consigo ter dados para oferecer planos depois."

     Vale só para quem está no ambiente de EMPRESA: é o lado que usa a
     lista para contratar, e é dele que vem a venda de plano. Quem está no
     ambiente de quem procura trabalho continua vendo a lista — ali ela
     serve para a pessoa comparar o próprio cadastro com o dos outros, e
     não há nada a vender.

     O desvio é `replace` para o botão de voltar não trazer de volta a uma
     tela que vai desviar de novo. */
  const tipoDeConta = useOnboardingStatus();
  const navegar = useNavigate();
  useEffect(() => {
    if (tipoDeConta !== "company" || !user) return;
    let vivo = true;
    empresaAtual(user.id).then((empresa) => {
      if (vivo && !empresa) navegar("/cadastro-empresa", { replace: true });
    });
    return () => { vivo = false; };
  }, [tipoDeConta, user, navegar]);

  const [lista, setLista] = useState<Disponivel[]>([]);
  /* O que esta conta já guardou. Vem numa consulta só, antes de a lista
     desenhar: perguntar por pessoa seriam sessenta viagens ao banco. */
  const [favoritos, setFavoritos] = useState<Favoritos>(SEM_FAVORITOS);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  /* A busca e o filtro moram na URL, não no estado da tela.
     ────────────────────────────────────────────────────────
     Testei como usuária: busquei "Pedreiro", abri um perfil, voltei — e o
     campo estava vazio, com a lista inteira de volta. É o mesmo defeito
     que o CLAUDE.md registra como já tendo custado horas no procurô
     ("abrir um cadastro e voltar apagava a busca"), e ele tinha voltado.

     Na URL, o botão de voltar do navegador devolve o estado sozinho, e o
     endereço filtrado pode ser guardado ou mandado para alguém. */
  const [params, setParams] = useSearchParams();
  const filtro = params.get("q") ?? "";
  const oficio = params.get("f");

  function mudarParams(mudanca: Record<string, string | null | undefined>) {
    const novo = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(mudanca)) {
      if (valor) novo.set(chave, valor);
      else novo.delete(chave);
    }
    /* `replace` para a busca não encher o histórico: senão, voltar depois
       de digitar oito letras exige oito toques no botão de voltar. */
    setParams(novo, { replace: true });
  }

  const setFiltro = (v: string) => mudarParams({ q: v });
  const setOficio = (v: string | null) => mudarParams({ f: v });

  /* ── A FOLHA DE FILTROS ─────────────────────────────────────────────
     Os filtros de sim/não e o bairro moram numa folha, e não soltos na
     tela. São seis, e seis fileiras de botões acima da lista empurrariam
     as pessoas para a terceira dobra — numa tela cujo assunto É a lista.

     O que fica visível é o que se usa a toda hora: a busca e os ofícios.
     O resto abre num toque, e o botão diz quantos estão ligados, para
     ninguém ficar com um filtro esquecido e uma tela vazia sem entender
     por quê — que é o jeito mais comum de um filtro estragar uma busca. */
  const [folhaAberta, setFolhaAberta] = useState(false);
  const bairro = params.get("b");
  const ligados = FILTROS_SIM.filter((f) => params.get(f.chave) === "1");
  const quantosFiltros = ligados.length + (bairro ? 1 : 0);

  /* Os favoritos, à parte da lista e sem derrubar nada se falharem: sem
     eles os corações ficam apagados, que é o mesmo que "ainda não
     guardei" — e o toque conserta. Derrubar a lista de gente por causa
     disso seria trocar o que a empresa veio ver por uma mensagem. */
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    lerFavoritos(user.id).then((f) => {
      if (vivo) setFavoritos(f);
    });
    return () => {
      vivo = false;
    };
  }, [user]);

  useEffect(() => {
    const sb = supabase();
    if (!sb) {
      setCarregando(false);
      return;
    }

    /* `lerTudo` e não um `select` simples: a migration 0062 pôs teto de 200
       linhas por consulta, e uma lista que para no ducentésimo profissional
       sem avisar é o número que mente calado. */
    lerTudo<Disponivel>(() =>
      sb
        .from("professionals_public")
        /* A lista de colunas é UMA string literal, e não uma soma de
           pedaços: o supabase-js lê o texto dela para saber o formato da
           resposta, e uma concatenação vira `string` — a conferência de
           tipos passa a não reconhecer nenhuma coluna.

           E é escrita à mão, uma por uma: coluna nova que ninguém
           acrescente aqui chega indefinida, sem erro para avisar, e o
           filtro dela passa a não achar ninguém. */
        .select("id, name, photo_url, areas_de_interesse, especialidade, neighborhood, disponivel, aceita_viajar, fim_de_semana, inicio_imediato, cnh, disponibilidade")
        .eq("city", DEFAULT_CITY)
        .eq("uf", DEFAULT_UF)
        /* ── SÓ QUEM FEZ O CADASTRO DO EI ITABIRITO ────────────────────
           A dona: "o app está com dados de pessoas que se cadastraram no
           procurô."

           Está — e é o MESMO banco: os dois apps leem a mesma tabela. Ela
           conferiu abrindo o procuroapp.com.br e são as mesmas pessoas.
           Apagar resolveria aqui e esvaziaria o procurô, que está no ar.

           O que separa um do outro é a coluna. `categories` é o que a
           pessoa FAZ como serviço, e é a do procurô. `areas_de_interesse`
           é onde ela ACEITARIA trabalhar, nasceu na 0070 e é a do Ei —
           é por ela que esta lista filtra e é por ela que a onda encontra
           gente.

           Quem se cadastrou no procurô nunca preencheu essa coluna: ela
           não existia. Então aparecia nesta lista sem função nenhuma, e —
           o que é pior — sem poder receber vaga, porque a onda cruza
           justamente por ela. Era gente que a empresa podia chamar e que o
           app nunca ia avisar de nada.

           Este filtro não apaga ninguém. Tira da lista do Ei quem não fez
           o cadastro do Ei, e deixa o procurô intacto. É reversível: sai
           daqui e todo mundo volta. */
        .not("areas_de_interesse", "is", null)
        .neq("areas_de_interesse", "{}")
        .order("created_at", { ascending: false })
    )
      .then(setLista)
      .catch((err) => {
        /* Erro nunca vira lista vazia. "Ninguém disponível em Itabirito" e
           "a consulta falhou" são a mesma tela e coisas opostas — e a
           primeira faz a empresa desistir do app inteiro. */
        setErro(mensagemDeErro(err, "Não consegui carregar os profissionais."));
      })
      .finally(() => setCarregando(false));
  }, []);

  /* Os filtros saem do que existe de verdade na cidade, e não de uma lista
     fixa de ofícios. Uma fileira com "Soldador" numa cidade sem soldador
     nenhum é um filtro que só sabe devolver tela vazia. */
  const oficios = useMemo(() => {
    const conta = new Map<string, number>();
    for (const p of lista) {
      for (const f of p.areas_de_interesse ?? []) conta.set(f, (conta.get(f) ?? 0) + 1);
    }
    return [...conta.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .slice(0, 12)
      .map(([f]) => f);
  }, [lista]);

  /* Os bairros saem do que existe de verdade na lista, e não de uma
     lista fixa da cidade: um filtro "Praia" numa cidade sem praia é um
     botão que só sabe devolver tela vazia. */
  const bairros = useMemo(() => {
    const conta = new Map<string, number>();
    for (const p of lista) {
      const b = p.neighborhood?.trim();
      if (b) conta.set(b, (conta.get(b) ?? 0) + 1);
    }
    return [...conta.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .map(([b]) => b);
  }, [lista]);

  const visiveis = useMemo(() => {
    const t = filtro.trim().toLocaleLowerCase("pt-BR");
    return lista.filter((p) => {
      if (oficio && !(p.areas_de_interesse ?? []).includes(oficio)) return false;
      if (bairro && p.neighborhood?.trim() !== bairro) return false;

      /* Cada filtro ligado exige um SIM. `null` (a coluna que a pessoa
         nunca respondeu) NÃO passa: quem procura "tem CNH" está
         perguntando quem TEM, e devolver quem não disse seria devolver
         uma lista que não responde a pergunta. É o contrário da regra da
         compatibilidade das vagas — lá o silêncio não pune ninguém,
         porque lá ninguém está filtrando. */
      for (const f of ligados) {
        if (p[f.campo] !== true) return false;
      }

      if (!t) return true;
      return (
        p.name.toLocaleLowerCase("pt-BR").includes(t) ||
        (p.areas_de_interesse ?? []).some((f) => f.toLocaleLowerCase("pt-BR").includes(t))
      );
    });
  }, [lista, filtro, oficio, bairro, ligados]);

  return (
    <div className="ei">
      <div className="ei-tela">
        {/* O mesmo nome da porta e da barra de baixo: a barra dizia
            "Talentos", a porta "Banco de talentos" e o título
            "Profissionais". Três nomes para uma tela só. */}
        <Pagina titulo="Banco de talentos" />

        {/* A busca em cápsula, com a lupa dentro. */}
        <div className="ei-busca" style={{ marginTop: 14 }}>
          <IconeLupa />
          <input
            type="search"
            placeholder="Nome ou função"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label="Procurar profissional"
          />
          {filtro && (
            <button
              type="button"
              className="ei-busca-limpar"
              aria-label="Limpar a busca"
              onClick={() => setFiltro("")}
            >
              ✕
            </button>
          )}
        </div>

        {/* O botão da folha, logo abaixo da busca. Leva o número de
            filtros ligados: sem ele, quem esquece um filtro marcado vê
            uma tela vazia e conclui que não há ninguém na cidade. */}
        <div className="ei-margem ei-linha-filtros">
          <button
            type="button"
            className={quantosFiltros ? "ei-chip ei-chip-filtro ativo" : "ei-chip ei-chip-filtro"}
            aria-pressed={quantosFiltros > 0}
            onClick={() => setFolhaAberta(true)}
          >
            <IconeFiltro />
            Filtros
            {quantosFiltros > 0 && <span className="ei-chip-conta">{quantosFiltros}</span>}
          </button>
          {quantosFiltros > 0 && (
            <button
              type="button"
              className="ei-btn-inline"
              onClick={() =>
                mudarParams(
                  Object.fromEntries([
                    ...FILTROS_SIM.map((f) => [f.chave, null]),
                    ["b", null],
                  ])
                )
              }
            >
              Limpar
            </button>
          )}
        </div>

        {/* A fileira de filtros só aparece quando há mais de um ofício na
            cidade: com um só, ela seria um botão que não filtra nada. */}
        {oficios.length > 1 && (
          <div className="ei-filtros" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="ei-chip"
              aria-pressed={oficio === null}
              onClick={() => setOficio(null)}
            >
              Todos
            </button>
            {oficios.map((f) => (
              <button
                key={f}
                type="button"
                className="ei-chip"
                aria-pressed={oficio === f}
                onClick={() => setOficio(oficio === f ? null : f)}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {carregando && (
          <p className="ei-apoio ei-margem" style={{ marginTop: 20 }}>
            Carregando…
          </p>
        )}

        {!carregando && !erro && (
          <div className="ei-secao-linha">
            <h2>
              {visiveis.length} {visiveis.length === 1 ? "pessoa" : "pessoas"}
            </h2>
            {(oficio || filtro) && (
              <button
                type="button"
                className="ei-secao-acao"
                onClick={() => {
                  setOficio(null);
                  setFiltro("");
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {!carregando && !erro && visiveis.length === 0 && (
          <div className="ei-cartao" style={{ padding: 0 }}>
            <div className="ei-vazio">
              <span className="ei-vazio-icone" aria-hidden="true">
                <IconeLupa grande />
              </span>
              <h3 className="ei-titulo">
                {filtro.trim() || oficio ? "Nada com esse filtro" : "Ainda não há ninguém"}
              </h3>
              <p className="ei-apoio">
                {filtro.trim() || oficio
                  ? "Tente outro nome, ou tire o filtro para ver todo mundo."
                  : "Assim que alguém se cadastrar em Itabirito, aparece aqui."}
              </p>
            </div>
          </div>
        )}

        {visiveis.length > 0 && (
          /* `ei-lista`, e não um `div` pelado: sem ela a lista inteira de
             pessoas ficava direto no chão cinza da tela, sem superfície
             branca embaixo — a única lista do app assim. Os fios entre as
             linhas viravam riscos soltos no cinza, e a tela parecia não ter
             terminado de carregar. */
          <div className="ei-lista">
            {visiveis.map((p) => {
              const funcoes = p.areas_de_interesse ?? [];
              return (
                /* A linha vira LINK. Era um `<article>` sem link nenhum:
                   a empresa via a lista, tocava numa pessoa e não
                   acontecia nada — e não havia telefone em lugar nenhum
                   do app. A parte gratuita da oferta não existia. */
                <Link key={p.id} to={`/profissional/${p.id}`} className="ei-pessoa">
                  <Retrato foto={p.photo_url} nome={p.name} />
                  <div className="ei-pessoa-texto">
                    {/* Na linha inteira cabem duas funções sem cortar — no
                        cartão de 163px não cabia nem uma. */}
                    <div className="ei-pessoa-nome ei-uma-linha">{p.name}</div>
                    {/* Duas linhas, e não uma: o ofício é o ÚNICO campo
                        que a empresa lê para decidir se abre a ficha, e
                        cortá-lo em "Técnico em celular…" esconde
                        justamente a parte que diferencia uma pessoa da
                        outra. */}
                    <div className="ei-pessoa-oficio ei-duas-linhas">
                      {funcoes.slice(0, 2).join(" · ") || p.especialidade || "Sem função"}
                      {funcoes.length > 2 && ` +${funcoes.length - 2}`}
                    </div>
                  </div>
                  {/* O coração ANTES da seta: a seta diz "abre", o coração
                      diz "guarda". Depois dela, o coração pareceria parte
                      do gesto de abrir. */}
                  <BotaoFavorito
                    pessoa={p.id}
                    marcado={favoritos.pessoas.has(p.id)}
                    rotulo={p.name}
                    aoMudar={(novo) =>
                      setFavoritos((f) => {
                        /* Conjunto NOVO, e não o mesmo mudado por dentro: o
                           React compara por identidade, e mexer no conjunto
                           existente não redesenha coração nenhum. */
                        const pessoas = new Set(f.pessoas);
                        if (novo) pessoas.add(p.id);
                        else pessoas.delete(p.id);
                        return { ...f, pessoas };
                      })
                    }
                  />
                  <span className="ei-linha-seta" aria-hidden="true">
                    <IconeSeta />
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {folhaAberta && (
          <BottomSheet
            title="Filtrar"
            subtitle="Some quem não responde ao que você marcar."
            onClose={() => setFolhaAberta(false)}
          >
            <div className="ei-filtros-folha">
              {FILTROS_SIM.map((f) => {
                const ligado = params.get(f.chave) === "1";
                return (
                  <label key={f.chave} className="ei-caixa ei-caixa-larga">
                    <input
                      type="checkbox"
                      checked={ligado}
                      onChange={() => mudarParams({ [f.chave]: ligado ? null : "1" })}
                    />
                    <span>{f.nome}</span>
                  </label>
                );
              })}

              {/* O bairro só aparece com mais de um: numa cidade em que
                  todo mundo cadastrado mora no Centro, ele seria um botão
                  que não filtra nada. */}
              {bairros.length > 1 && (
                <div className="ei-campo" style={{ marginTop: 6 }}>
                  <label htmlFor="filtro-bairro">Bairro</label>
                  <select
                    id="filtro-bairro"
                    value={bairro ?? ""}
                    onChange={(e) => mudarParams({ b: e.target.value || null })}
                  >
                    <option value="">Qualquer bairro</option>
                    {bairros.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* O botão diz QUANTAS pessoas sobraram, e não só "aplicar":
                é a resposta que a pessoa foi buscar ao abrir a folha, e
                dá-la aqui evita fechar, olhar, e abrir de novo. */}
            <button
              type="button"
              className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
              style={{ marginTop: 16 }}
              onClick={() => setFolhaAberta(false)}
            >
              Ver {visiveis.length} {visiveis.length === 1 ? "pessoa" : "pessoas"}
            </button>
          </BottomSheet>
        )}
      </div>
    </div>
  );
}

/**
 * O rosto da pessoa na lista.
 *
 * Sem foto, a inicial do nome — e não um ícone genérico de silhueta, que
 * faria as pessoas sem foto virarem todas o mesmo item cinza.
 *
 * O `onError` é o que evita o pior dos três estados: a foto que EXISTE no
 * cadastro mas não abre mais (arquivo apagado do Storage, endereço antigo
 * de antes da troca de bucket). Sem ele o navegador desenha o ícone de
 * imagem quebrada no lugar do rosto, que é bem pior do que uma inicial —
 * parece app defeituoso, e não pessoa sem foto.
 */
function Retrato({ foto, nome }: { foto: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  const inicial = nome.trim().charAt(0).toLocaleUpperCase("pt-BR");

  return (
    <span className="ei-pessoa-retrato" aria-hidden="true">
      {foto && !falhou ? (
        <img src={foto} alt="" loading="lazy" onError={() => setFalhou(true)} />
      ) : (
        inicial
      )}
    </span>
  );
}

function IconeSeta() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconeLupa({ grande = false }: { grande?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={grande ? 30 : 20}
      height={grande ? 30 : 20}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </svg>
  );
}

function IconeFiltro() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3.5 6h17M6.5 12h11M10 18h4" />
    </svg>
  );
}
