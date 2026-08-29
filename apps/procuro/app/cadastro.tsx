/**
 * Cadastrar o que eu faço.
 *
 * Um passo de cada vez, e não um formulário longo com tudo à vista.
 * Formulário longo no celular é uma parede: a pessoa rola, vê dez campos,
 * e fecha. Em passos, cada tela tem uma pergunta e um botão — e a barra de
 * progresso mostra que acaba.
 *
 * O passo da apresentação exige um texto mínimo de propósito. É esse texto
 * que quem procura lê antes de decidir chamar, e "faço de tudo" não decide
 * nada. Recusar o vazio aqui custa dez segundos a quem cadastra e poupa a
 * pergunta "por que ninguém me chama" depois.
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao, Campo, Carregando, Falhou } from '../src/componentes/Base';
import { categorias, cidades, porGrupo } from '../src/lib/busca';
import { criarCadastro, meuPerfil, salvarPerfil } from '../src/lib/perfil';
import { mensagemDeErro } from '../src/lib/erros';
import { ALVO_DE_TOQUE, canto, cores, espaco, tipo } from '../src/tema';
import type { Categoria, Cidade, TipoDeCadastro } from '../src/tipos/dominio';

const PASSOS = ['Seu nome', 'O que você faz', 'Onde atende', 'Sobre você'] as const;

export default function Cadastro() {
  const router = useRouter();
  const margens = useSafeAreaInsets();

  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [listaDeCategorias, setListaDeCategorias] = useState<Categoria[]>([]);
  const [listaDeCidades, setListaDeCidades] = useState<Cidade[]>([]);

  const [passo, setPasso] = useState(0);
  const [nome, setNome] = useState('');
  const [tipoDeCadastro, setTipoDeCadastro] = useState<TipoDeCadastro>('pf');
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [cidade, setCidade] = useState<Cidade | null>(null);
  const [raio, setRaio] = useState(15);
  const [apresentacao, setApresentacao] = useState('');

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErroDeCarga(null);
    try {
      const [cats, cids, perfil] = await Promise.all([categorias(), cidades(), meuPerfil()]);
      setListaDeCategorias(cats);
      setListaDeCidades(cids);
      // O nome já vem preenchido quando existe: repetir o que o app já
      // sabe é pedir trabalho para nada.
      if (perfil?.nome) {
        setNome(perfil.nome);
        setPasso(1);
      }
      if (cids.length === 1) setCidade(cids[0] ?? null);
    } catch (err) {
      setErroDeCarga(mensagemDeErro(err, 'Não deu para carregar o cadastro.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function avancar() {
    setErro(null);
    if (passo === 0) {
      if (nome.trim().length < 2) return setErro('Escreva seu nome completo.');
    }
    if (passo === 1 && !categoria) return setErro('Escolha o que você faz.');
    if (passo === 2 && !cidade) return setErro('Escolha a cidade onde você atende.');
    setPasso((p) => Math.min(p + 1, PASSOS.length - 1));
  }

  async function concluir() {
    setErro(null);
    if (!categoria || !cidade) return setErro('Falta escolher o ofício e a cidade.');
    setSalvando(true);
    try {
      await salvarPerfil({ nome, cidadeId: cidade.id });
      await criarCadastro({
        categoriaId: categoria.id,
        cidadeId: cidade.id,
        tipo: tipoDeCadastro,
        apresentacao,
        raioKm: raio,
      });
      router.replace('/oportunidades');
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não deu para criar seu cadastro.'));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <Carregando texto="Preparando o cadastro…" />;
  if (erroDeCarga) return <Falhou mensagem={erroDeCarga} aoTentarDeNovo={() => void carregar()} />;

  const ultimo = passo === PASSOS.length - 1;

  return (
    <KeyboardAvoidingView
      style={e.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* --- Progresso --- */}
      <View style={[e.topo, { paddingTop: margens.top + espaco.sm }]}>
        <View style={e.linhaDoTopo}>
          <Pressable
            onPress={() => (passo === 0 ? router.back() : setPasso((p) => p - 1))}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Feather name="arrow-left" size={24} color={cores.textoSobreMarca} />
          </Pressable>
          <Text style={[tipo.apoio, { color: 'rgba(255,255,255,0.75)' }]}>
            Passo {passo + 1} de {PASSOS.length}
          </Text>
        </View>

        <View style={e.barra}>
          {PASSOS.map((_, i) => (
            <View
              key={i}
              style={[e.pedacoDaBarra, i <= passo && { backgroundColor: cores.destaque }]}
            />
          ))}
        </View>

        <Text style={[tipo.titulo, { color: cores.textoSobreMarca, marginTop: espaco.lg }]}>
          {PASSOS[passo]}
        </Text>
      </View>

      <ScrollView contentContainerStyle={e.corpo} keyboardShouldPersistTaps="handled">
        {passo === 0 ? (
          <>
            <Campo
              rotulo="Como você quer aparecer"
              value={nome}
              onChangeText={(t) => { setNome(t); if (erro) setErro(null); }}
              erro={erro}
              ajuda="É esse nome que quem procura vê."
              placeholder="Seu nome ou o nome do negócio"
              autoCapitalize="words"
            />
            <Text style={[tipo.corpoForte, e.rotulo]}>Você é</Text>
            <View style={e.escolhas}>
              <Escolha
                texto="Autônomo"
                ativo={tipoDeCadastro === 'pf'}
                aoTocar={() => setTipoDeCadastro('pf')}
              />
              <Escolha
                texto="Empresa"
                ativo={tipoDeCadastro === 'pj'}
                aoTocar={() => setTipoDeCadastro('pj')}
              />
            </View>
          </>
        ) : passo === 1 ? (
          <EscolherOficio
            grupos={porGrupo(listaDeCategorias)}
            escolhido={categoria}
            aoEscolher={(c) => { setCategoria(c); if (erro) setErro(null); }}
            erro={erro}
          />
        ) : passo === 2 ? (
          <>
            <Text style={[tipo.corpoForte, e.rotulo]}>Cidade</Text>
            <View style={e.escolhas}>
              {listaDeCidades.map((c) => (
                <Escolha
                  key={c.id}
                  texto={`${c.nome} · ${c.uf}`}
                  ativo={cidade?.id === c.id}
                  aoTocar={() => { setCidade(c); if (erro) setErro(null); }}
                />
              ))}
            </View>

            <Text style={[tipo.corpoForte, e.rotulo]}>Até que distância você atende</Text>
            <View style={e.escolhas}>
              {[5, 10, 15, 30, 50].map((km) => (
                <Escolha
                  key={km}
                  texto={`${km} km`}
                  ativo={raio === km}
                  aoTocar={() => setRaio(km)}
                />
              ))}
            </View>
            <Text style={[tipo.apoio, { color: cores.textoApagado, marginTop: espaco.sm }]}>
              Você só recebe pedidos dentro dessa distância. Dá para mudar depois.
            </Text>
            {erro ? <Text style={e.erro}>{erro}</Text> : null}
          </>
        ) : (
          <>
            <Campo
              rotulo="Conte o que você faz"
              value={apresentacao}
              onChangeText={(t) => { setApresentacao(t); if (erro) setErro(null); }}
              erro={erro}
              ajuda="É o que a pessoa lê antes de decidir chamar você. Diga o que faz, há quanto tempo, e o que te diferencia."
              placeholder="Ex.: Eletricista há 15 anos. Faço instalação, manutenção e reparo em casa e comércio. Atendo emergência."
              multiline
              numberOfLines={6}
              style={e.campoGrande}
              textAlignVertical="top"
            />
            <Text style={[tipo.apoio, { color: cores.textoApagado }]}>
              {apresentacao.trim().length} de 20 letras no mínimo
            </Text>
          </>
        )}
      </ScrollView>

      <View style={[e.rodape, { paddingBottom: margens.bottom + espaco.md }]}>
        <Botao
          onPress={ultimo ? () => void concluir() : avancar}
          carregando={salvando}
        >
          {ultimo ? 'Concluir cadastro' : 'Continuar'}
        </Botao>
      </View>
    </KeyboardAvoidingView>
  );
}

function Escolha({
  texto,
  ativo,
  aoTocar,
}: {
  texto: string;
  ativo: boolean;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="radio"
      accessibilityState={{ selected: ativo }}
      style={({ pressed }) => [
        e.escolha,
        ativo && { borderColor: cores.marca, backgroundColor: cores.superficieAfundada },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[tipo.apoio, { color: cores.texto, fontWeight: ativo ? '700' : '400' }]}>
        {texto}
      </Text>
    </Pressable>
  );
}

function EscolherOficio({
  grupos,
  escolhido,
  aoEscolher,
  erro,
}: {
  grupos: Map<string, Categoria[]>;
  escolhido: Categoria | null;
  aoEscolher: (c: Categoria) => void;
  erro: string | null;
}) {
  return (
    <View>
      {erro ? <Text style={e.erro}>{erro}</Text> : null}
      {[...grupos.entries()].map(([grupo, itens]) => (
        <View key={grupo} style={{ marginBottom: espaco.lg }}>
          <Text style={[tipo.corpoForte, { color: cores.textoApagado, marginBottom: espaco.sm }]}>
            {grupo}
          </Text>
          <View style={e.escolhas}>
            {itens.map((c) => (
              <Escolha
                key={c.id}
                texto={c.nome}
                ativo={escolhido?.id === c.id}
                aoTocar={() => aoEscolher(c)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: { backgroundColor: cores.marca, paddingHorizontal: espaco.lg, paddingBottom: espaco.lg },
  linhaDoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barra: { flexDirection: 'row', gap: espaco.xs, marginTop: espaco.lg },
  pedacoDaBarra: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  corpo: { padding: espaco.lg, paddingBottom: espaco.xxl },
  rotulo: { color: cores.texto, marginBottom: espaco.sm, marginTop: espaco.md },
  escolhas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  escolha: {
    minHeight: ALVO_DE_TOQUE,
    justifyContent: 'center',
    paddingHorizontal: espaco.lg,
    borderRadius: canto.capsula,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  campoGrande: { minHeight: 140, paddingTop: espaco.md },
  erro: { ...tipo.apoio, color: cores.erro, marginBottom: espaco.md },
  rodape: {
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    padding: espaco.lg,
  },
});
