import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Quantas pessoas estão com o app aberto agora.
 *
 * Usa o Presence do Supabase Realtime: cada aba entra num canal comum e
 * anuncia sua existência; quem fecha a aba some sozinho, sem precisar de
 * tabela, cron de limpeza ou heartbeat escrito à mão. Nenhum dado pessoal
 * trafega aqui — só uma chave aleatória por aba, o suficiente para contar.
 *
 * Devolve `null` enquanto não sabe (ou quando não há banco configurado), para
 * a tela poder simplesmente não mostrar nada em vez de piscar "0 pessoas".
 */
export function useOnlineCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const client = supabase();
    if (!client) return;

    const key = Math.random().toString(36).slice(2);
    const channel = client.channel("presenca-online", {
      config: { presence: { key } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ em: Date.now() });
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  return count;
}
