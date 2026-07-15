import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Clock, Zap } from "lucide-react";
import { listPosts, loadPost } from "@/lib/blog";

export const dynamic = "force-static";

export function generateStaticParams() {
  return listPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = loadPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | Hyperfi`,
    description: post.description,
    keywords: post.keyword,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = loadPost(slug);
  if (!post) notFound();

  // SEO-PLAYBOOK §3: Article + FAQPage rich results.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      author: { "@type": "Person", name: post.author },
    },
    post.faq.length > 0 && {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-[#0b0d10] px-4 py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto w-full max-w-2xl">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-indigo-300"
        >
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>

        {/* Header: keyword tag, H1, byline, TIME ESTIMATE (Rule 3) */}
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">
          {post.keyword}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {post.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
          <span>{post.author}</span>
          <span aria-hidden>·</span>
          <time dateTime={post.date}>{post.date}</time>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300"
            title="Skim the TL;DR and bold text for the 2-minute version"
          >
            <Clock className="h-3.5 w-3.5" />
            {post.readingMinutes} min read · ~2 min at the TL;DR
          </span>
        </div>

        {/* TL;DR box (Rule 2): readers who stop here still got the value */}
        <aside className="mt-8 rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.07] p-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-300">
            TL;DR
          </p>
          <ul className="space-y-2">
            {post.tldr.map((line, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-neutral-200">
                <span className="mt-1 text-indigo-400" aria-hidden>▸</span>
                {line}
              </li>
            ))}
          </ul>
        </aside>

        {/* Body: chunked typography (Rule 4) via arbitrary-variant styling */}
        <div
          className="mt-10 text-[16.5px] leading-[1.85] text-neutral-300
            [&>h2]:mt-12 [&>h2]:mb-4 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:tracking-tight [&>h2]:text-white
            [&>h3]:mt-8 [&>h3]:mb-3 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-white
            [&>p]:mb-6
            [&_strong]:font-semibold [&_strong]:text-indigo-200
            [&>ul]:mb-6 [&>ul]:space-y-2 [&>ul]:pl-5 [&>ul>li]:list-disc [&>ul>li]:marker:text-indigo-400
            [&>ol]:mb-6 [&>ol]:space-y-2 [&>ol]:pl-5 [&>ol>li]:list-decimal
            [&_a]:text-indigo-300 [&_a]:underline [&_a]:decoration-indigo-500/40 [&_a]:underline-offset-4 hover:[&_a]:text-indigo-200
            [&>blockquote]:mb-6 [&>blockquote]:border-l-2 [&>blockquote]:border-indigo-500/50 [&>blockquote]:pl-4 [&>blockquote]:text-neutral-400"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        {/* FAQ (SEO: matches the FAQPage schema above) */}
        {post.faq.length > 0 && (
          <section className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Questions people actually ask
            </h2>
            <div className="mt-6 space-y-4">
              {post.faq.map((f, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-white/10 bg-[#131619] p-5 open:border-indigo-500/30"
                >
                  <summary className="cursor-pointer list-none font-semibold text-neutral-100 marker:content-none">
                    {f.q}
                  </summary>
                  <p className="mt-3 leading-relaxed text-neutral-400">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* THE single CTA (Rule 6) framed as a <2-minute first step (Rule 10) */}
        <aside className="mt-14 rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-500/15 to-purple-500/10 p-8 text-center">
          <Zap className="mx-auto h-8 w-8 text-indigo-400" />
          <p className="mx-auto mt-4 max-w-md text-lg font-semibold text-white">
            {post.cta.text}
          </p>
          <Link
            href={post.cta.href}
            className="mt-5 inline-block rounded-full bg-indigo-600 px-8 py-3 font-bold text-white shadow-[0_0_30px_-8px_rgba(99,102,241,0.6)] transition hover:bg-indigo-500"
          >
            Try it free — takes 2 minutes
          </Link>
          <p className="mt-3 text-xs text-neutral-500">
            5,000 free characters. No card.
          </p>
        </aside>
      </article>
    </main>
  );
}
