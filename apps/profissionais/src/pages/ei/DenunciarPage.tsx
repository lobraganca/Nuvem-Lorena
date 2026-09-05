import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pagina } from "../../components/ei/Pagina";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { useAuth } from "../../lib/useAuth";
import { mensagemDeErro } from "../../lib/erros";
import { SUPORTE_WHATSAPP } from "../../config";
import {
  enviarDenuncia,
  faltaAMigracaoDaDenuncia,
  jaDenunciou,
  MOTIVOS_DA_VAGA,
  MOTIVOS_DO_PERFIL,
  type AlvoDaDenuncia,
} from "../../lib/denuncias";

/**
 * "Isto aqui está errado, e é por isso."
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "a situação de denunciar o perfil deve ser direcionado ao painel
 * administrativo, com a solicitação e descrição para que eu veja e tenha a
 * possibilidade de tirar a vaga ou o usuário do ar."
 *
 * ── Por que uma tela, e não o WhatsApp ────────────────────────────────
 *
 * Era o WhatsApp: os dois botões de denunciar abriam uma conversa com um
 * texto pronto. Funcionava para mandar; não funcionava para RECEBER. Uma
 * conversa não tem fila, não tem estado, some no meio das outras mensagens
 * e não tem o botão de tirar do ar do lado do caso. A tabela e o painel
 * existiam desde o começo do projeto — faltava o app escrever neles.
 *
 * ── Motivo de lista, descrição livre ──────────────────────────────────
 *
 * O motivo é escolhido numa lista curta; a história vai no campo aberto
 * embaixo. Motivo digitado à mão vira "não gostei", e aí não dá para
 * separar o golpe do desentendimento — que é justamente a separação que
 * decide se alguém sai do ar.
 *
 * ── O aviso que não pode faltar ───────────────────────────────────────
 *
 * A tela diz, antes do botão, que a denúncia tem autor e que acusar
 * falsamente é crime (art. 339 e 340 do Código Penal). Não é ameaça a
 * quem denuncia de verdade — quem foi vítima de golpe quer mesmo se
 * identificar. É a única coisa que segura a denúncia gratuita contra um
 * concorrente, que é o uso previsível de qualquer botão desses numa cidade
 * pequena onde todo mundo se conhece.
 */
export function DenunciarPage() {
  const { tipo, id } = useParams();
  const alvo: AlvoDaDenuncia = tipo === "vaga" ? "vaga" : "perfil";
  const ehVaga = alvo === "vaga";

  useTituloDaPagina(ehVaga ? "Denunciar esta vaga" : "Denunciar este cadastro");
  const navegar = useNavigate();
  const { user, loading } = useAuth();

  const [motivo, setMotivo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  /* Quando o banco recusa por falta da 0121, o caminho antigo volta a
     aparecer: melhor a denúncia chegar pelo WhatsApp do que não chegar. */
  const [caiuNoWhatsapp, setCaiuNoWhatsapp] = useState(false);
  const [pronto, setPronto] = useState(false);

  const motivos = ehVaga ? MOTIVOS_DA_VAGA : MOTIVOS_DO_PERFIL;
  const voltarPara = ehVaga ? `/vaga-aberta/${id}` : `/profissional/${id}`;

  useEffect(() => {
    if (loading) return;
    /* Sem conta não dá para denunciar, e o motivo está na 0035: denúncia
       anônima é a ferramenta mais barata que existe para tirar um
       concorrente do ar. Levar para o login, e não mostrar um formulário
       que vai ser recusado no fim. */
    if (!user) navegar("/login", { replace: true });
  }, [user, loading, navegar]);

  /* A confirmação do número é exigida pelo banco (0045). Conferir aqui
     também evita a pessoa escrever a história inteira para ouvir um "sem
     permissão" no fim — que é como se perde uma denúncia legítima. */
  const semNumeroConfirmado = !!user && !user.phone_confirmed_at;

  const textoDoWhatsapp = encodeURIComponent(
    ehVaga
      ? `Quero denunciar uma vaga do Ei Emprego:\n${window.location.origin}/#/vaga-aberta/${id}\n\nMotivo: ${motivo}\nO que aconteceu: ${descricao}`
      : `Quero denunciar um cadastro do Ei Emprego:\n${window.location.origin}/#/profissional/${id}\n\nMotivo: ${motivo}\nO que aconteceu: ${descricao}`
  );

  async function enviar() {
    if (!user || !id) return;
    if (!motivo) {
      setErro("Escolha o motivo.");
      return;
    }
    if (descricao.trim().length < 10) {
      setErro("Conte o que aconteceu, mesmo que em poucas palavras.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      await enviarDenuncia({
        alvo,
        alvoId: id,
        motivo,
        descricao,
        denuncianteId: user.id,
      });
      setPronto(true);
    } catch (err) {
      if (jaDenunciou(err)) {
        /* Não é erro dela: já denunciou e ainda está em apuração. Dizer
           isso é o que impede a pessoa de tentar de novo achando que não
           foi. */
        setPronto(true);
      } else if (faltaAMigracaoDaDenuncia(err)) {
        setCaiuNoWhatsapp(true);
      } else {
        setErro(mensagemDeErro(err, "Não consegui enviar sua denúncia agora."));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina
          titulo={ehVaga ? "Denunciar esta vaga" : "Denunciar este cadastro"}
          voltar={voltarPara}
        />

        {pronto ? (
          <div className="ei-cartao">
            <h2 className="ei-titulo" style={{ marginTop: 0 }}>
              Recebemos sua denúncia
            </h2>
            <p className="ei-corpo">
              Ela foi para quem cuida do app, com o que você escreveu. Se a
              gente confirmar o que você contou,{" "}
              {ehVaga ? "a vaga sai do ar" : "o cadastro sai do ar"} — e a
              gente pode te chamar no seu telefone para entender melhor.
            </p>
            <p className="ei-apoio">
              Se alguém está te pedindo dinheiro, não pague nada. O Ei Emprego
              nunca cobra para você se candidatar.
            </p>
            <Link className="ei-btn ei-btn-cheio ei-btn-largo" to={voltarPara}>
              Voltar
            </Link>
          </div>
        ) : caiuNoWhatsapp ? (
          /* A 0121 ainda não foi aplicada no banco. Em vez de um erro que
             faz a pessoa desistir de denunciar um golpe, o caminho antigo,
             já com o texto dela dentro. */
          <div className="ei-cartao">
            <h2 className="ei-titulo" style={{ marginTop: 0 }}>
              Vamos por aqui
            </h2>
            <p className="ei-corpo">
              A denúncia de vaga pelo app está sendo ligada agora. Enquanto
              isso, é só tocar no botão abaixo: o que você escreveu já vai
              junto na mensagem.
            </p>
            <a
              className="ei-btn ei-btn-cheio ei-btn-largo"
              href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${textoDoWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Mandar no WhatsApp
            </a>
          </div>
        ) : semNumeroConfirmado ? (
          <div className="ei-cartao">
            <h2 className="ei-titulo" style={{ marginTop: 0 }}>
              Confirme seu telefone antes
            </h2>
            <p className="ei-corpo">
              Denúncia tem autor — é o que impede alguém de derrubar o anúncio
              de um concorrente de graça. Confirmar o seu número leva um
              minuto e o código chega por SMS.
            </p>
            <Link className="ei-btn ei-btn-cheio ei-btn-largo" to="/perfil">
              Confirmar meu telefone
            </Link>
            <a
              className="ei-btn ei-btn-texto"
              style={{ marginTop: 10 }}
              href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${textoDoWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ou fale direto com a gente no WhatsApp
            </a>
          </div>
        ) : (
          <>
            <div className="ei-cartao">
              <div className="ei-campo">
                <label htmlFor="motivo-denuncia">
                  {ehVaga ? "O que há de errado nesta vaga?" : "O que há de errado neste cadastro?"}
                </label>
                {/* Botões e não uma caixa de seleção: numa lista de cinco,
                    a caixa esconde quatro opções atrás de um toque, e a
                    pessoa escolhe a primeira. */}
                <div className="ei-opcoes ei-opcoes-lista" id="motivo-denuncia">
                  {motivos.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={motivo === m ? "ei-opcao-botao ativo" : "ei-opcao-botao"}
                      aria-pressed={motivo === m}
                      onClick={() => setMotivo(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ei-campo">
                <label htmlFor="descricao-denuncia">Conte o que aconteceu</label>
                <textarea
                  id="descricao-denuncia"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={5}
                />
                <p className="ei-apoio" style={{ marginTop: 6 }}>
                  Quanto mais detalhe, mais rápido a gente resolve: o que
                  pediram, quando foi, por onde falaram com você.
                </p>
              </div>

              {erro && (
                <p className="ei-campo-erro" role="alert">
                  {erro}
                </p>
              )}

              <button
                type="button"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                disabled={enviando}
                onClick={enviar}
              >
                {enviando ? "Enviando…" : "Enviar denúncia"}
              </button>
            </div>

            {/* O aviso vem DEPOIS do botão, e não antes: no alto ele
                assustaria quem foi vítima de golpe e está com o dedo
                trêmulo. Aqui ele cumpre o papel de segurar a denúncia
                gratuita sem espantar a legítima. */}
            <p className="ei-apoio ei-margem" style={{ marginTop: 14 }}>
              Sua denúncia vai identificada com a sua conta. Acusar alguém
              falsamente é crime (arts. 339 e 340 do Código Penal).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
