import React from "react";
import ReactDOM from "react-dom/client";
import BoutiqueApp from "./BoutiqueApp.jsx";
import "./index.css";
// Import STATIQUE (et non plus dynamique via import()) : BoutiqueApp.jsx importe déjà
// @capacitor/preferences de façon statique (voir son en-tête et backgroundPersistence.js),
// donc l'import dynamique précédent ici n'apportait aucun gain réel (le module était de
// toute façon déjà chargé en même temps que BoutiqueApp) — Vite/Rollup avertissait même
// explicitement de ce mélange import statique + dynamique du même module ("dynamic import
// will not move module into another chunk"), un cas limite qui peut perturber l'ordre
// d'initialisation des chunks à la construction. Correctif suite à une erreur en
// production ("Cannot access ... before initialization") qui n'apparaissait que sur le
// bundle déployé (jamais reproduite en local), très probablement liée à ce mélange.
import { Preferences } from "@capacitor/preferences";

// IMPORTANT : window.Capacitor existe aussi en dehors de l'app native (PWA/site web),
// car @capacitor/core l'injecte automatiquement dès qu'il est importé par un plugin
// (ex. @capacitor/preferences, @capacitor/push-notifications), même en mode web pur.
// Donc `!!window.Capacitor` seul ne suffit pas à détecter l'app native — seul
// isNativePlatform() le permet. Sans ce correctif, isCapacitorApp était aussi vrai sur
// la PWA, ce qui empêchait l'enregistrement du service worker et toute mise à jour.
const isCapacitorApp =
  typeof window !== "undefined" &&
  !!window.Capacitor &&
  typeof window.Capacitor.isNativePlatform === "function" &&
  window.Capacitor.isNativePlatform();

// Un déploiement remplace les fichiers JS/CSS par de nouveaux fichiers au nom différent
// (hash de contenu) et supprime les anciens. Si quelqu'un a déjà cette page ouverte (ou
// une copie mise en cache par le navigateur/service worker) au moment d'un déploiement,
// elle continue de pointer vers les anciens noms de fichiers — qui n'existent plus — et
// le navigateur affiche alors une boîte de dialogue brute "Failed to fetch dynamically
// imported module" au lieu de l'app. La solution : recharger la page UNE FOIS pour
// récupérer la version à jour (garde-fou via sessionStorage pour ne jamais boucler si le
// problème persistait pour une autre raison).
function reloadOnceForStaleAssets() {
  try {
    if (window.sessionStorage.getItem("mb_stale_reload_done") === "1") return false;
    window.sessionStorage.setItem("mb_stale_reload_done", "1");
  } catch (e) { /* tant pis, on tente quand même le rechargement */ }
  window.location.reload();
  return true;
}
// Couvre tout import dynamique qui échouerait plus tard pendant l'utilisation de l'app
// (chargement différé d'un morceau de code), pas seulement celui de main.jsx ci-dessous.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForStaleAssets();
});

// Mise à jour SILENCIEUSE, sans bandeau ni bouton : l'ancien bandeau "Mettre à jour"
// collé en bas de l'écran pouvait recouvrir un bouton que le boutiquier devait
// atteindre (ex. finaliser une vente en cours), et laissait la mise à jour entre les
// mains de chacun. Ici, dès qu'une nouvelle version est détectée, on la garde en
// attente et on l'applique (rechargement de la page) UNIQUEMENT pendant que l'app
// est en arrière-plan (onglet caché / app mise en veille sur le téléphone) — jamais
// pendant que l'écran est affiché, donc jamais au milieu d'une vente. La prochaine
// fois que le boutiquier revient sur l'app, elle est déjà à jour, sans rien à faire.
// Pour vérifier qu'une mise à jour est bien arrivée sur un appareil donné, voir
// Réglages > À propos > "Dernière mise à jour" dans BoutiqueApp.jsx (__BUILD_TIME__).
let pendingUpdateApply = null;
function applyPendingUpdateIfHidden() {
  if (pendingUpdateApply && document.visibilityState === "hidden") {
    const apply = pendingUpdateApply;
    pendingUpdateApply = null;
    apply(true); // true = recharge la page après activation du nouveau service worker
  }
}
document.addEventListener("visibilitychange", applyPendingUpdateIfHidden);

if (!isCapacitorApp && "serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onOfflineReady() {
        console.log("App prête pour le mode hors-ligne");
      },
      onNeedRefresh() {
        pendingUpdateApply = updateSW;
        applyPendingUpdateIfHidden(); // couvre le cas où l'app est déjà en arrière-plan à cet instant
      },
      onRegisteredSW(swUrl, registration) {
        // Une PWA peut rester ouverte des heures/jours sans jamais revérifier s'il existe
        // une nouvelle version. On force une vérification toutes les 30 minutes, et une
        // dès que l'app redevient visible (l'utilisateur rouvre l'app) pour ne jamais
        // rester bloqué sur une ancienne version.
        if (!registration) return;
        const checkForUpdate = () => registration.update().catch(() => {});
        setInterval(checkForUpdate, 30 * 60 * 1000);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate();
        });
      },
    });
  }).catch(() => {
    // Cet import lui-même peut échouer si la page vient d'un vieux cache pointant vers
    // un fichier "virtual_pwa-register-*.js" qui n'existe plus après un déploiement —
    // voir reloadOnceForStaleAssets ci-dessus. Sans ce filet, l'erreur restait silencieuse
    // dans la console et l'app démarrait quand même (renderApp() plus bas n'en dépend pas),
    // mais autant récupérer tout de suite la version à jour plutôt que de laisser
    // l'enregistrement du service worker (et donc les mises à jour futures) cassé.
    reloadOnceForStaleAssets();
  });
}

// Champs de saisie simples (recherche, nom de produit, quantités…) : on désactive la
// saisie automatique du navigateur/téléphone, sinon Android affiche au-dessus du clavier
// une barre « clé / carte bancaire / localisation » sans rapport avec le champ.
// Les champs e-mail et mot de passe (connexion) gardent la saisie automatique.
(function disableAutofillOnPlainFields() {
  const KEEP = new Set(["email", "password"]);
  const patch = (el) => {
    if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
    if (KEEP.has((el.type || "").toLowerCase())) return;
    const ac = (el.getAttribute("autocomplete") || "").toLowerCase();
    if (ac && ac !== "on") return; // valeur explicite choisie dans le code : on la respecte
    el.setAttribute("autocomplete", "off");
    if (!el.hasAttribute("data-lpignore")) el.setAttribute("data-lpignore", "true");
    if (!el.hasAttribute("data-form-type")) el.setAttribute("data-form-type", "other");
  };
  const scan = (root) => {
    if (!root || !root.querySelectorAll) return;
    patch(root);
    root.querySelectorAll("input, textarea").forEach(patch);
  };
  try {
    document.addEventListener("focusin", (e) => patch(e.target), true);
    const start = () => {
      scan(document.body);
      new MutationObserver((muts) => {
        for (const m of muts) m.addedNodes && m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n));
      }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  } catch (e) { /* jamais bloquant */ }
})();

function renderApp() {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BoutiqueApp />
    </React.StrictMode>
  );
  try { if (window.__boutiproMounted) window.__boutiproMounted(); } catch (e) {}
  // L'app a fini par se charger correctement : on lève le garde-fou anti-boucle, pour
  // qu'un VRAI nouveau problème de cache plus tard dans cette même page (après un futur
  // déploiement) puisse de nouveau déclencher un rechargement automatique.
  try { window.sessionStorage.removeItem("mb_stale_reload_done"); } catch (e) {}
}

if (isCapacitorApp) {
  (async () => {
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
  })();
} else {
  renderApp();
}
