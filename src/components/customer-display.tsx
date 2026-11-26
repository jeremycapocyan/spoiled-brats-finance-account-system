"use client";
import { useEffect, useState } from "react";
import { Coffee, Maximize, CheckCircle2 } from "lucide-react";
import { money } from "@/lib/model";
import { sanitizeDisplay, type DisplaySnapshot } from "@/lib/pos";
import { Brand } from "./brand";
export function CustomerDisplay(){
  const [snapshot,setSnapshot]=useState<DisplaySnapshot|null>(null),[error,setError]=useState(""),[connection,setConnection]=useState("");
  useEffect(()=>{const change=()=>setConnection(location.hash);change();window.addEventListener("hashchange",change);return()=>window.removeEventListener("hashchange",change);},[]);
  useEffect(()=>{
    if(!connection)return;setSnapshot(null);setError("");
    const params=new URLSearchParams(connection.slice(1)),token=params.get("token"),local=params.get("local");let alive=true,channel:BroadcastChannel|null=null,last=Date.now(),polling=false;
    function accept(data:unknown){try{const clean=sanitizeDisplay(data);if(alive){setSnapshot(clean);setError("");last=Date.now();}}catch{if(alive)setSnapshot(null);}}
    if(local&&/^[\da-f-]{36}$/i.test(local)){channel=new BroadcastChannel("spoiled-pos-"+local);channel.onmessage=e=>accept(e.data);channel.postMessage({type:"request"});}
    async function poll(){
      if(!token||polling)return;polling=true;
      try{const r=await fetch("/api/pos/display",{headers:{"x-display-token":token},cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Display disconnected.");if(d.snapshot)accept(d.snapshot);else if(alive){setSnapshot(null);setError("");}}
      catch(e){if(alive){setSnapshot(null);setError((e as Error).message);}}finally{polling=false;}
    }
    if(token)poll();else if(!local)setError("Open or pair this display from the cashier POS.");
    const timer=setInterval(()=>{if(token)poll();else if(Date.now()-last>90000)setSnapshot(null);},2000);
    return()=>{alive=false;clearInterval(timer);channel?.close();};
  },[connection]);
  const showing=snapshot&&snapshot.status!=="welcome"&&snapshot.lines.length>0;
  return <main className="customer-display"><header><Brand/><button className="icon-button" aria-label="Full screen" onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}><Maximize size={23}/></button></header><div className="display-layout"><section className="display-greeting"><span className="eyebrow">GOOD COFFEE. YOUR WAY.</span><h1>{snapshot?.status==="paid"?"Made with love.":"Your daily dose of spoiled."}</h1><div className="display-coffee" aria-hidden="true"><Coffee size={130} strokeWidth={.8}/></div><p>{snapshot?.status==="paid"?"Thank you! Your order is on its way.":"A little pause. A great cup. Welcome to Spoiled Brats Café."}</p>{snapshot?.sample&&<span className="badge">SAMPLE DISPLAY · FICTIONAL ORDER</span>}</section><section className="display-order">{showing?<><div className="display-order-title"><span className="eyebrow">{snapshot.status==="paid"?"PAYMENT RECEIVED":"YOUR ORDER"}</span>{snapshot.status==="paid"&&<CheckCircle2 size={27}/>}</div><h2>{snapshot.status==="paid"?"All set. Thank you!":"Looking good."}</h2><div className="display-lines">{snapshot.lines.map((l,i)=><div key={i}><span className="display-qty">{l.qty}×</span><span>{l.name}</span><strong>{money(l.amount)}</strong></div>)}</div><div className="display-total"><span>{snapshot.status==="paid"?"Total paid":"Total due"}</span><strong>{money(snapshot.total)}</strong></div><p className="display-note">{snapshot.status==="paid"?"See you again for another cup.":"Please check your order before paying."}</p></>:<div className="display-welcome"><span className="eyebrow">FRESHLY BREWED, EVERY DAY</span><h2>Something good<br/>is brewing.</h2><p>Your order will appear here.</p>{error&&<small role="status">{error}</small>}</div>}</section></div><footer>Spoiled Brats Café <span>Take a sip. Stay a little.</span></footer></main>;
}
