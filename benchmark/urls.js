// Curated examples, not a statistically representative sample of student traffic.
// Labels follow focusguard/classifier.js policy; review actual captures before scoring.
// Bump this version when selection, labels, or capture expectations change.
export const FIXTURE_VERSION = '2026-10-02-v3';

const example = (id, url, gt, category, rationale) => ({ id, url, gt, category, rationale });

export const URLS = [
  example(1, 'https://en.wikipedia.org/wiki/Photosynthesis', 'allow', 'reference', 'Science reference article.'),
  example(2, 'https://en.khanacademy.org/science/ap-biology/cellular-energetics/photosynthesis/a/intro-to-photosynthesis', 'allow', 'lesson', 'Specific biology lesson, not the course landing page.'),
  example(3, 'https://stackoverflow.com/questions/11227809', 'allow', 'programming', 'Programming question about sorted-array performance; reject challenge captures.'),
  example(4, 'https://www.wolframalpha.com/input?i=integrate+x%5E2', 'allow', 'school-tool', 'Math query; distinguish input shell from a loaded answer.'),
  example(5, 'https://www.desmos.com/calculator', 'allow', 'school-tool', 'Blank graphing calculator is a legitimate school tool.'),
  example(6, 'https://quizlet.com/1121625950/official-biology-flash-cards/', 'allow', 'flashcards', 'Biology set found in search; direct research fetch returned 403, so capture needs verification.'),
  example(7, 'https://www.merriam-webster.com/dictionary/ephemeral', 'allow', 'reference', 'Specific dictionary definition.'),
  example(8, 'https://www.gutenberg.org/files/1342/1342-h/1342-h.htm', 'allow', 'literature', 'Public-domain novel and literary preface.'),
  example(9, 'https://www.gutenberg.org/ebooks/84', 'allow', 'literature', 'Frankenstein catalog and synopsis; not the full book.'),
  example(10, 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions', 'allow', 'programming', 'JavaScript functions tutorial.'),
  example(11, 'https://www.youtube.com/watch?v=NybHckSEQBI', 'allow', 'educational-video', 'Math Antics algebra lesson; compare with entertainment videos on the same platform.'),
  example(12, 'https://www.reddit.com/r/learnprogramming/comments/zedovt/what_is_code_recursion_exactly_for/', 'allow', 'educational-discussion', 'Specific programming explanation thread, not a subreddit feed.'),
  example(13, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'block', 'entertainment-video', 'Music video; block under current entertainment policy.'),
  example(14, 'https://www.reddit.com/r/gaming/comments/zzwz0d/whats_your_favorite_game_of_all_time/', 'block', 'gaming-discussion', 'Favorite-game discussion; contrast with the programming thread.'),
  example(15, 'https://www.youtube.com/', 'allow', 'policy-edge', 'Explicit bare-homepage exception; not evidence that a recommendation feed is educational.'),
  example(16, 'https://www.roblox.com/', 'block', 'gaming-landing', 'Gaming signup page; current policy explicitly blocks Roblox.'),
  example(17, 'https://www.tiktok.com/', 'block', 'social-landing', 'Social platform landing page; no logged-in feed is assumed.'),
  example(18, 'https://www.twitch.tv/', 'block', 'streaming-landing', 'Streaming platform; reject module-loading errors.'),
  example(19, 'https://store.steampowered.com/app/620/Portal_2/', 'block', 'game-shopping', 'Specific game product page rather than a changing storefront.'),
  example(20, 'https://www.instagram.com/', 'block', 'social-landing', 'Social platform landing page; no logged-in feed is assumed.'),
  example(21, 'https://news.ycombinator.com/', 'allow', 'policy-edge', 'Current policy permits news/general knowledge, regardless of a specific homework assignment.'),
  example(22, 'https://www.google.com/search?q=photosynthesis', 'allow', 'research-search', 'Educational query; a bot challenge is not a valid search-results capture.'),
  example(23, 'https://www.amazon.com/s?k=gaming+headset', 'block', 'shopping', 'Gaming-headset shopping results.'),
  example(24, 'https://claude.ai/', 'allow', 'policy-edge', 'Neutral assistant landing page allowed under uncertainty; does not test study versus off-task conversations.'),
  example(25, 'https://www.merriam-webster.com/', 'allow', 'policy-edge', 'Dictionary exception despite mixed games and reference content.'),
  example(26, 'https://poki.com/en/g/subway-surfers', 'block', 'browser-game', 'Playable endless-runner game.'),
  example(27, 'https://www.youtube.com/watch?v=h_fJAPsbPAs', 'block', 'gaming-video', 'Luke TheNotable Minecraft gameplay challenge; contrast with the algebra lesson.'),
  example(28, 'https://docs.python.org/3/tutorial/controlflow.html', 'allow', 'programming', 'Official Python tutorial covering control flow and functions.'),
  example(29, 'https://www.netflix.com/', 'block', 'streaming-landing', 'Film/TV streaming landing page, not a logged-in viewing session.'),
  example(30, 'https://open.spotify.com/', 'block', 'streaming-landing', 'Music streaming landing page under current streaming policy; capture may require JavaScript.'),
];

// Reuse a successful scrape only if its version, ID, URL, and expected label match.
// Otherwise, scrape again. This does not check content quality.
export function canReuseCapture(cached, item) {
  return Boolean(cached?.scraped === true &&
    cached.fixtureVersion === FIXTURE_VERSION &&
    cached.id === item.id && cached.url === item.url && cached.gt === item.gt);
}
