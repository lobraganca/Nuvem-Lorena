import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * One row of the profile: a mark, a label, and a chevron saying it leads
 * somewhere. The shape people already read without thinking.
 */
export function SettingsRow({
  to,
  href,
  onClick,
  icon,
  label,
  danger,
}: {
  to?: string;
  /** An address outside the app; opens in the browser, in a new tab. */
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  danger?: boolean;
}) {
  const inside = (
    <>
      <span className="row-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="row-label">{label}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="row-chevron">
        <path
          d="M9 5l7 7-7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );

  const className = `settings-row ${danger ? "settings-row-danger" : ""}`;

  if (href) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer">
        {inside}
      </a>
    );
  }

  if (to) {
    return (
      <Link to={to} className={className}>
        {inside}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {inside}
    </button>
  );
}

/** The drawn marks, so the rows need no icon font and no network request. */
export const rowIcon = {
  store: (
    <svg viewBox="0 0 24 24">
      <path
        d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M4 9h16v11H4zM12 12v4m-2-2h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 24 24">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c0-3.3 3.1-6 7-6s7 2.7 7 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24">
      <path
        d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24">
      <path
        d="M9 4L3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4zm0 0v14m6-11.5v14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24">
      <path
        d="M12 3l7 3v6c0 4.4-3 8.3-7 9-4-0.7-7-4.6-7-9V6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24">
      <path
        d="M7 10V8a5 5 0 0 1 10 0v2M5 10h14v10H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24">
      <path
        d="M7 2h10v20H7zM10 18h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24">
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4v.01M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.7-.8 1.2v.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  ),
  exit: (
    <svg viewBox="0 0 24 24">
      <path
        d="M15 17l5-5-5-5M20 12H9M12 3H5v18h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};
