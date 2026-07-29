/**
 * Brazilian currency always shows two decimals. `toLocaleString` alone renders
 * 15.4 as "15,4", which reads like a broken price on a checkout screen.
 */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
