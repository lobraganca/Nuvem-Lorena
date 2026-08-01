import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BackLink } from "../components/BackLink";
import { BusinessEditor } from "../components/BusinessEditor";
import { MeetingPointEditor } from "../components/MeetingPointEditor";
import { ConnectMercadoPago } from "../components/ConnectMercadoPago";

export function ProfessionalBusiness() {
  const { user, businesses } = useAvena();
  const business = businesses.find((b) => b.id === user.ownBusinessId);

  if (!business) {
    return (
      <div className="page">
        <BackLink />
        <h1>Minha empresa</h1>
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
      <h1>Minha empresa</h1>

      <Link to={`/business/${business.id}`} className="btn-outline">
        Ver minha página como o viajante vê
      </Link>

      <BusinessEditor business={business} />
      <MeetingPointEditor business={business} />
      <ConnectMercadoPago business={business} />
    </div>
  );
}
