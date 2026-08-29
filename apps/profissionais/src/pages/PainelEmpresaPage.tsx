import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  obterMinhaEmpresa,
  listarMinhasVagas,
  confirmarTelefoneDaEmpresa,
} from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import type { Company, JobListing } from "../types/domain";

/**
 * Painel principal da empresa.
 *
 * - Mostra dados da empresa
 * - Lista vagas ativas
 * - Botão para criar nova vaga
 * - Acesso a respostas/ondas de cada vaga
 */
export function PainelEmpresaPage() {
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [empresa, setEmpresa] = useState<Company | null>(null);
  const [vagas, setVagas] = useState<JobListing[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  /**
   * Confirma o telefone da empresa.
   *
   * Quem confere tudo é o banco. O caso que exige cuidado aqui é o do
   * número que a conta de login NÃO confirmou: a função recusa com uma
   * mensagem técnica, e traduzi-la é o que separa "faça isto" de "deu
   * erro". Sem isso, a empresa fica olhando uma frase sobre código sem
   * saber que o caminho é entrar pelo telefone.
   */
  async function confirmarTelefone() {
    if (!empresa) return;
    setConfirmando(true);
    setErro("");
    try {
      await confirmarTelefoneDaEmpresa(empresa.id);
      await carregarDados();
    } catch (err) {
      const texto = mensagemDeErro(err, "Não foi possível confirmar o telefone.");
      setErro(
        texto.includes("ainda não foi confirmado")
          ? "Para confirmar, sua conta precisa ter entrado com este mesmo número. " +
              "Saia e entre de novo usando o telefone da empresa."
          : texto.includes("diferente")
            ? "O número do cadastro da empresa é diferente do número com que você entrou. " +
                "Ajuste um dos dois para que fiquem iguais."
            : texto
      );
    } finally {
      setConfirmando(false);
    }
  }

  useEffect(() => {
    if (carregandoConta || !user) return;

    carregarDados();
  }, [user, carregandoConta]);

  async function carregarDados() {
    try {
      const minha = await obterMinhaEmpresa(user?.id || "");
      if (!minha) {
        navegar("/cadastro-empresa", { replace: true });
        return;
      }
      setEmpresa(minha);

      const minhasVagas = await listarMinhasVagas(minha.id);
      setVagas(minhasVagas);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível carregar os dados."));
    } finally {
      setCarregando(false);
    }
  }

  if (carregandoConta || carregando) {
    return <div className="container" style={{ paddingTop: 48 }}>
      <span className="muted">Carregando…</span>
    </div>;
  }

  if (!empresa) {
    return <div className="container" style={{ paddingTop: 48 }}>
      <p className="muted">Empresa não encontrada.</p>
    </div>;
  }

  return (
    <div className="container painel-empresa" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h1>Painel da Empresa</h1>

      {erro && (
        <div style={{ color: "var(--color-danger)", marginBottom: 16, padding: 12, backgroundColor: "var(--color-danger-light)", borderRadius: 8 }}>
          {erro}
        </div>
      )}

      {/* Dados da empresa */}
      <section className="card" style={{ marginBottom: 24, padding: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {empresa.photo_url && (
            <img
              src={empresa.photo_url}
              alt={empresa.company_name}
              style={{
                width: 80,
                height: 80,
                borderRadius: 8,
                objectFit: "cover",
              }}
            />
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: "0 0 4px 0" }}>{empresa.company_name}</h2>
            <p className="muted" style={{ margin: "0 0 8px 0" }}>
              {empresa.neighborhood && `${empresa.neighborhood} • `}
              {empresa.city}/{empresa.uf}
            </p>
            {empresa.description && (
              <p style={{ margin: 0, fontSize: "0.95em" }}>{empresa.description}</p>
            )}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navegar("/painel/editar-empresa")}
          >
            Editar
          </button>
        </div>
      </section>

      {/* O telefone confirmado, antes de qualquer coisa.
          ────────────────────────────────────────────────
          Fica ACIMA do botão de criar vaga, e não escondido nas
          configurações, porque é o que separa uma empresa de um número
          digitado — e do lado de quem contrata isso pesa mais: quem
          responde à vaga vai procurar essa empresa de volta, e é aí que
          mora o golpe do falso emprego.

          O botão de criar vaga continua ali, aceso: quem trava a publicação
          é a própria tela de criação, com o motivo escrito. Desabilitar
          aqui deixaria a empresa olhando um botão cinza sem saber o que
          fazer para acendê-lo. */}
      {!empresa.phone_verified && (
        <div className="whats-pendente" style={{ marginBottom: 16 }}>
          <p>
            <strong>Confirme o telefone da empresa.</strong> É por ele que os
            profissionais vão procurar vocês de volta — e sem ele a vaga não sai.
          </p>
          <button
            type="button"
            className="btn btn-outline"
            disabled={confirmando}
            onClick={confirmarTelefone}
          >
            {confirmando ? "Confirmando…" : "Confirmar agora"}
          </button>
        </div>
      )}

      {/* Ação principal */}
      <div style={{ marginBottom: 24 }}>
        <button
          className="btn btn-primary btn-block"
          onClick={() => navegar("/criar-vaga")}
        >
          + Criar nova vaga
        </button>
      </div>

      {/* Vagas ativas */}
      <section>
        <h2 style={{ marginTop: 0 }}>
          Vagas ativas
          {vagas.length > 0 && ` (${vagas.length})`}
        </h2>

        {vagas.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <p className="muted">Nenhuma vaga criada ainda.</p>
            <p className="muted" style={{ fontSize: "0.9em" }}>
              Comece criando uma vaga para procurar por profissionais na sua cidade.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {vagas.map((vaga) => (
              <div
                key={vaga.id}
                className="card"
                style={{ padding: 16, cursor: "pointer" }}
                onClick={() => navegar(`/vaga/${vaga.id}`)}
              >
                <h3 style={{ margin: "0 0 4px 0" }}>{vaga.title}</h3>
                <p className="muted" style={{ margin: "0 0 8px 0", fontSize: "0.9em" }}>
                  {vaga.profession}
                  {vaga.specialty && ` • ${vaga.specialty}`}
                </p>
                <div style={{ display: "flex", gap: 16, fontSize: "0.9em" }}>
                  <span className="muted">
                    📅 {new Date(vaga.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="muted">
                    ✉️ {vaga.work_modality}
                  </span>
                  {vaga.salary_range_min && vaga.salary_range_max && (
                    <span className="muted">
                      💰 R$ {(vaga.salary_range_min / 100).toLocaleString("pt-BR")} - R$ {(vaga.salary_range_max / 100).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
