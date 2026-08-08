/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_MERCADOPAGO_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Carimbo da versão publicada, injetado pelo vite.config.ts. */
declare const __VERSAO__: string;
