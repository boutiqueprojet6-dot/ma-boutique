import React from "react";
import ReactDOM from "react-dom/client";
import BoutiqueApp from "./BoutiqueApp.jsx";
import "./index.css";

const isCapacitorApp = typeof window !== "undefined" && !!window.Capacitor;

// Bandeau "Mise à jour disponible" affiché par-dessus l'app, injecté directement
// dans le DOM (pas de composant React ici : main.jsx tourne avant le montage,
// et on veut que ça marche même si BoutiqueApp plante).
function showUpdateBanner(onReload) {
  if (document.getElementById("sw-update-banner")) return; // déjà affiché
  const banner = document.createElement("div");
  banner.id = "sw-update-banner";
  banner.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 999999;
    background: #1a1a1a; color: #fff; padding: 12px 16px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; font-family: system-ui, -apple-system, sans-serif; font-size: 14px;
    box-shadow: 0 -2px 8px rgba(0,0,0,0.2);
  `;
  banner.innerHTML = `
    <span>Une nouvelle version de l'app est disponible.</span>
    <button id="sw-update-btn" style="
      background: #fff; color: #1a1a1a; border: none; border-radius: 6px;
      padding: 8px 14px; font-weight: 600; font-size: 14px; cursor: pointer;
      white-space: nowrap;
    ">Mettre à jour</button>
  `;
  document.body.appendChild(banner);
  document.getElementById("sw-update-btn").onclick = () => {
    banner.remove();
    onReload();
  };
}

if (!isCapacitorApp && "serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onOfflineReady() {
        console.log("App prête pour le mode hors-ligne");
      },
      onNeedRefresh() {
        showUpdateBanner(() => updateSW(true)); // true = recharge la page après activation
      },
    });
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
