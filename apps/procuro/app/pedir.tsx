/**
 * Publicar o que eu preciso.
 *
 * A tela mostra **quantos profissionais vão receber** antes de publicar, e
 * essa é a decisão que importa aqui.
 *
 * Sem esse número, publicar é jogar um pedido no escuro: a pessoa espera,
 * não recebe nada, e conclui que o app não funciona. Com ele, ela sabe de
 * antemão — "12 eletricistas vão receber" convida a esperar; "nenhum
 * eletricista cadastrado ainda" evita a espera inútil e manda a pessoa
 * para a busca, onde talvez ache alguém de outra categoria.
 *
 * Mostrar zero é desconfortável e é honesto. Um app que esconde o zero
 * ganha um pedido publicado e perde a pessoa.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao, Campo, Carregando, Falhou } from '../src/componentes/Base';
import { categorias, cidades, porGrupo } from '../src/lib/busca';
import { publicar, quantosReceberiam } from '../src/lib/pedidos';
import { mensagemDeErro } from '../src/lib/erros';
import { ALVO_DE_TOQUE, canto, cores, espaco, tipo } from '../src/tema';
import type { Categoria, Cidade } from '../src/tipos/dominio';

export default function Pedir() {
  const router = useRouter();
  const margens = useSafeAreaInsets();
  // Quando vem da busca, a categoria já chega escolhida.
  const { categoriaId } = useLocalSearchParams<{ categoriaId?: string }>();

  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [listaDeCategorias, setListaDeCategorias] = useState<Categoria[]>([]);
  const [listaDeCidades, setListaDeCidades] = useState<Cidade[]>([]);

  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [cidade, setCidade] = useState<Cidade | null>(null);
  const [descricao, setDescricao] = useState('');
  const [bairro, setBairro] = useState('');

  const [alcance, setAlcance] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);

  const carregar = useCallback(async () => {
    setErroDeCarga(null);
    try {
      const [cats, cids] = await Promise.all([categorias(), cidades()]);
      setListaDeCategorias(cats);
      setListaDeCidades(cids);
      if (cids.length === 1) setCidade(cids[0] ?? null);
      if (categoriaId) setCategoria(cats.find((c) => c.id === categoriaId) ?? null);
    } catch (err) {
      setErroDeCarga(mensagemDeErro(err, 'Não deu para carregar as categorias.'));
    } finally {
      setCarregando(false);
    }
  }, [categoriaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Recalcula o alcance sempre que ofício ou cidade mudam. É a informação
  // que decide se vale a pena publicar.
  useEffect(() => {
    let vivo = true;
    if (!categoria || !cidade) {
      setAlcance(null);
      return;
    }
    quantosReceberiam(categoria.id, cidade.id)
      .then((n) => vivo && setAlcance(n))
      // Falhar aqui não pode travar a publicação: o alcance é uma ajuda,
      // não um requisito. `null` faz a faixa sumir em vez de mentir um
      // número.
      .catch(() => vivo && setAlcance(null));
    return () => { vivo = false; };
  }, [categoria, cidade]);

  async function enviar() {
    setErro(null);
    if (!categoria) return setErro('Escolha o tipo de profissional que você precisa.');
    if (!cidade) return setErro('Escolha a cidade.');
    setPublicando(true);
    try {
      await publicar({
        categoriaId: categoria.id,
        cidadeId: cidade.id,
        descricao,
        bairro,
      });
      router.replace('/pedidos');
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não deu para publicar seu pedido.'));
    } finally {
      setPublicando(false);
    }
  }

  if (carregando) return <Carregando texto="Carregando…" />;
  if (erroDeCarga) return <Falhou mensagem={erroDeCarga} aoTentarDeNovo={() => void carregar()} />;

  return (
    <KeyboardAvoidingView style={e.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          O que você precisa?
        </Text>
        <Text style={[tipo.apoio, { color: 'rgba(255,255,255,0.75)', marginTop: espaco.xs }]}>
          Publique uma vez. Avisamos os profissionais da sua região.
        </Text>
      </View>

      <ScrollView contentContainerStyle={e.corpo} keyboardShouldPersistTaps="handled">
        <Text style={[tipo.corpoForte, e.rotulo]}>Que tipo de profissional?</Text>
        {[...porGrupo(listaDeCategorias).entries()].map(([grupo, itens]) => (
          <View key={grupo} style={{ marginBottom: espaco.md }}>
            <Text style={[tipo.etiqueta, { color: cores.textoApagado, marginBottom: espaco.xs }]}>
              {grupo}
            </Text>
            <View style={e.escolhas}>
              {itens.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => { setCategoria(c); if (erro) setErro(null); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: categoria?.id === c.id }}
                  style={({ pressed }) => [
                    e.escolha,
                    categoria?.id === c.id && {
                      borderColor: cores.marca,
                      backgroundColor: cores.superficieAfundada,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[tipo.apoio, { color: cores.texto }]}>{c.nome}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* --- Quantos vão receber --- */}
        {categoria && alcance !== null ? (
          <View style={[e.alcance, alcance === 0 && { backgroundColor: cores.atencaoLavado }]}>
            <Feather
              name={alcance === 0 ? 'alert-circle' : 'users'}
              size={18}
              color={alcance === 0 ? cores.atencao : cores.sucesso}
            />
            <Text style={[tipo.apoio, e.textoDoAlcance]}>
              {alcance === 0
                ? `Nenhum ${categoria.nome.toLowerCase()} cadastrado na sua região ainda. Você pode publicar mesmo assim — avisamos assim que alguém se cadastrar.`
                : `${alcance} ${alcance === 1 ? 'profissional vai receber' : 'profissionais vão receber'} o seu pedido.`}
            </Text>
          </View>
        ) : null}

        <Campo
          rotulo="Descreva o que você precisa"
          value={descricao}
          onChangeText={(t) => { setDescricao(t); if (erro) setErro(null); }}
          ajuda="Quanto mais claro, melhor a resposta. Diga o que é, onde, e se tem pressa."
          placeholder="Ex.: A tomada da cozinha parou e está cheirando a queimado. Preciso de alguém ainda hoje."
          multiline
          numberOfLines={5}
          style={e.campoGrande}
          textAlignVertical="top"
        />

        <Campo
          rotulo="Bairro (opcional)"
          value={bairro}
          onChangeText={setBairro}
          ajuda="Ajuda quem atende a saber se é perto."
          placeholder="Centro"
          autoCapitalize="words"
        />

        {listaDeCidades.length > 1 ? (
          <>
            <Text style={[tipo.corpoForte, e.rotulo]}>Cidade</Text>
            <View style={e.escolhas}>
              {listaDeCidades.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCidade(c)}
                  style={[e.escolha, cidade?.id === c.id && { borderColor: cores.marca }]}
                >
                  <Text style={[tipo.apoio, { color: cores.texto }]}>{c.nome}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {erro ? <Text style={e.erro}>{erro}</Text> : null}
      </ScrollView>

      <View style={[e.rodape, { paddingBottom: margens.bottom + espaco.md }]}>
        <Botao onPress={() => void enviar()} carregando={publicando}>
          Publicar pedido
        </Botao>
      </View>
    </KeyboardAvoidingView>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: { backgroundColor: cores.marca, paddingHorizontal: espaco.lg, paddingBottom: espaco.lg },
  corpo: { padding: espaco.lg, paddingBottom: espaco.xxl },
  rotulo: { color: cores.texto, marginBottom: espaco.sm, marginTop: espaco.md },
  escolhas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  escolha: {
    minHeight: ALVO_DE_TOQUE,
    justifyContent: 'center',
    paddingHorizontal: espaco.md,
    borderRadius: canto.capsula,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  alcance: {
    flexDirection: 'row',
    gap: espaco.sm,
    alignItems: 'flex-start',
    backgroundColor: cores.sucessoLavado,
    borderRadius: canto.md,
    padding: espaco.md,
    marginVertical: espaco.lg,
  },
  textoDoAlcance: { flex: 1, color: cores.texto },
  campoGrande: { minHeight: 120, paddingTop: espaco.md },
  erro: { ...tipo.apoio, color: cores.erro, marginTop: espaco.md },
  rodape: {
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    padding: espaco.lg,
  },
});
