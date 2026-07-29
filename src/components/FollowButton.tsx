import { useAvena } from "../store/AvenaContext";
import { useT } from "../i18n";
import type { Traveler } from "../types";

export function FollowButton({ traveler }: { traveler: Traveler }) {
  const { user, followTraveler, unfollowTraveler } = useAvena();
  const t = useT();

  const following = (user.following ?? []).includes(traveler.id);
  const requested = (user.followRequests ?? []).includes(traveler.id);

  if (following || requested) {
    return (
      <button
        type="button"
        className="btn-outline"
        onClick={() => unfollowTraveler(traveler.id)}
      >
        {following ? t("follow.unfollow") : t("follow.requested")}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn-primary"
      onClick={() => followTraveler(traveler.id)}
    >
      {traveler.isPrivate ? t("follow.requestPrivate") : t("follow.follow")}
    </button>
  );
}
