import { PILARES, TOTAL_DE_CAMPOS, chaveDoCampo, type Etapa, type Pilar } from "../dados/metodo";
import { respondido, type Respostas } from "./guardar";

export type Conta = { feitos: number; total: number };

export function contarEtapa(pilar: Pilar, etapa: Etapa, respostas: Respostas): Conta {
  const feitos = etapa.campos.filter((campo) =>
    respondido(respostas[chaveDoCampo(pilar, etapa, campo)]),
  ).length;
  return { feitos, total: etapa.campos.length };
}

export function contarPilar(pilar: Pilar, respostas: Respostas): Conta {
  return pilar.etapas.reduce<Conta>(
    (soma, etapa) => {
      const conta = contarEtapa(pilar, etapa, respostas);
      return { feitos: soma.feitos + conta.feitos, total: soma.total + conta.total };
    },
    { feitos: 0, total: 0 },
  );
}

export function contarTudo(respostas: Respostas): Conta {
  const feitos = PILARES.reduce((soma, pilar) => soma + contarPilar(pilar, respostas).feitos, 0);
  return { feitos, total: TOTAL_DE_CAMPOS };
}

export function porcento({ feitos, total }: Conta): number {
  if (total === 0) return 0;
  return Math.round((feitos / total) * 100);
}
