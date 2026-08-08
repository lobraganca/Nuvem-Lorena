import type { CapacitorConfig } from '@capacitor/cli'

// Configuração base do Capacitor para gerar, no futuro, os projetos nativos
// Android/iOS a partir do build web (dist/). Ver README, seção
// "Publicação nas lojas (futuro)", para o passo a passo completo.
const config: CapacitorConfig = {
  appId: 'com.buscaitabirito.app',
  appName: 'Busca Itabirito',
  webDir: 'dist',
  backgroundColor: '#0B1D33',
}

export default config
