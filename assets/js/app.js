import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "https://e1a66c779d41f9c6057dbf22ee53ab8d@o4510070455992320.ingest.us.sentry.io/4510070931783680",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    Sentry.consoleLoggingIntegration({
      levels: ['log', 'warn', 'error'],
    }),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: true,
  enableLogs: true,
});
