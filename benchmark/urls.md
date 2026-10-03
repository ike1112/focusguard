# Benchmark URL selection

Selection revised 2026-10-02. `urls.js` is the source used by `scrape.js`: 30 examples, 18 allow and 12 block. This is a curated coverage set, not a measured distribution of student browsing. Labels follow the current FocusGuard policy and are proposed expectations for intended content, not claims of human-verified captured ground truth.

Each example records a category and rationale. Existing IDs retain their general use cases; five new IDs extend coverage. Category and rationale are saved as evaluation metadata, not included in model prompts.

## Researched replacements and additions

| IDs | Source | Research evidence |
|---|---|---|
| 2 | [Khan Academy photosynthesis lesson](https://en.khanacademy.org/science/ap-biology/cellular-energetics/photosynthesis/a/intro-to-photosynthesis) | Search indexed lesson text; direct open returned a shell. Replaces broad course page; browser capture still needs review. |
| 6 | [Quizlet biology flashcards](https://quizlet.com/1121625950/official-biology-flash-cards/) | Search indexed this real set; direct open returned 403. Replaces the known deleted placeholder. Do not score a challenge/error page as flashcards. |
| 11 | [Math Antics algebra](https://www.youtube.com/watch?v=NybHckSEQBI) | YouTube search confirmed algebra topic; corrected old history description. |
| 12 | [Programming recursion discussion](https://www.reddit.com/r/learnprogramming/comments/zedovt/what_is_code_recursion_exactly_for/) | Opened actual question and explanations; replaces subreddit homepage. |
| 14 | [Favorite-game discussion](https://www.reddit.com/r/gaming/comments/zzwz0d/whats_your_favorite_game_of_all_time/) | Opened actual gaming thread; same-platform contrast with ID 12. |
| 19 | [Portal 2 product page](https://store.steampowered.com/app/620/Portal_2/) | Opened game listing; replaces changing Steam homepage. |
| 26 | [Subway Surfers on Poki](https://poki.com/en/g/subway-surfers) | Opened game page with gameplay description. |
| 27 | [100 Days — Peaceful Minecraft](https://www.youtube.com/watch?v=h_fJAPsbPAs) | YouTube search confirmed gameplay challenge; contrasts with educational video. |
| 28 | [Python control-flow tutorial](https://docs.python.org/3/tutorial/controlflow.html) | Opened official tutorial. |
| 29 | [Netflix](https://www.netflix.com/) | Opened public film/TV streaming landing page. |
| 30 | [Spotify web player](https://open.spotify.com/) | Open returned player title but no extracted text; JavaScript capture risk. |

Unchanged URLs were retained based on the prior local dataset audit, not claimed to have all been freshly opened. Homepage examples for social, streaming, and school tools are intentional. They do not stand in for signed-in feeds, private documents, or assistant conversations. AI study/off-task pairs require separately captured, consented or explicitly synthetic fixtures; no private links were invented.

## Running and interpreting

Run `node benchmark/scrape.js` from the repo root to generate the new snapshot. The existing dataset has not been overwritten by this URL-selection change. The new fixture version rejects legacy cached records; subsequent reuse requires matching ID, URL, label, and version. Bump the version when expectations change.

The scraper's known capture-quality limitations remain: it can accept challenges or empty content, capture too early, and extract text differently from production. Review generated title/excerpt pairs before benchmarking. This URL update does not make those captures automatically valid. The benchmark's missing-dataset fallback still uses its older synthetic examples; it is not this curated set.

Keep `dataset-validation.md` as the historical audit of the previous 25-row snapshot. Its ID findings and fixture-match check describe that snapshot, not future captures of these replacements.
