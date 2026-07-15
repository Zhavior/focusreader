#!/usr/bin/env node
/**
 * Hyperfi blog bot — drafts a post with the writer rules baked in, validates
 * it against WRITER-RULES.md requirements, and installs it into the blog.
 *
 *   node marketing/bot/generate-post.mjs --keyword "adhd can't finish reading assignments"
 *   node marketing/bot/generate-post.mjs --keyword "..." --notes "angle: exam season" --dry
 *
 * Uses the local `claude` CLI (no API key needed). Drafts that violate the
 * rules are saved to marketing/bot/drafts/ with a violation report instead
 * of being published — the layout + this validator make rule-breaking posts
 * unshippable.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RULES = fs.readFileSync(path.join(ROOT, "marketing/WRITER-RULES.md"), "utf8");
const BLOG_DIR = path.join(ROOT, "frontend/content/blog");
const DRAFT_DIR = path.join(ROOT, "marketing/bot/drafts");

// ---- args -----------------------------------------------------------------
const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const keyword = get("--keyword");
const notes = get("--notes") || "";
const dry = args.includes("--dry");
if (!keyword) {
  console.error('Usage: generate-post.mjs --keyword "target search phrase" [--notes "..."] [--dry]');
  process.exit(1);
}

// ---- prompt -----------------------------------------------------------------
const prompt = `You are the staff writer for Hyperfi, an ADHD text-to-speech study tool
("everyone else sells listening; Hyperfi sells finishing"). Write ONE complete blog post.

TARGET KEYWORD (must appear in title, first 100 words, and one H2): "${keyword}"
${notes ? `EDITOR NOTES: ${notes}` : ""}

Follow every rule in this rulebook — it is law, not guidance:
---RULEBOOK---
${RULES}
---END RULEBOOK---

OUTPUT FORMAT — output ONLY a markdown file with YAML frontmatter, no commentary:
---
title: "..."            # <= 60 chars, contains the keyword naturally
description: "..."      # <= 155 chars meta description
keyword: "${keyword}"
date: "${new Date().toISOString().slice(0, 10)}"
author: "The Hyperfi Team"
tldr:                    # 3-4 bullets; a reader who stops here still wins
  - "..."
faq:                     # 3-5 real "People Also Ask" style questions
  - q: "..."
    a: "..."             # 2-3 sentence answers, honest, no over-claiming
cta:
  text: "..."            # ONE action, framed as a <2 minute first step
  href: "/dashboard"
---
(body: 700-1000 words. H2s that carry the argument alone. Max 3 sentences per
paragraph. Exactly one **bold key phrase** in important paragraphs. Concrete
numbers over abstractions. Mention Hyperfi at most twice, shown not pitched.
Do NOT include an H1 (the layout renders the title) and do NOT add extra CTAs.)`;

// ---- generate ---------------------------------------------------------------
console.log(`Drafting post for keyword: "${keyword}" ...`);
let output = execFileSync("claude", ["-p", prompt], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
  timeout: 300000,
}).trim();

// Strip code fences if the model wrapped the file in them.
output = output.replace(/^```(?:markdown|md|yaml)?\n/, "").replace(/\n```$/, "").trim();
if (!output.startsWith("---")) {
  fail("Output does not start with YAML frontmatter", output);
}

// ---- validate against the rulebook -----------------------------------------
const violations = [];
const fmEnd = output.indexOf("\n---", 3);
const frontmatter = output.slice(0, fmEnd);
const body = output.slice(fmEnd + 4).trim();

const requireFm = (field) => {
  if (!new RegExp(`^${field}:`, "m").test(frontmatter)) violations.push(`frontmatter missing "${field}"`);
};
["title", "description", "keyword", "tldr", "faq", "cta"].forEach(requireFm);

// Rule 1: shame vocabulary ban (crude but effective net; review flags manually)
const banned = /\b(lazy|laziness|excuses?|undisciplined|just try|simply try|should have)\b/i;
const bodyParas = body.split(/\n{2,}/);
bodyParas.forEach((p, i) => {
  if (banned.test(p) && !/not (a |about )?(lazy|laziness)|isn't laziness|not laziness/i.test(p)) {
    violations.push(`possible shame language in paragraph ${i + 1}: "${p.slice(0, 80)}..."`);
  }
});

// Rule 2: TL;DR with >= 3 bullets
if ((frontmatter.match(/^\s+- /gm) || []).length < 3) violations.push("TL;DR needs >= 3 bullets");

// Rule 4: paragraph chunking (heuristic: > 4 sentences = wall of text)
bodyParas.forEach((p, i) => {
  if (p.startsWith("#") || p.startsWith("-") || p.startsWith(">")) return;
  const sentences = p.split(/(?<=[.!?])\s+/).length;
  if (sentences > 4) violations.push(`paragraph ${i + 1} has ${sentences} sentences (max ~3)`);
});

// Rule 6: no extra CTAs in body
if (/\[(sign up|try (it )?free|get started|start now)/i.test(body)) {
  violations.push("body contains an extra CTA link — the layout renders THE one CTA");
}

// SEO: keyword placement
const first100 = body.split(/\s+/).slice(0, 100).join(" ").toLowerCase();
const kwLoose = keyword.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
if (!first100.includes(kwLoose.split(" ")[0])) violations.push("keyword (or its head word) missing from first 100 words");
if (!/^## /m.test(body)) violations.push("no H2 headings found");
if (/^# /m.test(body)) violations.push("body contains an H1 — layout owns the title");

// Length
const words = body.split(/\s+/).length;
if (words < 500) violations.push(`body too short (${words} words; want 700-1000)`);

// ---- install or reject ------------------------------------------------------
const slug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

if (violations.length > 0) {
  fail(`${violations.length} rule violation(s):\n  - ${violations.join("\n  - ")}`, output);
}

if (dry) {
  console.log("\n--- DRY RUN (valid post, not written) ---\n");
  console.log(output.slice(0, 1500) + "\n...\n");
  process.exit(0);
}

const dest = path.join(BLOG_DIR, `${slug}.md`);
fs.writeFileSync(dest, output + "\n");
console.log(`✅ Post passed all rule checks → ${path.relative(ROOT, dest)}`);
console.log(`   Review it, then commit. It renders at /blog/${slug}`);

function fail(reason, draft) {
  fs.mkdirSync(DRAFT_DIR, { recursive: true });
  const draftPath = path.join(DRAFT_DIR, `${slug || "draft"}-${Date.now()}.md`);
  fs.writeFileSync(draftPath, `<!-- REJECTED:\n${reason}\n-->\n\n${draft}`);
  console.error(`\n❌ Draft rejected — ${reason}`);
  console.error(`   Saved for human review: ${path.relative(ROOT, draftPath)}`);
  process.exit(1);
}
