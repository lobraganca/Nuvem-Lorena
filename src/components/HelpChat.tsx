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
    // A mark rather than a word: it sits in the top bar next to the bell and
    // the language, where a pill saying "Ajuda" would push the logo off a
    // narrow phone.
    return (
      <button
        type="button"
        className="help-fab"
        onClick={() => setOpen(true)}
        aria-label={t("help.open")}
        title={t("nav.help")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4v.01M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.7-.8 1.2v.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
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
