/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Endereço do projeto no Supabase. Público. Ver src/lib/supabase.ts. */
  readonly VITE_SUPABASE_URL?: string;
  /** Chave publicável do Supabase. Pública por definição — a proteção real
      são as políticas em supabase/migrations/0002_seguranca.sql. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Replaced at build time by vite.config.ts. See src/lib/adminAccess.ts. */
declare const __ADMIN_ENABLED__: boolean;

/** True in the standalone single-file build. See scripts/build-single-file.mjs. */
declare const __SINGLE_FILE__: boolean;

/** Short commit of the build that is running. See vite.config.ts. */
declare const __BUILD_ID__: string;
