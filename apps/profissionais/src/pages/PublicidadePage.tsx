import { useState } from "react";
import { Link } from "react-router-dom";
import { CITIES, type LocalDeAnuncio } from "../types/domain";
import { enviarPedidoDeAnuncio } from "../lib/banners";
import { useAuth } from "../lib/useAuth";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { mensagemDeErro } from "../lib/erros";
import { CONTATO_EMAIL, NOME_PLATAFORMA } from "../config";

/**
 * A página de vendas da publicidade: o que se compra, como a arte precisa
 * ser, quais são as regras e como pedir.
 *
 * Existe porque a conversa de banner nesta cidade é de porta em porta, e
 * repetir as mesmas medidas e as mesmas regras por WhatsApp, uma pessoa de
 * cada vez, é onde os combinados se perdem — a arte chega no tamanho
 * errado, ou o anunciante descobre só depois que a etiqueta "Publicidade"
 * não sai. Escrito num lugar só, dá para mandar o endereço e seguir.
 *
 * As regras não são enfeite: são o que permite dizer não a uma arte
 * enganosa depois de já ter recebido, sem parecer que a regra foi
 * inventada na hora.
 */
export function PublicidadePage() {
  useTituloDaPagina("Anuncie no app");
  const { user } = useAuth();

  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [local, setLocal] = useState<LocalDeAnuncio>("tanto_faz");
  const [cidade, setCidade] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar() {
    if (!nome.trim()) return setErro("Escreva o nome do seu comércio.");
    if (!contato.trim()) return setErro("Deixe um WhatsApp ou telefone para a gente falar com você.");
    setEnviando(true);
    setErro("");
    try {
      await enviarPedidoDeAnuncio({
        nome: nome.trim(),
        contato: contato.trim(),
        local,
        cidade: cidade || null,
        mensagem: mensagem.trim() || null,
        userId: user?.id ?? null,
      });
      setEnviado(true);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível enviar o pedido."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Anuncie no {NOME_PLATAFORMA}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Quem abre o app está procurando serviço aqui na cidade. Seu comércio pode aparecer nessa hora — mesmo
        que você não tenha anúncio de profissional no app.
      </p>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Onde seu anúncio aparece</h2>
        <p className="muted" style={{ margin: 0 }}>
          <strong>Na busca.</strong> Uma faixa no meio dos resultados, para quem está procurando serviço
          naquele momento. Dá para escolher aparecer só em uma categoria — por exemplo, só para quem procura
          eletricista.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          <strong>Na tela de início.</strong> Um cartão dentro da primeira lista que a pessoa vê ao abrir o
          app, junto do conteúdo. É o lugar de quem quer ser visto por todo mundo da cidade, não só por quem
          procurou um serviço específico.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Nos dois casos o anúncio pode ser <strong>só para a sua cidade</strong>: quem abre o app de outra
          cidade não gasta a sua exibição.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Como a arte precisa ser</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
          <li>
            <strong>Formato deitado, 3 por 1.</strong> O tamanho recomendado é{" "}
            <strong>1200 × 400 pixels</strong>. A mesma arte serve para os dois lugares.
          </li>
          <li>
            <strong>Arquivo de imagem</strong> (JPG, PNG ou WebP), <strong>até 2 MB</strong>.
          </li>
          <li>
            <strong>Letra grande.</strong> No celular esse espaço tem uns 8 cm de largura. Telefone, nome e
            no máximo uma frase — arte com texto de panfleto não se lê aqui.
          </li>
          <li>
            <strong>Deixe respiro nas bordas.</strong> Nada de informação importante colada no canto: em
            telas mais estreitas as pontas podem ser aparadas.
          </li>
          <li>
            Se não tiver arte pronta, mande sua logo e o que quer escrever que a gente monta junto.
          </li>
        </ul>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>As regras</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
          <li>
            <strong>Todo anúncio aparece com a etiqueta "Publicidade", e ela não sai.</strong> É exigência da
            lei (Código de Defesa do Consumidor, art. 36): a pessoa tem que conseguir reconhecer publicidade
            como publicidade. Anúncio que se disfarça de resultado de busca não entra aqui.
          </li>
          <li>
            <strong>O que estiver escrito na arte precisa ser verdade.</strong> Preço, desconto, prazo,
            "o melhor da cidade" — propaganda enganosa é crime (art. 37) e responde por ela quem anuncia.
          </li>
          <li>
            <strong>A arte precisa ser sua.</strong> Foto, música ou desenho de terceiro sem autorização não
            entra — o problema volta para você e para o app.
          </li>
          <li>
            <strong>Anunciar não é ser recomendado.</strong> O espaço é pago e aparece como pago. Ele não vira
            selo de qualidade nem mexe na ordem dos resultados da busca.
          </li>
          <li>
            Não entram anúncios de conteúdo ilegal, ofensivo, discriminatório, nem nada que dependa de
            autorização especial que você não tenha.
          </li>
          <li>
            <strong>Podemos recusar ou tirar do ar</strong> uma arte que quebre estas regras. Se isso
            acontecer no meio do período contratado, o tempo que faltava é devolvido ou vale para outra arte —
            você não perde o que pagou.
          </li>
          <li>
            <strong>A contratação e o pagamento acontecem fora do app</strong>, direto com a gente. O app não
            cobra nada por aqui.
          </li>
          <li>
            <strong>Você recebe os números.</strong> Quantas vezes a arte apareceu e quantos toques ela levou,
            contados pelo próprio app — sem número arredondado para cima.
          </li>
        </ul>
      </div>

      <div className="card" style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Quero anunciar</h2>
        {enviado ? (
          <>
            <p style={{ margin: 0 }}>
              <strong>Pedido enviado.</strong> A gente entra em contato pelo número que você deixou para
              combinar período, valor e a arte.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Se preferir adiantar, escreva para <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.
            </p>
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Deixe seu contato que a gente fala com você para combinar período e valor. Sem compromisso.
            </p>
            <input
              placeholder="Nome do seu comércio"
              value={nome}
              maxLength={60}
              onChange={(e) => setNome(e.target.value)}
            />
            <input
              placeholder="WhatsApp ou telefone"
              value={contato}
              maxLength={40}
              inputMode="tel"
              onChange={(e) => setContato(e.target.value)}
            />
            <label style={{ display: "grid", gap: 4 }}>
              <span className="muted" style={{ fontSize: "0.85rem" }}>Onde você quer aparecer</span>
              <select value={local} onChange={(e) => setLocal(e.target.value as LocalDeAnuncio)}>
                <option value="tanto_faz">Ainda não sei — me explica as opções</option>
                <option value="busca">Na busca</option>
                <option value="boas_vindas">Na tela de início</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="muted" style={{ fontSize: "0.85rem" }}>Sua cidade</span>
              <select value={cidade} onChange={(e) => setCidade(e.target.value)}>
                <option value="">Prefiro falar depois</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              placeholder="Quer contar mais alguma coisa? (opcional)"
              value={mensagem}
              maxLength={400}
              rows={3}
              onChange={(e) => setMensagem(e.target.value)}
            />
            {erro && <p className="form-erro">{erro}</p>}
            <button className="btn btn-primary" onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar pedido"}
            </button>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              A gente usa esses dados só para falar com você sobre o anúncio. Veja a{" "}
              <Link to="/privacidade">Política de Privacidade</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
