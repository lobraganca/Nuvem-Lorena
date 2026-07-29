import { useEffect, useRef, useState } from "react";
import { answerQuestion, suggestedQuestions } from "../lib/assistant";
import { useT } from "../i18n";
import { newId } from "../lib/ids";

interface ChatMessage {
  id: string;
  from: "user" | "avena";
  text: string;
}

const GREETING: ChatMessage = {
  id: "greeting",
  from: "avena",
  text: "Oi! Sou o assistente do Avena. Posso explicar planos, reservas, cancelamento, avaliações e anúncios. O que você quer saber?",
};

export function HelpChat() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, open]);

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;

    const reply = answerQuestion(trimmed);
    setMessages((prev) => [
      ...prev,
      { id: newId(), from: "user", text: trimmed },
      { id: newId(), from: "avena", text: reply.text },
    ]);
    setInput("");
  }

  if (!open) {
    return (
      <button
        type="button"
        className="help-fab"
        onClick={() => setOpen(true)}
        aria-label={t("help.open")}
      >
        {t("nav.help")}
      </button>
    );
  }

  return (
    <div className="help-chat" role="dialog" aria-label={t("help.assistant")}>
      <div className="help-chat-header">
        <strong>{t("help.assistant")}</strong>
        <button
          type="button"
          className="help-close"
          onClick={() => setOpen(false)}
          aria-label={t("common.close")}
        >
          ×
        </button>
      </div>

      <div className="help-chat-thread" ref={threadRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-bubble ${m.from === "user" ? "chat-bubble-me" : "chat-bubble-them"}`}
          >
            {m.text}
          </div>
        ))}

        {messages.length === 1 && (
          <div className="help-suggestions">
            {suggestedQuestions.map((q) => (
              <button key={q} type="button" className="chip" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className="help-chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("help.placeholder")}
        />
        <button type="submit" className="btn-primary">
          Enviar
        </button>
      </form>
    </div>
  );
}
