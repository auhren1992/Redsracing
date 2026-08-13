/**
 * Shared race date/time helpers for countdowns.
 * Combines Firestore `date` (YYYY-MM-DD) with admin `startTime` text.
 */
(function (global) {
  'use strict';

  var DEFAULT_HOUR = 19;
  var DEFAULT_MINUTE = 0;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  /** Local calendar day as YYYY-MM-DD (not UTC via toISOString). */
  function localTodayYmd() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function ymdFromDateField(raw) {
    if (!raw) return null;
    if (raw.toDate) {
      var dt = raw.toDate();
      return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
    }
    var s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
  }

  function parseMeridianTime(text) {
    var m = String(text).trim().match(/^(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)\s*$/i);
    if (!m) return null;
    var hh = parseInt(m[1], 10);
    var mm = parseInt(m[2], 10);
    if (hh < 1 || hh > 12 || mm > 59) return null;
    var ap = m[3].toUpperCase();
    if (ap === 'PM' && hh < 12) hh += 12;
    if (ap === 'AM' && hh === 12) hh = 0;
    return { hours: hh, minutes: mm };
  }

  function parseClockTime(text) {
    var m = String(text).trim().match(/^(\d{1,2})\s*:\s*(\d{2})\s*$/);
    if (!m) return null;
    var hh = parseInt(m[1], 10);
    var mm = parseInt(m[2], 10);
    if (hh > 23 || mm > 59) return null;
    // Bare "5:30" means evening feature for this series (not 05:30).
    if (hh >= 1 && hh <= 11) hh += 12;
    return { hours: hh, minutes: mm };
  }

  function defaultStartParts() {
    return { hours: DEFAULT_HOUR, minutes: DEFAULT_MINUTE, assumed: true };
  }

  /**
   * Parse admin startTime: "5:30 PM", "17:30", "5:30", "TBD".
   * Missing/TBD falls back to 19:00 local (not midnight).
   */
  function parseStartTime(startTime) {
    if (startTime == null) return defaultStartParts();
    var raw = String(startTime).trim();
    if (!raw || /^tbd$/i.test(raw) || /^tba$/i.test(raw) || /^n\/?a$/i.test(raw)) {
      return defaultStartParts();
    }
    var parsed = parseMeridianTime(raw) || parseClockTime(raw);
    if (!parsed) return defaultStartParts();
    return { hours: parsed.hours, minutes: parsed.minutes, assumed: false };
  }

  function raceDateTime(dateField, startTime) {
    var ymd = ymdFromDateField(dateField);
    if (!ymd) return null;
    var t = parseStartTime(startTime);
    var d = new Date(ymd + 'T' + pad2(t.hours) + ':' + pad2(t.minutes) + ':00');
    return isNaN(d.getTime()) ? null : d;
  }

  function raceDateTimeMs(dateField, startTime) {
    var d = raceDateTime(dateField, startTime);
    return d ? d.getTime() : null;
  }

  global.RRRaceDateTime = {
    localTodayYmd: localTodayYmd,
    ymdFromDateField: ymdFromDateField,
    parseStartTime: parseStartTime,
    raceDateTime: raceDateTime,
    raceDateTimeMs: raceDateTimeMs,
    DEFAULT_HOUR: DEFAULT_HOUR,
    DEFAULT_MINUTE: DEFAULT_MINUTE
  };
})(typeof window !== 'undefined' ? window : globalThis);
