/**
 * Entrar — a primeira tela de quem chega.
 *
 * Uma pergunta só: qual é o seu celular. Nada de escolher entre "entrar" e
 * "criar conta", porque essa escolha não existe de verdade: o app sabe
 * sozinho se o número já tem conta. Obrigar a pessoa a saber a resposta
 * antes de entrar é criar uma bifurcação onde não havia nenhuma — e quem
 * escolhe errado leva um erro que parece culpa dela.
 */

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao, Campo } from '../src/componentes/Base';
import { Marca } from '../src/componentes/Cabecalho';
import { cores, espaco, tipo } from '../src/tema';
import { pedirCodigo } from '../src/lib/autenticacao';
import { formatarEnquantoDigita } from '../src/lib/telefone';
import { mensagemDeErro } from '../src/lib/erros';

export default function Entrar() {
  const router = useRouter();
  const margens = useSafeAreaInsets();
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const e164 = await pedirCodigo(telefone);
      // O número segue para a próxima tela em E.164. Remontá-lo lá seria
      // arriscar mandar um número diferente do que recebeu o SMS.
      router.push({ pathname: '/codigo', params: { telefone: e164 } });
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não deu para enviar o código agora.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={e.tela}
      // No iPhone o teclado cobre o botão sem isto. No Android o próprio
      // sistema já reposiciona, e aplicar os dois deixa a tela pulando.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[e.conteudo, { paddingTop: margens.top + espaco.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Marca sobreEscuro />

        <View style={e.textos}>
          <Text style={[tipo.gigante, { color: cores.textoSobreMarca }]}>
            Quem faz,{'\n'}perto de você.
          </Text>
          <Text style={[tipo.corpo, e.subtitulo]}>
            Encontre profissionais da região — ou receba os pedidos de quem
            precisa do que você faz.
          </Text>
        </View>

        <View style={e.formulario}>
          <Campo
            rotulo="Seu celular"
            value={telefone}
            onChangeText={(t) => {
              setTelefone(formatarEnquantoDigita(t));
              // O erro some assim que a pessoa começa a corrigir. Deixá-lo
              // na tela enquanto ela digita é insistir num aviso que já
              // deixou de valer.
              if (erro) setErro(null);
            }}
            erro={erro}
            ajuda="Vamos mandar um código por SMS para confirmar que o número é seu."
            placeholder="(31) 99999-9999"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            maxLength={15}
            editable={!enviando}
            onSubmitEditing={() => void enviar()}
            returnKeyType="send"
          />

          <Botao onPress={() => void enviar()} carregando={enviando}>
            Receber código
          </Botao>

          <Text style={[tipo.apoio, e.aviso]}>
            Ao continuar você aceita os termos de uso e a política de
            privacidade do procurô.
          </Text>
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
  formulario: {
    marginTop: espaco.xxl,
    backgroundColor: cores.fundo,
    borderRadius: 24,
    padding: espaco.xl,
  },
  aviso: { color: cores.textoApagado, marginTop: espaco.lg, textAlign: 'center' },
});
