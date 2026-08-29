import { supabase } from "./supabase";
import type { ProfessionalExperience } from "../types/domain";
import type { ExperienciaEmEdicao } from "../components/SeletorDeExperiencias";

/**
 * As experiências de um cadastro.
 *
 * Erro sobe, nunca vira lista vazia. "Esta pessoa não tem experiência
 * nenhuma" e "não consegui ler as experiências" parecem a mesma tela e são
 * coisas opostas — a primeira é informação, a segunda é um defeito que
 * ninguém vê. Este projeto já perdeu semanas com uma tela que mentia com
 * calma.
 */
export async function lerExperiencias(professionalId: string): Promise<ProfessionalExperience[]> {
  const sb = supabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("professional_experiences")
    .select("*")
    .eq("professional_id", professionalId)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProfessionalExperience[];
}

/**
 * Grava a lista inteira: apaga o que saiu, grava o que ficou.
 *
 * Apagar tudo e reinserir é mais simples do que casar cada linha com a que
 * já estava lá, e o custo é baixo — são no máximo dez itens, sem nada
 * apontando para eles. A ordem da tela vira a coluna `ordem`, então ela
 * sobrevive à volta.
 *
 * Item sem cargo é descartado em silêncio, e é de propósito: o botão
 * "acrescentar outra" cria uma linha vazia, e quem desiste de preencher
 * deixa ela para trás sem pensar. Recusar o cadastro inteiro por causa
 * disso seria transformar uma hesitação em erro.
 */
export async function salvarExperiencias(
  professionalId: string,
  lista: ExperienciaEmEdicao[]
): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Banco não configurado");

  const validas = lista
    .map((e) => ({
      cargo: e.cargo.trim(),
      onde: e.onde.trim() || null,
      periodo: e.periodo.trim() || null,
    }))
    .filter((e) => e.cargo.length > 0);

  const { error: erroApagar } = await sb
    .from("professional_experiences")
    .delete()
    .eq("professional_id", professionalId);
  if (erroApagar) throw erroApagar;

  if (validas.length === 0) return;

  const { error } = await sb.from("professional_experiences").insert(
    validas.map((e, i) => ({ ...e, professional_id: professionalId, ordem: i }))
  );
  if (error) throw error;
}
