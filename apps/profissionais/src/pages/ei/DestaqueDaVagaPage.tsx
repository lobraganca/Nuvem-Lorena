import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pagina } from "../../components/ei/Pagina";
import { IconeFogo } from "../../components/ei/IconeFogo";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { useAuth } from "../../lib/useAuth";
import { mensagemDeErro } from "../../lib/erros";
import { podeVender } from "../../lib/plataforma";
import { SUPORTE_WHATSAPP } from "../../config";
import { minhasEmpresas, listarMinhasVagas } from "../../lib/company";
import {
  DESTAQUE_DIAS,
  precoDoDestaqueDeVagaEmTexto,
  vagaEmDestaque,
  diasDeDestaqueRestantes,
} from "../../lib/destaque";
import type { JobListing } from "../../types/domain";

/**
 * "O que eu ganho pondo a vaga em destaque."
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "o botão de apareça aqui deve direcionar a uma página que
 * explica os benefícios e tenha um botão para direcionar para pagamento
 * (que será configurado depois)."
 *
 * ── O que havia ────────────────────────────────────────────────────────
 *
 * A pastilha "Apareça aqui", ao lado do "Em destaque" do banco de vagas,
 * levava para `/painel-empresa` — a lista de empresas da pessoa. Quem
 * tocasse esperando saber o que é o destaque caía numa tela de
 * administração sem uma palavra sobre destaque nenhum, e tinha de
 * adivinhar que o caminho era entrar numa empresa, abrir uma vaga e rolar
 * até o fim da ficha dela.
 *
 * O bloco de venda existia — no pé da tela de UMA vaga. Ou seja: só
 * encontrava quem já sabia onde estava.
 *
 * ── Por que ela escolhe a vaga aqui dentro ────────────────────────────
 *
 * Destaque é de UMA vaga, não da empresa. A tela lista as vagas abertas
 * com o preço ao lado, e quem já está em destaque aparece marcado — senão
 * a empresa pagaria duas vezes pela mesma vaga sem o app dizer nada.
 *
 * ── O pagamento ───────────────────────────────────────────────────────
 *
 * Continua indo pelo WhatsApp, com o texto pronto, e a administração liga
 * o destaque num toque. A cobrança dentro do app depende do Mercado Pago
 * ligado neste projeto, e nada disso está feito — um botão que abrisse um
 * checkout inexistente seria pior: a empresa pagaria em lugar nenhum.
 *
 * Dentro do app da Play Store a tela NÃO existe (`podeVender`): vender bem
 * digital por fora da cobrança da Google é infração, e apontar o caminho
 * é a mesma infração que vender.
 */
export function DestaqueDaVagaPage() {
  useTituloDaPagina("Vaga em destaque");
  const navegar = useNavigate();
  const { user, loading } = useAuth();

  const [vagas, setVagas] = useState<JobListing[] | null>(null);
  const [semEmpresa, setSemEmpresa] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navegar("/login?lado=contratar", { replace: true });
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const empresas = await minhasEmpresas(user.id);
        if (!vivo) return;
        if (empresas.length === 0) {
          setSemEmpresa(true);
          setVagas([]);
          return;
        }
        /* Todas as empresas da pessoa, e não só a primeira: quem tem duas
           lojas tem vagas nas duas, e mostrar metade delas faria a tela
           parecer que perdeu uma vaga. */
        const listas = await Promise.all(empresas.map((e) => listarMinhasVagas(e.id)));
        if (vivo) setVagas(listas.flat().filter((v) => v.status === "active"));
      } catch (err) {
        if (vivo) setErro(mensagemDeErro(err, "Não consegui ler as suas vagas."));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [user, loading, navegar]);

  if (!podeVender()) {
    navegar("/comecar-empresa", { replace: true });
    return null;
  }

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Vaga em destaque" voltar="/vagas" />

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {/* O que se compra, antes de qualquer preço. Quem chegou aqui pela
            pastilha "Apareça aqui" não sabe o que é destaque — e um preço
            antes da explicação é o jeito mais rápido de a pessoa voltar. */}
        <div className="ei-cartao ei-destaque-capa">
          <span className="ei-destaque-capa-marca" aria-hidden="true">
            <IconeFogo tamanho={22} />
          </span>
          <h2 className="ei-destaque-capa-titulo">Sua vaga no topo da lista</h2>
          <p className="ei-destaque-capa-texto">
            Quem procura emprego em Itabirito abre o banco de vagas e vê as
            vagas em destaque primeiro, numa área só delas — antes de todas as
            outras.
          </p>
        </div>

        <h2 className="ei-secao">O que você leva</h2>
        <div className="ei-lista">
          <div className="ei-linha-item">
            <span className="ei-linha-nome">
              Área própria, no alto do banco de vagas
              <span className="ei-linha-sub">
                Por {DESTAQUE_DIAS} dias, antes da lista comum — e a vaga
                continua também na lista de baixo
              </span>
            </span>
          </div>
          <div className="ei-linha-item">
            <span className="ei-linha-nome">
              Selo “Em destaque”, com o foguinho
              <span className="ei-linha-sub">
                No cartão da vaga e na tela dela, para o olho achar de longe
              </span>
            </span>
          </div>
          <div className="ei-linha-item">
            <span className="ei-linha-nome">
              Acaba sozinho
              <span className="ei-linha-sub">
                Não vira assinatura e não cobra de novo: passados os{" "}
                {DESTAQUE_DIAS} dias, a vaga volta para a lista comum
              </span>
            </span>
          </div>
        </div>

        {/* A frase que o app precisa dizer, e que nenhuma tela de venda diz
            sozinha. Um app que insinua "pague e você contrata" perde a
            confiança da cidade na primeira vaga que não se preencher. */}
        <p className="ei-apoio ei-margem" style={{ marginTop: 14 }}>
          Isto é lugar na lista, não candidato garantido. Publicar a vaga,
          receber quem se interessou e falar com essas pessoas continua sendo
          de graça, com ou sem destaque.
        </p>

        <h2 className="ei-secao">Qual vaga você quer destacar?</h2>

        {vagas === null ? (
          <p className="ei-apoio ei-margem">Carregando…</p>
        ) : semEmpresa ? (
          <div className="ei-cartao">
            <p className="ei-corpo" style={{ marginTop: 0 }}>
              Você ainda não tem empresa cadastrada. O destaque é de uma vaga,
              então primeiro vem a empresa e a vaga.
            </p>
            <Link className="ei-btn ei-btn-cheio ei-btn-largo" to="/cadastro-empresa">
              Cadastrar minha empresa
            </Link>
          </div>
        ) : vagas.length === 0 ? (
          <div className="ei-cartao">
            <p className="ei-corpo" style={{ marginTop: 0 }}>
              Você não tem nenhuma vaga no ar agora. Publique uma e ela pode ir
              para o destaque no mesmo dia.
            </p>
            <Link className="ei-btn ei-btn-cheio ei-btn-largo" to="/criar-vaga">
              Publicar uma vaga
            </Link>
          </div>
        ) : (
          <div className="ei-lista">
            {vagas.map((v) => {
              const jaEsta = vagaEmDestaque(v);
              const faltam = diasDeDestaqueRestantes(v.destaque_ate);
              return (
                <div key={v.id} className="ei-linha-item">
                  <span className="ei-linha-nome">
                    {v.title}
                    <span className="ei-linha-sub">
                      {jaEsta
                        ? faltam === 1
                          ? "Em destaque — termina amanhã"
                          : `Em destaque — faltam ${faltam} dias`
                        : `${precoDoDestaqueDeVagaEmTexto()} por ${DESTAQUE_DIAS} dias`}
                    </span>
                  </span>
                  {jaEsta ? (
                    <span className="ei-selo ei-selo-laranja ei-selo-fogo">
                      <IconeFogo tamanho={13} />
                      Em destaque
                    </span>
                  ) : (
                    /* O pagamento sai daqui, com a vaga já escrita na
                       mensagem: sem o nome dela, a administração teria de
                       perguntar qual é — e essa ida e volta é onde a
                       compra morre. */
                    <a
                      className="ei-btn ei-btn-laranja-pequeno"
                      href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(
                        `Olá! Quero destacar a vaga "${v.title}" por ${DESTAQUE_DIAS} dias (${precoDoDestaqueDeVagaEmTexto()}).`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Destacar
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
