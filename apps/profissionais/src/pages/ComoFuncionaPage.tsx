import { Link } from "react-router-dom";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { precoMensal } from "../lib/payments";
import { useTituloDaPagina } from "../lib/tituloDaPagina";

export function ComoFuncionaPage() {
  useTituloDaPagina("Como funciona");
  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Como funciona</h1>
      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Como buscar</h2>
        <p className="muted" style={{ margin: 0 }}>
          Na página inicial, filtre por cidade e categoria ou digite uma palavra-chave (nome ou algo da
          descrição). Os resultados trazem foto/logo, nota média, o selo de conta premium (quando houver) e um
          botão de WhatsApp direto para quem é verificado.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Como avaliar</h2>
        <p className="muted" style={{ margin: 0 }}>
          Para avaliar é preciso entrar com sua conta e <strong>ter contratado</strong> aquela pessoa. Antes
          das estrelas o app pergunta isso — e quem responde que ainda não contratou é convidado a voltar
          depois do serviço. É a regra que impede alguém de derrubar a nota de um concorrente sem nunca ter
          chamado, e de encher o próprio cadastro de estrelas de quem não contratou nada.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Toda avaliação aparece com <strong>o seu nome, a sua foto e a data</strong> — os mesmos da conta com
          que você entrou. Avaliação anônima não existe aqui: quem escreve responde pelo que escreveu, e é
          isso que faz a nota valer alguma coisa.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          É <strong>uma avaliação por profissional</strong>. Se mudar de ideia, dá para editar ou apagar a sua
          quando quiser, na página dele.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Como fecho o app</h2>
        <p className="muted" style={{ margin: 0 }}>
          Em <Link to="/perfil">Perfil</Link> existe o botão <strong>"Fechar o app"</strong>. No Android ele
          fecha direto. No iPhone, o sistema não deixa um aplicativo se fechar sozinho — vale para todos, não
          só para o procurô —, então ali o botão mostra o gesto certo.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          O gesto no <strong>iPhone</strong>: deslize de baixo para cima, segure no meio da tela e empurre o
          procurô para cima. No <strong>Android</strong>: botão de recentes e empurre para o lado.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Você também não precisa fechar: indo para a tela de início do celular, o procurô fica parado sem gastar
          bateria nem internet.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Se o que você quer é <strong>sair da sua conta</strong>, isso tem botão: em{" "}
          <Link to="/perfil">Perfil</Link>, em "Sair da conta".
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Como excluo minha conta</h2>
        <p className="muted" style={{ margin: 0 }}>
          Vá em <strong>Perfil</strong> (o último ícone da barra de baixo) e role até o fim: embaixo de "Sair
          da conta" está <strong>"Excluir minha conta"</strong>. O app pede que você digite uma confirmação,
          para ninguém apagar tudo por um toque errado.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          A exclusão é <strong>imediata e definitiva</strong>: apaga seus cadastros, suas avaliações e seus
          favoritos. Não tem como desfazer nem recuperar depois. Se você só quer sumir da busca por um tempo,
          existe a opção de <strong>pausar o cadastro</strong> no painel — ela guarda tudo e devolve quando você
          quiser.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Se você tem assinatura ativa (selo ou destaque), cancele antes em <strong>Minhas páginas</strong>, para
          não continuar sendo cobrado.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Meu endereço aparece no cadastro?</h2>
        <p className="muted" style={{ margin: 0 }}>
          Só se você quiser. No formulário do cadastro existe a opção{" "}
          <strong>"Mostrar rua e número no meu cadastro"</strong>, e ela vem <strong>desmarcada</strong>.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Com ela desmarcada, ninguém vê a sua rua nem o número — nem pela tela, nem por trás dela. O que
          aparece é o <strong>bairro</strong>, que ajuda quem procura alguém perto sem dizer onde fica a sua
          porta. Quem tem salão, oficina ou loja e quer que as pessoas cheguem até lá é que marca a opção.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Se você atende na casa do cliente ou trabalha na sua própria casa, deixe desmarcada. Você pode
          mudar isso a qualquer momento editando o cadastro.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>O que é a conta premium</h2>
        <p className="muted" style={{ margin: 0 }}>
          A <strong>conta premium</strong> (o selo <VerifiedBadge />) é uma assinatura de quem tem cadastro:{" "}
          <strong>R$ {precoMensal("verification", "pf").toFixed(2).replace(".", ",")} por mês</strong> para
          profissional autônomo e{" "}
          <strong>R$ {precoMensal("verification", "pj").toFixed(2).replace(".", ",")} para empresa</strong>.
          Ela libera o <strong>botão de WhatsApp direto</strong> e o{" "}
          <strong>"peça para te chamar"</strong>, em que você deixa seu número e a pessoa retorna.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          <strong>O selo não é uma avaliação nossa.</strong> Ele diz que aquela pessoa assina o plano, e mais
          nada: não atestamos a qualidade do serviço, não conferimos documento e não somos parte do que for
          combinado entre vocês. Quem diz se o trabalho é bom são as avaliações de quem contratou.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Quem não assina continua aparecendo na busca, com o telefone visível. A diferença é só o atalho de
          contato.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>O que é um cadastro turbinado</h2>
        <p className="muted" style={{ margin: 0 }}>
          Um cadastro <strong>turbinado</strong> (<span className="badge badge-boosted">Destaque</span>) é
          outra assinatura opcional que faz o cadastro aparecer primeiro nos resultados de busca. É só um
          destaque de posicionamento — não é uma avaliação de qualidade do serviço.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Importante</h2>
        <p className="muted" style={{ margin: 0 }}>
          O procurô é uma vitrine: só ajuda quem busca um serviço a encontrar quem oferece. Não
          empregamos, não supervisionamos e não nos responsabilizamos pela execução, qualidade, prazos ou
          resultado de nenhum serviço contratado — isso é combinado diretamente entre você e o
          profissional/empresa. Veja os detalhes completos nos <Link to="/termos">Termos de Uso</Link>.
        </p>
      </div>
    </div>
  );
}
