import type { Metadata } from "next";
import { CustomerDisplay } from "@/components/customer-display";
export const metadata:Metadata={title:"Spoiled Brats Café | Your order",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function DisplayPage(){return <CustomerDisplay/>;}
