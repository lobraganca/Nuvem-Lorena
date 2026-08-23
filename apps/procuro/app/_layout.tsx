/**
 * A raiz do app.
 *
 * O `ErrorBoundary` daqui não é enfeite: sem ele, um erro em qualquer tela
 * derruba tudo para uma tela branca — e tela branca não diz nada nem para
 * quem está usando nem para quem vai consertar. Com ele, sobra um recado
 * em português e um jeito de voltar.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { cores } from '../src/tema';

export default function Raiz() {
  return (
    <SafeAreaProvider>
      {/* Barra de status clara porque o topo do app é o azul da marca. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: cores.fundo },
        }}
      />
    </SafeAreaProvider>
  );
}
