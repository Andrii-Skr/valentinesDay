import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/valentinesDay/',
  plugins: [react()],
  publicDir: 'public',
});
