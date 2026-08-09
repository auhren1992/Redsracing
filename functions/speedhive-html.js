/* eslint-env node */
"use strict";

function eventsFromJsonLd(html) {
  const events = [];
  const scriptBlocks = Array.from(
    html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi),
  ).map((m) => m[1]);
  for (const block of scriptBlocks) {
    if (!/"@type"\s*:\s*"Event"/i.test(block)) continue;
    const objMatches = block.match(/\{[\s\S]*?\}/g) || [];
    for (const raw of objMatches) {
      try {
        const obj = JSON.parse(raw);
        if (obj["@type"] !== "Event") continue;
        events.push({
          name: obj.name || null,
          startDate: obj.startDate || null,
          location: obj?.location?.name || null,
        });
      } catch (_) {
        /* ignore bad JSON fragments */
      }
    }
  }
  return events;
}

function eventsFromAnchorHeuristics(html) {
  const text = html.replace(/\s+/g, " ");
  const events = [];
  const linkRx = /<a[^>]+href=\"([^\"]+)\"[^>]*>(.*?)<\/a>/gi;
  let m;
  while ((m = linkRx.exec(html)) !== null) {
    const href = m[1];
    const label = m[2].replace(/<[^>]+>/g, "").trim();
    if (!(/event|result|race/i.test(href) && label && label.length > 3)) continue;
    const around = text.slice(
      Math.max(0, m.index - 120),
      Math.min(text.length, m.index + 200),
    );
    const dateMatch = around.match(
      /\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})\b/,
    );
    events.push({
      name: label,
      date: dateMatch ? dateMatch[0] : null,
      link: href,
    });
  }
  return events;
}

function extractSpeedhiveEventsFromHtml(html) {
  try {
    const fromJson = eventsFromJsonLd(html);
    if (fromJson.length) return fromJson;
  } catch (_) {
    /* ignore parse failures */
  }
  return eventsFromAnchorHeuristics(html);
}

module.exports = {
  extractSpeedhiveEventsFromHtml,
};
