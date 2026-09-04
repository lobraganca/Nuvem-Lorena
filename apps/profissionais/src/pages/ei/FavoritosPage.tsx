import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import {
  lerFavoritosCompletos,
  type EmpresaFavorita,
  type PessoaFavorita,
} from "../../lib/favoritos";
import { Pagina } from "../../components/ei/Pagina";
import Esqueleto from "../../components/ei/Esqueleto";

/**
 * Onde ficam os favoritos.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "ter opção de favoritar empresas e candidatos e ter onde ver os
 * favoritos."
 *
 * ── UMA TELA PARA OS DOIS LADOS ────────────────────────────────────────
 *
 * Quem contrata guarda candidatos; quem procura trabalho guarda empresas.
 * São públicos diferentes e nunca se cruzam — o que sugeriria duas telas.
 *
 * É uma só, e por um motivo prático: a mesma conta pode ser os dois. Numa
 * cidade pequena quem tem loja também procura trabalho, e o app já deixa
 * ter os dois lados no mesmo número. Duas telas obrigariam essa pessoa a
 * lembrar em qual delas guardou o quê.
 *
 * Cada seção só aparece quando tem alguém dentro: uma seção "Empresas" com
 * a frase "você não guardou nenhuma" é uma linha para dizer que não há
 * linha nenhuma.
 */
export function FavoritosPage() {
  useTituloDaPagina("Favoritos");
  const { user, loading } = useAuth();

  const [empresas, setEmpresas] = useState<EmpresaFavorita[]>([]);
  const [pessoas, setPessoas] = useState<PessoaFavorita[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    let vivo = true;
    lerFavoritosCompletos(user.id)
      .then((f) => {
        if (!vivo) return;
        setEmpresas(f.empresas);
        setPessoas(f.pessoas);
      })
      .catch((err) => {
        /* Erro NÃO vira lista vazia. Esta é a tela cujo assunto SÃO os
           favoritos: "você não guardou nada" só pode aparecer quando for
           verdade, senão a pessoa acha que o app perdeu o que ela salvou. */
        if (vivo) setErro(mensagemDeErro(err, "Não consegui abrir os seus favoritos."));
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [user, loading]);

  const vazio = !carregando && !erro && empresas.length === 0 && pessoas.length === 0;

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Favoritos" />

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {carregando && (
          <Esqueleto />
        )}

        {vazio && (
          <div className="ei-cartao" style={{ padding: 0, marginTop: 12 }}>
            <div className="ei-vazio">
              <span className="ei-vazio-icone" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
                     strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20.3s-7.5-4.6-7.5-9.6a4.3 4.3 0 0 1 7.5-2.9 4.3 4.3 0 0 1 7.5 2.9c0 5-7.5 9.6-7.5 9.6z" />
                </svg>
              </span>
              <h3 className="ei-titulo">Nada guardado ainda</h3>
              {/* A frase diz ONDE se guarda, e não só que está vazio: a
                  pergunta de quem chega numa tela vazia é "como eu ponho
                  alguma coisa aqui?". */}
              <p className="ei-apoio">
                Toque no coração numa empresa ou num cadastro para guardar aqui.
              </p>
            </div>
          </div>
        )}

        {pessoas.length > 0 && (
          <>
            <div className="ei-secao">
              <h2>
                {pessoas.length} {pessoas.length === 1 ? "pessoa" : "pessoas"}
              </h2>
            </div>
            <div className="ei-lista">
              {pessoas.map((p) => (
                <Link key={p.id} to={`/profissional/${p.id}`} className="ei-pessoa">
                  <Retrato foto={p.foto} nome={p.nome} />
                  <div className="ei-pessoa-texto">
                    <div className="ei-pessoa-nome ei-uma-linha">{p.nome}</div>
                    <div className="ei-pessoa-oficio ei-uma-linha">
                      {p.oficios.slice(0, 2).join(" · ") || "Sem função"}
                      {p.oficios.length > 2 && ` +${p.oficios.length - 2}`}
                    </div>
                  </div>
                  <IconeSeta />
                </Link>
              ))}
            </div>
          </>
        )}

        {empresas.length > 0 && (
          <>
            <div className="ei-secao">
              <h2>
                {empresas.length} {empresas.length === 1 ? "empresa" : "empresas"}
              </h2>
            </div>
            <div className="ei-lista">
              {empresas.map((e) => (
                <Link key={e.id} to={`/empresa/${e.id}`} className="ei-pessoa">
                  <Retrato foto={e.foto} nome={e.nome} />
                  <div className="ei-pessoa-texto">
                    <div className="ei-pessoa-nome ei-uma-linha">{e.nome}</div>
                    <div className="ei-pessoa-oficio ei-uma-linha">{e.onde}</div>
                  </div>
                  <IconeSeta />
                </Link>
              ))}
            </div>
            {/* A empresa favoritada que fechou todas as vagas some da lista
                (a `companies_public` só mostra quem tem vaga no ar). Dizer
                isso evita que a pessoa ache que o app perdeu o favorito
                dela — que é a suspeita natural quando um item some. */}
            <p className="ei-apoio ei-margem" style={{ marginTop: 10 }}>
              Empresa sem nenhuma vaga no ar não aparece aqui — ela volta quando
              publicar de novo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * O rosto ou a logo. Sem imagem, a inicial — e não um ícone genérico, que
 * faria todos os itens sem foto virarem o mesmo quadrado cinza justamente
 * na tela em que se procura reconhecer alguém.
 */
function Retrato({ foto, nome }: { foto: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <span className="ei-pessoa-retrato" aria-hidden="true">
      {foto && !falhou ? (
        <img src={foto} alt="" loading="lazy" onError={() => setFalhou(true)} />
      ) : (
        nome.trim().charAt(0).toLocaleUpperCase("pt-BR")
      )}
    </span>
  );
}

function IconeSeta() {
  return (
    <span className="ei-linha-seta" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
           strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </span>
  );
}
