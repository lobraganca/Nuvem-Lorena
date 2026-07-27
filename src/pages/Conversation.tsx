import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";

export function Conversation() {
  const { id } = useParams();
  const { people, messages, sendMessage } = useAvena();
  const [text, setText] = useState("");
  const person = people.find((p) => p.id === id);

  if (!person) return <div className="page">Pessoa não encontrada.</div>;

  const thread = messages
    .filter((m) => m.personId === person.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !person) return;
    sendMessage(person.id, text.trim());
    setText("");
  }

  return (
    <div className="page">
      <Link to="/messages" className="back-link">
        ← Voltar às mensagens
      </Link>
      <div className="person-header">
        <div className="avatar" style={{ background: person.avatarColor }}>
          {person.name[0]}
        </div>
        <h1>{person.name}</h1>
      </div>

      <div className="chat-thread">
        {thread.length === 0 && <p className="muted">Nenhuma mensagem ainda. Diga oi!</p>}
        {thread.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender === "me" ? "chat-bubble-me" : "chat-bubble-them"}`}>
            <div>{m.text}</div>
            <div className="chat-timestamp">
              {new Date(m.timestamp).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ))}
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem..."
        />
        <button type="submit" className="btn-primary">
          Enviar
        </button>
      </form>
    </div>
  );
}
