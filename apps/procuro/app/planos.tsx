/**
 * Os planos.
 *
 * A tela vende UMA coisa, e ela é a única que interessa a quem atende:
 * **quando o pedido chega em você.**
 *
 * A lista de recursos vem depois, e menor. Um quadro comparativo com
 * quinze linhas de "sim/não" parece completo e não convence ninguém —
 * porque não responde a pergunta que a pessoa está fazendo, que é "vale a
 * pena?". "Você recebe primeiro" responde.
 *
 * Os preços e o que cada plano dá vêm do BANCO, não daqui. Mudar o preço
 * ou mover um recurso de plano é um update pelo painel, sem publicar app —
 * e isso não é detalhe: preço é decisão comercial, e decisão comercial que
 * depende de programador é decisão que demora.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cartao, Carregando, Etiqueta, Falhou } from '../src/componentes/Base';
import { supabase } from '../src/lib/supabase';
import { ErroDeDados, mensagemDeErro } from '../src/lib/erros';
import { canto, cores, espaco, tipo } from '../src/tema';
import type { Plano } from '../src/tipos/dominio';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronto'; planos: Plano[] }
  | { fase: 'falhou'; mensagem: string };

export default function Planos() {
  const router = useRouter();
  const margens = useSafeAreaInsets();
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });

  const carregar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem');
      if (error) {
        throw new ErroDeDados(mensagemDeErro(error, 'Não deu para carregar os planos.'), error);
      }
      setEstado({ fase: 'pronto', planos: (data ?? []) as Plano[] });
    } catch (err) {
      setEstado({ fase: 'falhou', mensagem: mensagemDeErro(err, 'Não deu para carregar os planos.') });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <View style={e.tela}>
      <View style={[e.topo, { paddingTop: margens.top + espaco.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Feather name="arrow-left" size={24} color={cores.textoSobreMarca} />
        </Pressable>
        <Text style={[tipo.titulo, { color: cores.textoSobreMarca, marginTop: espaco.md }]}>
          Planos
        </Text>
        <Text style={[tipo.apoio, { color: 'rgba(255,255,255,0.8)', marginTop: espaco.xs }]}>
          A diferença entre eles é quando o pedido chega em você.
        </Text>
      </View>

      {estado.fase === 'carregando' ? (
        <Carregando texto="Carregando os planos…" />
      ) : estado.fase === 'falhou' ? (
        <Falhou mensagem={estado.mensagem} aoTentarDeNovo={() => void carregar()} />
      ) : (
        <ScrollView contentContainerStyle={e.corpo}>
          {estado.planos.map((p) => (
            <CartaoDePlano key={p.id} plano={p} />
          ))}

          <View style={e.aviso}>
            <Feather name="info" size={16} color={cores.textoApagado} />
            <Text style={[tipo.apoio, { color: cores.textoApagado, flex: 1 }]}>
              A cobrança ainda não está ligada. Fale com o suporte para mudar
              de plano por enquanto.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function CartaoDePlano({ plano }: { plano: Plano }) {
  const recomendado = plano.onda === 1;

  return (
    <View style={{ marginBottom: espaco.lg }}>
      <Cartao destacado={recomendado}>
        <View style={e.linhaDoTopo}>
          <Text style={[tipo.secao, { color: cores.texto }]}>{plano.nome}</Text>
          {recomendado ? <Etiqueta cor="destaque">Recebe primeiro</Etiqueta> : null}
        </View>

        <Text style={[tipo.gigante, e.preco]}>
          {plano.preco_mensal_centavos === 0
            ? 'Grátis'
            : `R$ ${(plano.preco_mensal_centavos / 100).toFixed(2).replace('.', ',')}`}
          {plano.preco_mensal_centavos > 0 ? (
            <Text style={[tipo.apoio, { color: cores.textoApagado }]}> por mês</Text>
          ) : null}
        </Text>

        {plano.preco_mensal_pj_centavos && plano.preco_mensal_pj_centavos !== plano.preco_mensal_centavos ? (
          <Text style={[tipo.apoio, { color: cores.textoApagado }]}>
            Empresa: R$ {(plano.preco_mensal_pj_centavos / 100).toFixed(2).replace('.', ',')} por mês
          </Text>
        ) : null}

        {/* A frase que vende, em destaque. */}
        <View style={[e.faixaDaOnda, plano.onda === null && { backgroundColor: cores.superficieAfundada }]}>
          <Text style={[tipo.corpoForte, { color: cores.texto }]}>
            {plano.onda === null
              ? 'Não recebe pedidos'
              : plano.onda === 1
                ? 'Recebe os pedidos na hora'
                : plano.atraso_minutos >= 60
                  ? `Recebe ${Math.round(plano.atraso_minutos / 60)}h depois`
                  : `Recebe ${plano.atraso_minutos} min depois`}
          </Text>
          <Text style={[tipo.apoio, { color: cores.textoApagado, marginTop: 2 }]}>
            {plano.onda === null
              ? 'Seu cadastro aparece para quem procura, com o telefone visível.'
              : plano.onda === 1
                ? 'Você é avisado antes de todo mundo.'
                : 'Depois de quem tem o plano acima.'}
          </Text>
        </View>

        {/* O resto, menor. */}
        <View style={e.recursos}>
          <Recurso liberado={plano.whatsapp_liberado} texto="Botão de WhatsApp no seu perfil" />
          <Recurso liberado={plano.ligacao_liberada} texto="Botão de ligar" />
          <Recurso liberado={plano.estatisticas} texto="Estatísticas do seu cadastro" />
          <Recurso liberado={plano.chat_interno} texto="Conversa dentro do app" />
          <Recurso liberado={plano.divulgacao} texto="Divulgar seus serviços" />
          <Recurso
            liberado={plano.destaque_busca > 0}
            texto={
              plano.destaque_busca >= 30
                ? 'Destaque máximo na busca'
                : plano.destaque_busca > 0
                  ? 'Mais visibilidade na busca'
                  : 'Aparece na busca normalmente'
            }
          />
        </View>
      </Cartao>
    </View>
  );
}

function Recurso({ liberado, texto }: { liberado: boolean; texto: string }) {
  return (
    <View style={e.recurso}>
      <Feather
        name={liberado ? 'check' : 'minus'}
        size={16}
        color={liberado ? cores.sucesso : cores.bordaForte}
      />
      <Text
        style={[
          tipo.apoio,
          { color: liberado ? cores.texto : cores.textoApagado, flex: 1 },
        ]}
      >
        {texto}
      </Text>
    </View>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: { backgroundColor: cores.marca, paddingHorizontal: espaco.lg, paddingBottom: espaco.lg },
  corpo: { padding: espaco.lg, paddingBottom: espaco.xxl },
  linhaDoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  preco: { color: cores.texto, marginTop: espaco.sm },
  faixaDaOnda: {
    backgroundColor: cores.destaqueLavado,
    borderRadius: canto.md,
    padding: espaco.md,
    marginTop: espaco.lg,
  },
  recursos: { marginTop: espaco.lg, gap: espaco.sm },
  recurso: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  aviso: {
    flexDirection: 'row',
    gap: espaco.sm,
    alignItems: 'flex-start',
    backgroundColor: cores.superficieAfundada,
    borderRadius: canto.md,
    padding: espaco.md,
  },
});
