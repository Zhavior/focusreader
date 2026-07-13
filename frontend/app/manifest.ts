import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FocusReader — ADHD Text to Speech",
    short_name: "FocusReader",
    description:
      "Turn boring PDFs and textbooks into dopamine-optimized audio tracks.",
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
