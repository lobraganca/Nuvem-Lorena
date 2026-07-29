import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { STORAGE_BUDGET_BYTES, dataUrlBytes, formatBytes, isImagePhoto } from "../lib/photos";

export function MyData() {
  const { exportData, importData, experiences, bookings, people } = useAvena();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const photoBytes = experiences
    .flatMap((e) => e.photos)
    .filter(isImagePhoto)
    .reduce((sum, p) => sum + dataUrlBytes(p), 0);
  const usedPct = Math.min(100, Math.round((photoBytes / STORAGE_BUDGET_BYTES) * 100));

  function download() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `avena-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Backup salvo. Guarde o arquivo em outro lugar além deste aparelho.");
    setError(null);
  }

  async function restore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !confirm(
        "Restaurar o backup substitui tudo o que está no app agora. Deseja continuar?"
      )
    ) {
      return;
    }
    try {
      importData(await file.text());
      setMessage("Backup restaurado.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
      setMessage(null);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="page">
      <Link to="/profile" className="back-link">
        ← Voltar ao perfil
      </Link>
      <h1>Meus dados</h1>

      <div className="sandbox-warning" role="note">
        <strong>Seus dados estão apenas neste navegador.</strong> Ainda não existe
        conta com login nesta versão, então limpar os dados do navegador, trocar de
        aparelho ou usar uma janela anônima faz suas memórias desaparecerem. Faça o
        backup abaixo e guarde o arquivo.
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <strong>{experiences.length}</strong>
          <span className="muted">experiências</span>
        </div>
        <div className="stat-card">
          <strong>{people.length}</strong>
          <span className="muted">pessoas</span>
        </div>
        <div className="stat-card">
          <strong>{bookings.length}</strong>
          <span className="muted">reservas</span>
        </div>
      </div>

      <h2 className="timeline-title">Espaço usado por fotos</h2>
      <div
        className="storage-bar"
        role="progressbar"
        aria-valuenow={usedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Espaço usado por fotos"
      >
        <div className="storage-bar-fill" style={{ width: `${usedPct}%` }} />
      </div>
      <p className="muted">
        {formatBytes(photoBytes)} de aproximadamente{" "}
        {formatBytes(STORAGE_BUDGET_BYTES)} disponíveis neste navegador ({usedPct}%).
        {usedPct > 75 &&
          " Está perto do limite: faça o backup e remova fotos de memórias antigas."}
      </p>

      <h2 className="timeline-title">Backup</h2>
      <div className="chip-row">
        <button type="button" className="btn-primary" onClick={download}>
          Baixar backup
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => inputRef.current?.click()}
        >
          Restaurar backup
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={restore}
          aria-label="Escolher arquivo de backup"
        />
      </div>

      {message && <p className="availability-note">{message}</p>}
      {error && <p className="form-error">{error}</p>}

      <h2 className="timeline-title">Seus direitos</h2>
      <p className="muted">
        A LGPD garante que você acesse, corrija e apague seus dados. O botão de
        backup entrega tudo o que o app guarda sobre você em formato aberto.
        Para apagar, use "Restaurar backup" com um arquivo vazio ou limpe os
        dados do navegador. Detalhes na{" "}
        <Link to="/privacidade">Política de Privacidade</Link>.
      </p>
    </div>
  );
}
