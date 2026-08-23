/**
 * A raiz do app, e o guarda que decide quem entra onde.
 *
 * O guarda mora aqui, num lugar só, e não espalhado por tela. Guarda
 * repetido em cada tela é guarda que alguém esquece de colocar na tela
 * nova — e a tela esquecida é justamente a que vaza.
 *
 * Os três caminhos:
 *
 *   carregando -> a marca, parada. NUNCA a tela de entrar.
 *   fora       -> tela de entrar
 *   entrou     -> o app
 *
 * O primeiro é o que costuma ser esquecido, e o esquecimento tem um
 * sintoma feio: enquanto o app lê a sessão guardada no aparelho, ele acha
 * que ninguém entrou e pisca a tela de login — inclusive para quem está
 * logado há meses. Dura poucos quadros e é o bastante para o app parecer
 * quebrado toda vez que abre.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Marca } from '../src/componentes/Cabecalho';
import { cores, espaco, tipo } from '../src/tema';
import { useSessao } from '../src/lib/autenticacao';

/** As telas que dá para ver sem ter entrado. */
const TELAS_ABERTAS = ['entrar', 'codigo'];

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Guarda />
    </SafeAreaProvider>
  );
}

function Guarda() {
  const estado = useSessao();
  const segmentos = useSegments();
  const router = useRouter();

  const estaEmTelaAberta = TELAS_ABERTAS.includes(segmentos[0] ?? '');

  useEffect(() => {
    // Enquanto não sabemos, não mexe em nada. Redirecionar aqui é o que
    // produz o piscar.
    if (estado.fase === 'carregando') return;

    if (estado.fase === 'fora' && !estaEmTelaAberta) {
      router.replace('/entrar');
    } else if (estado.fase === 'entrou' && estaEmTelaAberta) {
      // Acabou de confirmar o código: sai da entrada e vai para o app.
      // `replace` e não `push` para o botão voltar não devolver a pessoa
      // para a tela de login já resolvida.
      router.replace('/');
    }
  }, [estado.fase, estaEmTelaAberta, router]);

  if (estado.fase === 'carregando') return <Abrindo />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: cores.fundo },
      }}
    />
  );
}

/**
 * A tela de abertura.
 *
 * Mostra a marca, não um rodinha solta. Os poucos décimos que o app leva
 * para ler a sessão são o primeiro contato de cada abertura — e uma marca
 * parada comunica "está abrindo" tão bem quanto um indicador, sem o ar de
 * espera indefinida que um rodinha sozinho tem.
 */
function Abrindo() {
  return (
    <View style={e.abrindo}>
      <Marca sobreEscuro />
      <Text style={[tipo.apoio, e.frase]}>Quem faz, perto de você.</Text>
    </View>
  );
}

const e = StyleSheet.create({
  abrindo: {
    flex: 1,
    backgroundColor: cores.marca,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frase: { color: 'rgba(255,255,255,0.7)', marginTop: espaco.md },
});
