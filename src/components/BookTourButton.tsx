import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { commissionRateFor } from "../lib/plans";
import { cancellationDescriptionKey, cancellationLabelKey } from "../lib/cancellation";
import { availabilityFor } from "../lib/availability";
import { PAYMENT_WINDOW_MINUTES, paymentDeadline } from "../lib/bookingStatus";
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
import { formatBRL } from "../lib/money";
import { useT } from "../i18n";
import { canReceivePayments } from "../lib/payments/mercadopago";
import { newId } from "../lib/ids";

export function BookTourButton({ business, tour }: { business: Business; tour: Tour }) {
  const { addBooking, bookings, user, waitlist, joinWaitlist } = useAvena();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const t = useT();
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
      id: newId(),
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
      id: newId(),
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
      // The seat is held, not sold. Only the payment turns it into a booking.
      status: "aguardando-pagamento" as const,
      paymentDueAt: paymentDeadline(),
      cancellationPolicy,
    };
    addBooking(booking);
    navigate(`/pagamento/${booking.id}`);
  }

  // An agency with no payment account has nowhere to receive the money, so the
  // booking is blocked rather than taken and left unpayable.
  if (!canReceivePayments(business)) {
    return (
      <div className="availability-note availability-none">
        {t("booking.noPaymentAccount", { name: business.name })}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
        {t("booking.book")}
      </button>
    );
  }

  return (
    <form className="booking-form" onSubmit={confirmBooking}>
      <div className="form-row">
        <label>
          {t("booking.date")}
          <input
            type="date"
            value={travelDate}
            onChange={(e) => setTravelDate(e.target.value)}
            required
          />
        </label>
        <label>
          {t("booking.travelers")}
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
            ? t("booking.soldOut")
            : t("booking.spotsAvailable", {
                remaining: availability.remaining,
                capacity: availability.capacity ?? 0,
              })}
        </div>
      )}
      {soldOut && (
        <div className="waitlist-box">
          {alreadyWaiting ? (
            <span className="muted">{t("booking.waitlistJoined")}</span>
          ) : (
            <>
              <span className="muted">{t("booking.waitlistOffer")}</span>
              <button type="button" className="btn-outline" onClick={handleJoinWaitlist}>
                {t("booking.waitlistJoin")}
              </button>
            </>
          )}
        </div>
      )}

      {offSeason && season && (
        <div className="availability-note">
          {t("booking.offSeason", { season: season ?? "" })}
        </div>
      )}

      {exceedsCapacity && !soldOut && (
        <div className="availability-note availability-none">
          {t("booking.onlyLeft", { remaining: availability.remaining })}
        </div>
      )}

      <ParticipantFields participants={participants} onChange={setParticipants} />

      {peopleError && (
        <div className="availability-none">
          {t(peopleError.key, { n: peopleError.index })}
        </div>
      )}

      <div className="booking-breakdown">
        <div>
          {t("booking.total")} <strong>R$ {formatBRL(totalPrice)}</strong>
        </div>
        <div className="muted">
          {t("booking.serviceFee", {
            pct: Math.round(commissionRate * 100),
            amount: formatBRL(commissionAmount),
          })}
        </div>
        <div className="muted">
          {t("booking.businessReceives", {
            name: business.name,
            amount: formatBRL(businessPayout),
          })}
        </div>
        <div className="muted">
          {t("business.cancellation", {
            policy: t(cancellationLabelKey[cancellationPolicy]),
          })}
          : {t(cancellationDescriptionKey[cancellationPolicy])}
        </div>
        <div className="muted">
          {t("booking.holdNotice", { minutes: PAYMENT_WINDOW_MINUTES })}
        </div>
      </div>

      <LegalAcceptance checked={legalChecked} onChange={setLegalChecked} />

      <div className="chip-row">
        <button
          type="submit"
          className="btn-primary"
          disabled={soldOut || exceedsCapacity || !legalOk || Boolean(peopleError)}
        >
          {t("booking.goToPayment")}
        </button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
