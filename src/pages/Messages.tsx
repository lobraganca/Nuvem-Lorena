import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import type { Message } from "../types";

interface Thread {
  id: string;
  name: string;
  subtitle: string;
  avatarColor: string;
  last?: Message;
}

function lastOf(messages: Message[]): Message | undefined {
  return [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )[messages.length - 1];
}

export function Messages() {
  const { people, businesses, messages } = useAvena();

  const personThreads: Thread[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: "Pessoa",
    avatarColor: p.avatarColor,
    last: lastOf(messages.filter((m) => m.personId === p.id)),
  }));

  // Only businesses you already talked to, so the list stays about
  // conversations rather than becoming a second directory.
  const businessThreads: Thread[] = businesses
    .filter((b) => messages.some((m) => m.businessId === b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      subtitle: `${b.type} · ${b.city}`,
      avatarColor: "var(--accent)",
      last: lastOf(messages.filter((m) => m.businessId === b.id)),
    }));

  function sortThreads(threads: Thread[]) {
    return threads.sort((a, b) => {
      if (!a.last) return 1;
      if (!b.last) return -1;
      return new Date(b.last.timestamp).getTime() - new Date(a.last.timestamp).getTime();
    });
  }

  function ThreadList({ threads }: { threads: Thread[] }) {
    return (
      <div className="conversation-list">
        {threads.map((t) => (
          <Link to={`/messages/${t.id}`} key={t.id} className="conversation-row">
            <div className="avatar" style={{ background: t.avatarColor }}>
              {t.name[0]}
            </div>
            <div className="conversation-preview">
              <div className="timeline-card-title">{t.name}</div>
              <div className="muted">
                {t.last ? t.last.text : "Diga oi e comece a conversa"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar
      </Link>
      <h1>Mensagens</h1>

      {businessThreads.length > 0 && (
        <>
          <h2 className="timeline-title">Agências e guias</h2>
          <ThreadList threads={sortThreads(businessThreads)} />
        </>
      )}

      <h2 className="timeline-title">Pessoas</h2>
      <ThreadList threads={sortThreads(personThreads)} />

      {businessThreads.length === 0 && (
        <p className="muted" style={{ marginTop: 20 }}>
          Para falar com uma agência ou guia, abra a página dele e toque em
          “Enviar mensagem”.
        </p>
      )}
    </div>
  );
}
