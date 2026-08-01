import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BackLink } from "../components/BackLink";
import { BusinessReviews } from "../components/BusinessReviews";

export function ProfessionalReviews() {
  const { user, businesses } = useAvena();
  const business = businesses.find((b) => b.id === user.ownBusinessId);

  if (!business) {
    return (
      <div className="page">
        <BackLink />
        <h1>Avaliações</h1>
        <p className="muted">Você ainda não tem uma empresa cadastrada.</p>
        <Link to="/business/new" className="btn-primary">
          Cadastrar minha empresa
        </Link>
      </div>
    );
  }

  return (
    <div className="page page-wide">
      <BackLink />
      <BusinessReviews businessId={business.id} />
    </div>
  );
}
