import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";

export function Messages() {
  const { people, messages } = useAvena();

  const conversations = people
    .map((p) => {
      const thread = messages
        .filter((m) => m.personId === p.id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return { person: p, last: thread[thread.length - 1] };
    })
    .sort((a, b) => {
      if (!a.last) return 1;
      if (!b.last) return -1;
      return new Date(b.last.timestamp).getTime() - new Date(a.last.timestamp).getTime();
    });

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar ao mapa
      </Link>
      <h1>Mensagens</h1>
      <div className="conversation-list">
        {conversations.map(({ person, last }) => (
          <Link to={`/messages/${person.id}`} key={person.id} className="conversation-row">
            <div className="avatar" style={{ background: person.avatarColor }}>
              {person.name[0]}
            </div>
            <div className="conversation-preview">
              <div className="timeline-card-title">{person.name}</div>
              <div className="muted">
                {last ? last.text : "Diga oi e comece a conversa"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
