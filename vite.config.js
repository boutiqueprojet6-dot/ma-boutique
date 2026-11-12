import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// ---- Découpage des langues (boutipro-lang-split) ----
// src/BoutiqueApp.jsx contient les 30 langues de l'app (~1,9 Mo de texte, plus de la moitié
// du code). Ce plugin les sort du fichier principal AU MOMENT DE LA CONSTRUCTION : le français
// et l'anglais (langues de repli) restent dans l'app, chacune des 28 autres devient un petit
// fichier chargé à la demande (voir loadLangPack dans BoutiqueApp.jsx). Le fichier source
// n'est pas modifié : on continue d'y écrire toutes les traductions comme avant.
// Le plugin lit trois formes, et arrête la construction avec un message clair s'il ne les
// retrouve pas (mieux vaut une construction qui échoue qu'une langue qui disparaît) :
//   const TRANSLATIONS = { fr: {...}, en: {...}, ... };
//   const EXTRA_UI = { cle: { fr: "...", en: "...", ... }, ... };
//   EXTRA_UI.cle = { fr: "...", en: "...", ... };      (une ligne par clé)
function boutiproLangSplit() {
  const VIRTUAL = "virtual:boutipro-lang/";
  const KEEP = ["fr", "en"];
  let packs = {};
  // Renvoie [début, fin] du littéral { ... } qui commence à la première accolade après `from`.
  const literalRange = (code, from) => {
    const start = code.indexOf("{", from);
    let depth = 0, inStr = null;
    for (let k = start; k < code.length; k++) {
      const c = code[k];
      if (inStr) { if (c === "\\") { k++; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === "/" && code[k + 1] === "/") { k = code.indexOf("\n", k); if (k < 0) break; continue; }
      if (c === "/" && code[k + 1] === "*") { k = code.indexOf("*/", k) + 1; continue; }
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) return [start, k + 1]; }
    }
    throw new Error("[boutipro-lang-split] accolade fermante introuvable");
  };
  const evalLiteral = (text) => new Function("return (" + text + ");")();
  const fail = (msg) => { throw new Error("[boutipro-lang-split] " + msg); };
  return {
    name: "boutipro-lang-split",
    enforce: "pre",
    resolveId(id) { if (id.startsWith(VIRTUAL)) return "\0" + id; },
    load(id) {
      if (!id.startsWith("\0" + VIRTUAL)) return null;
      const lang = id.slice(("\0" + VIRTUAL).length);
      if (!packs[lang]) fail("langue inconnue : " + lang);
      return "export default " + JSON.stringify(packs[lang]) + ";";
    },
    transform(code, id) {
      if (!id.replace(/\\/g, "/").split("?")[0].endsWith("/src/BoutiqueApp.jsx")) return null;
      // 1. TRANSLATIONS
      const tAt = code.indexOf("const TRANSLATIONS = {");
      if (tAt < 0) fail("const TRANSLATIONS = { introuvable");
      const [tStart, tEnd] = literalRange(code, tAt);
      const T = evalLiteral(code.slice(tStart, tEnd));
      const langs = Object.keys(T);
      for (const l of KEEP) if (!T[l]) fail("langue de repli absente : " + l);
      for (const l of langs) for (const k in T[l]) if (typeof T[l][k] !== "string") fail(`TRANSLATIONS.${l}.${k} n'est pas un texte`);
      const next = {};
      for (const l of langs) if (!KEEP.includes(l)) next[l] = { T: T[l], X: {} };
      const keepOnly = (obj, where) => {
        const kept = {};
        for (const l in obj) {
          if (typeof obj[l] !== "string") fail(where + "." + l + " n'est pas un texte");
          if (KEEP.includes(l)) kept[l] = obj[l];
          else if (next[l]) next[l].X[where] = obj[l];
          else fail(where + " : langue « " + l + " » absente de TRANSLATIONS");
        }
        return kept;
      };
      const keptT = {};
      for (const l of KEEP) keptT[l] = T[l];
      let out = code.slice(0, tStart) + JSON.stringify(keptT) + code.slice(tEnd);
      // 2. EXTRA_UI (objet de départ)
      const xAt = out.indexOf("const EXTRA_UI = {");
      if (xAt < 0) fail("const EXTRA_UI = { introuvable");
      const [xStart, xEnd] = literalRange(out, xAt);
      const X = evalLiteral(out.slice(xStart, xEnd));
      const keptX = {};
      for (const k in X) keptX[k] = keepOnly(X[k], k);
      out = out.slice(0, xStart) + JSON.stringify(keptX) + out.slice(xEnd);
      // 3. EXTRA_UI.cle = { ... };
      let lines = 0;
      out = out.replace(/^EXTRA_UI\.(\w+) ?= ?(\{.*\});[ \t]*$/gm, (m, key, lit) => { lines++; return "EXTRA_UI." + key + " = " + JSON.stringify(keepOnly(evalLiteral(lit), key)) + ";"; });
      const expected = (out.match(/^EXTRA_UI\.\w+ ?=/gm) || []).length;
      if (lines !== expected) fail(`${expected - lines} ligne(s) EXTRA_UI.xxx = ... dans un format non reconnu (une ligne par clé attendue)`);
      // 4. chargeurs
      const marker = "const LANG_PACK_LOADERS = {};";
      if (!out.includes(marker)) fail(marker + " introuvable");
      out = out.replace(marker, "const LANG_PACK_LOADERS = {" + Object.keys(next).map((l) => `${JSON.stringify(l)}: () => import(${JSON.stringify(VIRTUAL + l)})`).join(", ") + "};");
      packs = next;
      return { code: out, map: null };
    },
  };
}

export default defineConfig({
  // Horodatage figé à la construction (pas à l'exécution) : sert à afficher "Dernière
  // mise à jour" dans Réglages > À propos. Comme la valeur est gravée dans le fichier
  // JS lui-même, elle change automatiquement de date dès qu'un appareil charge un
  // nouveau build — exactement ce qu'il faut pour vérifier qu'une modification
  // demandée est bien arrivée jusqu'à un appareil donné (voir aussi main.jsx).
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    boutiproLangSplit(),
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png"],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Par défaut, le Service Worker intercepte TOUTE navigation directe
        // vers n'importe quelle URL et sert index.html à la place (comportement
        // normal pour une SPA classique). Mais auth-callback.html doit rester
        // une vraie page indépendante (elle contient le code qui rouvre
        // l'app Android après la connexion Google), et /.well-known/assetlinks.json
        // doit lui aussi rester intact : c'est le fichier qu'Android va chercher
        // lui-même en arrière-plan pour vérifier le App Link (sans ça, la
        // vérification échoue silencieusement et Android refuse d'ouvrir l'app
        // automatiquement).
        navigateFallbackDenylist: [/^\/auth-callback\.html$/, /^\/\.well-known\//],
      },
      manifest: {
        name: "Boutipro",
        short_name: "Boutipro",
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
