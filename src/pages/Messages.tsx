import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import type { Message } from "../types";
import { useT } from "../i18n";
import { unreadThreadKeys } from "../lib/messages";
import { businessTypeKey } from "../i18n/domain";

interface Thread {
  id: string;
  name: string;
  subtitle: string;
  avatarColor: string;
  last?: Message;
  unread?: boolean;
}

function lastOf(messages: Message[]): Message | undefined {
  return [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )[messages.length - 1];
}

export function Messages() {
  const { people, businesses, messages, user } = useAvena();
  const t = useT();

  const unread = new Set(unreadThreadKeys(messages, user.threadReads));

  const personThreads: Thread[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: t("messages.person"),
    avatarColor: p.avatarColor,
    last: lastOf(messages.filter((m) => m.personId === p.id)),
    unread: unread.has(`p:${p.id}`),
  }));

  // Only businesses you already talked to, so the list stays about
  // conversations rather than becoming a second directory.
  const businessThreads: Thread[] = businesses
    .filter((b) => messages.some((m) => m.businessId === b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      subtitle: `${t(businessTypeKey[b.type])} · ${b.city}`,
      avatarColor: "var(--accent)",
      last: lastOf(messages.filter((m) => m.businessId === b.id)),
      unread: unread.has(`b:${b.id}`),
    }));

  function sortThreads(threads: Thread[]) {
    return threads.sort((a, b) => {
      if (!a.last) return 1;
      if (!b.last) return -1;
      return new Date(b.last.timestamp).getTime() - new Date(a.last.timestamp).getTime();
    });
  }

  const startHint = t("messages.startHint");
  const unreadLabel = t("messages.unread");

  function ThreadList({ threads }: { threads: Thread[] }) {
    return (
      <div className="conversation-list">
        {threads.map((t) => (
          <Link
            to={`/messages/${t.id}`}
            key={t.id}
            className={`conversation-row ${t.unread ? "conversation-row-unread" : ""}`}
          >
            <div className="avatar" style={{ background: t.avatarColor }}>
              {t.name[0]}
            </div>
            <div className="conversation-preview">
              <div className="timeline-card-title">{t.name}</div>
              <div className="muted">
                {t.last ? t.last.text : startHint}
              </div>
            </div>
            {t.unread && <span className="conversation-unread-dot" aria-label={unreadLabel} />}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← {t("common.back")}
      </Link>
      <h1>{t("messages.title")}</h1>

      {businessThreads.length > 0 && (
        <>
          <h2 className="timeline-title">{t("messages.businesses")}</h2>
          <ThreadList threads={sortThreads(businessThreads)} />
        </>
      )}

      <h2 className="timeline-title">{t("messages.people")}</h2>
      <ThreadList threads={sortThreads(personThreads)} />

      {businessThreads.length === 0 && (
        <p className="muted" style={{ marginTop: 20 }}>
          {t("messages.hint")}
        </p>
      )}
    </div>
  );
}
