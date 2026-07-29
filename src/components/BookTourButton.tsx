import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { commissionRateFor } from "../lib/plans";
import { cancellationPolicyDescription, cancellationPolicyLabel } from "../lib/cancellation";
import { availabilityFor } from "../lib/availability";
import { isInSeason, seasonLabel } from "../lib/tourAttributes";
import {
  ParticipantFields,
  emptyParticipant,
  participantsError,
  resizeParticipants,
} from "./ParticipantFields";
import {
  LegalAcceptance,
  useAcceptLegal,
  useLegalAccepted,
} from "./LegalAcceptance";
import type { Business, Participant, Tour } from "../types";

export function BookTourButton({ business, tour }: { business: Business; tour: Tour }) {
  const { addBooking, bookings, user, waitlist, joinWaitlist } = useAvena();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [travelDate, setTravelDate] = useState(new Date().toISOString().slice(0, 10));
  const [travelers, setTravelers] = useState(1);
  // The buyer is participant 1, pre-filled with the account name.
  const [participants, setParticipants] = useState<Participant[]>([
    { ...emptyParticipant(), name: user.name },
  ]);

  function changeTravelers(count: number) {
    const safe = Math.max(1, count);
    setTravelers(safe);
    setParticipants((prev) => resizeParticipants(prev, safe));
  }
  const [legalChecked, setLegalChecked] = useState(false);
  const legalAccepted = useLegalAccepted();
  const acceptLegal = useAcceptLegal();
  const legalOk = legalAccepted || legalChecked;

  const unitPrice = tour.priceFrom ?? 0;
  const totalPrice = unitPrice * travelers;
  const commissionRate = commissionRateFor(business.planTier);
  const commissionAmount = Math.round(totalPrice * commissionRate * 100) / 100;
  const businessPayout = Math.round((totalPrice - commissionAmount) * 100) / 100;
  const cancellationPolicy = tour.cancellationPolicy ?? "moderada";
  const availability = availabilityFor(tour, bookings, travelDate);
  const peopleError = participantsError(participants);
  const season = seasonLabel(tour.seasonMonths);
  const offSeason = !isInSeason(tour.seasonMonths, travelDate);
  const alreadyWaiting = waitlist.some(
    (w) => w.tourId === tour.id && w.date === travelDate
  );

  function handleJoinWaitlist() {
    joinWaitlist({
      id: crypto.randomUUID(),
      tourId: tour.id,
      tourTitle: tour.title,
      businessId: business.id,
      businessName: business.name,
      date: travelDate,
      people: travelers,
      createdAt: new Date().toISOString(),
    });
  }
  const soldOut = availability.tracked && availability.remaining === 0;
  const exceedsCapacity = availability.tracked && travelers > availability.remaining;

  function confirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (soldOut || exceedsCapacity || !legalOk || peopleError) return;
    if (!legalAccepted) acceptLegal();
    const booking = {
      id: crypto.randomUUID(),
      businessId: business.id,
      businessName: business.name,
      tourId: tour.id,
      tourTitle: tour.title,
      travelDate,
      travelers,
      participants,
      unitPrice,
      totalPrice,
      commissionRate,
      commissionAmount,
      businessPayout,
      createdAt: new Date().toISOString(),
      status: "confirmada" as const,
      cancellationPolicy,
    };
    addBooking(booking);
    navigate("/bookings");
  }

  if (!open) {
    return (
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
        Reservar
      </button>
    );
  }

  return (
    <form className="booking-form" onSubmit={confirmBooking}>
      <div className="form-row">
        <label>
          Data
          <input
            type="date"
            value={travelDate}
            onChange={(e) => setTravelDate(e.target.value)}
            required
          />
        </label>
        <label>
          Pessoas
          <input
            type="number"
            min={1}
            value={travelers}
            onChange={(e) => changeTravelers(Number(e.target.value))}
            required
          />
        </label>
      </div>

      {availability.tracked && (
        <div className={`availability-note ${soldOut ? "availability-none" : ""}`}>
          {soldOut
            ? "Sem vagas disponíveis nesta data."
            : `${availability.remaining} de ${availability.capacity} vagas disponíveis nesta data.`}
        </div>
      )}
      {soldOut && (
        <div className="waitlist-box">
          {alreadyWaiting ? (
            <span className="muted">
              Você está na lista de espera desta data. Avisamos se abrir vaga.
            </span>
          ) : (
            <>
              <span className="muted">
                Podemos avisar você se alguém cancelar nesta data.
              </span>
              <button type="button" className="btn-outline" onClick={handleJoinWaitlist}>
                Avisar se abrir vaga
              </button>
            </>
          )}
        </div>
      )}

      {offSeason && season && (
        <div className="availability-note">
          Melhor época para este passeio: {season}. Fora da temporada a
          experiência pode ser diferente do anunciado.
        </div>
      )}

      {exceedsCapacity && !soldOut && (
        <div className="availability-note availability-none">
          Só restam {availability.remaining} vagas nesta data para o número de pessoas informado.
        </div>
      )}

      <ParticipantFields participants={participants} onChange={setParticipants} />

      {peopleError && <div className="availability-none">{peopleError}</div>}

      <div className="booking-breakdown">
        <div>
          Valor total <strong>R$ {totalPrice.toLocaleString("pt-BR")}</strong>
        </div>
        <div className="muted">
          Taxa de serviço Avena ({Math.round(commissionRate * 100)}%): R${" "}
          {commissionAmount.toLocaleString("pt-BR")}
        </div>
        <div className="muted">
          {business.name} recebe: R$ {businessPayout.toLocaleString("pt-BR")}
        </div>
        <div className="muted">
          Cancelamento {cancellationPolicyLabel[cancellationPolicy]}:{" "}
          {cancellationPolicyDescription[cancellationPolicy]}
        </div>
      </div>

      <LegalAcceptance checked={legalChecked} onChange={setLegalChecked} />

      <div className="chip-row">
        <button
          type="submit"
          className="btn-primary"
          disabled={soldOut || exceedsCapacity || !legalOk || Boolean(peopleError)}
        >
          Confirmar reserva
        </button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
