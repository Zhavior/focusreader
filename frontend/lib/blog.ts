import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

/**
 * File-based blog: markdown files in content/blog/, one file per post.
 * Frontmatter is the contract the generation bot must satisfy — the layout
 * renders WRITER-RULES requirements (TL;DR, time estimate, FAQ, single CTA)
 * from these fields, so a post missing them cannot ship.
 */
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  keyword: string;
  date: string;
  author: string;
  tldr: string[];
  faq: { q: string; a: string }[];
  cta: { text: string; href: string };
  readingMinutes: number;
  html: string;
}

function blogDir(): string {
  return path.join(process.cwd(), "content", "blog");
}

/** ~230 wpm adult average; ADHD readers skim — we show both numbers in UI. */
function readingMinutes(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

export function listPosts(): BlogPost[] {
  if (!fs.existsSync(blogDir())) return [];
  return fs
    .readdirSync(blogDir())
    .filter((f) => f.endsWith(".md"))
    .map((f) => loadPost(f.replace(/\.md$/, "")))
    .filter((p): p is BlogPost => p !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function loadPost(slug: string): BlogPost | null {
  const file = path.join(blogDir(), `${slug}.md`);
  if (!fs.existsSync(file)) return null;

  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  if (!data.title || !Array.isArray(data.tldr) || !data.cta) return null;

  return {
    slug,
    title: String(data.title),
    description: String(data.description ?? ""),
    keyword: String(data.keyword ?? ""),
    date: String(data.date ?? new Date().toISOString().slice(0, 10)),
    author: String(data.author ?? "The Hyperfi Team"),
    tldr: (data.tldr as string[]).map(String),
    faq: Array.isArray(data.faq)
      ? (data.faq as { q: string; a: string }[]).map((x) => ({
          q: String(x.q),
          a: String(x.a),
        }))
      : [],
    cta: { text: String(data.cta.text), href: String(data.cta.href) },
    readingMinutes: readingMinutes(content),
    html: marked.parse(content, { async: false }) as string,
  };
}
