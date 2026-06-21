import type { MetadataRoute } from "next";

// Web App Manifest — makes the app installable on a phone home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atomic Habits",
    short_name: "Atomic",
    description: "Build habits and run a shared home, together.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfbfd",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
