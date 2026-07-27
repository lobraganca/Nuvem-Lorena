import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { profileStats } from "../lib/stats";
import { buildCollections } from "../lib/collections";
import { categoryEmoji } from "../lib/categories";

export function Profile() {
  const { experiences, people, user, updateUser } = useAvena();
  const stats = profileStats(experiences);
  const collections = buildCollections(experiences);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [isPrivate, setIsPrivate] = useState(user.isPrivate);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const companyCounts = new Map<string, number>();
  for (const exp of experiences) {
    for (const pid of exp.peopleIds) {
      companyCounts.set(pid, (companyCounts.get(pid) ?? 0) + 1);
    }
  }
  const topCompany = [...companyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topPerson = topCompany ? people.find((p) => p.id === topCompany[0]) : undefined;

  const sortedExperiences = [...experiences].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateUser({ avatarPhoto: reader.result as string });
    reader.readAsDataURL(file);
  }

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    updateUser({ name, username, bio, isPrivate });
    setEditing(false);
  }

  return (
    <div className="page page-wide">
      <Link to="/" className="back-link">
        ← Voltar ao mapa
      </Link>

      <div className="ig-header">
        <button
          type="button"
          className="ig-avatar-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Alterar foto de perfil"
        >
          {user.avatarPhoto ? (
            <img src={user.avatarPhoto} alt={user.name} className="ig-avatar" />
          ) : (
            <div className="ig-avatar ig-avatar-fallback" style={{ background: user.avatarColor }}>
              {user.name[0]}
            </div>
          )}
          <span className="ig-avatar-edit">📷</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handlePhotoChange}
        />

        <div className="ig-header-info">
          <div className="ig-header-top">
            <h1 className="ig-username">@{user.username}</h1>
            <span className={`privacy-badge ${user.isPrivate ? "privacy-private" : "privacy-public"}`}>
              {user.isPrivate ? "🔒 Privado" : "🌐 Público"}
            </span>
            <button className="btn-outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancelar" : "Editar perfil"}
            </button>
          </div>

          <div className="ig-stats-row">
            <div>
              <strong>{stats.total}</strong> <span className="muted">experiências</span>
            </div>
            <div>
              <strong>{stats.cities}</strong> <span className="muted">cidades</span>
            </div>
            <div>
              <strong>{people.length}</strong> <span className="muted">pessoas</span>
            </div>
          </div>

          <div className="ig-name">{user.name}</div>
          <div className="ig-bio">{user.bio}</div>
        </div>
      </div>

      {editing && (
        <form className="experience-form ig-edit-form" onSubmit={saveProfile}>
          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Usuário
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            Bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} />
          </label>
          <fieldset>
            <legend>Privacidade do perfil</legend>
            <div className="privacy-toggle">
              <button
                type="button"
                className={`chip ${!isPrivate ? "chip-active" : ""}`}
                onClick={() => setIsPrivate(false)}
              >
                🌐 Público
              </button>
              <button
                type="button"
                className={`chip ${isPrivate ? "chip-active" : ""}`}
                onClick={() => setIsPrivate(true)}
              >
                🔒 Privado
              </button>
            </div>
            <p className="muted">
              {isPrivate
                ? "Apenas pessoas marcadas em suas experiências podem ver seu perfil e mapa."
                : "Qualquer pessoa na comunidade pode ver seu perfil, mapa e coleções."}
            </p>
          </fieldset>
          <button type="submit" className="btn-primary">
            Salvar
          </button>
        </form>
      )}

      {topPerson && (
        <div className="insight-card">
          💡 Sua companhia mais frequente é <strong>{topPerson.name}</strong>, com{" "}
          {topCompany![1]} experiências vividas juntos.
        </div>
      )}

      <h2 className="timeline-title">Publicações</h2>
      <div className="ig-grid">
        {sortedExperiences.length === 0 && (
          <p className="muted">Nenhuma experiência publicada ainda.</p>
        )}
        {sortedExperiences.map((exp) => (
          <Link to={`/experience/${exp.id}`} key={exp.id} className="ig-tile">
            <span className="ig-tile-emoji">
              {exp.photos[0] ?? categoryEmoji[exp.category]}
            </span>
          </Link>
        ))}
      </div>

      <h2 className="timeline-title">Coleções</h2>
      <div className="collections-grid">
        {collections.map((c) => {
          const pct = Math.min(100, Math.round((c.achieved / c.total) * 100));
          return (
            <div key={c.id} className="collection-card">
              <div className="collection-top">
                <span>{c.emoji}</span>
                <span className="muted">
                  {c.achieved}/{c.total}
                </span>
              </div>
              <div className="collection-title">{c.title}</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="muted">{pct}% concluído</div>
            </div>
          );
        })}
      </div>

      <h2 className="timeline-title">Pessoas</h2>
      <div className="people-grid">
        {people.map((p) => (
          <Link key={p.id} to={`/person/${p.id}`} className="person-card">
            <div className="avatar" style={{ background: p.avatarColor }}>
              {p.name[0]}
            </div>
            <div>{p.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
