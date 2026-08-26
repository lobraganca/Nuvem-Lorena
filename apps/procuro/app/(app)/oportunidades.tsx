/**
 * A tela de oportunidades — a primeira que quem atende vê.
 *
 * Ela abre no que é urgente, não no que é bonito. Quem paga pelo plano
 * paga por isto: saber, assim que abre, se apareceu trabalho.
 *
 * Três estados que precisam ser DIFERENTES na tela, e é o ponto todo:
 *
 *   carregando -> ainda não sabemos
 *   falhou     -> não conseguimos saber
 *   vazio      -> sabemos, e não tem nada
 *
 * Desenhar "falhou" igual a "vazio" produz um app que diz "nenhuma
 * oportunidade" quando na verdade quebrou. Ninguém reclama disso — a tela
 * parece normal — e o defeito vive meses.
 */

import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Cabecalho } from '../../src/componentes/Cabecalho';
import { CartaoDeOportunidade } from '../../src/componentes/CartaoDeOportunidade';
import { Carregando, Etiqueta, Falhou, Vazio } from '../../src/componentes/Base';
import { cores, espaco, tipo } from '../../src/tema';
import { ErroDeDados, mensagemDeErro } from '../../src/lib/erros';
import {
  comoRecebeOportunidades,
  meuCadastroProfissional,
  oportunidadesEmAberto,
  planoVigente,
  responder,
} from '../../src/lib/oportunidades';
import type { Oportunidade, Plano, RespostaAoDisparo } from '../../src/tipos/dominio';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronto'; lista: Oportunidade[]; plano: Plano | null }
  /** Entrou, mas não é profissional — usa o app só para procurar. */
  | { fase: 'so_cliente' }
  | { fase: 'falhou'; mensagem: string };

export default function Oportunidades() {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [atualizando, setAtualizando] = useState(false);
  const [respondendoId, setRespondendoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const cadastro = await meuCadastroProfissional();
      // Quem não é profissional não tem oportunidade nenhuma para ver, e
      // isso não é um vazio nem uma falha — é outra tela.
      if (!cadastro) {
        setEstado({ fase: 'so_cliente' });
        return;
      }

      // As duas juntas: sem o plano, a tela não sabe explicar POR QUE a
      // lista está vazia — e "seu plano não recebe oportunidades" é uma
      // resposta completamente diferente de "não apareceu nada hoje".
      const [lista, plano] = await Promise.all([
        oportunidadesEmAberto(cadastro.id),
        planoVigente(cadastro.id),
      ]);
      setEstado({ fase: 'pronto', lista, plano });
    } catch (err) {
      setEstado({
        fase: 'falhou',
        mensagem: mensagemDeErro(err, 'Não deu para carregar suas oportunidades.'),
      });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const puxarParaAtualizar = useCallback(async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }, [carregar]);

  const responderA = useCallback(
    async (disparoId: string, resposta: RespostaAoDisparo) => {
      setRespondendoId(disparoId);
      try {
        await responder(disparoId, resposta);
        // Some da lista na hora. Esperar o recarregamento deixa o cartão
        // na tela por um instante depois de respondido, e nesse instante
        // dá para tocar de novo.
        setEstado((atual) =>
          atual.fase === 'pronto'
            ? { ...atual, lista: atual.lista.filter((o) => o.id !== disparoId) }
            : atual,
        );
      } catch (err) {
        setEstado({
          fase: 'falhou',
          mensagem:
            err instanceof ErroDeDados
              ? err.message
              : mensagemDeErro(err, 'Não deu para registrar sua resposta.'),
        });
      } finally {
        setRespondendoId(null);
      }
    },
    [],
  );

  return (
    <View style={e.tela}>
      <Cabecalho titulo="Oportunidades" escuro />

      {estado.fase === 'carregando' ? (
        <Carregando texto="Procurando trabalho para você…" />
      ) : estado.fase === 'falhou' ? (
        <Falhou mensagem={estado.mensagem} aoTentarDeNovo={() => void carregar()} />
      ) : estado.fase === 'so_cliente' ? (
        <Vazio
          titulo="Você ainda não tem cadastro de profissional"
          texto="Cadastre o que você faz para começar a receber os pedidos de quem precisa do seu serviço na região."
        />
      ) : (
        <FlatList
          data={estado.lista}
          keyExtractor={(o) => o.id}
          contentContainerStyle={e.lista}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={() => void puxarParaAtualizar()}
              tintColor={cores.marca}
            />
          }
          ListHeaderComponent={<FaixaDoPlano plano={estado.plano} />}
          ListEmptyComponent={
            <SemOportunidades plano={estado.plano} />
          }
          renderItem={({ item }) => (
            <CartaoDeOportunidade
              oportunidade={item}
              respondendo={respondendoId === item.id}
              aoAceitar={() => void responderA(item.id, 'aceito')}
              aoRecusar={() => void responderA(item.id, 'recusado')}
            />
          )}
        />
      )}
    </View>
  );
}

/** A faixa que explica em que onda a pessoa está. */
function FaixaDoPlano({ plano }: { plano: Plano | null }) {
  const recebe = plano?.onda !== null && plano !== null;
  return (
    <View style={[e.faixa, !recebe && { backgroundColor: cores.atencaoLavado }]}>
      <View style={e.faixaTopo}>
        <Etiqueta cor={recebe ? 'destaque' : 'atencao'}>
          {plano ? `Plano ${plano.nome}` : 'Plano Básico'}
        </Etiqueta>
      </View>
      <Text style={[tipo.apoio, { color: cores.texto, marginTop: espaco.sm }]}>
        {comoRecebeOportunidades(plano)}
      </Text>
    </View>
  );
}

/**
 * O vazio, que muda conforme o motivo de estar vazio.
 *
 * Para quem é Básico, "nenhuma oportunidade" seria mentira por omissão: não
 * é que não apareceu nada, é que este plano não recebe. Dizer isso aqui é o
 * único lugar em que a pessoa vai entender o que está comprando.
 */
function SemOportunidades({ plano }: { plano: Plano | null }) {
  if (!plano || plano.onda === null) {
    return (
      <Vazio
        titulo="Seu plano não recebe oportunidades"
        texto="Seu cadastro continua aparecendo para quem procura. Para receber os pedidos assim que forem publicados, mude para o plano Pro ou Premium."
      />
    );
  }
  return (
    <Vazio
      titulo="Nenhuma oportunidade agora"
      texto="Assim que alguém publicar um pedido do que você faz, ele aparece aqui — e o aviso chega no seu celular."
    />
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.lg, flexGrow: 1 },
  faixa: {
    backgroundColor: cores.destaqueLavado,
    borderRadius: 16,
    padding: espaco.lg,
    marginBottom: espaco.lg,
  },
  faixaTopo: { flexDirection: 'row', justifyContent: 'space-between' },
});
