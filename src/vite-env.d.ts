/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string;
  readonly VITE_OPENCLAW_TOKEN?: string;
  readonly VITE_OPENCLAW_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
