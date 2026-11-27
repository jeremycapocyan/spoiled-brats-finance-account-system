"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type InstallContext = { available: boolean; installed: boolean; online: boolean; install: () => Promise<string> };
const AppContext = createContext<InstallContext>({ available: false, installed: false, online: true, install: async () => "Use your browser menu to install this app." });
export const useAppInstall = () => useContext(AppContext);

export function AppRuntime({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const checkInstalled = () => setInstalled(standalone.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const checkOnline = () => setOnline(navigator.onLine);
    const offer = (e: Event) => { e.preventDefault(); setPrompt(e as InstallEvent); };
    const complete = () => { setInstalled(true); setPrompt(null); };
    checkInstalled(); checkOnline();
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", complete);
    window.addEventListener("online", checkOnline);
    window.addEventListener("offline", checkOnline);
    standalone.addEventListener("change", checkInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", complete);
      window.removeEventListener("online", checkOnline);
      window.removeEventListener("offline", checkOnline);
      standalone.removeEventListener("change", checkInstalled);
    };
  }, []);
  async function install() {
    if (!prompt) return "Use the steps for your device below. Installation is controlled by your browser.";
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setPrompt(null);
      return choice.outcome === "accepted" ? "Installation accepted. Look for Spoiled Brats on your home screen or desktop." : "Installation cancelled. You can keep using the browser or install later.";
    } catch { setPrompt(null); return "Use the installation steps below to add the app from your browser menu."; }
  }
  return <AppContext.Provider value={{ available: !!prompt, installed, online, install }}>
    {!online && <div className="offline-banner no-print" role="alert">Offline · Reconnect to record live sales and sync customer displays. No live payments are saved offline.</div>}
    {children}
  </AppContext.Provider>;
}
