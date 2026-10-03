/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly NANO_API_KEY: string;
    readonly MESHY_API_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
