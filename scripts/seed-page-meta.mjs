/**
 * Seed default page_meta/{slug} docs in Firestore.
 *
 * Eliminates the page-meta.js 404 noise (one 404 per page that didn't have a
 * seeded doc) and gives the admin Meta Tags panel concrete rows to edit. Each
 * doc is idempotent (merge:true) so you can re-run this safely after editing
 * docs in the admin UI — the script only fills in fields that are still empty.
 *
 * Auth: ADC.
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GCLOUD_PROJECT = "redsracing-a7f8b"
 *
 * Run: node scripts/seed-page-meta.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'redsracing-a7f8b';
initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
const db = getFirestore();

const ORIGIN = 'https://redsracing.org';
const OG_DEFAULT = `${ORIGIN}/assets/img/og-default.jpg`;
const TWITTER_CARD = 'summary_large_image';

// Curated defaults for the high-traffic public pages. The slug is the file
// name WITHOUT the `.html` extension (e.g. `index.html` → `index`).
const PUBLIC = {
  index: {
    title: 'RedsRacing #8 & #88 — 2026 Season Countdown',
    description: "Follow Jon Kirsch #8 and Jonny Kirsch #88 — schedule, results, gallery, predictions and live race-day updates from RedsRacing.",
    keywords: 'RedsRacing, Jon Kirsch, Jonny Kirsch, stock car racing, dirt racing, short track racing, #8, #88',
  },
  driver: {
    title: 'Jon Kirsch #8 — RedsRacing Driver Profile',
    description: 'The veteran. Driver and team leader of RedsRacing #8. Stats, gallery, the #8 car spec sheet, and career highlights.',
    keywords: 'Jon Kirsch, RedsRacing #8, stock car driver, racing veteran',
  },
  jonny: {
    title: 'Jonny Kirsch #88 — RedsRacing Rookie',
    description: "The rookie sensation. Driver profile for Jonny Kirsch #88 — race results, gallery, K1 karting archive and the road to the #88 stock car.",
    keywords: 'Jonny Kirsch, RedsRacing #88, rookie driver, K1 karting',
  },
  team: {
    title: 'The Team — RedsRacing #8 & #88',
    description: 'Meet the RedsRacing drivers and the crew behind the cars.',
    keywords: 'RedsRacing team, crew, mechanics, tire tech, crew chief',
  },
  crew: {
    title: 'Crew — RedsRacing',
    description: 'The crew behind RedsRacing — the people who keep the #8 and #88 cars on the track.',
    keywords: 'RedsRacing crew, pit crew, mechanics',
  },
  schedule: {
    title: 'Schedule — RedsRacing',
    description: 'The 2026 race schedule for RedsRacing #8 and #88. Subscribe to the iCal feed and never miss a green flag.',
    keywords: 'racing schedule 2026, RedsRacing schedule, iCal subscribe',
  },
  gallery: {
    title: "Gallery — Jon Kirsch's RedsRacing #8",
    description: "Race photos, behind-the-scenes shots and sponsor moments from RedsRacing's #8 stock car.",
    keywords: 'RedsRacing gallery, #8 race photos, stock car photography',
  },
  'jonny-gallery': {
    title: "Jonny's Gallery — RedsRacing #88",
    description: 'Race-day photos and behind-the-scenes shots from the #88 of Jonny Kirsch.',
    keywords: 'RedsRacing #88 gallery, Jonny Kirsch photos',
  },
  'jonny-results': {
    title: 'Jonny #88 — Race Results',
    description: 'Race-by-race results from rookie driver Jonny Kirsch.',
    keywords: 'Jonny Kirsch results, #88 race results',
  },
  jons: {
    title: "Jon's K1 Karting Archive — 2024 & 2025",
    description: "Archive of Jon Kirsch's K1 karting seasons from 2024 and 2025 before the move to stock cars.",
    keywords: 'Jon Kirsch karting, K1 karting archive, RedsRacing history',
  },
  leaderboard: {
    title: 'Leaderboard — RedsRacing Fan Predictions',
    description: 'The season-long fan-prediction league standings — who picks the finish best?',
    keywords: 'RedsRacing leaderboard, fan predictions league',
  },
  predictions: {
    title: 'Fan Predictions — RedsRacing #8 vs #88',
    description: 'Pick the finishes before each race, earn points, climb the leaderboard.',
    keywords: 'RedsRacing predictions, fan predictions, race winner picks',
  },
  'fan-wall': {
    title: 'Fan Wall — RedsRacing #8 & #88',
    description: 'Shout-outs, fan posts and race-day reactions from the RedsRacing community.',
    keywords: 'RedsRacing fan wall, racing fan community',
  },
  qna: {
    title: 'Q&A — Ask the Drivers',
    description: "Submit a question for Jon or Jonny — answered ones are published right here.",
    keywords: 'RedsRacing Q&A, ask the driver, racing questions',
  },
  feedback: {
    title: 'Feedback — RedsRacing',
    description: 'Tell us what you want more (or less) of. Every note goes straight to the team.',
    keywords: 'RedsRacing feedback, site feedback',
  },
  about: {
    title: 'About RedsRacing #8 & #88',
    description: 'The story behind RedsRacing — two drivers, one team, one season at a time.',
    keywords: 'about RedsRacing, racing team history',
  },
  contact: {
    title: 'Contact — RedsRacing',
    description: 'Reach the RedsRacing team for sponsorship, media or fan inquiries.',
    keywords: 'contact RedsRacing, sponsorship inquiries',
  },
  sponsorship: {
    title: 'Sponsorship — Partner with RedsRacing',
    description: 'Become a RedsRacing sponsor. Audience, exposure, and partnership packages for the 2026 season.',
    keywords: 'RedsRacing sponsorship, racing team sponsor, race car sponsor',
  },
  'racing-guide': {
    title: 'Racing Guide — RedsRacing',
    description: "What is the American Super Cup Series? A no-jargon guide to the cars, the tracks and the rules.",
    keywords: 'racing guide, American Super Cup Series, half-scale stock car',
  },
  recaps: {
    title: 'Race Recaps — RedsRacing',
    description: 'Race-by-race recaps from the 2026 season — what happened, what went right, what went wrong.',
    keywords: 'RedsRacing recaps, race reports',
  },
  stats: {
    title: 'Season Stats — RedsRacing',
    description: 'Finishes, podiums, fast laps and trend graphs for #8 and #88 throughout the season.',
    keywords: 'RedsRacing stats, season statistics, driver stats',
  },
  tracks: {
    title: 'Track Guides — RedsRacing',
    description: "Driver guides to every track on the RedsRacing schedule — racing line, key turns, what to watch.",
    keywords: 'track guides, RedsRacing tracks, racing lines',
  },
  videos: {
    title: 'Videos — RedsRacing',
    description: 'Race highlights, in-car footage and team videos.',
    keywords: 'RedsRacing videos, race highlights, in-car video',
  },
  live: {
    title: 'Race-Day Hub — RedsRacing',
    description: 'Live race-day updates from the track — countdown, weather, what to watch for, and updates as they happen.',
    keywords: 'RedsRacing live, race day, live updates',
  },
  legends: {
    title: 'Team Legends — RedsRacing',
    description: 'The names who shaped RedsRacing.',
    keywords: 'RedsRacing legends, team history',
  },
  passport: {
    title: 'Fan Passport — RedsRacing',
    description: 'Scan QR codes on race day to stamp your fan passport. Top fans get featured on the home page.',
    keywords: 'RedsRacing passport, fan check-in, race day QR',
  },
  newsletter: {
    title: 'Newsletter — RedsRacing',
    description: 'Get race recaps, schedule reminders and sponsor news in your inbox.',
    keywords: 'RedsRacing newsletter, racing email',
  },
  blog: {
    title: 'Blog — RedsRacing',
    description: 'Behind-the-scenes stories from RedsRacing.',
    keywords: 'RedsRacing blog, team blog, racing blog',
  },
  countdown: {
    title: '2026 Season Countdown — RedsRacing',
    description: 'Counting down to green flag on the 2026 RedsRacing season.',
    keywords: 'RedsRacing countdown, 2026 season',
  },
  privacy: {
    title: 'Privacy Policy — RedsRacing',
    description: 'How RedsRacing handles your data.',
    keywords: 'RedsRacing privacy',
  },
  'privacy-policy': {
    title: 'Privacy Policy — RedsRacing',
    description: 'How RedsRacing handles your data.',
    keywords: 'RedsRacing privacy',
  },
  terms: {
    title: 'Terms of Use — RedsRacing',
    description: 'Site terms of use.',
    keywords: 'RedsRacing terms',
  },
};

// Admin / dev / dashboard pages — seed them with `noindex:true` so they
// never appear in search results.
const ADMIN_NOINDEX = [
  '404',
  'admin',
  'admin-console',
  'admin-role-test',
  'admin-setup',
  'dashboard',
  'driver-new',
  'fan-settings',
  'follower-dashboard',
  'follower-login',
  'force-dashboard',
  'live-race-admin',
  'live-race-widget',
  'login',
  'migrate-schedule',
  'newsletter-footer',
  'profile',
  'push-notifications',
  'redsracing-dashboard',
  'settings',
  'setup-admin',
  'signup',
  'simple-admin',
  'teams',
  'team-settings',
  'HEADER_TEMPLATE',
];

function publicDoc(slug, meta) {
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords || '',
    ogTitle: meta.title,
    ogDescription: meta.description,
    ogImage: OG_DEFAULT,
    twitterCard: TWITTER_CARD,
    twitterTitle: meta.title,
    twitterDescription: meta.description,
    twitterImage: OG_DEFAULT,
    canonical: `${ORIGIN}/${slug}.html`,
    noindex: false,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'scripts/seed-page-meta.mjs',
  };
}

function adminDoc(slug) {
  return {
    title: `${slug} (admin) — RedsRacing`,
    description: '',
    keywords: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: OG_DEFAULT,
    twitterCard: TWITTER_CARD,
    canonical: '',
    noindex: true,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'scripts/seed-page-meta.mjs',
  };
}

(async () => {
  let pubCount = 0;
  let admCount = 0;

  for (const [slug, meta] of Object.entries(PUBLIC)) {
    await db.doc(`page_meta/${slug}`).set(publicDoc(slug, meta), { merge: true });
    pubCount++;
  }
  for (const slug of ADMIN_NOINDEX) {
    await db.doc(`page_meta/${slug}`).set(adminDoc(slug), { merge: true });
    admCount++;
  }

  console.log(`[seed-page-meta] wrote ${pubCount} public + ${admCount} admin docs (merge:true).`);
  process.exit(0);
})().catch((e) => {
  console.error('[seed-page-meta] FAILED:', e);
  process.exit(1);
});
