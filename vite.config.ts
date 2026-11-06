import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@divora/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
        '@divora/chains': path.resolve(__dirname, './packages/chains/src/index.ts'),
        '@divora/wallets': path.resolve(__dirname, './packages/wallets/src/index.ts'),
        '@divora/nft': path.resolve(__dirname, './packages/nft/src/index.ts'),
        '@divora/opportunities': path.resolve(__dirname, './packages/opportunities/src/index.ts'),
        '@divora/policy': path.resolve(__dirname, './packages/policy/src/index.ts'),
        '@divora/tx': path.resolve(__dirname, './packages/tx/src/index.ts'),
        '@divora/market': path.resolve(__dirname, './packages/market/src/index.ts'),
        '@divora/agent': path.resolve(__dirname, './packages/agent/src/index.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
