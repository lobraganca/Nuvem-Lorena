/**
 * O topo das telas, com a marca.
 *
 * A logo é desenhada em texto e não é imagem: o circunflexo dourado sobre
 * o "o" final é a marca inteira, e ele precisa acompanhar o tamanho da
 * fonte de quem aumentou a letra do aparelho. Imagem não acompanha.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, espaco, tipo } from '../tema';

export function Marca({ sobreEscuro = false }: { sobreEscuro?: boolean }) {
  const corDoTexto = sobreEscuro ? cores.textoSobreMarca : cores.marca;
  return (
    <View style={e.marca} accessibilityRole="header" accessibilityLabel="procurô">
      <Text style={[e.palavra, { color: corDoTexto }]}>procur</Text>
      <View>
        {/* O circunflexo fica posicionado à mão porque o "ô" com acento na
            fonte do sistema sai pequeno demais para ser a marca. */}
        <Text style={[e.circunflexo, { color: cores.destaque }]}>^</Text>
        <Text style={[e.palavra, { color: corDoTexto }]}>o</Text>
      </View>
    </View>
  );
}

export function Cabecalho({
  titulo,
  subtitulo,
  escuro = false,
}: {
  titulo?: string;
  subtitulo?: string;
  escuro?: boolean;
}) {
  const margens = useSafeAreaInsets();

  return (
    <View
      style={[
        e.cabecalho,
        { paddingTop: margens.top + espaco.sm },
        escuro
          ? { backgroundColor: cores.marca }
          : { backgroundColor: cores.superficie, borderBottomWidth: 1, borderBottomColor: cores.borda },
      ]}
    >
      <Marca sobreEscuro={escuro} />
      {titulo ? (
        <Text
          style={[
            tipo.titulo,
            { color: escuro ? cores.textoSobreMarca : cores.texto, marginTop: espaco.md },
          ]}
        >
          {titulo}
        </Text>
      ) : null}
      {subtitulo ? (
        <Text
          style={[
            tipo.apoio,
            {
              color: escuro ? 'rgba(255,255,255,0.8)' : cores.textoApagado,
              marginTop: espaco.xs,
            },
          ]}
        >
          {subtitulo}
        </Text>
      ) : null}
    </View>
  );
}

const e = StyleSheet.create({
  cabecalho: {
    paddingHorizontal: espaco.lg,
    paddingBottom: espaco.lg,
  },
  marca: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    // O circunflexo fica em posição negativa sobre o "o". Sem esta folga
    // ele encosta no topo do cabeçalho e sai cortado — e a marca cortada
    // foi o primeiro defeito que a primeira foto da tela mostrou.
    paddingTop: 14,
  },
  palavra: { fontSize: 26, fontWeight: '700', letterSpacing: -1 },
  circunflexo: {
    position: 'absolute',
    top: -11,
    alignSelf: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
});
