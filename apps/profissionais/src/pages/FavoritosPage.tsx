import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CartaoProfissional } from "../components/CartaoProfissional";
import { getFavoriteProfessionals, type ProfessionalWithRating } from "../lib/professionals";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import { useTituloDaPagina } from "../lib/tituloDaPagina";

export function FavoritosPage() {
  useTituloDaPagina("Meus favoritos");
  const { user, loading: authLoading } = useAuth();
  const [results, setResults] = useState<ProfessionalWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!user) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro("");
    getFavoriteProfessionals(user.id)
      .then(setResults)
      /* "Você ainda não guardou ninguém" é o que a tela diz quando a lista
         volta vazia. Falha não pode cair nessa frase: quem tem vinte
         favoritos leria que não tem nenhum. */
      .catch((err) => setErro(mensagemDeErro(err, "Não foi possível carregar seus favoritos.")))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Meus favoritos</h1>

      {!authLoading && !user && (
        <p className="muted">
          Faça <Link to="/login">login</Link> para favoritar profissionais e vê-los aqui.
        </p>
      )}

      {erro && <p className="entrar-erro">{erro}</p>}

      {user && !loading && !erro && results.length === 0 && (
        /* Vazio com saída: quem chega aqui sem favoritos não errou nada, só
           ainda não guardou ninguém — e o caminho de volta é a busca. */
        <div className="card" style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          <strong>Você ainda não guardou ninguém.</strong>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.45 }}>
            Toque no ♥ de um profissional para guardá-lo aqui. Serve para não perder o contato de quem atendeu
            bem — e para achar rápido da próxima vez.
          </p>
          <Link className="btn btn-primary" to="/">
            Procurar profissionais
          </Link>
        </div>
      )}

      {loading && <p className="muted">Carregando…</p>}

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {results.map((p) => {
          const whatsappLink = p.phone && p.verified ? `https://wa.me/${p.phone.replace(/\D/g, "")}` : null;
          return (
            /* Mesmo cartão da busca, agora literalmente o mesmo componente:
               é a mesma pessoa nas duas telas, e antes ela aparecia com
               textos e etiquetas diferentes em cada uma. */
            <CartaoProfissional
              key={p.id}
              p={p}
              favoritado
              extra={
                whatsappLink && (
                  <button
                    type="button"
                    className="btn btn-teal"
                    style={{ marginTop: 10 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(whatsappLink, "_blank", "noreferrer");
                    }}
                  >
                    Chamar no WhatsApp
                  </button>
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
}
