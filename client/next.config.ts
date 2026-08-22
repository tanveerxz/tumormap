import type { NextConfig } from "next";

/** Where the Python server actually listens, as seen from the Next process. */
const BACKEND = (process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  /**
   * The dev server refuses cross-origin requests it does not recognise, which
   * blocks HMR and dev assets when the app is reached through a tunnel. Trust
   * the tunnel domains so `cloudflared tunnel --url http://localhost:3000`
   * (or ngrok) works without disabling the check.
   * Dev-only — production builds ignore this.
   */
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.ngrok.app",
  ],

  /**
   * Proxy the API through this server so the browser only ever talks to the
   * origin it loaded from.
   *
   * Without this the client fetched http://127.0.0.1:8000 directly, which
   * works on the dev box and nowhere else: on any other machine 127.0.0.1 is
   * the *viewer's* loopback, and over an HTTPS tunnel the browser blocks the
   * plain-HTTP request as mixed content. Same-origin relative paths fix both,
   * and the backend can stay bound to loopback.
   */
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND}/api/:path*` },
      { source: "/health", destination: `${BACKEND}/health` },
    ];
  },
};

export default nextConfig;
