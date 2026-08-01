import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { isTourWished } from "../lib/wishlist";
import { newId } from "../lib/ids";
import type { Business, Tour } from "../types";

/**
 * O que dá para fazer com um passeio, além de reservar.
 *
 * Em linha, embaixo da foto, e não escondidos atrás de um menu: são três
 * gestos que a pessoa faz antes de decidir, e que decidem por ela. Guardar,
 * para voltar depois. Mandar para quem vai junto — quase ninguém escolhe
 * passeio sozinho, e sem um jeito de mandar o link a conversa migra para o
 * WhatsApp e leva a reserva junto. E perguntar, porque a dúvida que não é
 * respondida vira desistência.
 */
export function TourActions({ business, tour }: { business: Business; tour: Tour }) {
  const { wishlist, addWish, removeWish } = useAvena();
  const [shared, setShared] = useState<"copiado" | null>(null);

  const existing = wishlist.find((w) => w.tourId === tour.id && !w.doneAt);
  const wished = isTourWished(wishlist, tour.id);

  function toggleWish() {
    if (existing) {
      removeWish(existing.id);
      return;
    }
    addWish({
      id: newId(),
      title: tour.title,
      city: business.city,
      state: business.state,
      tourId: tour.id,
      businessId: business.id,
      businessName: business.name,
      priceFrom: tour.priceFrom,
      createdAt: new Date().toISOString(),
    });
  }

  async function share() {
    const url = window.location.href;
    const text = `${tour.title} — ${business.name}, ${business.city}`;
    // No celular isto abre a folha do sistema, com WhatsApp e mensagens; no
    // computador não existe, e aí copiar o endereço é o que resta de útil.
    if (navigator.share) {
      try {
        await navigator.share({ title: tour.title, text, url });
        return;
      } catch {
        // A pessoa fechou a folha de compartilhamento. Não é erro.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared("copiado");
      window.setTimeout(() => setShared(null), 2500);
    } catch {
      // Sem permissão para a área de transferência: o endereço continua na
      // barra do navegador, que é de onde a pessoa copiaria de qualquer jeito.
    }
  }

  return (
    <div className="tour-actions">
      <button
        type="button"
        className={`tour-action ${wished ? "tour-action-on" : ""}`}
        onClick={toggleWish}
        aria-pressed={wished}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
        <span>{wished ? "Salvo" : "Favoritar"}</span>
      </button>

      <button type="button" className="tour-action" onClick={share}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 15V4m0 0L8 8m4-4l4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
            fill="none"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>{shared === "copiado" ? "Link copiado" : "Compartilhar"}</span>
      </button>

      <Link to={`/messages/${business.id}`} className="tour-action">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M21 12a8 8 0 0 1-8 8H8l-4 2 1-4a8 8 0 1 1 16-6z"
            fill="none"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
        <span>Perguntar</span>
      </Link>
    </div>
  );
}
