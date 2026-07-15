import type { MetadataRoute } from "next";
import { listPosts } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/blog`, changeFrequency: "weekly", priority: 0.9 },
    ...listPosts().map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: p.date,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
