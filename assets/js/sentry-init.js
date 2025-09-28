// Lazy Sentry initialization. This file is loaded via dynamic import only in production
// and only if a DSN is present on window.SENTRY_DSN or in a <meta name="sentry-dsn" /> tag.

export async function initSentry() {
  try {
    const dsn =
      (typeof window !== "undefined" && window.SENTRY_DSN) ||
      (document && document.querySelector('meta[name="sentry-dsn"]')?.content) ||
      null;

    if (!dsn) {
      return; // No DSN configured; skip
    }

    const { init, browserTracingIntegration, browserProfilingIntegration, replayIntegration } = await import(/* webpackChunkName: "sentry" */ "@sentry/browser");

    // Enhanced configuration with performance monitoring and profiling
    init({
      dsn,
      integrations: [
        browserTracingIntegration(),
        browserProfilingIntegration(),
        replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        })
      ],
      // Performance Monitoring
      tracesSampleRate: 1.0, // Capture 100% of transactions
      // Set trace propagation targets for your domains
      tracePropagationTargets: [
        "localhost", 
        /^https:\/\/.*\.firebaseapp\.com\//,
        /^https:\/\/.*\.web\.app\//,
        /^https:\/\/.*-r7f4oo4gjq-uc\.a\.run\.app\//,
        "redsracing.org",
        /^https:\/\/redsracing/
      ],
      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      // Performance Profiling
      profilesSampleRate: 1.0, // Profile 100% of transactions
    });
  } catch (e) {
    // Swallow errors to avoid impacting UX
    // console.warn('Sentry init skipped:', e);
  }
}