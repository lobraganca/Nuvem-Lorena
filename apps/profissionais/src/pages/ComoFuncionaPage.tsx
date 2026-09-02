import { Link } from "react-router-dom";
import { useTituloDaPagina } from "../lib/tituloDaPagina";

/**
 * Como funciona o Ei Itabirito.
 *
 * Faltava — a dona pediu um link "Como funciona" na Conta (junto de
 * "enviar sugestão", termos e suporte), e não existia nenhuma tela que
 * explicasse o app inteiro num lugar só. Havia pedaços da explicação
 * espalhados pelo app (o texto da porta de entrada, o aviso da onda), mas
 * ninguém que já esteja cadastrado tropeça neles de novo.
 *
 * Escrita para as duas pessoas que abrem esta tela por motivos opostos:
 * quem procura trabalho e quer entender por que uma vaga chegou (ou não
 * chegou), e quem contrata e quer saber o que acontece depois de publicar.
 */
export function ComoFuncionaPage() {
  useTituloDaPagina("Como funciona");
  return (
    <div className="ei">
      <div className="ei-tela">
        <h1 className="ei-titulo-g">Como funciona</h1>
        <p className="ei-apoio">
          O Ei Itabirito não é um mural de vagas onde se procura — é a vaga que vai atrás de quem
          combina com ela.
        </p>

        <div className="ei-cartao" style={{ display: "grid", gap: 16, marginTop: 20 }}>
          <h2 className="ei-secao" style={{ marginTop: 0 }}>Se você procura trabalho</h2>

          <p className="ei-corpo">
            <strong>1. Faça o seu cadastro.</strong> Nome, foto, telefone e o que você aceita
            fazer — as suas funções são o dado mais importante: é por elas que a vaga te encontra.
            Quanto mais completo (experiência, formação, pretensão salarial, melhor horário), mais
            fácil a empresa decidir chamar você.
          </p>

          <p className="ei-corpo">
            <strong>2. Uma empresa publica uma vaga e dispara um aviso.</strong> Chamamos isso de
            <em> onda</em>: o app compara o que a vaga pede com o que está no seu cadastro, e quem
            combina recebe um aviso — no app e, se você deixar ligado, uma notificação no celular.
          </p>

          <p className="ei-corpo">
            <strong>3. Você responde.</strong> Toque em <strong>Tenho interesse</strong> ou{" "}
            <strong>Não é para mim</strong>. Só quando você diz que tem interesse a empresa vê o
            seu contato — dizer "não" não avisa ninguém, e dá para mudar de ideia depois.
          </p>

          <p className="ei-corpo">
            <strong>Público ou oculto — você escolhe.</strong> No seu cadastro,{" "}
            <strong>público</strong> quer dizer que qualquer empresa pode te achar procurando no{" "}
            <Link to="/profissionais">banco de talentos</Link>. <strong>Oculto</strong> tira você
            dessa lista, mas não tira você das ondas — continua recebendo vaga do seu ofício, só
            que sem aparecer para quem está só olhando. É a opção de quem está empregado e não
            quer ser encontrado pelo patrão atual.
          </p>

          <p className="ei-corpo">
            Além da onda, dá para procurar por conta própria a qualquer hora no{" "}
            <Link to="/vagas">banco de vagas</Link> — todas as vagas abertas da cidade, mesmo as
            que a onda não escolheu para você.
          </p>
        </div>

        <div className="ei-cartao" style={{ display: "grid", gap: 16, marginTop: 20 }}>
          <h2 className="ei-secao" style={{ marginTop: 0 }}>Se você contrata</h2>

          <p className="ei-corpo">
            <strong>1. Cadastre a sua empresa</strong> e publique a vaga — função, salário (ou "a
            combinar"), tipo de contrato, jornada e o que mais for relevante. Quanto mais completa
            a vaga, mais preciso é o comparativo que decide quem recebe o aviso.
          </p>

          <p className="ei-corpo">
            <strong>2. A onda avisa quem combina.</strong> O aviso compara o que a vaga pede com o
            cadastro de cada pessoa da cidade — inclusive quem está oculto da busca pública.
          </p>

          <p className="ei-corpo">
            <strong>3. Acompanhe os interessados no painel da vaga.</strong> Cada pessoa que
            responder "tenho interesse" aparece ali, com o contato — é você quem decide se liga,
            manda mensagem ou marca uma entrevista.
          </p>

          <p className="ei-corpo">
            Pode <strong>pausar, arquivar ou excluir</strong> uma vaga a qualquer momento. Vaga
            pausada ou encerrada para de aparecer para novos interessados, mas os que já
            responderam continuam na sua lista.
          </p>
        </div>

        <div className="ei-cartao" style={{ display: "grid", gap: 16, marginTop: 20 }}>
          <h2 className="ei-secao" style={{ marginTop: 0 }}>O que o Ei Itabirito não faz</h2>
          <p className="ei-corpo">
            Não somos agência de emprego e não participamos da contratação: não empregamos, não
            selecionamos e não respondemos por combinados entre a empresa e a pessoa. O app
            aproxima os dois lados — o resto é conversa direta entre vocês. Os detalhes completos
            estão nos <Link to="/termos">Termos de uso</Link> e na{" "}
            <Link to="/privacidade">Política de privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
