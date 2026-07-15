import Link from "next/link";
import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { listPosts } from "@/lib/blog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "The FocusReader Blog — Finish Your Reading",
  description:
    "ADHD-friendly reading strategies, honest tool comparisons, and the science of actually finishing what you start.",
};

export default function BlogIndexPage() {
  const posts = listPosts();

  return (
    <main className="min-h-screen bg-[#0b0d10] px-4 py-16">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          Finish your reading.
        </h1>
        <p className="mt-3 text-neutral-400">
          Strategies, science, and honest tool talk for brains that don&apos;t do boring.
          Every post has a TL;DR — skimming is a feature here.
        </p>

        <div className="mt-12 space-y-6">
          {posts.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-neutral-600">
              First posts landing soon.
            </p>
          )}
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-2xl border border-white/10 bg-[#131619] p-6 transition hover:border-indigo-500/40"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                {post.keyword}
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
                {post.title}
              </h2>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-400">
                {post.description}
              </p>
              <p className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                <Clock className="h-3.5 w-3.5" />
                {post.readingMinutes} min · {post.date}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
