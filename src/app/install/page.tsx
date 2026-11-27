import type { Metadata } from "next";
import { InstallApp } from "@/components/install-app";
export const metadata: Metadata = { title: "Install Spoiled Brats Café", description: "Add the café POS to your Android tablet, iPad or Windows desktop." };
export default function InstallPage() { return <InstallApp />; }
