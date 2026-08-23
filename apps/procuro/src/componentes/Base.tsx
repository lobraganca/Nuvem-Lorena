/**
 * As peças que todas as telas usam.
 *
 * Ficam juntas num arquivo só enquanto são poucas e pequenas. Um arquivo
 * por componente de dez linhas espalha a leitura sem organizar nada — a
 * hora de separar é quando um deles crescer, não antes.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';
import { ALVO_DE_TOQUE, canto, cores, espaco, sombra, tipo } from '../tema';

// ---------------------------------------------------------------------
// Botão
// ---------------------------------------------------------------------

type BotaoProps = {
  children: ReactNode;
  onPress?: () => void;
  variante?: 'principal' | 'contorno' | 'discreto' | 'perigo';
  carregando?: boolean;
  desabilitado?: boolean;
  largura?: 'total' | 'conteudo';
};

export function Botao({
  children,
  onPress,
  variante = 'principal',
  carregando = false,
  desabilitado = false,
  largura = 'total',
}: BotaoProps) {
  // Enquanto carrega, o botão fica inerte. Sem isto, dois toques rápidos
  // mandam a mesma coisa duas vezes — e no caso de aceitar oportunidade,
  // dois aceites é um problema de verdade.
  const inerte = desabilitado || carregando;

  return (
    <Pressable
      onPress={inerte ? undefined : onPress}
      disabled={inerte}
      accessibilityRole="button"
      accessibilityState={{ disabled: inerte, busy: carregando }}
      style={({ pressed }) => [
        e.botao,
        largura === 'total' && { alignSelf: 'stretch' },
        variante === 'principal' && { backgroundColor: cores.marca },
        variante === 'contorno' && {
          backgroundColor: cores.superficie,
          borderWidth: 1,
          borderColor: cores.bordaForte,
        },
        variante === 'discreto' && { backgroundColor: cores.superficieAfundada },
        variante === 'perigo' && { backgroundColor: cores.erroLavado },
        pressed && !inerte && { opacity: 0.75 },
        inerte && { opacity: 0.5 },
      ]}
    >
      {carregando ? (
        <ActivityIndicator
          color={variante === 'principal' ? cores.textoSobreMarca : cores.marca}
        />
      ) : (
        <Text
          style={[
            e.textoDoBotao,
            variante === 'principal' && { color: cores.textoSobreMarca },
            variante === 'contorno' && { color: cores.texto },
            variante === 'discreto' && { color: cores.texto },
            variante === 'perigo' && { color: cores.erro },
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Cartão
// ---------------------------------------------------------------------

export function Cartao({
  children,
  onPress,
  destacado = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  destacado?: boolean;
}) {
  const conteudo = (
    <View style={[e.cartao, destacado && { borderColor: cores.destaque, borderWidth: 1.5 }]}>
      {children}
    </View>
  );
  if (!onPress) return conteudo;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      {conteudo}
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Campo de texto
// ---------------------------------------------------------------------

type CampoProps = ComponentProps<typeof TextInput> & {
  rotulo: string;
  /** O recado de erro fica COLADO no campo, não no topo da tela. */
  erro?: string | null;
  ajuda?: string;
};

export function Campo({ rotulo, erro, ajuda, style, ...resto }: CampoProps) {
  return (
    <View style={e.campoFora}>
      <Text style={[tipo.corpoForte, { color: cores.texto, marginBottom: espaco.sm }]}>
        {rotulo}
      </Text>
      <TextInput
        placeholderTextColor={cores.textoApagado}
        // Sem isto o campo fica cinza-claro no modo escuro do aparelho e a
        // pessoa digita sem enxergar o que escreveu.
        style={[e.campo, erro ? { borderColor: cores.erro } : null, style]}
        accessibilityLabel={rotulo}
        {...resto}
      />
      {/* O erro entra no lugar da ajuda em vez de empurrar a tela para
          baixo: campo que cresce quando erra faz o botão fugir do dedo
          exatamente no momento em que a pessoa vai tocar nele. */}
      {erro ? (
        <Text style={[tipo.apoio, { color: cores.erro, marginTop: espaco.sm }]}>{erro}</Text>
      ) : ajuda ? (
        <Text style={[tipo.apoio, { color: cores.textoApagado, marginTop: espaco.sm }]}>
          {ajuda}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------
// Etiqueta
// ---------------------------------------------------------------------

export function Etiqueta({
  children,
  cor = 'neutra',
}: {
  children: ReactNode;
  cor?: 'neutra' | 'destaque' | 'sucesso' | 'atencao' | 'erro';
}) {
  const paleta = {
    neutra: { fundo: cores.superficieAfundada, texto: cores.textoApagado },
    destaque: { fundo: cores.destaqueLavado, texto: cores.destaqueEscuro },
    sucesso: { fundo: cores.sucessoLavado, texto: cores.sucesso },
    atencao: { fundo: cores.atencaoLavado, texto: cores.atencao },
    erro: { fundo: cores.erroLavado, texto: cores.erro },
  }[cor];

  return (
    <View style={[e.etiqueta, { backgroundColor: paleta.fundo }]}>
      <Text style={[tipo.etiqueta, { color: paleta.texto }]}>{children}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------
// Estado vazio e estado de erro
// ---------------------------------------------------------------------

export function Vazio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <View style={e.centralizado}>
      <Text style={[tipo.secao, { color: cores.texto, textAlign: 'center' }]}>{titulo}</Text>
      {texto ? (
        <Text style={[tipo.apoio, e.textoCentral, { color: cores.textoApagado }]}>{texto}</Text>
      ) : null}
    </View>
  );
}

/**
 * O aviso de que algo falhou.
 *
 * Existe separado do `Vazio` porque a diferença entre "não tem nada" e
 * "não deu para saber se tem" é a diferença mais importante da tela. Elas
 * já foram desenhadas iguais uma vez, e o resultado foi um app que dizia
 * "nenhum profissional encontrado" quando na verdade a busca estava
 * quebrada — ninguém reclamou, porque a tela parecia certa.
 */
export function Falhou({ mensagem, aoTentarDeNovo }: { mensagem: string; aoTentarDeNovo?: () => void }) {
  return (
    <View style={e.centralizado}>
      <View style={e.avisoDeErro}>
        <Text style={[tipo.corpoForte, { color: cores.erro, marginBottom: espaco.xs }]}>
          Não deu certo
        </Text>
        <Text style={[tipo.apoio, { color: cores.texto }]}>{mensagem}</Text>
      </View>
      {aoTentarDeNovo ? (
        <View style={{ marginTop: espaco.lg, alignSelf: 'stretch' }}>
          <Botao variante="contorno" onPress={aoTentarDeNovo}>
            Tentar de novo
          </Botao>
        </View>
      ) : null}
    </View>
  );
}

export function Carregando({ texto }: { texto?: string }) {
  return (
    <View style={e.centralizado}>
      <ActivityIndicator color={cores.marca} size="large" />
      {texto ? (
        <Text style={[tipo.apoio, { color: cores.textoApagado, marginTop: espaco.md }]}>
          {texto}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------

const e = StyleSheet.create({
  botao: {
    minHeight: ALVO_DE_TOQUE,
    borderRadius: canto.capsula,
    paddingHorizontal: espaco.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoDoBotao: { ...tipo.corpoForte },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: canto.lg,
    padding: espaco.lg,
    borderWidth: 1,
    borderColor: cores.borda,
    ...sombra.cartao,
  },
  etiqueta: {
    paddingHorizontal: espaco.sm,
    paddingVertical: espaco.xs,
    borderRadius: canto.sm,
    alignSelf: 'flex-start',
  },
  campoFora: { marginBottom: espaco.lg },
  campo: {
    minHeight: ALVO_DE_TOQUE + 6,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.bordaForte,
    borderRadius: canto.md,
    paddingHorizontal: espaco.lg,
    fontSize: 17, // maior que o corpo: é o que a pessoa está digitando
    color: cores.texto,
  },
  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espaco.xl,
  },
  textoCentral: { textAlign: 'center', marginTop: espaco.sm },
  avisoDeErro: {
    backgroundColor: cores.erroLavado,
    borderRadius: canto.md,
    padding: espaco.lg,
    borderLeftWidth: 3,
    borderLeftColor: cores.erro,
    alignSelf: 'stretch',
  },
});
