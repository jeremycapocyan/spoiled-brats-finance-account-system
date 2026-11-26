import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";
export const metadata: Metadata = {
  title: "Spoiled Brats | Coffee & accounts",
  description: "Your daily coffee shop finances, inventory, and team hours in one place.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
