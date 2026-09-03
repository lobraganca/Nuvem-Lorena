import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { uploadProfessionalPhoto } from "../lib/storage";
import { mensagemDeErro } from "../lib/erros";
import { useTituloDaPagina } from "../lib/tituloDaPagina";

/**
 * Consertar um cadastro pela administração.
 *
 * ── O pedido ─────────────────────────────────────────────────────────
 *
 * A dona: "dar a opção de eu consertar alguma coisa dentro do cadastro da
 * empresa e do profissional. Ajustar uma foto, uma palavra mal escrita."
 *
 * É o que ela faz de verdade: alguém cadastra "eletrecista", manda a foto
 * de lado, escreve o bairro errado — e hoje o único caminho é ligar para a
 * pessoa e pedir que ela mesma conserte. Muita gente não volta.
 *
 * ── Por que uma tela enxuta, e não o formulário do dono ──────────────
 *
 * O formulário do dono tem trinta campos, etapas, e regras que só fazem
 * sentido para quem está se cadastrando (confirmar telefone, escolher
 * plano, aceitar termos). Reaproveitá-lo aqui traria junto tudo o que a
 * administração NÃO deve mexer.
 *
 * Aqui só o que se conserta: as palavras e a foto. Telefone confirmado,
 * plano, suspensão e situação ficam de fora — cada um tem o seu lugar, e
 * telefone em especial é o dado que a 0076 protege com gatilho, porque ele
 * é a prova de identidade de quem recebe a vaga.
 *
 * ── Quem pode ────────────────────────────────────────────────────────
 *
 * Quem está em `admins`, e quem decide é o BANCO: a policy de UPDATE de
 * `professionals` (0008) e a de `companies` (0112). Esta tela só oferece o
 * caminho — se a permissão não existir, o salvar volta com o erro do banco
 * em vez de fingir que deu certo.
 */
type Tipo = "profissional" | "empresa";

const CAMPOS: Record<Tipo, { tabela: string; titulo: string; campos: Array<{ id: string; rotulo: string; linhas?: number; ajuda?: string }> }> = {
  profissional: {
    tabela: "professionals",
    titulo: "Corrigir cadastro",
    campos: [
      { id: "name", rotulo: "Nome" },
      { id: "especialidade", rotulo: "Especialidade", ajuda: "O recorte do ofício — “telhados”, “pintura de portão”." },
      { id: "bio", rotulo: "Resumo sobre a pessoa", linhas: 4 },
      { id: "neighborhood", rotulo: "Bairro" },
    ],
  },
  empresa: {
    tabela: "companies",
    titulo: "Corrigir empresa",
    campos: [
      { id: "company_name", rotulo: "Nome da empresa" },
      { id: "responsible_name", rotulo: "Quem responde pela empresa" },
      { id: "description", rotulo: "O que a empresa faz", linhas: 4 },
      { id: "neighborhood", rotulo: "Bairro" },
    ],
  },
};

export function AdminCorrigir() {
  const { tipo, id } = useParams<{ tipo: string; id: string }>();
  const qual = (tipo === "empresa" ? "empresa" : "profissional") as Tipo;
  const config = CAMPOS[qual];
  useTituloDaPagina(config.titulo);
  const navegar = useNavigate();

  const [valores, setValores] = useState<Record<string, string>>({});
  const [foto, setFoto] = useState<string | null>(null);
  const [dono, setDono] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    const sb = supabase();
    if (!sb || !id) return;
    let vivo = true;
    (async () => {
      const { data, error } = await sb.from(config.tabela).select("*").eq("id", id).limit(1);
      if (!vivo) return;
      if (error) {
        setErro(mensagemDeErro(error, "Não consegui abrir este cadastro."));
      } else {
        const linha = ((data ?? [])[0] ?? null) as Record<string, unknown> | null;
        if (!linha) {
          setErro("Cadastro não encontrado.");
        } else {
          const v: Record<string, string> = {};
          for (const c of config.campos) v[c.id] = String(linha[c.id] ?? "");
          setValores(v);
          setFoto((linha.photo_url as string) ?? null);
          setDono((linha.owner_id as string) ?? null);
        }
      }
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [config, id]);

  async function salvar() {
    const sb = supabase();
    if (!sb || !id) return;
    setSalvando(true);
    setErro("");
    setSalvo(false);
    try {
      /* Só os campos desta tela. Mandar a linha inteira de volta
         sobrescreveria com valores velhos tudo o que mudou no banco desde
         que a tela abriu — e aqui quem edita não é o dono do cadastro. */
      const mudancas: Record<string, string | null> = {};
      for (const c of config.campos) mudancas[c.id] = valores[c.id]?.trim() || null;
      const { error } = await sb.from(config.tabela).update(mudancas).eq("id", id);
      if (error) throw error;
      setSalvo(true);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui salvar a correção."));
    } finally {
      setSalvando(false);
    }
  }

  async function trocarFoto(arquivo: File) {
    const sb = supabase();
    if (!sb || !id || !dono) return;
    setEnviandoFoto(true);
    setErro("");
    try {
      /* A foto vai para a pasta do DONO, e não da administração: é a regra
         da 0058, e sem ela a imagem fica num caminho que o dono não pode
         apagar depois. */
      const url = await uploadProfessionalPhoto(dono, arquivo);
      const { error } = await sb.from(config.tabela).update({ photo_url: url }).eq("id", id);
      if (error) throw error;
      setFoto(url);
      setSalvo(true);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui trocar a foto."));
    } finally {
      setEnviandoFoto(false);
    }
  }

  if (carregando) return <p className="muted">Abrindo o cadastro…</p>;

  return (
    <section style={{ display: "grid", gap: 14 }}>
      {erro && <p className="admin-resumo-erro">{erro}</p>}

      <div className="card" style={{ padding: 14, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--color-bg-soft)",
              display: "grid",
              placeItems: "center",
              flex: "none",
            }}
          >
            {foto ? (
              <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span className="muted">sem foto</span>
            )}
          </span>
          <label className="btn btn-outline" style={{ margin: 0 }}>
            {enviandoFoto ? "Enviando…" : "Trocar a foto"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              disabled={enviandoFoto || !dono}
              onChange={(e) => {
                const a = e.target.files?.[0];
                if (a) trocarFoto(a);
              }}
            />
          </label>
        </div>

        {config.campos.map((c) => (
          <div key={c.id} className="ei-campo">
            <label htmlFor={`corrigir-${c.id}`}>{c.rotulo}</label>
            {c.linhas ? (
              <textarea
                id={`corrigir-${c.id}`}
                rows={c.linhas}
                value={valores[c.id] ?? ""}
                onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
              />
            ) : (
              <input
                id={`corrigir-${c.id}`}
                value={valores[c.id] ?? ""}
                onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
              />
            )}
            {c.ajuda && <span className="ei-campo-ajuda">{c.ajuda}</span>}
          </div>
        ))}
      </div>

      {salvo && !erro && <p className="card">Correção salva.</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar correção"}
        </button>
        <button className="btn btn-outline" onClick={() => navegar(-1)}>
          Voltar
        </button>
      </div>

      {/* O que esta tela NÃO mexe, dito por escrito: sem isso a
          administração procura aqui o que está noutro lugar. */}
      <p className="muted" style={{ fontSize: "0.83rem" }}>
        Telefone confirmado, plano e situação do cadastro não se mudam aqui — o
        telefone é a prova de quem recebe a vaga, e o plano fica na lista de empresas.
      </p>
    </section>
  );
}
