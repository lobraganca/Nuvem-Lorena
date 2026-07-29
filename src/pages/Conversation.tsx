import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import type { MessageThread } from "../types";
import { ModerationNotice, isPublishable } from "../components/ModerationNotice";
import { threadKey, unreadThreadKeys } from "../lib/messages";
import { localeFor, useI18n } from "../i18n";

export function Conversation() {
  const { id } = useParams();
  const { people, businesses, messages, sendMessage, markThreadRead, user } = useAvena();
  const { t, lang } = useI18n();
  const [text, setText] = useState("");

  const person = people.find((p) => p.id === id);
  const business = person ? undefined : businesses.find((b) => b.id === id);
  const exists = Boolean(person || business);
  const isPerson = Boolean(person);

  // Opening the conversation is what marks it read. The unread check is not an
  // optimisation: marking writes to the store, which hands back a new
  // markThreadRead, so an unconditional effect would never settle.
  const unread = exists && id
    ? unreadThreadKeys(messages, user.threadReads).includes(
        threadKey(isPerson ? { personId: id } : { businessId: id })
      )
    : false;

  useEffect(() => {
    if (!unread || !id) return;
    markThreadRead(isPerson ? { personId: id } : { businessId: id });
  }, [unread, id, isPerson, markThreadRead]);

  if (!person && !business) {
    return <div className="page">Conversa não encontrada.</div>;
  }

  const thread: MessageThread = person
    ? { personId: person.id }
    : { businessId: business!.id };

  const title = person ? person.name : business!.name;
  const subtitle = person
    ? undefined
    : `${business!.type} · ${business!.city}`;
  const avatarColor = person ? person.avatarColor : "var(--accent)";

  const conversation = messages
    .filter((m) => (person ? m.personId === person.id : m.businessId === business!.id))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !isPublishable(text)) return;
    sendMessage(thread, text.trim());
    setText("");
  }

  return (
    <div className="page">
      <Link to="/messages" className="back-link">
        ← {t("messages.backToList")}
      </Link>
      <div className="person-header">
        <div className="avatar" style={{ background: avatarColor }}>
          {title[0]}
        </div>
        <div>
          <h1>{title}</h1>
          {subtitle && <div className="muted">{subtitle}</div>}
        </div>
        {business && (
          <Link to={`/business/${business.id}`} className="btn-outline">
            {t("messages.seeTours")}
          </Link>
        )}
      </div>

      <div className="chat-thread">
        {conversation.length === 0 && (
          <p className="muted">
            {business
              ? t("messages.emptyBusiness")
              : t("messages.emptyPerson")}
          </p>
        )}
        {conversation.map((m) => (
          <div
            key={m.id}
            className={`chat-bubble ${m.sender === "me" ? "chat-bubble-me" : "chat-bubble-them"}`}
          >
            <div>{m.text}</div>
            <div className="chat-timestamp">
              {new Date(m.timestamp).toLocaleString(localeFor(lang), {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ))}
      </div>

      <ModerationNotice text={text} />
      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("messages.placeholder")}
        />
        <button type="submit" className="btn-primary" disabled={!isPublishable(text)}>
          {t("messages.send")}
        </button>
      </form>
    </div>
  );
}
