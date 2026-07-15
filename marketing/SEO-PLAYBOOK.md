# Hyperfi SEO Playbook — How We Actually Get Google Hits

> Companion to COMPETITOR-LANDSCAPE (what to write) and WRITER-RULES (how to
> write it). This doc is the third leg: **how Google finds it, ranks it, and
> sends people**. Includes video ("vlog") strategy — video and blog are one
> system, not two channels.
>
> Reality check up front: SEO compounds on a 3–6 month delay. Publish weekly
> for a quarter before judging anything. TikTok/shorts bring visitors THIS
> week; Google brings them forever. Do both.

---

## 1. The keyword ladder — fight where we can win

Speechify owns "text to speech" (head term, unwinnable for ~2 years). We climb
from the bottom:

**Tier 1 — winnable in 1–3 months (long-tail, low competition, HIGH intent):**
- "how to finish reading with adhd"
- "adhd can't finish reading assignments"
- "text to speech for adhd students"
- "speechify alternative for adhd"
- "listen to textbook while reading along"
- "brown noise while studying adhd"
- "pdf to audio with word highlighting"

**Tier 2 — winnable at ~20 posts + some backlinks (3–9 months):**
- "speechify vs [every rival]" comparisons
- "best text to speech for students 2026"
- "adhd study tools that work"
- "bionic reading app"

**Tier 3 — the prize (year+):** "adhd reading app", "text to speech chrome extension"

**Rule: one post = one primary keyword.** Primary keyword goes in: URL slug,
H1, first 100 words, one H2, and the meta title. Never twice in the H1 —
Google's spam systems and ADHD readers hate the same things.

**Free research workflow (no ahrefs budget needed):** type seed phrases into
Google → harvest Autocomplete, "People Also Ask", and "Related searches" →
each PAA question becomes an H2 or FAQ entry. Reddit r/ADHD thread titles are
literal keyword gold — people search the way they post.

---

## 2. On-page template (every post, no exceptions)

- **Meta title** ≤60 chars: `{Keyword}: {specific promise} ({year})` — e.g.
  *"Can't Finish Reading With ADHD? The 26-Minute Method (2026)"*
- **Meta description** ≤155 chars, contains keyword, ends with a reason to click.
- **URL**: `/blog/finish-reading-adhd` — 3–5 words, no dates.
- **H1** = title. H2s = the actual questions people ask (pull from PAA).
- **First 100 words**: keyword once, promise stated, TL;DR box (WRITER-RULES
  Rule 2 — our accessibility rules are ALSO ranking signals: chunking, headers,
  and short paragraphs reduce pogo-sticking, and dwell time is the metric).
- **One image minimum** with descriptive alt text; compress it. Product
  screenshots beat stock photos for trust AND image search.
- **FAQ section** (3–5 PAA questions) + FAQPage schema → wins the dropdown
  real estate under search results.
- **Internal links**: every post links to 2–3 sibling posts AND one product
  page with descriptive anchors ("time math feature", not "click here").
  Pillar C posts (traffic) must link down to Pillar A/B posts (conversion).

## 3. Technical SEO — code tasks (Claude can ship these in one session)

1. `app/sitemap.ts` + `app/robots.ts` (Next.js metadata API) — **must-have**
2. Per-post `generateMetadata()` with OpenGraph + Twitter cards
3. JSON-LD schema: `Article` + `FAQPage` per post, `SoftwareApplication` on
   the homepage (name, price $19/mo, ratings when real)
4. Blog infra itself: MDX blog under `/blog` with an index page (doesn't exist yet)
5. Core Web Vitals pass (the site is already fast; verify with PageSpeed after deploy)
6. Google Search Console + GA4 (or privacy-friendly Plausible) wired on day one
   of deploy — GSC is where we learn which queries we ALMOST rank for (position
   8–20 = priority rewrite list, the highest-ROI work in SEO)

## 4. The vlog: video = second front door

YouTube is the #2 search engine and its results embed in Google's page one.
Our product is *visually demonstrable* — that's an unfair advantage in a
category full of talking heads.

- **Format that fits ADHD creators AND viewers**: 3–8 min screen-share demos,
  no long intros — cold-open on the payoff ("this 47-min chapter is about to
  become 26"), then how.
- **Every blog post gets a sibling video; every video description links the
  post; the post embeds the video.** Google sees a content hub; viewers pick
  their medium; dwell time rises on both.
- **Video titles = same keyword ladder** ("How I Finish ADHD Reading
  Assignments — full method"). Say the keyword out loud in the first 15 seconds
  (YouTube transcripts are indexed).
- **Shorts/TikTok clips** cut from each video: the karaoke highlight moment,
  the checkpoint chime, the time-math reveal. 3 clips per video minimum.
  Captions ALWAYS on (huge ADHD audience overlap + sound-off viewing).
- Add `VideoObject` schema on posts with embeds → eligible for video rich results.

## 5. Backlinks — the honest, non-sleazy list

Links are still the strongest ranking lever. In priority order:
1. **ADHD tool directories & "best of" listicles** — email the authors of
   existing "best ADHD apps" posts; offer a free year + a genuinely useful blurb.
2. **HARO / journalist requests** (founder-with-ADHD-tool angle is press-friendly).
3. **Student disability office resource pages** (.edu links are gold; offer edu discount).
4. **Guest posts** on ADHD coach blogs / student-life sites (bring data, not fluff).
5. **Launch posts**: Product Hunt, Hacker News "Show HN", BetaList — each is a
   real domain-authority link plus a traffic spike.
6. **Publish original data** once we have users: "We measured completion rates
   across 10,000 reading sessions" — data earns links passively for years.

## 6. E-E-A-T — why Google should believe us

Google weighs Experience/Expertise/Authority/Trust heavily for anything
health-adjacent (ADHD qualifies):
- Real author byline with bio + photo on every post ("built by someone who
  couldn't finish their own readings" is *Experience* — lead with it).
- About page telling the founder story; privacy policy; visible contact.
- Cite primary sources (journals, not other blogs). WRITER-RULES Rule 7 is
  also an E-E-A-T requirement.
- Never publish pure-AI slop. AI-drafted is fine; unedited is detectable and
  this niche will call it out by name.

## 7. Cadence & measurement

**Weekly rhythm (pick a sustainable one — consistency beats bursts):**
1 blog post + 1 sibling video + 3 shorts, all from the same research effort.

**The four numbers that matter (check monthly, not daily):**
| Metric | Where | Healthy at month 3 |
|---|---|---|
| Impressions trend | GSC | Up and to the right (any absolute number) |
| Queries at position 8–20 | GSC | ≥10 (this is the rewrite goldmine) |
| Signups attributed to blog | GA4/Plausible | ≥1 (proves the pipe works) |
| Email captures | newsletter tool | List of any size — the algorithm-proof asset |

**Quarterly:** rewrite the top-3 "almost ranking" posts before writing new
ones. Updating old posts is 3–5x more efficient than new posts once you have
twenty.

---

## The single most important sentence in this document
Nothing in this playbook works until the site is deployed on a real domain —
Google cannot index localhost. SEO clock starts at deploy, so deploy starts the
clock, not the content.
