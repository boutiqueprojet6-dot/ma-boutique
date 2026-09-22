// ============================================================
// PERSISTANCE CRITIQUE EN ARRIÈRE-PLAN
// ============================================================
// Android peut tuer le process WebView à tout moment quand l'app
// passe en arrière-plan (surtout avec une app lourde comme celle-ci).
// À chaque événement critique (changement d'onglet, ouverture de
// panier, etc.), on écrit IMMÉDIATEMENT dans le stockage NATIF
// (@capacitor/preferences) qui SURVIT au kill du process, en plus
// du localStorage classique. Au retour, on restaure TOUT depuis le
// natif AVANT de regarder localStorage.
// ============================================================

// Import STATIQUE (et non plus dynamique via import()) : @capacitor/preferences
// est déjà importé statiquement dans BoutiqueApp.jsx, et dépend lui aussi de
// @capacitor/core. Le charger dynamiquement ICI en plus créait le même cycle
// de chunks Vite/Rollup que celui qui causait "Cannot access '_' before
// initialization" avec @capacitor/app et @capacitor/browser.
import { Preferences } from "@capacitor/preferences";

// Clé unique qui regroupe TOUT l'état critique de l'app.
// Un seul JSON = une seule écriture native = pas de course asynchrone.
export const CRITICAL_STATE_KEY = "mb_critical_state_v2";

// État critique à persister à chaque changement.
// Ajoute ici tout ce que l'utilisateur s'attend à retrouver au retour.
export function buildCriticalState({
  tab,
  activeCartId,
  draftCarts,
  showAddProduct,
  editingProductId,
  showSettings,
  settingsView,
  settingsField,
  showCameraCheckout,
  showAiHistory,
  showMoreMenu,
  showAddExpense,
  showEditFund,
  showAddDebtModal,
  showAccountingExport,
  showShopSwitcher,
  showForgotPin,
  showHistoryFilters,
  histFilterKinds,
  histFilterFrom,
  histFilterTo,
  histFilterProduct,
  histFilterCustomer,
  histFilterMinAmount,
  histFilterMaxAmount,
  stockSearch,
  cartSearch,
  debtsSearch,
  historySearch,
  productSortMode,
  saleViewMode,
  showAllLowStock,
  showAllTopProducts,
  lang,
  username,
  shopName,
  activeShopId,
}) {
  return {
    savedAt: Date.now(),
    tab,
    activeCartId,
    // On ne sauve que les IDs + métadonnées des paniers, pas tout le contenu
    // (le contenu complet est déjà dans shop_data via persist()).
    cartSnapshot: (draftCarts || []).map((c) => ({
      id: c.id,
      label: c.label,
      itemCount: (c.items || []).length,
      payment: c.payment,
      customer: c.customer,
    })),
    showAddProduct,
    editingProductId,
    showSettings,
    settingsView,
    settingsField,
    showCameraCheckout,
    showAiHistory,
    showMoreMenu,
    showAddExpense,
    showEditFund,
    showAddDebtModal,
    showAccountingExport,
    showShopSwitcher,
    showForgotPin,
    showHistoryFilters,
    histFilterKinds,
    histFilterFrom,
    histFilterTo,
    histFilterProduct,
    histFilterCustomer,
    histFilterMinAmount,
    histFilterMaxAmount,
    stockSearch,
    cartSearch,
    debtsSearch,
    historySearch,
    productSortMode,
    saleViewMode,
    showAllLowStock,
    showAllTopProducts,
    lang,
    username,
    shopName,
    activeShopId,
  };
}

// Écrit l'état critique dans le stockage NATIF (survit au kill Android).
// On attend la Promise pour être sûr que l'écriture est terminée.
export async function writeCriticalState(state) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(state);
  // 1) localStorage (rapide, mais peut être vidé par Android)
  try { window.localStorage.setItem(CRITICAL_STATE_KEY, raw); } catch (e) {}
  // 2) Stockage natif Capacitor (survit au kill process)
  if (window.Capacitor) {
    try {
      await Preferences.set({ key: CRITICAL_STATE_KEY, value: raw });
    } catch (e) { /* best effort */ }
  }
}

// Lit l'état critique. Priorité : NATIF > localStorage.
// Retourne null si rien de valide.
export async function readCriticalState() {
  if (typeof window === "undefined") return null;
  if (window.Capacitor) {
    try {
      const { value } = await Preferences.get({ key: CRITICAL_STATE_KEY });
      if (value) {
        const parsed = JSON.parse(value);
        if (parsed && parsed.savedAt) return parsed;
      }
    } catch (e) {}
  }
  try {
    const raw = window.localStorage.getItem(CRITICAL_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.savedAt) return parsed;
    }
  } catch (e) {}
  return null;
}

// Supprime l'état critique (à appeler à la déconnexion).
export async function clearCriticalState() {
  try { window.localStorage.removeItem(CRITICAL_STATE_KEY); } catch (e) {}
  if (window.Capacitor) {
    try {
      await Preferences.remove({ key: CRITICAL_STATE_KEY });
    } catch (e) {}
  }
}

// Vérifie si l'état sauvegardé est encore frais (< 24h).
export function isStateFresh(state, maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!state || !state.savedAt) return false;
  return Date.now() - state.savedAt < maxAgeMs;
}
// Écrit l'état critique dans le stockage NATIF (survit au kill Android).
// On attend la Promise pour être sûr que l'écriture est terminée.
export async function writeCriticalState(state) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(state);
  // 1) localStorage (rapide, mais peut être vidé par Android)
  try { window.localStorage.setItem(CRITICAL_STATE_KEY, raw); } catch (e) {}
  // 2) Stockage natif Capacitor (survit au kill process)
  if (window.Capacitor) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: CRITICAL_STATE_KEY, value: raw });
    } catch (e) { /* best effort */ }
  }
}

// Lit l'état critique. Priorité : NATIF > localStorage.
// Retourne null si rien de valide.
export async function readCriticalState() {
  if (typeof window === "undefined") return null;
  if (window.Capacitor) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: CRITICAL_STATE_KEY });
      if (value) {
        const parsed = JSON.parse(value);
        if (parsed && parsed.savedAt) return parsed;
      }
    } catch (e) {}
  }
  try {
    const raw = window.localStorage.getItem(CRITICAL_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.savedAt) return parsed;
    }
  } catch (e) {}
  return null;
}

// Supprime l'état critique (à appeler à la déconnexion).
export async function clearCriticalState() {
  try { window.localStorage.removeItem(CRITICAL_STATE_KEY); } catch (e) {}
  if (window.Capacitor) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key: CRITICAL_STATE_KEY });
    } catch (e) {}
  }
}

// Vérifie si l'état sauvegardé est encore frais (< 24h).
export function isStateFresh(state, maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!state || !state.savedAt) return false;
  return Date.now() - state.savedAt < maxAgeMs;
}

