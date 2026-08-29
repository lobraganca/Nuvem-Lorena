import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  CATEGORIES,
  GRUPOS_DE_SERVICOS,
  MAX_CATEGORIES,
  MAX_CATEGORIA_LEN,
  normalizarCategoria,
} from "../types/domain";

/**
 * Escolha dos serviços do cadastro.
 *
 * Antes a tela despejava os 65 serviços de uma vez, em chips, e o cadastro
 * inteiro ficava soterrado embaixo deles: para chegar à cidade, à descrição
 * ou ao telefone era preciso rolar uma parede de palavras. Pior, tudo ali
 * parecia igualmente clicável, então o que a pessoa já tinha marcado se
 * perdia no meio do que ela ainda não marcou.
 *
 * Agora o formulário mostra só o que é dela — os serviços escolhidos — e um
 * "+" para acrescentar. A lista grande continua existindo, mas dentro da
 * folha, que é onde procurar é a única tarefa. É a mesma troca que os
 * aplicativos de agenda fazem com os convidados: a lista de contatos não
 * mora no formulário, ela abre quando você pede.
 *
 * A ordem importa e é visível: o primeiro serviço é o que aparece em
 * destaque no cadastro e nas buscas, então ele leva a etiqueta "principal" e
 * dá para promover outro sem desmarcar tudo.
 *
 * Serve a duas perguntas parecidas e diferentes: "o que você faz" e "onde
 * você aceitaria trabalhar". As duas escolhem ofícios da mesma lista, então
 * repetem o mesmo gesto — quem aprendeu um já sabe o outro. O que muda é o
 * texto e a etiqueta de principal, que só faz sentido na primeira: entre
 * áreas de interesse não existe uma que apareça em destaque.
 */
export function SeletorDeServicos({
  escolhidos,
  onChange,
  max = MAX_CATEGORIES,
  comPrincipal = true,
  textos,
}: {
  escolhidos: string[];
  onChange: (servicos: string[]) => void;
  max?: number;
  comPrincipal?: boolean;
  textos?: { vazio: string; adicionar: string; tituloFolha: string; subtituloFolha: string };
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const cheio = escolhidos.length >= max;

  const t = textos ?? {
    vazio: "Escolher o que você faz",
    adicionar: "Adicionar outro serviço",
    tituloFolha: "O que você faz",
    subtituloFolha: `Escolha até ${max}. Não achou o seu ofício? Escreva do seu jeito — ele passa a valer também no filtro da busca.`,
  };

  function alterna(servico: string) {
    onChange(
      escolhidos.includes(servico)
        ? escolhidos.filter((x) => x !== servico)
        : [...escolhidos, servico]
    );
  }

  function tornarPrincipal(servico: string) {
    onChange([servico, ...escolhidos.filter((x) => x !== servico)]);
  }

  const digitado = normalizarCategoria(busca);
  const termo = digitado.toLocaleLowerCase("pt-BR");
  const jaExiste =
    CATEGORIES.some((c) => c.toLocaleLowerCase("pt-BR") === termo) ||
    escolhidos.some((c) => c.toLocaleLowerCase("pt-BR") === termo);
  const podeEscrever = digitado.length >= 3 && !jaExiste && !cheio;

  return (
    <>
      {escolhidos.length > 0 && (
        <ul className="servicos-escolhidos">
          {escolhidos.map((c, i) => (
            <li
              key={c}
              className={comPrincipal && i === 0 ? "servico-escolhido principal" : "servico-escolhido"}
            >
              <span className="servico-nome">{c}</span>
              {!comPrincipal ? null : i === 0 ? (
                <span className="servico-marca">principal</span>
              ) : (
                <button
                  type="button"
                  className="servico-promover"
                  onClick={() => tornarPrincipal(c)}
                  title={`Deixar "${c}" como serviço principal`}
                >
                  tornar principal
                </button>
              )}
              <button
                type="button"
                className="servico-tirar"
                onClick={() => alterna(c)}
                aria-label={`Tirar ${c}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn-adicionar-servico" onClick={() => setAberto(true)} disabled={cheio}>
        <span className="mais" aria-hidden="true">
          +
        </span>
        {escolhidos.length === 0 ? t.vazio : t.adicionar}
      </button>

      {cheio && (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
          Você já marcou {max} — o limite. Tire um para pôr outro.
        </p>
      )}

      {aberto && (
        <BottomSheet
          title={t.tituloFolha}
          subtitle={t.subtituloFolha}
          onClose={() => {
            setAberto(false);
            setBusca("");
          }}
        >
          <input
            placeholder="Procure ou escreva seu serviço"
            value={busca}
            maxLength={MAX_CATEGORIA_LEN}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              // Enter dentro do formulário do cadastro salvaria o cadastro pela
              // metade; aqui ele acrescenta o que a pessoa escreveu.
              if (e.key === "Enter") {
                e.preventDefault();
                if (podeEscrever) {
                  alterna(digitado);
                  setBusca("");
                }
              }
            }}
            aria-label="Procurar ou escrever um serviço"
            style={{ width: "100%" }}
          />

          {podeEscrever && (
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: 10 }}
              onClick={() => {
                alterna(digitado);
                setBusca("");
              }}
            >
              Acrescentar “{digitado}”
            </button>
          )}

          <div className="servicos-lista">
            {GRUPOS_DE_SERVICOS.map((g) => {
              const itens = (g.itens as readonly string[]).filter(
                (c) => !termo || c.toLocaleLowerCase("pt-BR").includes(termo)
              );
              if (itens.length === 0) return null;
              return (
                <div key={g.grupo} className="servicos-grupo">
                  <h3>{g.grupo}</h3>
                  {itens.map((c) => {
                    const marcado = escolhidos.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        className={marcado ? "servico-opcao marcado" : "servico-opcao"}
                        aria-pressed={marcado}
                        disabled={!marcado && cheio}
                        onClick={() => alterna(c)}
                      >
                        <span>{c}</span>
                        <span className="servico-check" aria-hidden="true">
                          {marcado ? "✓" : "+"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Serviços escritos à mão não pertencem a nenhum grupo e sumiriam
              da folha assim que a pessoa limpasse a busca — o que pareceria
              não ter sido salvo. Ficam listados à parte. */}
          {escolhidos.some((c) => !(CATEGORIES as readonly string[]).includes(c)) && (
            <div className="servicos-grupo">
              <h3>Escritos por você</h3>
              {escolhidos
                .filter((c) => !(CATEGORIES as readonly string[]).includes(c))
                .map((c) => (
                  <button key={c} type="button" className="servico-opcao marcado" onClick={() => alterna(c)}>
                    <span>{c}</span>
                    <span className="servico-check" aria-hidden="true">
                      ✓
                    </span>
                  </button>
                ))}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 16 }}
            onClick={() => {
              setAberto(false);
              setBusca("");
            }}
          >
            {escolhidos.length === 0 ? "Fechar" : `Pronto — ${escolhidos.length} escolhido${escolhidos.length > 1 ? "s" : ""}`}
          </button>
        </BottomSheet>
      )}
    </>
  );
}
