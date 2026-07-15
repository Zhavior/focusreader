import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FocusReader — Reading Made Listenable",
    short_name: "FocusReader",
    description:
      "Neural-voiced audio for PDFs, articles & textbooks. Built for hyperfocus.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0d10",
    theme_color: "#0b0d10",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
