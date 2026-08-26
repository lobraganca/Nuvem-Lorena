/**
 * A barra de baixo.
 *
 * Duas abas, porque o app serve duas pessoas na mesma conta: quem procura
 * e quem atende. Elas convivem de propósito — quem contrata hoje pode se
 * cadastrar como profissional amanhã sem criar outra conta, e obrigar a
 * escolher um lado no cadastro seria fechar essa porta antes de a pessoa
 * saber que ela existe.
 *
 * Buscar vem primeiro porque é a aba que TODO mundo tem. Oportunidades só
 * faz sentido para quem se cadastrou, e quem não se cadastrou encontra ali
 * o convite para fazê-lo.
 */

import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, tipo } from '../../src/tema';

/**
 * Altura da barra, sem contar a faixa do sistema.
 *
 * Foi calculada e não chutada: ícone (24) + folga (4) + rótulo (~14) +
 * respiro em cima e embaixo. A primeira versão deixava a altura no padrão
 * e só a corrigia no Android — e a foto da tela mostrou "Oportunidades"
 * cortado ao meio. Rótulo cortado não é detalhe estético: é a palavra que
 * diz para que serve a aba.
 */
const ALTURA_DA_BARRA = 60;

export default function AbasDoApp() {
  const margens = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.marca,
        tabBarInactiveTintColor: cores.textoApagado,
        tabBarStyle: {
          backgroundColor: cores.superficie,
          borderTopColor: cores.borda,
          // A faixa do sistema (o risco do iPhone, a barra de gestos do
          // Android) entra SOMADA à altura, nunca comendo dela.
          height: ALTURA_DA_BARRA + margens.bottom,
        },
        // Sem `paddingTop`/`paddingBottom` aqui de propósito. A primeira
        // versão os aplicava na barra, e medir a tela mostrou o estrago: o
        // rótulo ficava com 3px de altura, espremido entre o padding e o
        // ícone. A navegação já distribui o miolo do item sozinha — o que
        // ela precisa é de altura, não de instrução.
        tabBarLabelStyle: tipo.etiqueta,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, size }) => <Feather name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="oportunidades"
        options={{
          title: 'Oportunidades',
          tabBarIcon: ({ color, size }) => <Feather name="bell" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
