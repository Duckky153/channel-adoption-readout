# Channel Adoption Readout

A two-page static site that answers one question: which channels and pages brought people who kept using a product, not just visitors. All data is synthetic. The made-up subject is a free-to-start, open-source workflow product with a cloud signup and a demo-request form, tracked over Weeks 1-8 with no calendar dates.

- **Page 1, the readout (`index.html`):** one result sentence at the top, then a sortable table of 13 sources with a verdict for each (Adoption, Mixed, Attention only, or Too early to judge), a share-of-visits versus share-of-activated chart, a weekly spike view, an exceptions list, the open-source panel, the eight rules with live counts, the assumptions, and the questions to answer before trusting this on real data.
- **Page 2, next tests (`next-tests.html`):** which topics' readers kept using the product, three tests with the win bar set before they start, and a weekly check table with synthetic week 1 numbers.

## How it works, in plain English

Each of the 3,153 synthetic signups has a list of up to three tracked posts or pages it came through, in order, plus how many times its workflows ran in the first 7 days, its email type, company size, and whether it asked for a demo. The page runs eight rules over those rows every time a control changes.

1. **Credit:** each signup gives exactly one credit, to the first page it came through (or the last one, if you flip the switch), so credits always add up to total signups.
2. **No source:** a signup with no recorded touch stays in "No source" and is never spread across the channels to make them look bigger.
3. **Activated:** a signup counts as activated when its workflows ran at least 3 times in its first 7 days, because one test run is curiosity and repeated runs mean it's doing real work; the selector changes 3 to 1 or 5 and highlights any verdict that flips.
4. **Qualified demo:** a demo request counts only with a work email, a company of 201 or more people and a stated use case, and repeat requests from one company count once.
5. **Too early:** a source with fewer than 30 credited signups shows "Too early to judge" instead of a verdict, because a few people can swing its rate.
6. **Verdict:** a source is "Adoption" when its activated signups per 1,000 visits are at or above the overall rate, "Attention only" when its share of visits is at least twice its share of activated signups, and "Mixed" in between.
7. **Held burst:** 15 or more signups from one company domain on one day are held as likely one team testing, left out of the rates, and listed under Exceptions.
8. **Open source:** repository stars and self-host install pings can't be tied to a person, so they get their own panel and are never added to signups.

Page 2 reuses the same rules. Its win bar is the median activated per 1,000 visits of today's Adoption sources, the stop line is half of that, and no test is judged before it has both 60 signups and 3 weeks.

With the default view (first touch, 3 runs) the top sentence reads: "The launch post brought 38% of visits but 12% of activated signups; integration how-to pages brought 6% of visits and 22% of activated signups, and comparison pages produced 11 of the 29 qualified demos." The spike view shows week 3: 72% of signups came from the launch post, and 8% of them activated.

## Assumptions

- The data comes from a seeded random generator (mulberry32, seed 20261002) in `data.js`, built from per-source targets, so every refresh shows the same numbers. Company domains end in `.example`, a reserved test domain.
- Visits are counted per source per week and don't move between credit views; only signups, activations and demos move.
- The overall rate and both shares include No source signups, because those people are real, even though No source is never credited to a channel.
- Held signups are left out of every rate, share and demo count. They still appear in the reconciliation line, the spike chart and Exceptions.

## How to run

- **View it:** double-click `index.html`. It works straight from disk or on GitHub Pages. There is no build step, no libraries, no fonts from the web, no network calls, no accounts and no analytics.
- **Test it:** from this folder, run `node tests/run-tests.mjs` (plain Node 18 or newer, no packages). The tests check the data targets, every rule, both credit views, the result sentence, page 2's plan and the copy rules.

## Files

- `index.html`, `app.js`: page 1 and its rendering.
- `next-tests.html`, `next.js`: page 2 and its rendering.
- `readout.mjs`: every rule and number, shared by both pages and the tests.
- `data.js`: the synthetic data generator.
- `style.css`: shared light and dark styles.
- `tests/run-tests.mjs`: the tests.

## Limits

- The data is synthetic and tuned to tell a clear story; real channel data will be noisier.
- Not modeled: paid conversion, revenue, sales cycle length, accounts with several users, people who switch devices, and how long activated people keep going after the first week.
- First and last touch are the only credit models; there is no split credit.
- An analytics tool already draws funnels. The value here is the rules on top: one credit per signup, a clear activation line, a qualified-demo filter, a too-early flag and a held-burst check. On real data, the first step is agreeing on what counts as activated.

Built by Dakshit Raj with Claude Code and Codex.
