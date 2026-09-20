import { useEffect, useRef, useState } from "react";
import type { Campo } from "../dados/metodo";
import { ler, salvar } from "../lib/guardar";

type Props = { chave: string; campo: Campo };

/**
 * Um campo do questionário. Salva sozinho, meio segundo depois da última
 * tecla — e também ao sair do campo e ao trocar de tela, porque quem digita e
 * toca em "próxima" no mesmo segundo perderia a última frase.
 */
export function CampoDeTexto({ chave, campo }: Props) {
  const [valor, setValor] = useState(() => ler()[chave] ?? "");
  const [avisoDeSalvo, setAvisoDeSalvo] = useState(false);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const ultimo = useRef(valor);
  ultimo.current = valor;

  // Cresce com o texto. No celular, campo de altura fixa esconde o que a
  // pessoa acabou de escrever, e ela não percebe que continua lá.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valor]);

  useEffect(() => {
    const relogio = setTimeout(() => {
      // Só avisa se algo mudou mesmo. Antes o "salvo" acendia em TODOS os
      // campos meio segundo depois de abrir a tela, sem ninguém ter digitado
      // nada — aviso que aparece sozinho ensina a não olhar para ele.
      if (salvar(chave, valor)) setAvisoDeSalvo(true);
    }, 500);
    return () => clearTimeout(relogio);
  }, [chave, valor]);

  // Saiu da tela com texto ainda não salvo (o meio segundo não venceu).
  useEffect(() => {
    return () => {
      salvar(chave, ultimo.current);
    };
  }, [chave]);

  useEffect(() => {
    if (!avisoDeSalvo) return;
    const relogio = setTimeout(() => setAvisoDeSalvo(false), 1600);
    return () => clearTimeout(relogio);
  }, [avisoDeSalvo]);

  const idAjuda = `${chave}-ajuda`;

  return (
    <div className="campo">
      <label htmlFor={chave}>
        {campo.pergunta}
        <span className={`salvo-aviso ${avisoDeSalvo ? "salvo-aviso-visivel" : ""}`}>
          salvo
        </span>
      </label>

      {campo.ajuda && (
        <p className="ajuda" id={idAjuda}>
          {campo.ajuda}
        </p>
      )}
      {campo.exemplo && <p className="exemplo">Exemplo: {campo.exemplo}</p>}

      <textarea
        id={chave}
        ref={caixa}
        rows={campo.linhas ?? 4}
        value={valor}
        aria-describedby={campo.ajuda ? idAjuda : undefined}
        onChange={(evento) => setValor(evento.target.value)}
        onBlur={() => salvar(chave, valor)}
        placeholder="Escreva aqui"
      />
    </div>
  );
}
