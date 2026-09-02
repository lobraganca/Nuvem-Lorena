import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import {
  minhasEmpresas,
  escolherEmpresa,
  idDaEmpresaEscolhida,
  resumoDasEmpresas,
  type ResumoDasEmpresas,
} from "../../lib/company";
import {
  PLANOS_EMPRESA,
  PLANO_GRATUITO,
  type Company,
} from "../../types/domain";
import { Pagina } from "../../components/ei/Pagina";
import { AvisoPerfilIncompleto } from "../../components/ei/AvisoPerfilIncompleto";

/**
 * Qual empresa você quer abrir agora.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "ao escolher a empresa, se o cadastro tiver feito, deve aparecer
 * cards com a foto e nome das empresas cadastradas. Deve ter opção de
 * cadastrar mais de uma empresa. Pode ter um botão ao lado do card escrito
 * +. Nessa tela de escolha da empresa, deve ter o card das empresas
 * cadastradas e o botão do banco de talentos. Ao escolher a empresa, aí sim
 * abre outra tela com opções de vagas disponíveis daquela empresa."
 *
 * ── ELA APARECE SEMPRE, INCLUSIVE COM UMA EMPRESA SÓ ──────────────────
 *
 * Houve uma versão em que esta tela se pulava sozinha quando havia uma
 * empresa só — "uma pergunta com uma resposta só é um toque a mais para
 * nada". A dona pediu a tela duas vezes depois disso, e o motivo é que ela
 * nunca chegou a vê-la.
 *
 * O argumento estava errado porque a tela não é só uma pergunta: é onde se
 * cadastra a SEGUNDA empresa, com o "+" ao lado dos cartões. Quem tem uma
 * só é justamente quem precisa achar esse botão.
 *
 * ── O BANCO DE TALENTOS FICA AQUI ──────────────────────────────────────
 *
 * Ele não pertence a nenhuma das empresas: é a lista de quem está
 * procurando trabalho na cidade, e serve igual para as duas. Por isso é um
 * botão à parte, embaixo dos cartões, e não uma opção dentro de cada um.
 *
 * No laranja da marca, como a dona pediu no item 7.
 */
export function MinhasEmpresasPage() {
  useTituloDaPagina("Suas empresas");
  const navegar = useNavigate();
  const { user, loading } = useAuth();

  const [lista, setLista] = useState<Company[] | null>(null);
  /* As métricas chegam DEPOIS dos cartões, numa segunda consulta. Esperar
     as duas para desenhar deixaria a tela em branco enquanto o banco conta
     respostas — e o nome da empresa é o que a pessoa veio ver. */
  const [resumo, setResumo] = useState<ResumoDasEmpresas | null>(null);
  const [erro, setErro] = useState("");

  /* Qual está aberta AGORA. Sem nada guardado, é a primeira — que é
     exatamente o que `empresaAtual` usa para montar o painel. Ler só o
     guardado deixava a tela sem nenhuma marcada na primeira visita, e a
     pessoa entrava no painel da padaria sem que a tela anterior tivesse
     dito que era a padaria. */
  const escolhida = idDaEmpresaEscolhida() ?? lista?.[0]?.id ?? null;

  useEffect(() => {
    if (loading || !user) return;
    let vivo = true;
    minhasEmpresas(user.id)
      .then((empresas) => {
        if (!vivo) return;
        /* Nenhuma empresa: vai para o cadastro, e é decisão da dona —
           "senão ela consegue verificar o banco de talentos e eu não
           consigo ter dados para oferecer planos depois". */
        if (empresas.length === 0) {
          navegar("/cadastro-empresa", { replace: true });
          return;
        }
        /* ── A TELA APARECE SEMPRE, INCLUSIVE COM UMA EMPRESA SÓ ─────
           A dona: "nas minhas alterações, pedi pra fazer uma tela onde a
           empresa escolhe a empresa e depois entra nas vagas disponíveis."

           Ela pediu, e ela não estava vendo — porque aqui havia um desvio
           que pulava a tela quando existia uma empresa só. O argumento era
           razoável ("uma pergunta com uma resposta só é um toque a mais
           para nada"), e estava errado por dois motivos:

             · a tela não é só uma pergunta. É onde se CADASTRA a segunda
               empresa, com o "+" do lado — e quem tem uma só é exatamente
               quem precisa achar esse botão;
             · e o desvio fazia a tela que ela desenhou não existir na
               prática. Ela pediu duas vezes justamente por isso.

           Fica o desvio de quem não tem NENHUMA empresa: ali não há
           escolha nem "+" que faça sentido, e o cadastro é o único caminho
           possível. */
        setLista(empresas);

        /* Sem `await` na mesma corrente, pelo mesmo motivo: os cartões
           aparecem já, e os números entram quando chegarem. */
        resumoDasEmpresas(empresas)
          .then((r) => {
            if (vivo) setResumo(r);
          })
          .catch(() => {
            /* Números que não vieram simplesmente não aparecem. Mostrar
               "0 interessados" numa loja com gente esperando é pior que
               não mostrar nada: o zero faz desistir de entrar. */
          });
      })
      .catch((err) => {
        /* Erro NÃO vira "você não tem empresa": esse caminho manda quem
           tem duas para o formulário de cadastro, e o salvamento criaria
           uma terceira por cima. */
        if (vivo) setErro(mensagemDeErro(err, "Não consegui ler os seus cadastros."));
      });
    return () => {
      vivo = false;
    };
  }, [user, loading, navegar]);

  if (erro) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Suas empresas" />
          <p className="ei-campo-erro ei-margem" role="alert">{erro}</p>
        </div>
      </div>
    );
  }

  if (!lista) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Suas empresas" />
          <p className="ei-apoio ei-margem" style={{ paddingTop: 20 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Suas empresas" />

        <p className="ei-apoio ei-margem" style={{ marginTop: 10 }}>
          Escolha qual você quer abrir agora.
        </p>

        <AvisoPerfilIncompleto lado="company" />

        {/* ── O PLANO DA CONTA, UMA VEZ SÓ (0107) ────────────────────────
            A dona: "o plano é pelo usuário, então se ele quiser utilizar
            as vagas em outras empresas cadastradas ele pode."

            Desde a 0107 o teto é da conta e é somado entre as lojas: com o
            Premium dá para abrir 2 na padaria e 1 na lanchonete. Por isso
            ele aparece aqui em cima, e não dentro de cada cartão —
            repetido em três cartões, "3 de 3" diria que cada loja tem
            três, que é o contrário da regra.

            Fica ACIMA dos cartões porque é ele que responde à pergunta que
            traz a pessoa a esta tela quando ela vem publicar: "ainda cabe
            vaga?". A resposta não muda conforme a loja escolhida. */}
        <PlanoDaConta empresas={lista} resumo={resumo} />

        <div className="ei-empresas">
          {lista.map((e) => (
            <button
              key={e.id}
              type="button"
              className={e.id === escolhida ? "ei-empresa-cartao aberta" : "ei-empresa-cartao"}
              onClick={() => {
                escolherEmpresa(e.id);
                navegar("/painel-empresa");
              }}
            >
              {/* ── O CARTÃO É UMA LINHA, NÃO UMA PILHA — 02/09 ────────
                  A dona: "o card das empresas pode ter design mais
                  aproveitado, com foto da empresa."

                  Era uma pilha: logo de 44px, nome, bairro e selo, um
                  embaixo do outro, cada um ocupando a largura toda e
                  usando um terço dela. Num cartão de tela cheia isso é
                  muito alto para pouca informação — e a foto, que é o que
                  distingue uma loja da outra num relance, era a menor
                  coisa ali.

                  Agora a foto é grande e fica à ESQUERDA, com o nome, o
                  bairro e o selo ao lado, ocupando a largura que sobrava.
                  Os números seguem embaixo, cruzando o cartão inteiro. */}
              <span className="ei-empresa-cabeca">
                <Logo foto={e.photo_url} nome={e.company_name} />
                <span className="ei-empresa-texto">
                  <span className="ei-empresa-nome">{e.company_name}</span>
                  {/* ── O QUE FICA NA SEGUNDA LINHA — 02/09 ────────────
                      A dona: "o card pode ter só o nome da empresa, o
                      número de pessoas interessadas pode tirar e vagas em
                      aberto pode deixar onde tem o nome da cidade (que
                      pode tirar também). As informações do plano não têm
                      que ficar dentro da tela de vagas, ela pode ficar na
                      tela das empresas mostrando o plano atual e quantas
                      vagas 1 de 2."

                      O bairro e a cidade saíram: são as MESMAS em todas as
                      empresas de quem só trabalha em Itabirito, e uma
                      linha igual em todos os cartões não ajuda a escolher
                      nenhum — só ocupa a linha que faltava para o que
                      ajuda.

                      Os interessados saíram porque cada vaga já diz
                      quantos tem, e é lá que se faz alguma coisa com esse
                      número.

                      Ficou o que decide a escolha: o plano desta empresa e
                      quantas vagas ele ainda comporta. */}
                  <span className="ei-empresa-onde">
                    <VagasDaEmpresa quantas={resumo?.porEmpresa.get(e.id)} />
                  </span>
                  {/* "Qual está selecionada" — a dona pediu isso duas
                      vezes, no item 4 e no 6. Sem a marca, a pessoa com
                      duas lojas não tem como saber em qual publicou a
                      vaga.

                      Dizia "Aberta agora", e a dona perguntou o que era —
                      com razão: numa lista de lojas, "aberta agora" lê
                      como horário de funcionamento, que é o que a palavra
                      significa para qualquer comerciante. O selo não fala
                      da loja, fala do APP: é esta que está selecionada, e
                      é nela que a próxima vaga vai ser publicada. */}
                  {e.id === escolhida && (
                    <span className="ei-empresa-aberta-selo">Selecionada</span>
                  )}
                </span>
                <span className="ei-linha-seta" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </span>
            </button>
          ))}

          {/* O "+" ao lado dos cartões, como ela desenhou. Do mesmo tamanho
              deles, para a fileira não ficar torta — e com a palavra junto,
              porque um "+" sozinho não diz o que vai acontecer. */}
          <Link to="/cadastro-empresa?nova=1" className="ei-empresa-cartao ei-empresa-nova">
            <span className="ei-empresa-mais" aria-hidden="true">+</span>
            <span className="ei-empresa-nome">Cadastrar outra</span>
            <span className="ei-empresa-onde">Uma segunda loja, obra ou serviço</span>
          </Link>
        </div>

        <div className="ei-margem" style={{ marginTop: 18 }}>
          <Link to="/profissionais" className="ei-porta ei-porta-laranja">
            <span className="ei-porta-nome">Banco de talentos</span>
            {/* "— vale para as suas empresas" saiu a pedido da dona: a
                lista é da cidade, e explicar que ela serve às duas lojas
                era responder uma pergunta que ninguém faz. */}
            <span className="ei-porta-nota">Quem está procurando trabalho na cidade</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * A marca da empresa no cartão.
 *
 * Sem logo, a inicial — e não um ícone genérico, que faria todas as
 * empresas sem imagem virarem o mesmo quadrado cinza, justamente na tela
 * em que a pessoa precisa distinguir uma da outra num relance.
 *
 * O `onError` cobre a logo que existe no cadastro mas não abre mais
 * (arquivo apagado do Storage): sem ele o navegador desenha o ícone de
 * imagem quebrada, que lê como app defeituoso.
 */
function Logo({ foto, nome }: { foto: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  const inicial = nome.trim().charAt(0).toLocaleUpperCase("pt-BR");
  return (
    <span className="ei-empresa-logo" aria-hidden="true">
      {foto && !falhou ? (
        <img src={foto} alt="" loading="lazy" onError={() => setFalhou(true)} />
      ) : (
        inicial
      )}
    </span>
  );
}

/**
 * A segunda linha do cartão: quantas vagas ESTA loja tem no ar.
 *
 * Só o número desta empresa — o teto é da conta e está lá em cima. Enquanto
 * a consulta não volta fica um traço: um "0" que depois vira "2" é uma
 * mentira curta, e é a que faz a pessoa achar que a loja está parada.
 */
function VagasDaEmpresa({ quantas }: { quantas: number | undefined }) {
  if (quantas === undefined) return <>—</>;
  if (quantas === 0) return <>Nenhuma vaga no ar</>;
  return <>{quantas === 1 ? "1 vaga no ar" : `${quantas} vagas no ar`}</>;
}

/**
 * O plano da conta e quanto dele já está usado.
 *
 * O nome sai do que foi PAGO (`companies.plano`), e não do teto: dois
 * planos podem acabar com o mesmo teto depois de uma promoção, e aí a tela
 * diria o nome errado. Sem nada pago em dia, é o gratuito — que não é um
 * valor no banco (ver PLANO_GRATUITO).
 */
function PlanoDaConta({
  empresas,
  resumo,
}: {
  empresas: Company[];
  resumo: ResumoDasEmpresas | null;
}) {
  const agora = Date.now();
  const forca = { pro: 1, tres: 2, ilimitado: 3 } as const;
  let melhorNome: string | null = null;
  let melhor = 0;
  for (const e of empresas) {
    if (!e.plano || !e.plano_ate || new Date(e.plano_ate).getTime() < agora) continue;
    const f = forca[e.plano as keyof typeof forca] ?? 0;
    if (f > melhor) {
      melhor = f;
      melhorNome = `Plano ${PLANOS_EMPRESA[e.plano]?.nome ?? e.plano}`;
    }
  }
  const nome = melhorNome ?? PLANO_GRATUITO.nome;

  /* Sem plano não há "de quantas": o gratuito não publica vaga, e "0 de 0"
     lê como defeito. `-1` é o sem teto, e "3 de -1" seria o número mágico
     vazando para a tela. */
  const quanto =
    resumo == null
      ? ""
      : resumo.limite === 0
        ? "não publica vaga"
        : resumo.limite < 0
          ? `${resumo.abertas} ${resumo.abertas === 1 ? "vaga no ar" : "vagas no ar"}`
          : `${resumo.abertas} de ${resumo.limite} ${resumo.limite === 1 ? "vaga" : "vagas"}`;

  return (
    <div className="ei-conta-plano ei-margem">
      <span className="ei-conta-plano-nome">{nome}</span>
      {quanto && <span className="ei-conta-plano-nota">{quanto}</span>}
      <Link to="/planos-empresa" className="ei-btn-inline">
        {melhorNome ? "Mudar" : "Ver planos"}
      </Link>
    </div>
  );
}
