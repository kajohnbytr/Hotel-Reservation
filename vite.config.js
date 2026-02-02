import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5000,        // 👈 change to your desired port
    strictPort: true,  // optional: fail if port is taken
    host: true,        // optional: allow LAN access
    open: true         // optional: auto-open browser
  }
});