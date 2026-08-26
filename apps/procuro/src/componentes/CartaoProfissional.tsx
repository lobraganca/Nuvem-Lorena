/**
 * O cartão de quem faz, na lista da busca.
 *
 * A ordem do que aparece segue a ordem das perguntas de quem procura:
 *
 *   1. Quem é?          -> foto e nome
 *   2. Faz o quê?       -> o ofício
 *   3. Posso confiar?   -> o selo de verificado
 *   4. Atende hoje?     -> a situação
 *   5. Como falo?       -> o botão
 *
 * Quem está de férias ou pausado aparece esmaecido, e isso é deliberado:
 * some da lista quem se ocultou, mas quem só está ocupado continua
 * visível — porque na semana que vem ele atende, e o cadastro dele vale.
 * Esmaecer diz "existe, mas não hoje" sem precisar de explicação.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Cartao, Etiqueta } from './Base';
import { comoEstaAgora } from '../lib/busca';
import { canto, cores, espaco, tipo } from '../tema';
import type { ProfissionalPublico } from '../tipos/dominio';

/** As iniciais, para quem ainda não pôs foto. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return (partes[0] ?? '?').slice(0, 1).toUpperCase();
  return ((partes[0] ?? '').slice(0, 1) + (partes[partes.length - 1] ?? '').slice(0, 1)).toUpperCase();
}

export function CartaoProfissional({
  profissional,
  aoTocar,
}: {
  profissional: ProfissionalPublico;
  aoTocar?: () => void;
}) {
  const estado = comoEstaAgora(profissional);
  const destacado = profissional.destaque >= 30;

  return (
    <View style={e.espacamento}>
      <Cartao onPress={aoTocar} destacado={destacado}>
        <View style={[e.linha, !estado.atende && e.esmaecido]}>
          <View style={e.retrato}>
            <Text style={e.iniciais}>{iniciais(profissional.nome)}</Text>
          </View>

          <View style={e.meio}>
            <View style={e.nomeELinha}>
              <Text style={[tipo.corpoForte, { color: cores.texto }]} numberOfLines={1}>
                {profissional.nome}
              </Text>
              {profissional.verificado ? (
                <Feather
                  name="check-circle"
                  size={15}
                  color={cores.sucesso}
                  style={{ marginLeft: espaco.xs }}
                  // Sem isto, quem usa leitor de tela ouve só o nome e
                  // perde a informação que mais pesa na decisão.
                  accessibilityLabel="Documento verificado"
                />
              ) : null}
            </View>

            <Text style={[tipo.apoio, { color: cores.textoApagado }]} numberOfLines={1}>
              {profissional.categoria_nome}
            </Text>

            {profissional.apresentacao ? (
              <Text style={[tipo.apoio, e.apresentacao]} numberOfLines={2}>
                {profissional.apresentacao}
              </Text>
            ) : null}

            <View style={e.rodape}>
              <Etiqueta cor={estado.atende ? 'sucesso' : 'neutra'}>{estado.texto}</Etiqueta>
              {destacado ? <Etiqueta cor="destaque">Destaque</Etiqueta> : null}
            </View>
          </View>
        </View>
      </Cartao>
    </View>
  );
}

const e = StyleSheet.create({
  espacamento: { marginBottom: espaco.md },
  linha: { flexDirection: 'row', alignItems: 'flex-start' },
  esmaecido: { opacity: 0.55 },
  retrato: {
    width: 52,
    height: 52,
    borderRadius: canto.capsula,
    backgroundColor: cores.marca,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: espaco.md,
  },
  iniciais: { color: cores.textoSobreMarca, fontSize: 18, fontWeight: '700' },
  meio: { flex: 1 },
  nomeELinha: { flexDirection: 'row', alignItems: 'center' },
  apresentacao: { color: cores.textoApagado, marginTop: espaco.xs },
  rodape: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.sm, flexWrap: 'wrap' },
});
