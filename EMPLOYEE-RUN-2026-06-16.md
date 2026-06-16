# Employee Run: 2026-06-16

**Branch:** `employee/2026-06-16-content-seo`
**Worker:** Claude Sonnet 4.6 (autonomous shift, Lane C + Lane D)
**Status:** All work staged on branch. Nothing deployed. Kaden reviews and merges.

---

## (a) Files Created / Changed

### New Blog Posts (3 created)

| File | Why |
|------|-----|
| `blog/listing-photos-vs-listing-video-west-michigan.html` | Fills video gap; pricing-awareness post that doesn't exist yet on site |
| `blog/west-michigan-real-estate-photographer-seasonal-calendar.html` | Month-by-month hyperlocal differentiator; complements the existing seasonal post without duplicating it |
| `blog/real-estate-photo-shoot-day-checklist-grand-rapids.html` | Gap topic: agent workflow from booking to MLS upload; targets agent search intent not covered by existing posts |

### SEO Edits (5 pages modified)

| File | What changed |
|------|-------------|
| `real-estate-photography-rockford.html` | Added FAQPage JSON-LD schema (4 Q&As); added inline FAQ section with 3 answered questions before the booking section |
| `real-estate-photography-east-grand-rapids.html` | Added FAQPage JSON-LD schema (4 Q&As); added inline FAQ section |
| `real-estate-photography-forest-hills.html` | Added FAQPage JSON-LD schema (4 Q&As); added inline FAQ section |
| `real-estate-photography-grand-rapids.html` | Added 2 new blog post links to the Listing Photo Resources section (shoot-day checklist + photos vs video) |
| `blog.html` | Added 3 new post cards at the top of the posts grid |

### Supporting File Updates

| File | What changed |
|------|-------------|
| `feed.xml` | Added 3 new RSS `<item>` entries; updated `lastBuildDate` |
| `sitemap.xml` | Added 3 new `<url>` entries for the new blog posts |

---

## (b) Blog Post Titles and Slugs

| Title | Slug | Tag | Image |
|-------|------|-----|-------|
| Listing Photos vs Listing Video: Do West Michigan Sellers Need Both? | `listing-photos-vs-listing-video-west-michigan` | Real Estate | DSC08881-HDR-1600.jpg |
| A West Michigan Real Estate Photographer's Seasonal Shoot Calendar | `west-michigan-real-estate-photographer-seasonal-calendar` | Real Estate | DSC08901-HDR-1600.jpg |
| The Real Estate Photo Shoot Day Checklist for Grand Rapids Agents | `real-estate-photo-shoot-day-checklist-grand-rapids` | Real Estate | DSC08468-HDR-1600.jpg |

**Gap rationale for Post 3:** The existing ~44 posts cover "how to prepare a home" (seller-facing) and "how long does a shoot take" (seller-facing), but nothing covers the full agent workflow from booking through going live on MLS. This post fills that gap with a different primary keyword ("real estate photo shoot day checklist") and targets agent search intent rather than seller intent.

---

## (c) SEO Changes Made

### Town Pages: Added FAQPage JSON-LD Schema

Three town pages (`rockford`, `east-grand-rapids`, `forest-hills`) were missing FAQPage schema entirely, despite having FAQ-style content inline (or nearby). These pages are also the thinnest (~25KB vs ~30KB for pages with FAQ schema like Lowell and Grand Haven). Changes applied:

**Rockford:**
- Added `FAQPage` schema block with 4 Q&As covering: pricing, drone, turnaround, and buyer profile
- Added inline FAQ section (3 answered questions) before the booking section for content depth

**East Grand Rapids:**
- Added `FAQPage` schema block with 4 Q&As covering: pricing, drone/LAANC, real twilight importance, Showcase package contents
- Added inline FAQ section (3 answered questions)

**Forest Hills / Cascade:**
- Added `FAQPage` schema block with 4 Q&As covering: package selection, drone availability, twilight rationale, booking
- Added inline FAQ section (3 answered questions)

### GR Money Page: Internal Link Additions

Added 2 new blog links to the "Listing Photo Resources" section:
- `blog/real-estate-photo-shoot-day-checklist-grand-rapids.html` — "Shoot day checklist for agents"
- `blog/listing-photos-vs-listing-video-west-michigan.html` — "Listing photos vs listing video"

### Meta Descriptions: Audited, No Changes Needed

All audited pages have meta descriptions in the 140-155 char target range:
- Grand Rapids: 148 chars
- Grand Haven: 150 chars
- Lowell: 153 chars
- Forest Hills: 151 chars
- East GR: 140 chars

### Image Alt Text: Audited, No Changes Needed

Town page images have descriptive alt text. GR money page hero images have keyword-appropriate alt text. No empty alts found on content images (Meta Pixel noscript `alt=""` is intentional and correct).

---

## (d) GO Sheet — Review, Merge, and Deploy

### Review the branch

```bash
cd /Users/kaden/Desktop/elzingacreativestudio.com
git checkout employee/2026-06-16-content-seo
git diff main --stat
```

Preview any blog post locally:
```bash
open blog/listing-photos-vs-listing-video-west-michigan.html
open blog/west-michigan-real-estate-photographer-seasonal-calendar.html
open blog/real-estate-photo-shoot-day-checklist-grand-rapids.html
```

Check the town page SEO changes:
```bash
open real-estate-photography-rockford.html
open real-estate-photography-east-grand-rapids.html
open real-estate-photography-forest-hills.html
```

### Merge and deploy

```bash
git checkout main
git merge employee/2026-06-16-content-seo
git push origin main
```

GitHub Pages + Fastly auto-deploys on push to main. Posts go live immediately.

### After deploying

1. Go to Google Search Console → Sitemaps → submit `https://elzingacreativestudio.com/sitemap.xml` (already updated on branch)
2. Request indexing for each new blog post URL in GSC (optional, speeds up discovery)
3. The RSS feed at `/feed.xml` is already updated — any RSS subscriber/aggregator will pick up the 3 new posts automatically

### Nothing to do for the blog posts themselves

Each post is a complete standalone `.html` file placed in `blog/`. The `blog.html` index already has the 3 new post cards added. No CMS step, no build step required — it's all static HTML.

---

## Notes

- No fabricated stats, reviews, or credentials used anywhere. All pricing figures match the published ECS pricing ($245/$325/$495, add-ons at stated prices).
- All internal links point to real pages that exist in the repo.
- External links in posts are to verifiable real sources: Rockford city website, FAA LAANC system.
- The `best-time-of-year-real-estate-photos-michigan.html` post already covers season-by-season broadly; the new seasonal calendar post is differentiated by going month-by-month (12 months, not 4 seasons) and by focusing on the photographer's decision-making process rather than the seller's timing question.
- Risky/uncertain changes documented here rather than applied: the GR money page title tag (`Grand Rapids Real Estate Photography | Elzinga Creative Studio`) is already well-optimized at 56 chars; no change made. The LocalBusiness schema lives on `index.html` and is referenced by `@id` on service pages — this is the correct pattern, no change needed.
