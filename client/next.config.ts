import type { NextConfig } from "next";

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
};

export default nextConfig;
