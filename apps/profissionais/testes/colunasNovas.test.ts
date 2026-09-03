/**
 * A tolerância a coluna que o banco ainda não tem.
 *
 * Ela existe porque as migrations deste projeto são aplicadas à mão e o
 * código sobe sozinho — e uma coluna que chega ao app antes de chegar ao
 * banco já deixou a cidade inteira sem conseguir se cadastrar por catorze
 * horas (a coluna `uf`, na 0060).
 *
 * O teste importa: é código que só roda no dia ruim, e por isso é o que
 * mais fácil quebra sem ninguém ver.
 */
import {
  erroDeColunaDesconhecida,
  gravarTolerando,
  lerTolerando,
  colunasQueExistem,
} from "../src/lib/colunasNovas.ts";
import { grupo, teste, igual, verdade, resumo } from "./ajuda.ts";

const ERRO_POSTGREST = {
  code: "PGRST204",
  message: "Could not find the 'genero' column of 'professionals' in the schema cache",
};
const ERRO_POSTGRES = { code: "42703", message: "column job_listings.destaque_ate does not exist" };
const ERRO_OUTRO = { code: "23505", message: "duplicate key value violates unique constraint" };

grupo("reconhecer o erro certo");

teste("reconhece os dois jeitos de o banco dizer 'não conheço essa coluna'", () => {
  verdade(erroDeColunaDesconhecida(ERRO_POSTGREST), "PGRST204 devia ser reconhecido");
  verdade(erroDeColunaDesconhecida(ERRO_POSTGRES), "42703 devia ser reconhecido");
});

teste("não confunde com outros erros", () => {
  verdade(!erroDeColunaDesconhecida(ERRO_OUTRO), "chave duplicada não é coluna faltando");
  verdade(!erroDeColunaDesconhecida(null), "nulo não é erro de coluna");
  verdade(!erroDeColunaDesconhecida("texto solto"), "texto solto não é erro de coluna");
});

grupo("gravar");

teste("refaz sem as colunas novas e grava o resto", async () => {
  const tentativas: string[][] = [];
  const r = await gravarTolerando(
    { nome: "Ana", genero: "feminino", pcd: true },
    ["genero", "pcd"],
    async (campos) => {
      tentativas.push(Object.keys(campos));
      if ("genero" in campos) return { error: ERRO_POSTGREST };
      return { data: { id: "1" }, error: null };
    }
  );
  igual(tentativas.length, 2, "devia tentar duas vezes");
  igual(tentativas[1], ["nome"], "a segunda tentativa vai sem as colunas novas");
  igual((r.data as { id: string }).id, "1");
  igual(r.error, null);
});

teste("erro que NÃO é de coluna não vira segunda tentativa", async () => {
  let vezes = 0;
  const r = await gravarTolerando({ nome: "Ana" }, ["genero"], async () => {
    vezes++;
    return { error: ERRO_OUTRO };
  });
  igual(vezes, 1, "não podia repetir");
  igual((r.error as { code: string }).code, "23505", "o erro original tem de chegar a quem chamou");
});

teste("quando dá certo de primeira, não repete", async () => {
  let vezes = 0;
  await gravarTolerando({ nome: "Ana" }, ["genero"], async () => {
    vezes++;
    return { data: {}, error: null };
  });
  igual(vezes, 1);
});

grupo("ler");

teste("refaz a leitura sem as colunas novas", async () => {
  const pedidas: string[] = [];
  const r = await lerTolerando("id, nome, genero, pcd", ["genero", "pcd"], async (colunas) => {
    pedidas.push(colunas);
    if (colunas.includes("genero")) return { error: ERRO_POSTGREST };
    return { data: [{ id: "1" }], error: null };
  });
  igual(pedidas.length, 2);
  igual(pedidas[1], "id, nome", "a lista enxuta não pode ter vírgula sobrando");
  igual(r.data, [{ id: "1" }]);
});

teste("a lista enxuta não estraga uma relação com vírgula dentro", async () => {
  /* `companies:companies_public!inner ( company_name, photo_url )` tem
     vírgula DENTRO dos parênteses. Um recorte ingênuo por vírgula quebra
     a relação no meio e o PostgREST recusa a consulta inteira. */
  const colunas =
    "id, title, destaque_ate, companies:companies_public!inner ( company_name, photo_url )";
  const enxuta = await colunasQueExistem(colunas, ["destaque_ate"], async (c) =>
    c.includes("destaque_ate") ? { error: ERRO_POSTGRES } : { error: null }
  );
  verdade(
    enxuta.includes("companies:companies_public!inner ( company_name, photo_url )"),
    `a relação foi estragada: ${enxuta}`
  );
  verdade(!enxuta.includes("destaque_ate"), `a coluna nova devia ter saído: ${enxuta}`);
});

teste("colunasQueExistem devolve a lista inteira quando o banco aceita", async () => {
  const r = await colunasQueExistem("id, nome", ["nome"], async () => ({ error: null }));
  igual(r, "id, nome");
});

process.exit(await resumo());
