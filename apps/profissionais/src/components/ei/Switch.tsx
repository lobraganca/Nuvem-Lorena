/**
 * Interruptor de ligar/desligar, no desenho do Material 3.
 *
 * Existe para as duas escolhas mais importantes do perfil de quem procura
 * trabalho — "estou disponível" e "ficar oculto" — e uma caixa de marcar não
 * serviria: ela some no meio de um formulário longo, e essas duas precisam
 * mostrar o estado ATUAL sem a pessoa abrir ou rolar nada.
 *
 * É um `button` com `role="switch"`, e não um `input[type=checkbox]`
 * disfarçado: o leitor de tela anuncia "ativado/desativado" em vez de
 * "marcado", que é a leitura certa para um estado que vale agora — e não
 * para uma opção que será enviada depois num formulário.
 */
export function Switch({
  ligado,
  onChange,
  titulo,
  descricao,
  desabilitado = false,
}: {
  ligado: boolean;
  onChange: (novo: boolean) => void;
  titulo: string;
  descricao?: string;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      className="ei-switch"
      disabled={desabilitado}
      onClick={() => onChange(!ligado)}
    >
      <span>
        <span style={{ display: "block", fontWeight: 500 }}>{titulo}</span>
        {descricao && (
          <span className="ei-apoio" style={{ display: "block", marginTop: 2 }}>
            {descricao}
          </span>
        )}
      </span>
      {/* `aria-hidden`: o estado já é anunciado pelo `aria-checked` do
          botão. Sem isto, o leitor de tela lê o desenho como se fosse um
          segundo controle. */}
      <span className="ei-switch-trilho" aria-hidden="true">
        <span className="ei-switch-bolinha" />
      </span>
    </button>
  );
}
