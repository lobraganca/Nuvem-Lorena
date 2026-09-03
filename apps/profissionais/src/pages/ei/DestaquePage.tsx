import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pagina } from "../../components/ei/Pagina";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { useAuth } from "../../lib/useAuth";
import { mensagemDeErro } from "../../lib/erros";
import { lerMeuPerfil } from "../../lib/meuPerfil";
import { podeVender } from "../../lib/plataforma";
import { SUPORTE_WHATSAPP } from "../../config";
import {
  meuDestaque,
  precoDoDestaqueEmTexto,
  diasDeDestaqueRestantes,
  DESTAQUE_DIAS,
} from "../../lib/destaque";

/**
 * "Aparecer primeiro na lista por 7 dias."
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "vou fazer um plano pra quem quer aparecer na lista primeiro.
 * R$ 10,90 por 7 dias. Daí aparece profissional em alta e ele no topo das
 * vagas."
 *
 * ── O que esta tela promete, e o que ela não promete ──────────────────
 *
 * Promete posição na lista e o selo. NÃO promete emprego, e a tela diz
 * isso com todas as letras — quem está desempregado é o público mais
 * vulnerável a uma promessa dessas, e um app que insinua "pague e você é
 * chamado" perde a cidade inteira na primeira semana em que ninguém for
 * chamado.
 *
 * ── Por que o botão ainda leva ao WhatsApp ────────────────────────────
 *
 * A cobrança dentro do app depende do Mercado Pago ligado neste projeto
 * (a conta, a chave nos segredos do Supabase e a função publicada), e
 * nada disso está feito. Um botão que abrisse um checkout inexistente
 * seria pior do que este: a pessoa pagaria em lugar nenhum e ficaria
 * esperando. Aqui ela fala com o suporte, paga por Pix, e a administração
 * liga o destaque num toque (ver `ligarDestaque`).
 *
 * Dentro do app da Play Store esta tela NÃO existe (`podeVender`): a
 * Google não permite vender bem digital por fora da cobrança dela, e
 * apontar o caminho de fora é a mesma violação que vender.
 */
export function DestaquePage() {
  useTituloDaPagina("Aparecer primeiro");
  const navegar = useNavigate();
  const { user, loading } = useAuth();

  const [estado, setEstado] = useState<{ ativo: boolean; ate: string | null } | null>(null);
  const [semCadastro, setSemCadastro] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navegar("/login?lado=trabalhar", { replace: true });
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const perfil = await lerMeuPerfil(user.id);
        if (!vivo) return;
        if (!perfil?.id) {
          setSemCadastro(true);
          return;
        }
        const d = await meuDestaque(perfil.id);
        if (vivo) setEstado(d);
      } catch (err) {
        if (vivo) setErro(mensagemDeErro(err, "Não consegui ler o seu destaque."));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [user, loading, navegar]);

  /* No app da loja a tela nem existe: redireciona, porque uma tela em
     branco com o menu em volta faz a pessoa achar que o app quebrou. */
  if (!podeVender()) {
    navegar("/comecar-profissional", { replace: true });
    return null;
  }

  const faltam = diasDeDestaqueRestantes(estado?.ate);

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Aparecer primeiro" voltar="/meu-desempenho" />

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {semCadastro && (
          <div className="ei-cartao">
            <h2 className="ei-titulo" style={{ marginTop: 0 }}>
              Primeiro, o cadastro
            </h2>
            <p className="ei-corpo">
              Aparecer primeiro só faz diferença com o cadastro preenchido — é ele
              que a empresa lê quando para na sua linha.
            </p>
            <Link className="ei-btn-inline" to="/meu-perfil">
              Preencher agora
            </Link>
          </div>
        )}

        {estado?.ativo && (
          <div className="ei-cartao ei-recado">
            <h2 className="ei-recado-titulo">Você está no topo da lista</h2>
            <p className="ei-recado-texto">
              {faltam === 1
                ? "Termina amanhã."
                : `Faltam ${faltam} dias — até ${new Date(estado.ate!).toLocaleDateString("pt-BR")}.`}{" "}
              Enquanto vale, o seu cadastro aparece antes dos outros e com o selo
              “Em alta”.
            </p>
          </div>
        )}

        {!semCadastro && !estado?.ativo && (
          <>
            <div className="ei-cartao">
              <div className="ei-plano-linha">
                <span className="ei-plano-nome">Aparecer primeiro</span>
                <span className="ei-plano-preco">
                  {precoDoDestaqueEmTexto()}
                  <span className="ei-plano-ciclo"> / {DESTAQUE_DIAS} dias</span>
                </span>
              </div>
              <ul className="ei-plano-lista">
                <li>Seu cadastro no topo do banco de talentos por {DESTAQUE_DIAS} dias</li>
                <li>Selo “Em alta” do lado do seu nome</li>
                <li>Acaba sozinho: não vira assinatura e não cobra de novo</li>
              </ul>

              {/* A frase mais importante da tela. Ver o comentário no topo:
                  um app que insinua "pague e você é chamado" perde a
                  cidade inteira na primeira semana em que ninguém for
                  chamado. */}
              <p className="ei-apoio" style={{ margin: "0 0 14px" }}>
                Isto é lugar na lista, não vaga garantida. Quem decide quem chamar
                continua sendo a empresa — e ver os profissionais e falar com eles é
                de graça para ela, com ou sem destaque.
              </p>

              <a
                className="ei-btn-laranja"
                style={{ margin: 0, width: "100%" }}
                href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(
                  `Olá! Quero o destaque de ${DESTAQUE_DIAS} dias no Ei Emprego (${precoDoDestaqueEmTexto()}).`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Quero aparecer primeiro
              </a>
              <p className="ei-apoio" style={{ marginTop: 10, marginBottom: 0 }}>
                Você fala com a gente, paga por Pix, e o destaque é ligado no mesmo
                dia. O pagamento dentro do app está sendo preparado.
              </p>
            </div>

            <h2 className="ei-secao">O que ajuda de graça</h2>
            <div className="ei-lista">
              <Link to="/meu-perfil" className="ei-linha-item">
                <span className="ei-linha-nome">
                  Foto no cadastro
                  <span className="ei-linha-sub">
                    Numa cidade pequena, reconhecer o rosto é metade da decisão
                  </span>
                </span>
              </Link>
              <Link to="/meu-perfil" className="ei-linha-item">
                <span className="ei-linha-nome">
                  Mais funções que você aceita
                  <span className="ei-linha-sub">
                    Cada função é uma porta: é por elas que a busca encontra
                  </span>
                </span>
              </Link>
              <Link to="/vagas?m=cartoes" className="ei-linha-item">
                <span className="ei-linha-nome">
                  Responder as vagas abertas
                  <span className="ei-linha-sub">
                    Quem responde chega à empresa com nome e telefone
                  </span>
                </span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
