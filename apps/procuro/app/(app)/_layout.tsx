/**
 * A barra de baixo.
 *
 * Quatro abas, porque o app serve duas pessoas na mesma conta: quem
 * procura e quem atende. Elas convivem de propósito — quem contrata hoje
 * pode se cadastrar como profissional amanhã sem criar outra conta, e
 * obrigar a escolher um lado no cadastro seria fechar essa porta antes de
 * a pessoa saber que ela existe.
 *
 * A ordem segue quem tem cada aba:
 *
 *   Buscar        — todo mundo
 *   Pedidos       — todo mundo (o que eu pedi)
 *   Oportunidades — quem se cadastrou (e quem não, encontra o convite ali)
 *   Conta         — todo mundo
 */

import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, tipo } from '../../src/tema';

/**
 * Altura da barra, sem contar a faixa do sistema.
 *
 * Foi medida, não chutada. Uma versão anterior punha `paddingTop` aqui e o
 * rótulo ficava com 3px de altura, espremido entre o padding e o ícone — a
 * palavra que diz para que serve a aba, cortada. A navegação já distribui
 * o miolo do item sozinha; o que ela precisa é de altura.
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
        // 10px e não os 11 do resto do app: com QUATRO abas num celular
        // estreito, "Oportunidades" não cabe em 11 e chega cortado como
        // "Oportunida…" — e a palavra cortada é justamente a que diz para
        // que serve a aba. Medido no navegador, não estimado.
        tabBarLabelStyle: { ...tipo.etiqueta, fontSize: 10 },
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
        name="pedidos"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size }) => <Feather name="file-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="oportunidades"
        options={{
          title: 'Oportunidades',
          tabBarIcon: ({ color, size }) => <Feather name="bell" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="conta"
        options={{
          title: 'Conta',
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
