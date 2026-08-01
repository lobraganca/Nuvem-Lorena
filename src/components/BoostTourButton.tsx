import { Link } from "react-router-dom";
import { liveAdForTour } from "../lib/ads";
import { useAvena } from "../store/AvenaContext";
import type { Tour } from "../types";

/**
 * O estado do anúncio de um passeio, dentro do painel.
 *
 * A compra em si mora em /anuncios, e não aqui: escolher onde aparecer, por
 * quantos dias e por quanto é uma decisão de dinheiro, e ela ficava espremida
 * entre os campos de editar o passeio, onde ninguém compara nada.
 */
export function BoostTourButton({ tour }: { tour: Tour }) {
  const { boosts } = useAvena();
  const live = liveAdForTour(boosts, tour.id);

  if (live) {
    return (
      <div className="boost-active">
        Em destaque até {new Date(live.endsAt).toLocaleDateString("pt-BR")}
      </div>
    );
  }

  return (
    <Link to="/anuncios" className="btn-outline">
      Anunciar este passeio
    </Link>
  );
}
