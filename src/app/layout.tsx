import type { Metadata, Viewport } from "next";
import { AppRuntime } from "@/components/app-runtime";
import "./globals.css";
import "./brand.css";
import "./install.css";
export const metadata: Metadata = {
  title: "Spoiled Brats | Coffee & accounts",
  description: "Your daily coffee shop finances, inventory, and team hours in one place.",
  applicationName: "Spoiled Brats Café",
  appleWebApp: { capable: true, title: "Spoiled Brats", statusBarStyle: "black" },
  icons: { icon: [{ url: "/app-icons/192", sizes: "192x192", type: "image/png" }], apple: [{ url: "/app-icons/180", sizes: "180x180", type: "image/png" }] },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1c1b20" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><AppRuntime>{children}</AppRuntime></body></html>;
}
