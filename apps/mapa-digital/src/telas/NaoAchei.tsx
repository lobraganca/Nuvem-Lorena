import { Link } from "react-router-dom";

export function NaoAchei() {
  return (
    <article className="tela">
      <h1>Esta página não existe</h1>
      <p className="chamada">
        O endereço pode ter sido digitado errado, ou a etapa mudou de nome.
      </p>
      <Link className="botao" to="/">
        Voltar para o início
      </Link>
    </article>
  );
}
