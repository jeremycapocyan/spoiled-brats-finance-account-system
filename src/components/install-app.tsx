"use client";
import Link from "next/link";
import { useState } from "react";
import { Download, Tablet, Monitor, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Brand } from "./brand";
import { useAppInstall } from "./app-runtime";

export function InstallApp() {
  const { available, installed, install } = useAppInstall();
  const [notice, setNotice] = useState("");
  return <main className="install-page">
    <header><Link href="/pos" aria-label="Spoiled Brats POS"><Brand /></Link><Link href="/pos" className="button"><ArrowLeft size={16} />Open POS</Link></header>
    <section className="install-intro"><span className="eyebrow">YOUR COFFEE SHOP, READY TO GO</span><h1>A place on your home screen.</h1><p>Install Spoiled Brats on your Android tablet, iPad, or PC. Open your POS in its own window and use the same shop records everywhere.</p>
      {installed ? <div className="notice success"><CheckCircle2 size={20} />You’re using the installed app.</div> : <button className="button primary" onClick={async () => setNotice(await install())}><Download size={18} />{available ? "Install Spoiled Brats" : "Show installation help"}</button>}
      {notice && <p className="notice" role="status">{notice}</p>}
    </section>
    <section className="install-devices" aria-label="Installation steps">
      <article><Tablet size={26} /><h2>Android tablet</h2><ol><li>Open <Link href="/pos">the POS</Link> in Chrome.</li><li>Open Chrome’s menu ⋮ and choose <strong>Install and create shortcut → Install</strong>. Some versions show <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm, then launch <strong>Spoiled Brats</strong> from the home screen.</li></ol><a className="text-button" href="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en" target="_blank" rel="noreferrer">Google’s installation guide ↗</a></article>
      <article><Tablet size={26} /><h2>iPad</h2><ol><li>Open <Link href="/pos">the POS</Link> in Safari.</li><li>Tap <strong>Share → Add to Home Screen</strong>. If needed, find Share in Safari’s More menu.</li><li>Leave <strong>Open as Web App</strong> enabled if offered, then tap <strong>Add</strong>.</li><li>Open <strong>Spoiled Brats</strong> from the home screen and sign in.</li></ol><a className="text-button" href="https://support.apple.com/guide/ipad/ipad8f1f7a29/ipados" target="_blank" rel="noreferrer">Apple’s installation guide ↗</a></article>
      <article><Monitor size={26} /><h2>Windows PC</h2><ol><li>Open <Link href="/pos">the POS</Link> in Chrome or Edge.</li><li>Use the install icon in the address bar. In Chrome you can also choose <strong>⋮ → Cast, save, and share → Install page as app</strong>.</li><li>Confirm installation and pin <strong>Spoiled Brats</strong> to the taskbar if you want quick access.</li></ol><a className="text-button" href="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=en" target="_blank" rel="noreferrer">Chrome’s desktop guide ↗</a></article>
    </section>
    <section className="install-display"><div><span className="eyebrow">TABLET + CUSTOMER SCREEN</span><h2>One order. Both screens.</h2><p>Use an Android tablet or iPad as the cashier POS. On that tablet, choose <strong>Customer display → Create display link</strong>. Open the generated link on the PC, move its window to the second monitor, and select full screen.</p><p>If the cashier also uses the PC, choose <strong>Open customer window</strong> instead. Keep the cashier app open during service. Each cashier has one paired device link; a new link replaces their previous one.</p></div><div className="install-connection"><strong>Internet is required for live sales.</strong><p>Installation adds an app icon and a separate window. It uses the same shared database. It does not add offline sales or payment processing. Customer display links last eight hours and can be disconnected from POS.</p><Link className="button primary" href="/pos">Open your POS</Link><Link className="text-button" href="/pos?sample=1">Try with fictional sample records ↗</Link></div></section>
  </main>;
}
