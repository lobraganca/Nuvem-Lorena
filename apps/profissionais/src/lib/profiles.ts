import { supabase } from "./supabase";
import type { Profile } from "../types/domain";

export async function getProfile(userId: string): Promise<Profile | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.from("profiles").select("*").eq("id", userId).single();
  return data ?? null;
}

/** Salva o CPF do usuário logado. O banco garante (unique index) que um CPF não se repete entre contas. */
export async function saveCpf(userId: string, cpf: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("profiles").update({ cpf }).eq("id", userId);
  if (error) {
    if (error.code === "23505") throw new Error("Este CPF já está associado a outra conta.");
    throw error;
  }
}
