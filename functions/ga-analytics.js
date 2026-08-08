/**
 * Google Analytics 4 Data API helpers for the admin console.
 * Uses Application Default Credentials (Cloud Functions runtime SA).
 *
 * Setup:
 * 1. GA4 Admin → Property settings → copy numeric Property ID
 * 2. Save to Firestore: config/google_analytics { propertyId, measurementId }
 *    or set env GA4_PROPERTY_ID
 * 3. In GA4 → Admin → Property access management, add the Cloud Functions
 *    service account as Viewer (e.g. PROJECT_ID@appspot.gserviceaccount.com
 *    or the Compute default SA used by 2nd gen functions)
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const MEASUREMENT_ID_DEFAULT = "G-YD3ZWC13SR";

function assertAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const claims = request.auth.token || {};
  const role = String(claims.role || "").toLowerCase();
  const ok =
    claims.admin === true ||
    role === "admin" ||
    role === "owner";
  if (!ok) {
    throw new HttpsError("permission-denied", "Admin only.");
  }
}

async function resolveGaConfig() {
  const db = getFirestore();
  let propertyId = process.env.GA4_PROPERTY_ID || "";
  let measurementId = process.env.GA4_MEASUREMENT_ID || MEASUREMENT_ID_DEFAULT;

  try {
    const snap = await db.collection("config").doc("google_analytics").get();
    if (snap.exists) {
      const d = snap.data() || {};
      if (d.propertyId) propertyId = String(d.propertyId).trim();
      if (d.measurementId) measurementId = String(d.measurementId).trim();
    }
  } catch (err) {
    logger.warn("Failed reading config/google_analytics", err);
  }

  propertyId = String(propertyId || "").replace(/^properties\//, "").trim();
  return { propertyId, measurementId };
}

function rowsToObjects(response) {
  const dimHeaders = (response.dimensionHeaders || []).map((h) => h.name);
  const metHeaders = (response.metricHeaders || []).map((h) => h.name);
  return (response.rows || []).map((row) => {
    const out = {};
    (row.dimensionValues || []).forEach((v, i) => {
      out[dimHeaders[i] || `dim${i}`] = v.value;
    });
    (row.metricValues || []).forEach((v, i) => {
      out[metHeaders[i] || `met${i}`] = v.value;
    });
    return out;
  });
}

async function runGaReports(propertyId) {
  const { BetaAnalyticsDataClient } = require("@google-analytics/data");
  const client = new BetaAnalyticsDataClient();
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate: "30daysAgo", endDate: "today" }];

  async function safeReport(label, request) {
    try {
      const [response] = await client.runReport(request);
      return response;
    } catch (err) {
      logger.warn(`GA4 report failed: ${label}`, err?.message || err);
      return { rows: [], dimensionHeaders: [], metricHeaders: [] };
    }
  }

  const [summaryRes, pagesRes, channelsRes, devicesRes, dailyRes, eventsRes] =
    await Promise.all([
      safeReport("summary", {
        property,
        dateRanges,
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "newUsers" },
          { name: "screenPageViews" },
          { name: "engagedSessions" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
          { name: "eventCount" },
        ],
      }),
      safeReport("pages", {
        property,
        dateRanges,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 10,
      }),
      safeReport("channels", {
        property,
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      safeReport("devices", {
        property,
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "totalUsers" }, { name: "sessions" }],
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
      }),
      safeReport("daily", {
        property,
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
      }),
      safeReport("events", {
        property,
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: 12,
      }),
    ]);

  const summaryRow = rowsToObjects(summaryRes)[0] || {};
  return {
    summary: {
      sessions: Number(summaryRow.sessions || 0),
      totalUsers: Number(summaryRow.totalUsers || 0),
      newUsers: Number(summaryRow.newUsers || 0),
      screenPageViews: Number(summaryRow.screenPageViews || 0),
      engagedSessions: Number(summaryRow.engagedSessions || 0),
      averageSessionDuration: Number(summaryRow.averageSessionDuration || 0),
      bounceRate: Number(summaryRow.bounceRate || 0),
      eventCount: Number(summaryRow.eventCount || 0),
    },
    topPages: rowsToObjects(pagesRes).map((r) => ({
      path: r.pagePath || "/",
      views: Number(r.screenPageViews || 0),
      users: Number(r.totalUsers || 0),
    })),
    channels: rowsToObjects(channelsRes).map((r) => ({
      channel: r.sessionDefaultChannelGroup || "Unknown",
      sessions: Number(r.sessions || 0),
      users: Number(r.totalUsers || 0),
    })),
    devices: rowsToObjects(devicesRes).map((r) => ({
      device: r.deviceCategory || "unknown",
      users: Number(r.totalUsers || 0),
      sessions: Number(r.sessions || 0),
    })),
    daily: rowsToObjects(dailyRes).map((r) => ({
      date: r.date || "",
      sessions: Number(r.sessions || 0),
      users: Number(r.totalUsers || 0),
      views: Number(r.screenPageViews || 0),
    })),
    topEvents: rowsToObjects(eventsRes).map((r) => ({
      event: r.eventName || "unknown",
      count: Number(r.eventCount || 0),
    })),
  };
}

exports.getGoogleAnalyticsReport = onCall(
  {
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    assertAdmin(request);
    const { propertyId, measurementId } = await resolveGaConfig();

    if (!propertyId) {
      return {
        ok: false,
        configured: false,
        measurementId,
        error:
          "GA4 property ID not set. Save config/google_analytics.propertyId (numeric) in Firestore, or set GA4_PROPERTY_ID on functions.",
        helpUrl: "https://analytics.google.com/",
      };
    }

    try {
      const report = await runGaReports(propertyId);
      return {
        ok: true,
        configured: true,
        measurementId,
        propertyId,
        range: { startDate: "30daysAgo", endDate: "today" },
        source: "google-analytics-data-api",
        ...report,
      };
    } catch (err) {
      logger.error("GA4 runReport failed", err);
      const message = err?.message || String(err);
      let hint = message;
      if (/PERMISSION_DENIED|403/i.test(message)) {
        hint =
          "Permission denied. Grant the Cloud Functions service account Viewer access on this GA4 property.";
      }
      return {
        ok: false,
        configured: true,
        measurementId,
        propertyId,
        error: hint,
        helpUrl: `https://analytics.google.com/analytics/web/#/p${propertyId}/`,
      };
    }
  },
);
