/**
 * Minha conta.
 *
 * A parte que mais importa aqui é o seletor de disponibilidade, e ele tem
 * QUATRO estados porque são quatro decisões diferentes:
 *
 *   Disponível — aparece na busca e recebe pedidos
 *   Pausado    — aparece na busca, não recebe pedidos (estou cheio hoje)
 *   Férias     — aparece marcado como ausente, volta sozinho na data
 *   Oculto     — some da busca, sem apagar nada
 *
 * Juntar isso num interruptor "ligado/desligado" — que é o que quase todo
 * app faz — obrigaria quem está de férias a sumir. E sumir da busca custa
 * os clientes que voltariam depois: quem não te acha em janeiro não te
 * procura em março.
 *
 * As férias exigem data de volta de propósito. Sem ela, "volto semana que
 * vem" vira cadastro invisível para sempre, porque ninguém lembra de
 * destravar. Com ela, o app destrava sozinho.
 */

import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Cabecalho } from '../../src/componentes/Cabecalho';
import { Botao, Cartao, Carregando, Etiqueta, Falhou } from '../../src/componentes/Base';
import { sair } from '../../src/lib/autenticacao';
import { meuCadastro, meuPerfil, mudarSituacao, type CadastroProfissional } from '../../src/lib/perfil';
import { comoRecebeOportunidades, planoVigente } from '../../src/lib/oportunidades';
import { paraLeitura } from '../../src/lib/telefone';
import { mensagemDeErro } from '../../src/lib/erros';
import { ALVO_DE_TOQUE, canto, cores, espaco, tipo } from '../../src/tema';
import { ROTULO_DA_SITUACAO, type Perfil, type Plano, type Situacao } from '../../src/tipos/dominio';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronto'; perfil: Perfil | null; cadastro: CadastroProfissional | null; plano: Plano | null }
  | { fase: 'falhou'; mensagem: string };

/** O que cada estado significa, em uma linha, para quem escolhe. */
const EXPLICACAO: Record<Situacao, string> = {
  disponivel: 'Aparece na busca e recebe pedidos.',
  pausado: 'Continua na busca, mas não recebe pedidos novos.',
  ferias: 'Aparece marcado como ausente. Volta sozinho na data.',
  oculto: 'Some da busca. Seu cadastro fica guardado.',
};

export default function Conta() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [mudando, setMudando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [perfil, cadastro] = await Promise.all([meuPerfil(), meuCadastro()]);
      const plano = cadastro ? await planoVigente(cadastro.id) : null;
      setEstado({ fase: 'pronto', perfil, cadastro, plano });
    } catch (err) {
      setEstado({ fase: 'falhou', mensagem: mensagemDeErro(err, 'Não deu para carregar sua conta.') });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  async function trocarSituacao(nova: Situacao) {
    if (estado.fase !== 'pronto' || !estado.cadastro) return;

    if (nova === 'ferias') {
      // Sem tela de calendário ainda: 15 dias é um padrão honesto, e a
      // data aparece para a pessoa saber quando volta.
      const volta = new Date();
      volta.setDate(volta.getDate() + 15);
      const iso = volta.toISOString().slice(0, 10);
      const [ano, mes, dia] = iso.split('-');
      Alert.alert(
        'Férias',
        `Seu perfil fica marcado como ausente e volta sozinho em ${dia}/${mes}/${ano}.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: () => void aplicar(nova, iso) },
        ],
      );
      return;
    }
    await aplicar(nova, null);
  }

  async function aplicar(nova: Situacao, ate: string | null) {
    if (estado.fase !== 'pronto' || !estado.cadastro) return;
    setMudando(true);
    try {
      await mudarSituacao(estado.cadastro.id, nova, ate);
      await carregar();
    } catch (err) {
      Alert.alert('Não deu certo', mensagemDeErro(err, 'Não deu para mudar sua disponibilidade.'));
    } finally {
      setMudando(false);
    }
  }

  if (estado.fase === 'carregando') return <Carregando texto="Carregando sua conta…" />;
  if (estado.fase === 'falhou') {
    return (
      <View style={e.tela}>
        <Cabecalho titulo="Minha conta" escuro />
        <Falhou mensagem={estado.mensagem} aoTentarDeNovo={() => void carregar()} />
      </View>
    );
  }

  const { perfil, cadastro, plano } = estado;

  return (
    <View style={e.tela}>
      <Cabecalho titulo="Minha conta" escuro />

      <ScrollView contentContainerStyle={e.corpo}>
        {/* --- Quem sou --- */}
        <Cartao>
          <Text style={[tipo.secao, { color: cores.texto }]}>{perfil?.nome || 'Sem nome'}</Text>
          {perfil?.telefone ? (
            <View style={e.linhaDoTelefone}>
              <Text style={[tipo.apoio, { color: cores.textoApagado }]}>
                {paraLeitura(perfil.telefone)}
              </Text>
              {perfil.telefone_confirmado === perfil.telefone ? (
                <Etiqueta cor="sucesso">Confirmado</Etiqueta>
              ) : (
                <Etiqueta cor="atencao">Não confirmado</Etiqueta>
              )}
            </View>
          ) : null}
        </Cartao>

        {/* --- Profissional --- */}
        {cadastro ? (
          <>
            <Text style={[tipo.secao, e.tituloDaSecao]}>Disponibilidade</Text>
            <View style={e.opcoes}>
              {(['disponivel', 'pausado', 'ferias', 'oculto'] as Situacao[]).map((s) => {
                const ativo = cadastro.situacao === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => void trocarSituacao(s)}
                    disabled={mudando}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ativo, disabled: mudando }}
                    style={({ pressed }) => [
                      e.opcao,
                      ativo && { borderColor: cores.marca, backgroundColor: cores.superficieAfundada },
                      pressed && { opacity: 0.7 },
                      mudando && { opacity: 0.5 },
                    ]}
                  >
                    <View style={e.marcador}>
                      {ativo ? <View style={e.marcadorCheio} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[tipo.corpoForte, { color: cores.texto }]}>
                        {ROTULO_DA_SITUACAO[s]}
                      </Text>
                      <Text style={[tipo.apoio, { color: cores.textoApagado, marginTop: 2 }]}>
                        {EXPLICACAO[s]}
                        {s === 'ferias' && cadastro.ausente_ate && ativo
                          ? ` Volta em ${cadastro.ausente_ate.split('-').reverse().join('/')}.`
                          : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[tipo.secao, e.tituloDaSecao]}>Seu plano</Text>
            <Cartao>
              <View style={e.linhaDoPlano}>
                <Etiqueta cor={plano?.onda ? 'destaque' : 'neutra'}>
                  {plano?.nome ?? 'Básico'}
                </Etiqueta>
              </View>
              <Text style={[tipo.apoio, { color: cores.texto, marginTop: espaco.sm }]}>
                {comoRecebeOportunidades(plano)}
              </Text>
              <View style={{ marginTop: espaco.md }}>
                <Botao variante="contorno" onPress={() => router.push('/planos')}>
                  Ver planos
                </Botao>
              </View>
            </Cartao>
          </>
        ) : (
          <>
            <Text style={[tipo.secao, e.tituloDaSecao]}>Trabalhar com o procurô</Text>
            <Cartao>
              <Text style={[tipo.corpo, { color: cores.texto }]}>
                Cadastre o que você faz e comece a receber os pedidos de quem
                precisa do seu serviço na região.
              </Text>
              <View style={{ marginTop: espaco.md }}>
                <Botao onPress={() => router.push('/cadastro')}>Quero me cadastrar</Botao>
              </View>
            </Cartao>
          </>
        )}

        {/* --- Sair --- */}
        <View style={e.sair}>
          <Botao
            variante="perigo"
            onPress={() =>
              Alert.alert('Sair da conta', 'Você vai precisar entrar de novo com seu telefone.', [
                { text: 'Ficar', style: 'cancel' },
                {
                  text: 'Sair',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await sair();
                    } catch (err) {
                      Alert.alert('Não deu certo', mensagemDeErro(err, 'Não deu para sair.'));
                    }
                  },
                },
              ])
            }
          >
            Sair da conta
          </Botao>
        </View>
      </ScrollView>
    </View>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.lg, paddingBottom: espaco.xxl },
  linhaDoTelefone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    marginTop: espaco.sm,
  },
  tituloDaSecao: { color: cores.texto, marginTop: espaco.xl, marginBottom: espaco.md },
  opcoes: { gap: espaco.sm },
  opcao: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaco.md,
    minHeight: ALVO_DE_TOQUE,
    padding: espaco.lg,
    borderRadius: canto.md,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  marcador: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: cores.bordaForte,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  marcadorCheio: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: cores.marca,
  },
  linhaDoPlano: { flexDirection: 'row', justifyContent: 'space-between' },
  sair: { marginTop: espaco.xxl },
});
