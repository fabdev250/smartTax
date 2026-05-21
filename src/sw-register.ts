export function registerServiceWorker() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/public/sw.js")
        .then((reg) => {
          console.log("SmartTax offline ServiceWorker registered successfully:", reg.scope);
        })
        .catch((err) => {
          console.error("ServiceWorker registration failed:", err);
        });
    });
  }
}
