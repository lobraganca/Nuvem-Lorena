/**
 * O perfil de quem faz — a tela onde a pessoa decide chamar ou não.
 *
 * Tudo aqui serve a essa decisão, e o que não serve ficou de fora.
 *
 * Os botões de contato mudam conforme o plano de QUEM ATENDE, não de quem
 * procura. Básico mostra o número para copiar; Pro e Premium ganham o
 * toque único no WhatsApp e na ligação. O que o plano compra é a
 * facilidade e a visibilidade — nunca o direito de ser encontrado, porque
 * um cadastro com quem não dá para falar afasta quem procura, e sem quem
 * procura não há para quem vender plano.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao, Cartao, Carregando, Etiqueta, Falhou } from '../../src/componentes/Base';
import { Estrelas } from '../../src/componentes/Estrelas';
import { buscar, comoEstaAgora } from '../../src/lib/busca';
import { avaliacoesDe, reputacaoDe } from '../../src/lib/avaliacoes';
import { abrirWhatsApp, contatosLiberados, ligar, primeiraMensagem } from '../../src/lib/contato';
import { paraLeitura } from '../../src/lib/telefone';
import { mensagemDeErro } from '../../src/lib/erros';
import { canto, cores, espaco, tipo } from '../../src/tema';
import type { Avaliacao, ProfissionalPublico, Reputacao } from '../../src/tipos/dominio';

type Estado =
  | { fase: 'carregando' }
  | {
      fase: 'pronto';
      pro: ProfissionalPublico;
      reputacao: Reputacao | null;
      avaliacoes: Avaliacao[];
    }
  | { fase: 'falhou'; mensagem: string };

export default function PerfilDoProfissional() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const margens = useSafeAreaInsets();
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      // A busca é a única porta para os dados públicos: ela já carrega o
      // filtro que esconde suspenso e oculto. Ler a tabela direto daqui
      // seria repetir esse filtro num segundo lugar — e o segundo lugar é
      // onde ele acaba divergindo.
      const lista = await buscar({ limite: 100 });
      const pro = lista.find((p) => p.id === id);
      if (!pro) {
        setEstado({
          fase: 'falhou',
          mensagem: 'Este profissional não está mais disponível.',
        });
        return;
      }
      const [reputacao, avaliacoes] = await Promise.all([
        reputacaoDe(id),
        avaliacoesDe(id),
      ]);
      setEstado({ fase: 'pronto', pro, reputacao, avaliacoes });
    } catch (err) {
      setEstado({ fase: 'falhou', mensagem: mensagemDeErro(err, 'Não deu para abrir este perfil.') });
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (estado.fase === 'carregando') return <Carregando texto="Abrindo o perfil…" />;
  if (estado.fase === 'falhou') {
    return (
      <View style={e.tela}>
        <Voltar aoTocar={() => router.back()} topo={margens.top} />
        <Falhou mensagem={estado.mensagem} aoTentarDeNovo={() => void carregar()} />
      </View>
    );
  }

  const { pro, reputacao, avaliacoes } = estado;
  const estadoAgora = comoEstaAgora(pro);
  const contatos = contatosLiberados(pro.destaque);
  const temTelefone = !!pro.telefone;

  return (
    <View style={e.tela}>
      <ScrollView contentContainerStyle={{ paddingBottom: espaco.xxl }}>
        {/* --- Cabeçalho --- */}
        <View style={[e.topo, { paddingTop: margens.top + espaco.sm }]}>
          <Voltar aoTocar={() => router.back()} />
          <View style={e.retrato}>
            <Text style={e.iniciais}>{iniciais(pro.nome)}</Text>
          </View>
          <View style={e.nomeELinha}>
            <Text style={[tipo.titulo, { color: cores.textoSobreMarca }]}>{pro.nome}</Text>
            {pro.verificado ? (
              <Feather
                name="check-circle"
                size={19}
                color={cores.destaque}
                style={{ marginLeft: espaco.sm }}
                accessibilityLabel="Documento verificado"
              />
            ) : null}
          </View>
          <Text style={[tipo.corpo, e.oficio]}>{pro.categoria_nome}</Text>
          <Text style={[tipo.apoio, e.lugar]}>
            {pro.cidade_nome} · atende até {pro.raio_km} km
          </Text>
        </View>

        {/* --- Nota --- */}
        <View style={e.faixaDaNota}>
          {reputacao && reputacao.quantas > 0 ? (
            <View style={e.notaLinha}>
              <Estrelas nota={reputacao.media} tamanho={18} />
              <Text style={[tipo.corpoForte, { color: cores.texto, marginLeft: espaco.sm }]}>
                {reputacao.media.toFixed(1)}
              </Text>
              <Text style={[tipo.apoio, { color: cores.textoApagado, marginLeft: espaco.xs }]}>
                ({reputacao.quantas} {reputacao.quantas === 1 ? 'avaliação' : 'avaliações'})
              </Text>
            </View>
          ) : (
            // "Ainda sem avaliações" é diferente de nota baixa, e a tela
            // precisa dizer isso — senão um cadastro novo parece ruim.
            <Text style={[tipo.apoio, { color: cores.textoApagado }]}>
              Ainda sem avaliações. Quem for o primeiro ajuda os próximos a decidir.
            </Text>
          )}
          <View style={{ marginTop: espaco.sm, flexDirection: 'row', gap: espaco.sm }}>
            <Etiqueta cor={estadoAgora.atende ? 'sucesso' : 'atencao'}>{estadoAgora.texto}</Etiqueta>
          </View>
        </View>

        {/* --- Sobre --- */}
        {pro.apresentacao ? (
          <View style={e.secao}>
            <Text style={[tipo.secao, e.tituloDaSecao]}>Sobre</Text>
            <Text style={[tipo.corpo, { color: cores.texto, lineHeight: 22 }]}>
              {pro.apresentacao}
            </Text>
          </View>
        ) : null}

        {/* --- Avaliações --- */}
        {avaliacoes.length > 0 ? (
          <View style={e.secao}>
            <Text style={[tipo.secao, e.tituloDaSecao]}>O que dizem</Text>
            {avaliacoes.map((a) => (
              <View key={a.id} style={{ marginBottom: espaco.md }}>
                <Cartao>
                  <View style={e.linhaDaAvaliacao}>
                    <Estrelas nota={a.nota} tamanho={14} />
                    <Text style={[tipo.apoio, { color: cores.textoApagado }]}>
                      {a.autor_nome}
                    </Text>
                  </View>
                  {a.comentario ? (
                    <Text style={[tipo.corpo, { color: cores.texto, marginTop: espaco.sm }]}>
                      {a.comentario}
                    </Text>
                  ) : null}
                  {/* A resposta do profissional aparece junto, recuada. Quem
                      levou uma nota injusta merece poder explicar, e quem lê
                      merece ver os dois lados antes de decidir. */}
                  {a.resposta ? (
                    <View style={e.resposta}>
                      <Text style={[tipo.etiqueta, { color: cores.textoApagado }]}>
                        Resposta de {pro.nome}
                      </Text>
                      <Text style={[tipo.apoio, { color: cores.texto, marginTop: 2 }]}>
                        {a.resposta}
                      </Text>
                    </View>
                  ) : null}
                </Cartao>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* --- Contato, preso embaixo --- */}
      <View style={[e.barraDeContato, { paddingBottom: margens.bottom + espaco.md }]}>
        {!temTelefone ? (
          <Text style={[tipo.apoio, { color: cores.textoApagado, textAlign: 'center' }]}>
            Este profissional ainda não confirmou um telefone.
          </Text>
        ) : contatos.whatsapp ? (
          <View style={e.botoes}>
            <View style={{ flex: 1 }}>
              <Botao
                variante="contorno"
                onPress={() => void ligar(pro.telefone as string)}
              >
                Ligar
              </Botao>
            </View>
            <View style={{ flex: 1.3 }}>
              <Botao
                onPress={() =>
                  void abrirWhatsApp(
                    pro.telefone as string,
                    primeiraMensagem({ nomeDoProfissional: pro.nome }),
                  )
                }
              >
                WhatsApp
              </Botao>
            </View>
          </View>
        ) : (
          // Plano Básico: o número aparece, e ligar continua sendo um
          // toque. O que falta é o WhatsApp com a mensagem pronta.
          <View>
            <Text style={[tipo.apoio, e.numero]}>{paraLeitura(pro.telefone as string)}</Text>
            <Botao variante="contorno" onPress={() => void ligar(pro.telefone as string)}>
              Ligar
            </Botao>
          </View>
        )}
      </View>
    </View>
  );
}

function Voltar({ aoTocar, topo = 0 }: { aoTocar: () => void; topo?: number }) {
  return (
    <Pressable
      onPress={aoTocar}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      style={[e.voltar, topo ? { marginTop: topo } : null]}
    >
      <Feather name="arrow-left" size={24} color={cores.textoSobreMarca} />
    </Pressable>
  );
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return (p[0] ?? '?').slice(0, 1).toUpperCase();
  return ((p[0] ?? '').slice(0, 1) + (p[p.length - 1] ?? '').slice(0, 1)).toUpperCase();
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: {
    backgroundColor: cores.marca,
    paddingHorizontal: espaco.lg,
    paddingBottom: espaco.xl,
  },
  voltar: { alignSelf: 'flex-start', padding: espaco.xs, marginBottom: espaco.md },
  retrato: {
    width: 76,
    height: 76,
    borderRadius: canto.capsula,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espaco.md,
  },
  iniciais: { color: cores.marca, fontSize: 26, fontWeight: '700' },
  nomeELinha: { flexDirection: 'row', alignItems: 'center' },
  oficio: { color: 'rgba(255,255,255,0.9)', marginTop: espaco.xs },
  lugar: { color: 'rgba(255,255,255,0.7)', marginTop: espaco.xs },
  faixaDaNota: {
    backgroundColor: cores.superficie,
    padding: espaco.lg,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  notaLinha: { flexDirection: 'row', alignItems: 'center' },
  secao: { padding: espaco.lg },
  tituloDaSecao: { color: cores.texto, marginBottom: espaco.md },
  linhaDaAvaliacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resposta: {
    marginTop: espaco.md,
    paddingLeft: espaco.md,
    borderLeftWidth: 2,
    borderLeftColor: cores.borda,
  },
  barraDeContato: {
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.md,
  },
  botoes: { flexDirection: 'row', gap: espaco.sm },
  numero: { color: cores.texto, textAlign: 'center', marginBottom: espaco.md, fontSize: 17 },
});
