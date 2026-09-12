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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BoutiqueApp />
  </React.StrictMode>
);
