/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Replaced at build time by vite.config.ts. See src/lib/adminAccess.ts. */
declare const __ADMIN_ENABLED__: boolean;

/** True in the standalone single-file build. See scripts/build-single-file.mjs. */
declare const __SINGLE_FILE__: boolean;

/** Short commit of the build that is running. See vite.config.ts. */
declare const __BUILD_ID__: string;
