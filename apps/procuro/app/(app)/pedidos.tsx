/**
 * Meus pedidos — o que eu pedi e quem respondeu.
 *
 * Cada cartão responde a pergunta que a pessoa realmente tem: **e aí,
 * alguém apareceu?**
 *
 * Por isso o estado do pedido é escrito em gente, não em jargão de banco:
 * "Avisamos 12, aguardando resposta" diz o que está acontecendo; "aberto"
 * não diz nada. E quando alguém aceita, o cartão vira uma lista de contatos
 * — que é o que a pessoa veio buscar.
 */

import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Cabecalho } from '../../src/componentes/Cabecalho';
import { Botao, Cartao, Carregando, Etiqueta, Falhou, Vazio } from '../../src/componentes/Base';
import { abrirWhatsApp, ligar, primeiraMensagem } from '../../src/lib/contato';
import {
  cancelar,
  comoEsta,
  interessadosNoPedido,
  meusPedidos,
  type Interessado,
  type MeuPedido,
} from '../../src/lib/pedidos';
import { mensagemDeErro } from '../../src/lib/erros';
import { cores, espaco, tipo } from '../../src/tema';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronto'; lista: MeuPedido[] }
  | { fase: 'falhou'; mensagem: string };

export default function Pedidos() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [atualizando, setAtualizando] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, Interessado[]>>({});

  const carregar = useCallback(async () => {
    try {
      setEstado({ fase: 'pronto', lista: await meusPedidos() });
    } catch (err) {
      setEstado({
        fase: 'falhou',
        mensagem: mensagemDeErro(err, 'Não deu para carregar seus pedidos.'),
      });
    }
  }, []);

  // Recarrega toda vez que a aba volta ao foco. Sem isto, quem publica um
  // pedido e volta para cá vê a lista antiga — e conclui que não publicou.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  async function verInteressados(pedido: MeuPedido) {
    if (abertos[pedido.id]) {
      setAbertos((a) => {
        const novo = { ...a };
        delete novo[pedido.id];
        return novo;
      });
      return;
    }
    try {
      const lista = await interessadosNoPedido(pedido.id);
      setAbertos((a) => ({ ...a, [pedido.id]: lista }));
    } catch (err) {
      setEstado({
        fase: 'falhou',
        mensagem: mensagemDeErro(err, 'Não deu para carregar quem se interessou.'),
      });
    }
  }

  return (
    <View style={e.tela}>
      <Cabecalho titulo="Meus pedidos" escuro />

      {estado.fase === 'carregando' ? (
        <Carregando texto="Carregando seus pedidos…" />
      ) : estado.fase === 'falhou' ? (
        <Falhou mensagem={estado.mensagem} aoTentarDeNovo={() => void carregar()} />
      ) : (
        <FlatList
          data={estado.lista}
          keyExtractor={(p) => p.id}
          contentContainerStyle={e.lista}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={async () => {
                setAtualizando(true);
                await carregar();
                setAtualizando(false);
              }}
              tintColor={cores.marca}
            />
          }
          ListEmptyComponent={
            <View style={e.vazio}>
              <Vazio
                titulo="Você ainda não pediu nada"
                texto="Publique o que você precisa e avisamos os profissionais da sua região. Você não escolhe um por um — eles é que respondem."
              />
              <View style={e.botaoDoVazio}>
                <Botao onPress={() => router.push('/pedir')}>Publicar um pedido</Botao>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <CartaoDePedido
              pedido={item}
              interessados={abertos[item.id]}
              aoVerInteressados={() => void verInteressados(item)}
              aoCancelar={async () => {
                try {
                  await cancelar(item.id);
                  await carregar();
                } catch (err) {
                  setEstado({
                    fase: 'falhou',
                    mensagem: mensagemDeErro(err, 'Não deu para cancelar.'),
                  });
                }
              }}
            />
          )}
        />
      )}

      {/* O botão de publicar fica sempre à mão, e não só na tela vazia:
          quem já tem pedidos é justamente quem publica de novo. */}
      {estado.fase === 'pronto' && estado.lista.length > 0 ? (
        <View style={e.rodape}>
          <Botao onPress={() => router.push('/pedir')}>Publicar outro pedido</Botao>
        </View>
      ) : null}
    </View>
  );
}

function CartaoDePedido({
  pedido,
  interessados,
  aoVerInteressados,
  aoCancelar,
}: {
  pedido: MeuPedido;
  interessados?: Interessado[];
  aoVerInteressados: () => void;
  aoCancelar: () => void;
}) {
  const estado = comoEsta(pedido);
  const aberto = pedido.status === 'aberto';

  return (
    <View style={{ marginBottom: espaco.md }}>
      <Cartao>
        <View style={e.linhaDoTopo}>
          <Etiqueta>{pedido.categoria_nome}</Etiqueta>
          <Etiqueta cor={estado.cor}>{estado.texto}</Etiqueta>
        </View>

        <Text style={[tipo.corpoForte, e.descricao]} numberOfLines={3}>
          {pedido.descricao}
        </Text>

        {pedido.interessados > 0 ? (
          <Pressable
            onPress={aoVerInteressados}
            style={e.verQuem}
            accessibilityRole="button"
          >
            <Text style={[tipo.apoio, { color: cores.marca, fontWeight: '600' }]}>
              {interessados ? 'Esconder' : 'Ver quem se interessou'}
            </Text>
            <Feather
              name={interessados ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={cores.marca}
            />
          </Pressable>
        ) : null}

        {interessados?.map((i) => (
          <View key={i.disparoId} style={e.interessado}>
            <View style={{ flex: 1 }}>
              <View style={e.nomeELinha}>
                <Text style={[tipo.corpoForte, { color: cores.texto }]}>{i.nome}</Text>
                {i.verificado ? (
                  <Feather
                    name="check-circle"
                    size={14}
                    color={cores.sucesso}
                    style={{ marginLeft: espaco.xs }}
                    accessibilityLabel="Documento verificado"
                  />
                ) : null}
              </View>
              <Text style={[tipo.apoio, { color: cores.textoApagado }]}>{i.categoriaNome}</Text>
            </View>

            {i.telefone ? (
              <View style={e.contatos}>
                <Pressable
                  onPress={() => void ligar(i.telefone as string)}
                  style={e.botaoRedondo}
                  accessibilityRole="button"
                  accessibilityLabel={`Ligar para ${i.nome}`}
                >
                  <Feather name="phone" size={18} color={cores.marca} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    void abrirWhatsApp(
                      i.telefone as string,
                      primeiraMensagem({
                        nomeDoProfissional: i.nome,
                        oQuePrecisa: pedido.descricao,
                      }),
                    )
                  }
                  style={[e.botaoRedondo, { backgroundColor: cores.marca }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Falar com ${i.nome} no WhatsApp`}
                >
                  <Feather name="message-circle" size={18} color={cores.textoSobreMarca} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}

        {aberto ? (
          <Pressable onPress={aoCancelar} style={e.cancelar} accessibilityRole="button">
            <Text style={[tipo.apoio, { color: cores.textoApagado }]}>Cancelar pedido</Text>
          </Pressable>
        ) : null}
      </Cartao>
    </View>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.lg, flexGrow: 1 },
  vazio: { flex: 1, justifyContent: 'center' },
  botaoDoVazio: { paddingHorizontal: espaco.xl, marginTop: espaco.lg },
  linhaDoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  descricao: { color: cores.texto, marginTop: espaco.md },
  verQuem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    marginTop: espaco.md,
    paddingVertical: espaco.sm,
  },
  interessado: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: espaco.md,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  nomeELinha: { flexDirection: 'row', alignItems: 'center' },
  contatos: { flexDirection: 'row', gap: espaco.sm },
  botaoRedondo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: cores.bordaForte,
  },
  cancelar: { marginTop: espaco.md, alignSelf: 'flex-start', paddingVertical: espaco.xs },
  rodape: {
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    padding: espaco.lg,
  },
});
