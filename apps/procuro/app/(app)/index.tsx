/**
 * A tela de consulta — procurar quem faz.
 *
 * Ela abre no CATÁLOGO, não numa lista vazia com um campo de busca
 * piscando. A diferença decide quem consegue usar o app:
 *
 * Campo de busca vazio pergunta "o que você quer?" e assume que a pessoa
 * sabe responder. Muita gente não sabe — não porque não saiba o que
 * precisa, mas porque não sabe o NOME de quem faz. Quem tem uma tomada
 * queimada sabe da tomada, não da palavra "eletricista".
 *
 * O catálogo responde antes de perguntar: mostra os ofícios agrupados, e a
 * pessoa reconhece o seu ao ver. Quem já sabe o nome usa o campo e chega
 * mais rápido; quem não sabe, navega. Os dois chegam.
 *
 * E o campo, quando usado, aceita o problema no lugar do ofício: digitar
 * "chuveiro vazando" leva ao encanador (ver a migration 0005).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Marca } from '../../src/componentes/Cabecalho';
import { CartaoProfissional } from '../../src/componentes/CartaoProfissional';
import { Botao, Carregando, Falhou, Vazio } from '../../src/componentes/Base';
import { buscar, categorias, porGrupo } from '../../src/lib/busca';
import { mensagemDeErro } from '../../src/lib/erros';
import { ALVO_DE_TOQUE, canto, cores, espaco, tipo } from '../../src/tema';
import type { Categoria, ProfissionalPublico } from '../../src/tipos/dominio';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'catalogo'; grupos: Map<string, Categoria[]> }
  | { fase: 'buscando'; grupos: Map<string, Categoria[]> }
  | {
      fase: 'resultados';
      grupos: Map<string, Categoria[]>;
      lista: ProfissionalPublico[];
      /** O que foi procurado, para a tela poder dizer no vazio. */
      oQueFoiProcurado: string;
    }
  | { fase: 'falhou'; mensagem: string };

export default function Buscar() {
  const router = useRouter();
  const margens = useSafeAreaInsets();
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [termo, setTermo] = useState('');
  const [categoriaEscolhida, setCategoriaEscolhida] = useState<Categoria | null>(null);

  const carregarCatalogo = useCallback(async () => {
    try {
      const lista = await categorias();
      setEstado({ fase: 'catalogo', grupos: porGrupo(lista) });
    } catch (err) {
      setEstado({
        fase: 'falhou',
        mensagem: mensagemDeErro(err, 'Não deu para carregar as categorias.'),
      });
    }
  }, []);

  useEffect(() => {
    void carregarCatalogo();
  }, [carregarCatalogo]);

  const procurar = useCallback(
    async (opcoes: { termo?: string; categoria?: Categoria | null }) => {
      const grupos = 'grupos' in estado ? estado.grupos : new Map<string, Categoria[]>();
      setEstado({ fase: 'buscando', grupos });
      try {
        const lista = await buscar({
          termo: opcoes.termo,
          categoriaId: opcoes.categoria?.id,
        });
        setEstado({
          fase: 'resultados',
          grupos,
          lista,
          oQueFoiProcurado: opcoes.categoria?.nome ?? opcoes.termo ?? '',
        });
      } catch (err) {
        setEstado({
          fase: 'falhou',
          mensagem: mensagemDeErro(err, 'Não deu para fazer a busca agora.'),
        });
      }
    },
    [estado],
  );

  function limpar() {
    setTermo('');
    setCategoriaEscolhida(null);
    void carregarCatalogo();
  }

  const mostrandoResultados = estado.fase === 'resultados' || estado.fase === 'buscando';

  return (
    <View style={e.tela}>
      {/* --- Topo com a marca e o campo --- */}
      <View style={[e.topo, { paddingTop: margens.top + espaco.sm }]}>
        <Marca sobreEscuro />

        <View style={e.campoFora}>
          <Feather name="search" size={18} color={cores.textoApagado} />
          <TextInput
            style={e.campo}
            value={termo}
            onChangeText={setTermo}
            onSubmitEditing={() => {
              setCategoriaEscolhida(null);
              void procurar({ termo });
            }}
            placeholder="O que você precisa?"
            placeholderTextColor={cores.textoApagado}
            returnKeyType="search"
            accessibilityLabel="Procurar profissional ou serviço"
          />
          {termo.length > 0 || categoriaEscolhida ? (
            <Pressable onPress={limpar} hitSlop={12} accessibilityLabel="Limpar busca">
              <Feather name="x" size={18} color={cores.textoApagado} />
            </Pressable>
          ) : null}
        </View>

        {/* A dica não é enfeite: é o que ensina que dá para digitar o
            problema em vez do nome do ofício. Sem ela, ninguém descobre. */}
        {!mostrandoResultados ? (
          <Text style={e.dica}>
            Pode escrever o problema: “chuveiro vazando”, “bolo de aniversário”.
          </Text>
        ) : null}
      </View>

      {/* --- Corpo --- */}
      {estado.fase === 'carregando' ? (
        <Carregando texto="Carregando os ofícios…" />
      ) : estado.fase === 'falhou' ? (
        <Falhou mensagem={estado.mensagem} aoTentarDeNovo={() => void carregarCatalogo()} />
      ) : estado.fase === 'buscando' ? (
        <Carregando texto="Procurando…" />
      ) : estado.fase === 'resultados' ? (
        <FlatList
          data={estado.lista}
          keyExtractor={(p) => p.id}
          contentContainerStyle={e.lista}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => void procurar({ termo, categoria: categoriaEscolhida })}
              tintColor={cores.marca}
            />
          }
          ListHeaderComponent={
            <View style={e.cabecalhoDaLista}>
              <Text style={[tipo.secao, { color: cores.texto }]}>
                {estado.lista.length === 0
                  ? 'Nada encontrado'
                  : `${estado.lista.length} ${estado.lista.length === 1 ? 'resultado' : 'resultados'}`}
              </Text>
              {estado.oQueFoiProcurado ? (
                <Text style={[tipo.apoio, { color: cores.textoApagado }]}>
                  para “{estado.oQueFoiProcurado}”
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={e.vazio}>
              <Vazio
                titulo="Ninguém encontrado ainda"
                texto={`Nenhum profissional cadastrado para “${estado.oQueFoiProcurado}” na sua região por enquanto.`}
              />
              {/* Não achar ninguém é justamente quando publicar um pedido
                  vale mais: o pedido fica esperando, e quem se cadastrar
                  depois recebe. Mandar a pessoa embora de mãos vazias aqui
                  é perder as duas pontas. */}
              <View style={e.botaoDoVazio}>
                <Botao
                  onPress={() =>
                    router.push(
                      categoriaEscolhida
                        ? `/pedir?categoriaId=${categoriaEscolhida.id}`
                        : '/pedir',
                    )
                  }
                >
                  Publicar um pedido
                </Botao>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <CartaoProfissional
              profissional={item}
              aoTocar={() => router.push(`/profissional/${item.id}`)}
            />
          )}
        />
      ) : (
        <CatalogoDeOficios
          grupos={estado.grupos}
          aoEscolher={(c) => {
            setCategoriaEscolhida(c);
            setTermo('');
            void procurar({ categoria: c });
          }}
        />
      )}
    </View>
  );
}

/**
 * O catálogo: os ofícios agrupados, em fichas.
 *
 * Ficha e não linha de lista porque a pessoa está RECONHECENDO, não lendo.
 * Uma grade de alvos grandes se percorre com o olho; uma lista de texto
 * corrido exige ler item por item até achar — e quarenta e um itens em
 * lista é uma parede.
 */
function CatalogoDeOficios({
  grupos,
  aoEscolher,
}: {
  grupos: Map<string, Categoria[]>;
  aoEscolher: (c: Categoria) => void;
}) {
  return (
    <ScrollView contentContainerStyle={e.catalogo} keyboardShouldPersistTaps="handled">
      {[...grupos.entries()].map(([grupo, itens]) => (
        <View key={grupo} style={e.grupo}>
          <Text style={[tipo.secao, e.tituloDoGrupo]}>{grupo}</Text>
          <View style={e.grade}>
            {itens.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => aoEscolher(c)}
                accessibilityRole="button"
                style={({ pressed }) => [e.ficha, pressed && { opacity: 0.7 }]}
              >
                <Text style={e.textoDaFicha} numberOfLines={2}>
                  {c.nome}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: {
    backgroundColor: cores.marca,
    paddingHorizontal: espaco.lg,
    paddingBottom: espaco.lg,
  },
  campoFora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    backgroundColor: cores.superficie,
    borderRadius: canto.capsula,
    paddingHorizontal: espaco.lg,
    minHeight: ALVO_DE_TOQUE + 4,
    marginTop: espaco.lg,
  },
  campo: {
    flex: 1,
    fontSize: 16,
    color: cores.texto,
    // Sem isto o campo ganha um contorno azul no navegador ao receber o
    // foco, que não combina com nada do resto.
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null),
  },
  dica: {
    ...tipo.apoio,
    color: 'rgba(255,255,255,0.75)',
    marginTop: espaco.md,
  },
  lista: { padding: espaco.lg, flexGrow: 1 },
  vazio: { flex: 1, justifyContent: 'center' },
  botaoDoVazio: { paddingHorizontal: espaco.xl, marginTop: espaco.lg },
  cabecalhoDaLista: { marginBottom: espaco.lg },
  catalogo: { padding: espaco.lg },
  grupo: { marginBottom: espaco.xl },
  tituloDoGrupo: { color: cores.texto, marginBottom: espaco.md },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  ficha: {
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: canto.md,
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.md,
    minHeight: ALVO_DE_TOQUE,
    justifyContent: 'center',
    // Três por linha em tela de celular comum, dois quando o nome é longo.
    minWidth: '30%',
    flexGrow: 1,
    maxWidth: '48%',
  },
  textoDaFicha: { ...tipo.apoio, color: cores.texto, fontWeight: '600' },
});
