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

    const [{ init, BrowserTracing, Replay }, { captureException }] = await Promise.all([
      import(/* webpackChunkName: "sentry" */ "@sentry/browser"),
      import(/* webpackChunkName: "sentry" */ "@sentry/browser")
    ]);

    // Note: Keep integrations list minimal to reduce bytes; tracing/replay are optional.
    init({
      dsn,
      integrations: [new BrowserTracing()],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 0.2,
    });
  } catch (e) {
    // Swallow errors to avoid impacting UX
    // console.warn('Sentry init skipped:', e);
  }
}