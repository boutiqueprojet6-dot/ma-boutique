import React from "react";
import ReactDOM from "react-dom/client";
import BoutiqueApp from "./BoutiqueApp.jsx";
import "./index.css";

const isCapacitorApp = typeof window !== "undefined" && !!window.Capacitor;

if (!isCapacitorApp && "serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BoutiqueApp />
    </React.StrictMode>
  );
}

if (isCapacitorApp) {
  // Le cache des données de la boutique (produits, ventes, stock...) est normalement
  // stocké dans le localStorage du WebView, qui n'est pas fiable dans l'app native —
  // exactement le même problème déjà rencontré et corrigé pour la session de connexion.
  // On le recopie donc depuis le stockage natif (bien plus fiable, voir writeLocalCache
  // dans BoutiqueApp.jsx qui l'alimente en parallèle) juste avant de monter l'app, pour
  // que le cache soit déjà présent dès le tout premier rendu — sans quoi l'app attendrait
  // une requête réseau complète avant de pouvoir afficher quoi que ce soit.
  import("@capacitor/preferences").then(async ({ Preferences }) => {
    try {
      const { keys } = await Preferences.keys();
      await Promise.all(
        keys.map(async (key) => {
          const { value } = await Preferences.get({ key });
          if (value !== null && value !== undefined) {
            try { window.localStorage.setItem(key, value); } catch (e) {}
          }
        })
      );
    } catch (e) {
      // Pas grave : l'app fonctionnera quand même, juste sans ce cache pour cette fois.
    }
    renderApp();
  });
} else {
  renderApp();
}
