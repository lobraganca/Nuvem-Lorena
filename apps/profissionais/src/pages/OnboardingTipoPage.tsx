import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { registrarTipoDeUsuario, marcarOnboardingCompleto } from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import { Pagina } from "../components/ei/Pagina";

/**
 * Primeira página após login/criar conta: escolhe se é profissional ou empresa.
 *
 * Depois disso:
 * - Profissional → CadastroPage (nome, foto, serviço, bairro, etc)
 * - Empresa → CadastroEmpresaPage (razão social, CNPJ, endereço, etc)
 */
export function OnboardingTipoPage() {
  useTituloDaPagina("De que lado você está?");
  const navegar = useNavigate();
  const { user, loading } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navegar("/login", { replace: true });
    }
  }, [user, loading, navegar]);

  async function escolherProfissional() {
    if (!user) return;
    setEnviando(true);
    setErro("");

    try {
      await registrarTipoDeUsuario(user.id, "professional");
      await marcarOnboardingCompleto(user.id);
      // Vai para cadastro de profissional
      navegar("/painel/novo", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível continuar."));
      setEnviando(false);
    }
  }

  async function escolherEmpresa() {
    if (!user) return;
    setEnviando(true);
    setErro("");

    try {
      await registrarTipoDeUsuario(user.id, "company");
      // Vai para cadastro de empresa (não marca completo ainda)
      navegar("/cadastro-empresa", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível continuar."));
      setEnviando(false);
    }
  }

  if (loading) {
    return <div className="container" style={{ paddingTop: 48, textAlign: "center" }}>
      <span className="muted">Carregando…</span>
    </div>;
  }

  return (
    /* A MESMA pergunta da tela inicial, com as MESMAS palavras.
       ────────────────────────────────────────────────────────
       Esta tela só aparece para quem acabou de criar a conta e ainda não
       disse de que lado está — por isso passou tanto tempo sem ser aberta,
       e por isso era a mais atrasada do app.

       Ela perguntava "Qual é seu tipo de conta?" e oferecia "Sou
       profissional" e "Sou empresa/contratante". A tela inicial faz a
       MESMA pergunta, três toques antes, assim: "De que lado você está?",
       "Procuro trabalho", "Estou contratando". Duas linguagens para a
       mesma decisão fazem a pessoa achar que são decisões diferentes — e
       "tipo de conta" é palavra de sistema, não de gente.

       O texto de apoio era do procurô, palavra por palavra: "apareça aqui
       e receba CLIENTES" (aqui não se recebe cliente, se recebe vaga) e
       "preciso de profissionais — BUSQUE aqui" (a empresa não busca, ela
       publica a vaga e o app avisa quem encaixa). O ícone do lado da
       empresa era uma LUPA, pelo mesmo motivo.

       E sumiu o "você pode mudar de ideia depois, mas preencha seu tipo
       principal primeiro": ninguém sabe o que é um "tipo principal", e a
       frase pedia calma para uma dúvida que a tela não criou. */
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="De que lado você está?" />

        <div className="ei-portas" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="ei-porta ei-porta-cheia"
            disabled={enviando}
            onClick={escolherProfissional}
          >
            <span className="ei-porta-nome">Procuro trabalho</span>
            <span className="ei-porta-nota">Receba as vagas do seu ofício</span>
          </button>

          <button
            type="button"
            className="ei-porta"
            disabled={enviando}
            onClick={escolherEmpresa}
          >
            <span className="ei-porta-nome">Estou contratando</span>
            <span className="ei-porta-nota">Publique e avise a cidade</span>
          </button>
        </div>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 14 }} role="alert">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
