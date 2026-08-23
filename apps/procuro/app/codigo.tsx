/**
 * Conferir o código do SMS.
 *
 * Duas coisas aqui existem por causa do que acontece quando o SMS demora:
 *
 * 1. **O botão de reenviar tem contagem regressiva.** Sem ela, quem acha
 *    que o SMS não chegou toca três vezes seguidas, bate no limite de
 *    envio do Auth, e passa a receber erro em vez de código — ficando
 *    preso justamente por ter tentado resolver sozinho. A contagem
 *    transforma "tocar de novo" numa espera visível, que é honesta.
 *
 * 2. **O número aparece na tela, com um jeito de voltar e corrigir.**
 *    Quem digitou um dígito errado fica esperando um SMS que nunca vem, e
 *    sem ver o número não tem como desconfiar. Mostrar o número é o que
 *    faz a pessoa perceber.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao, Campo } from '../src/componentes/Base';
import { Marca } from '../src/componentes/Cabecalho';
import { cores, espaco, tipo } from '../src/tema';
import { conferirCodigo, pedirCodigo } from '../src/lib/autenticacao';
import { paraLeitura } from '../src/lib/telefone';
import { mensagemDeErro } from '../src/lib/erros';

/** Quanto tempo até poder pedir outro código. */
const ESPERA_PARA_REENVIAR = 60;

export default function ConferirCodigo() {
  const router = useRouter();
  const margens = useSafeAreaInsets();
  const { telefone } = useLocalSearchParams<{ telefone: string }>();

  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [segundos, setSegundos] = useState(ESPERA_PARA_REENVIAR);

  // Guarda se a tela ainda está montada. Sem isto, um `setState` depois de
  // a pessoa voltar dispara aviso e, pior, segura a tela na memória.
  const viva = useRef(true);
  useEffect(() => () => { viva.current = false; }, []);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => viva.current && setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  const conferir = useCallback(
    async (valor: string) => {
      if (!telefone) return;
      setErro(null);
      setConferindo(true);
      try {
        await conferirCodigo(telefone, valor);
        // Deu certo: o guarda do _layout percebe a sessão nova e leva para
        // dentro do app sozinho. Navegar daqui também levaria a duas
        // navegações competindo pela mesma tela.
      } catch (err) {
        if (!viva.current) return;
        setErro(mensagemDeErro(err, 'Não deu para conferir o código.'));
        setCodigo('');
      } finally {
        if (viva.current) setConferindo(false);
      }
    },
    [telefone],
  );

  async function reenviar() {
    if (!telefone || segundos > 0) return;
    setErro(null);
    try {
      await pedirCodigo(telefone);
      setSegundos(ESPERA_PARA_REENVIAR);
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não deu para reenviar o código.'));
    }
  }

  return (
    <KeyboardAvoidingView
      style={e.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[e.conteudo, { paddingTop: margens.top + espaco.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Marca sobreEscuro />

        <View style={e.textos}>
          <Text style={[tipo.titulo, { color: cores.textoSobreMarca }]}>
            Digite o código
          </Text>
          <Text style={[tipo.corpo, e.subtitulo]}>
            Mandamos um SMS para {telefone ? paraLeitura(telefone) : 'seu celular'}.
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[tipo.apoio, e.trocar]}>Número errado? Corrigir</Text>
          </Pressable>
        </View>

        <View style={e.formulario}>
          <Campo
            rotulo="Código do SMS"
            value={codigo}
            onChangeText={(t) => {
              const so = t.replace(/\D/g, '').slice(0, 6);
              setCodigo(so);
              if (erro) setErro(null);
              // Confere sozinho quando completa. Quem já digitou os seis
              // números não tem mais nada a decidir — pedir um toque a mais
              // só adiciona um passo sem propósito.
              if (so.length === 6) void conferir(so);
            }}
            erro={erro}
            placeholder="000000"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={6}
            editable={!conferindo}
            style={e.campoDoCodigo}
          />

          <Botao
            onPress={() => void conferir(codigo)}
            carregando={conferindo}
            desabilitado={codigo.length < 4}
          >
            Confirmar
          </Botao>

          <View style={e.reenviar}>
            {segundos > 0 ? (
              <Text style={[tipo.apoio, { color: cores.textoApagado }]}>
                Não chegou? Você poderá pedir outro em {segundos}s
              </Text>
            ) : (
              <Botao variante="discreto" onPress={() => void reenviar()}>
                Enviar outro código
              </Botao>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.marca },
  conteudo: { flexGrow: 1, padding: espaco.xl },
  textos: { marginTop: espaco.xxl },
  subtitulo: { color: 'rgba(255,255,255,0.85)', marginTop: espaco.md },
  trocar: {
    color: cores.destaque,
    marginTop: espaco.sm,
    textDecorationLine: 'underline',
  },
  formulario: {
    marginTop: espaco.xxl,
    backgroundColor: cores.fundo,
    borderRadius: 24,
    padding: espaco.xl,
  },
  // Código se lê dígito a dígito: fonte grande e espaçada, centralizada.
  campoDoCodigo: {
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    fontWeight: '700',
  },
  reenviar: { marginTop: espaco.lg, alignItems: 'center' },
});
