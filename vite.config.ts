import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import net from "node:net";

function canConnectTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));

    socket.connect(port, host);
  });
}

async function detectDefaultApiProxyTarget(): Promise<string> {
  /**
   * Best-effort proxy target selection.
   *
   * Contract:
   * - Prefer local docker-compose gateway default (8081) when it is listening.
   * - Otherwise fall back to Kavia preview gateway port (3001) when it is listening.
   * - If neither is listening yet, default to 8081 (matches docs/local expectations).
   *
   * Notes:
   * - This avoids the common Vite proxy HTTP 500 caused by ECONNREFUSED when the
   *   wrong port is configured.
   */
  const host = "127.0.0.1";

  if (await canConnectTcp(host, 8081, 150)) return "http://localhost:8081";
  if (await canConnectTcp(host, 3001, 150)) return "http://localhost:3001";

  return "http://localhost:8081";
}

export default defineConfig(async ({ mode }) => {
  /**
   * Dev proxy target for API calls.
   *
   * IMPORTANT:
   * - Local docker-compose: gateway defaults to 8081 (see shopizer-modern-java21/docker-compose.yml).
   * - Kavia preview: the gateway is exposed on port 3001 (see running container metadata).
   * - We keep the frontend basePath as "/api" and proxy that to the gateway.
   *
   * Configure explicitly via env when needed:
   * - VITE_DEV_API_PROXY_TARGET=http://localhost:8081
   */
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET || (await detectDefaultApiProxyTarget());

  return {
    plugins: [react()],
    server: {
      /**
       * Allow access from the Kavia preview host(s).
       * Vite blocks unknown hosts by default to prevent DNS rebinding attacks.
       *
       * If your preview host changes between sessions, the wildcard entry helps.
       */
      allowedHosts: [
        "vscode-internal-13040-beta.beta01.cloud.kavia.ai",
        ".cloud.kavia.ai",
      ],
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
