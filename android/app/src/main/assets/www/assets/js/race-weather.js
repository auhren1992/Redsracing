/**
 * Race-day weather via Open-Meteo (no API key).
 * Geocodes city/state, caches forecasts, returns fan-friendly rain risk.
 */
(function () {
  'use strict';

  const GEO_CACHE = new Map();
  const DAY_CACHE = new Map();
  const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

  function weatherLabel(code) {
    const c = Number(code);
    if (!Number.isFinite(c)) return { label: 'Forecast TBD', icon: 'fas fa-cloud-sun', risk: 'unknown' };
    if (c === 0) return { label: 'Clear', icon: 'fas fa-sun', risk: 'low' };
    if (c <= 3) return { label: 'Partly cloudy', icon: 'fas fa-cloud-sun', risk: 'low' };
    if (c <= 48) return { label: 'Foggy', icon: 'fas fa-smog', risk: 'low' };
    if (c <= 57) return { label: 'Drizzle risk', icon: 'fas fa-cloud-rain', risk: 'medium' };
    if (c <= 67) return { label: 'Rain likely', icon: 'fas fa-cloud-showers-heavy', risk: 'high' };
    if (c <= 77) return { label: 'Snow / wintry', icon: 'fas fa-snowflake', risk: 'medium' };
    if (c <= 82) return { label: 'Rain showers', icon: 'fas fa-cloud-showers-heavy', risk: 'high' };
    if (c <= 86) return { label: 'Snow showers', icon: 'fas fa-snowflake', risk: 'medium' };
    if (c >= 95) return { label: 'Thunderstorms', icon: 'fas fa-bolt', risk: 'high' };
    return { label: 'Mixed', icon: 'fas fa-cloud', risk: 'medium' };
  }

  function rainCopy(prob, risk) {
    const p = Number(prob);
    if (!Number.isFinite(p)) return risk === 'high' ? 'Rain possible — check closer to race time' : 'Rain chance updating…';
    if (p >= 60) return p + '% chance of rain — pack a jacket / watch for delays';
    if (p >= 35) return p + '% chance of rain — possible sprinkles';
    if (p >= 15) return p + '% slight rain chance';
    return 'Low rain chance (' + p + '%)';
  }

  async function geocode(city, state) {
    const key = (String(city || '').trim() + ',' + String(state || '').trim()).toLowerCase();
    if (!key || key === ',') return null;
    if (GEO_CACHE.has(key)) return GEO_CACHE.get(key);

    const q = [city, state, 'USA'].filter(Boolean).join(', ');
    const url = GEO_URL + '?name=' + encodeURIComponent(q) + '&count=1&language=en&format=json';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('geo ' + res.status);
      const data = await res.json();
      const hit = (data.results && data.results[0]) || null;
      const coords = hit ? { lat: hit.latitude, lon: hit.longitude, name: hit.name } : null;
      GEO_CACHE.set(key, coords);
      return coords;
    } catch (e) {
      console.warn('[race-weather] geocode failed', key, e);
      GEO_CACHE.set(key, null);
      return null;
    }
  }

  async function forecastDay(lat, lon, dateStr) {
    const key = lat.toFixed(3) + ',' + lon.toFixed(3) + ':' + dateStr;
    if (DAY_CACHE.has(key)) return DAY_CACHE.get(key);

    const url =
      FORECAST_URL +
      '?latitude=' + encodeURIComponent(lat) +
      '&longitude=' + encodeURIComponent(lon) +
      '&daily=weathercode,precipitation_probability_max,temperature_2m_max,temperature_2m_min' +
      '&temperature_unit=fahrenheit&timezone=auto' +
      '&start_date=' + encodeURIComponent(dateStr) +
      '&end_date=' + encodeURIComponent(dateStr);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('forecast ' + res.status);
      const data = await res.json();
      const daily = data.daily || {};
      const code = Array.isArray(daily.weathercode) ? daily.weathercode[0] : null;
      const precip = Array.isArray(daily.precipitation_probability_max)
        ? daily.precipitation_probability_max[0]
        : null;
      const tmax = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
      const tmin = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;
      const meta = weatherLabel(code);
      const out = {
        date: dateStr,
        weathercode: code,
        precipProb: precip,
        tempMaxF: tmax,
        tempMinF: tmin,
        label: meta.label,
        icon: meta.icon,
        risk: meta.risk,
        summary: rainCopy(precip, meta.risk),
        tempLine:
          Number.isFinite(tmax) && Number.isFinite(tmin)
            ? Math.round(tmin) + '°–' + Math.round(tmax) + '°F'
            : Number.isFinite(tmax)
              ? Math.round(tmax) + '°F'
              : ''
      };
      DAY_CACHE.set(key, out);
      return out;
    } catch (e) {
      console.warn('[race-weather] forecast failed', key, e);
      return null;
    }
  }

  async function forRace({ city, state, date }) {
    const dateStr = String(date || '').slice(0, 10);
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    const coords = await geocode(city, state);
    if (!coords) return null;
    return forecastDay(coords.lat, coords.lon, dateStr);
  }

  /** Batch unique city/state/date races; returns Map keyed by date|city|state */
  async function forRaces(races) {
    const list = Array.isArray(races) ? races : [];
    const out = new Map();
    const jobs = [];
    const seen = new Set();
    list.forEach((r) => {
      const dateStr = String(r.date || '').slice(0, 10);
      const city = r.city || '';
      const state = r.state || '';
      const key = dateStr + '|' + city + '|' + state;
      if (!dateStr || seen.has(key)) return;
      seen.add(key);
      jobs.push(
        forRace({ city, state, date: dateStr }).then((wx) => {
          if (wx) out.set(key, wx);
        })
      );
    });
    // Limit concurrency a bit
    const chunk = 4;
    for (let i = 0; i < jobs.length; i += chunk) {
      await Promise.all(jobs.slice(i, i + chunk));
    }
    return out;
  }

  function riskClass(risk) {
    if (risk === 'high') return 'wx-risk-high';
    if (risk === 'medium') return 'wx-risk-medium';
    if (risk === 'low') return 'wx-risk-low';
    return 'wx-risk-unknown';
  }

  window.RRRaceWeather = {
    forRace,
    forRaces,
    weatherLabel,
    riskClass,
    rainCopy
  };
})();
