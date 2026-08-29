/**
 * A conexão com o banco.
 *
 * Um detalhe que não é detalhe: **a sessão precisa de `AsyncStorage`**.
 * O cliente do Supabase guarda o login em `localStorage` por padrão, que
 * não existe no React Native. Sem passar o armazenamento aqui, o app
 * funciona a sessão inteira e esquece quem entrou assim que fecha — e o
 * sintoma ("toda hora pede login de novo") não aponta para cá de jeito
 * nenhum.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseFalso } from './supabaseFalso';

/**
 * O modo demonstração, e por que ele mora aqui.
 *
 * Para ver o app sem credencial, a saída óbvia é trocar este arquivo por
 * um falso à mão, rodar, e lembrar de desfazer. Funciona até a vez em que
 * alguém esquece — e aí o app publicado fala com um banco que não existe,
 * sem erro nenhum, mostrando dados inventados. Defeito silencioso, e dos
 * caros: tudo parece funcionar.
 *
 * Com a chave `EXPO_PUBLIC_DEMO`, não há troca de arquivo nenhuma: quem
 * não define a variável nunca encosta no falso, e não dá para esquecer de
 * desfazer o que não foi feito.
 *
 *   EXPO_PUBLIC_DEMO=1             entra como cliente
 *   EXPO_PUBLIC_DEMO=profissional  entra já cadastrado, com oportunidades
 */
const ehDemonstracao = !!process.env.EXPO_PUBLIC_DEMO;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chaveAnonima = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Falta de configuração é avisada aqui, alto e claro.
 *
 * A alternativa — deixar passar e quebrar na primeira consulta — produz um
 * app que abre, navega, e devolve "nada encontrado" em toda tela. Parece
 * banco vazio, e já custou horas de gente procurando defeito no lugar
 * errado. Melhor não abrir do que abrir mentindo.
 */
if (!ehDemonstracao && (!url || !chaveAnonima)) {
  throw new Error(
    'Faltam as chaves do banco. Defina EXPO_PUBLIC_SUPABASE_URL e ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env — ou use ' +
      'EXPO_PUBLIC_DEMO=1 para abrir com dados de demonstração.',
  );
}

/**
 * Onde a sessão é guardada — e por que não é sempre o `AsyncStorage`.
 *
 * A versão web do app é publicada com `output: "static"`, o que significa
 * que cada tela é renderizada no **Node** antes de ir para o navegador. E
 * no Node não existe `AsyncStorage`: ele é uma ponte para o armazenamento
 * do aparelho, e do lado do servidor essa ponte não leva a lugar nenhum.
 *
 * O sintoma é violento e não aponta para cá: o servidor derruba a página
 * inteira ao montar o cliente do Supabase, antes de qualquer tela aparecer.
 * Não é erro de tela, é erro de arranque.
 *
 * A saída é um armazenamento de mentira para o servidor. Não guardar nada
 * lá é o certo, não um remendo: no servidor não HÁ sessão para guardar —
 * ninguém entrou ainda, a página está sendo montada para ser enviada.
 */
const semLugarParaGuardar = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const estaNoServidor = typeof window === 'undefined';

/**
 * O tipo é sempre o do cliente de VERDADE, mesmo no modo demonstração.
 *
 * Sem esta anotação, o TypeScript une os dois tipos, o `any` do falso vence,
 * e o app inteiro perde a conferência de tipo em cima do banco — que é
 * justamente onde ela mais protege. O falso é uma dublê: ele imita o
 * contrato, então quem chama continua sendo cobrado por respeitá-lo.
 */
export const supabase: SupabaseClient = ehDemonstracao
  ? (supabaseFalso as SupabaseClient)
  : createClient(url as string, chaveAnonima as string, {
      auth: {
        storage: estaNoServidor ? semLugarParaGuardar : AsyncStorage,
        autoRefreshToken: true,
        // Renovar e guardar sessão no servidor não faz sentido pelo mesmo
        // motivo: não há dono para a sessão do lado de lá.
        persistSession: !estaNoServidor,
        detectSessionInUrl: false,
      },
    });
