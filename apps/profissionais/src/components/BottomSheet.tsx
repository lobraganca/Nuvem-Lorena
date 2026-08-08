import type { ReactNode } from "react";

/**
 * Modal que sobe de baixo em mobile (cantos superiores arredondados, X para
 * fechar, overlay escurecido) e vira um modal centralizado comum em telas
 * maiores (ver media query em theme.css). Usado nos formulários curtos que
 * fazem mais sentido como confirmação pontual (CPF, avaliação, denúncia).
 */
export function BottomSheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="Fechar" type="button">
          ✕
        </button>
        <h2 className="sheet-title">{title}</h2>
        {subtitle && <p className="sheet-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
