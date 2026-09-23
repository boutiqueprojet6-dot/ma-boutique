import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png"],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Par défaut, le Service Worker intercepte TOUTE navigation directe
        // vers n'importe quelle URL et sert index.html à la place (comportement
        // normal pour une SPA classique). Mais auth-callback.html doit rester
        // une vraie page indépendante (elle contient le code qui rouvre
        // l'app Android après la connexion Google) — sinon c'est toujours
        // l'app React (index.html) qui s'affiche à sa place, et le lien
        // profond n'est jamais déclenché.
        navigateFallbackDenylist: [/^\/auth-callback\.html$/],
      },
      manifest: {
        name: "Shopnify",
        short_name: "Shopnify",
        description: "Application de gestion de boutique",
        theme_color: "#1e3a8a",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      }
    })
  ],
});
