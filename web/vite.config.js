import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE is '/' locally and '/job-tracker-api/' on GitHub Pages, where the
// site is served from a sub-path. Set by the deploy workflow.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
});
