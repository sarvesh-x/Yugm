import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const config = loadEnv(mode, process.cwd(), "VITE_ADMIN_");
  return {
    plugins: [react()],
    // The existing Node server mounts the app at /admin/. A separate Pages
    // project serves it from /, selected at build time for that deployment.
    base: config.VITE_ADMIN_BASE_PATH || "/admin/",
    server: {
      port: 5173,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://127.0.0.1:4000",
          changeOrigin: true
        }
      }
    }
  };
});
