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

  /** Known ASC / Midwest tracks — avoid flaky geocode for race cities. */
  const TRACK_COORDS = {
    'grundy county speedway': { lat: 41.3686, lon: -88.4212, name: 'Morris, IL' },
    'golden sands speedway': { lat: 44.3908, lon: -89.8173, name: 'Wisconsin Rapids, WI' },
    'slinger speedway': { lat: 43.3336, lon: -88.2862, name: 'Slinger, WI' },
    'tomah speedway': { lat: 43.9786, lon: -90.5040, name: 'Tomah, WI' },
    'la crosse speedway': { lat: 43.8997, lon: -91.0815, name: 'West Salem, WI' },
    'dells raceway park': { lat: 43.6275, lon: -89.7710, name: 'Wisconsin Dells, WI' },
    'rockford speedway': { lat: 42.3211, lon: -89.0151, name: 'Rockford, IL' },
    'milwaukee mile': { lat: 43.0203, lon: -87.9992, name: 'West Allis, WI' }
  };

  const CITY_COORDS = {
    'tomah|wi': { lat: 43.9786, lon: -90.5040, name: 'Tomah' },
    'morris|il': { lat: 41.3573, lon: -88.4212, name: 'Morris' },
    'wisconsin rapids|wi': { lat: 44.3836, lon: -89.8173, name: 'Wisconsin Rapids' },
    'slinger|wi': { lat: 43.3336, lon: -88.2862, name: 'Slinger' },
    'west salem|wi': { lat: 43.8997, lon: -91.0815, name: 'West Salem' },
    'wisconsin dells|wi': { lat: 43.6275, lon: -89.7710, name: 'Wisconsin Dells' },
    'rockford|il': { lat: 42.2711, lon: -89.0940, name: 'Rockford' }
  };

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

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lookupKnownCoords(city, state, track) {
    const trackKey = norm(track);
    if (trackKey && TRACK_COORDS[trackKey]) return TRACK_COORDS[trackKey];
    for (const [k, v] of Object.entries(TRACK_COORDS)) {
      if (trackKey && (trackKey.includes(k) || k.includes(trackKey))) return v;
    }
    const cityKey = norm(city) + '|' + norm(state);
    if (CITY_COORDS[cityKey]) return CITY_COORDS[cityKey];
    return null;
  }

  function pickGeoHit(results, state) {
    const list = Array.isArray(results) ? results : [];
    if (!list.length) return null;
    const st = norm(state);
    const stateNames = {
      wi: 'wisconsin', il: 'illinois', mn: 'minnesota', ia: 'iowa',
      mi: 'michigan', in: 'indiana', oh: 'ohio'
    };
    const want = stateNames[st] || st;
    if (want) {
      const match = list.find((r) => norm(r.admin1) === want || norm(r.admin1).startsWith(want));
      if (match) return match;
    }
    const us = list.find((r) => String(r.country_code || '').toUpperCase() === 'US');
    return us || list[0];
  }

  async function geocodeRemote(city, state) {
    const cityName = String(city || '').trim();
    if (!cityName) return null;
    const queries = [
      [cityName, state, 'USA'].filter(Boolean).join(', '),
      [cityName, state].filter(Boolean).join(', '),
      cityName
    ];
    for (const q of queries) {
      const url =
        GEO_URL +
        '?name=' + encodeURIComponent(q) +
        '&count=5&language=en&format=json&countryCode=US';
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const hit = pickGeoHit(data.results, state);
        if (hit) {
          return { lat: hit.latitude, lon: hit.longitude, name: hit.name };
        }
      } catch (e) {
        console.warn('[race-weather] geocode failed', q, e);
      }
    }
    return null;
  }

  async function geocode(city, state, track) {
    const key = (norm(city) + '|' + norm(state) + '|' + norm(track)).toLowerCase();
    if (GEO_CACHE.has(key)) return GEO_CACHE.get(key);

    const known = lookupKnownCoords(city, state, track);
    if (known) {
      GEO_CACHE.set(key, known);
      return known;
    }

    const remote = await geocodeRemote(city, state);
    GEO_CACHE.set(key, remote);
    return remote;
  }

  function dailyField(daily, snake, camel) {
    if (Array.isArray(daily[snake])) return daily[snake][0];
    if (Array.isArray(daily[camel])) return daily[camel][0];
    return null;
  }

  async function forecastDay(lat, lon, dateStr) {
    const key = lat.toFixed(3) + ',' + lon.toFixed(3) + ':' + dateStr;
    if (DAY_CACHE.has(key)) return DAY_CACHE.get(key);

    const url =
      FORECAST_URL +
      '?latitude=' + encodeURIComponent(lat) +
      '&longitude=' + encodeURIComponent(lon) +
      '&daily=weathercode,precipitation_probability_max,temperature_2m_max,temperature_2m_min' +
      '&temperature_unit=fahrenheit&timezone=America%2FChicago' +
      '&start_date=' + encodeURIComponent(dateStr) +
      '&end_date=' + encodeURIComponent(dateStr);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('forecast ' + res.status);
      const data = await res.json();
      if (data && data.reason) throw new Error(String(data.reason));
      const daily = data.daily || {};
      const code = dailyField(daily, 'weathercode', 'weather_code');
      const precip = dailyField(daily, 'precipitation_probability_max', 'precipitation_probability_max');
      const tmax = dailyField(daily, 'temperature_2m_max', 'temperature_2m_max');
      const tmin = dailyField(daily, 'temperature_2m_min', 'temperature_2m_min');
      if (code == null && precip == null && tmax == null) {
        throw new Error('empty daily forecast');
      }
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
              : '',
        source: 'open-meteo'
      };
      DAY_CACHE.set(key, out);
      return out;
    } catch (e) {
      console.warn('[race-weather] forecast failed', key, e);
      return null;
    }
  }

  async function forRace({ city, state, date, track }) {
    const dateStr = String(date || '').slice(0, 10);
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { error: 'bad-date', message: 'Missing or invalid race date.' };
    }
    const coords = await geocode(city, state, track);
    if (!coords) {
      return { error: 'geocode', message: 'Could not locate ' + [city, state].filter(Boolean).join(', ') + '.' };
    }
    const wx = await forecastDay(coords.lat, coords.lon, dateStr);
    if (!wx) {
      return {
        error: 'forecast',
        message: 'Open-Meteo had no daily forecast for ' + dateStr + ' (check CSP / network).',
        coords
      };
    }
    wx.coords = coords;
    return wx;
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
        forRace({ city, state, date: dateStr, track: r.track || r.eventName || '' }).then((wx) => {
          if (wx && !wx.error) out.set(key, wx);
        })
      );
    });
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
    rainCopy,
    lookupKnownCoords
  };
})();
