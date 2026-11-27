import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Spoiled Brats Café",
    short_name: "Spoiled Brats",
    description: "Coffee shop POS, finances, inventory, and team attendance.",
    start_url: "/pos",
    scope: "/",
    display: "standalone",
    background_color: "#1c1b20",
    theme_color: "#1c1b20",
    lang: "en-PH",
    icons: [
      { src: "/app-icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "Point of sale", url: "/pos", description: "Open the cashier counter" },
      { name: "Finance tracker", url: "/", description: "Open the shop workspace" },
    ],
  };
}
