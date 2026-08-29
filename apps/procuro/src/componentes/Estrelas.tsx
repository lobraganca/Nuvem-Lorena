/**
 * As estrelas da nota.
 *
 * Serve para ler e para escolher. A meia-estrela existe porque uma média
 * de 4,5 desenhada com 4 estrelas mente para baixo e com 5 mente para
 * cima — e a diferença entre 4,4 e 4,6 é exatamente o que faz alguém
 * escolher um profissional em vez de outro.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ALVO_DE_TOQUE, cores, espaco } from '../tema';

const COR_DA_ESTRELA = '#E0A44C';

export function Estrelas({
  nota,
  tamanho = 16,
  aoEscolher,
}: {
  nota: number;
  tamanho?: number;
  /** Quando existe, as estrelas viram botões. */
  aoEscolher?: (nota: number) => void;
}) {
  const escolhendo = !!aoEscolher;

  return (
    <View
      style={e.linha}
      accessibilityRole={escolhendo ? 'radiogroup' : 'text'}
      accessibilityLabel={escolhendo ? 'Escolha de 1 a 5 estrelas' : `Nota ${nota.toFixed(1)} de 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        // Cheia quando a nota alcança a estrela; meia quando passa da
        // metade dela. `4.5` acende quatro cheias e uma meia.
        const cheia = nota >= i;
        const meia = !cheia && nota >= i - 0.5;
        const icone = cheia || meia ? 'star' : 'star';
        const cor = cheia ? COR_DA_ESTRELA : meia ? COR_DA_ESTRELA : cores.borda;

        const estrela = (
          <View style={{ opacity: meia ? 0.5 : 1 }}>
            <Feather name={icone} size={tamanho} color={cor} />
          </View>
        );

        if (!escolhendo) return <View key={i} style={e.espaco}>{estrela}</View>;

        return (
          <Pressable
            key={i}
            onPress={() => aoEscolher(i)}
            hitSlop={8}
            accessibilityRole="radio"
            accessibilityState={{ selected: nota >= i }}
            accessibilityLabel={`${i} ${i === 1 ? 'estrela' : 'estrelas'}`}
            // Alvo grande quando é para tocar: estrela de 16px é
            // impossível de acertar com o dedo.
            style={e.alvo}
          >
            {estrela}
          </Pressable>
        );
      })}
    </View>
  );
}

const e = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center' },
  espaco: { marginRight: 2 },
  alvo: {
    minWidth: ALVO_DE_TOQUE,
    minHeight: ALVO_DE_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: espaco.xs,
  },
});
