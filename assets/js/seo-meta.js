/**
 * RedsRacing SEO Meta Tags Configuration
 * Centralized SEO configuration for all pages
 */

const SEO_CONFIG = {
  // Base configuration
  siteName: 'RedsRacing',
  baseUrl: 'https://redsracing-a7f8b.web.app',
  defaultImage: 'https://redsracing-a7f8b.web.app/assets/images/og-default.jpg',
  twitterHandle: '@redsracing',
  
  // Page-specific configurations
  pages: {
    home: {
      title: '2026 Season Countdown - RedsRacing #8 & #88',
      description: 'Follow RedsRacing drivers Jon and Jonny Kirsch competing in the American Super Cup Series. Get race updates, team news, and exclusive behind-the-scenes content.',
      keywords: 'redsracing, jon kirsch, jonny kirsch, racing team, super cup series, illinois racing, dirt track racing',
      type: 'website'
    },
    team: {
      title: 'Meet The Team - RedsRacing #8 & #88',
      description: 'Two drivers, one team, unlimited potential. Meet Jon Kirsch #8K and Jonny Kirsch #88, competing in the American Super Cup Series.',
      keywords: 'racing team, jon kirsch, jonny kirsch, team profile, race drivers',
      type: 'website'
    },
    driver: {
      title: 'Jon Kirsch #8K - RedsRacing Driver Profile',
      description: 'Veteran driver Jon Kirsch #8K - 2025 4th place championship finish, competing in the American Super Cup Series. View stats, photos, and race results.',
      keywords: 'jon kirsch, driver profile, racing stats, super cup, #8 car',
      type: 'profile'
    },
    jonny: {
      title: 'Jonny Kirsch #88 - RedsRacing Driver Profile',
      description: 'Rising star Jonny Kirsch #88 competing in Pure Stocks and Super Cup divisions. Follow his racing journey and view results.',
      keywords: 'jonny kirsch, pure stocks, driver profile, #88 car, young driver',
      type: 'profile'
    },
    schedule: {
      title: 'Race Schedule - RedsRacing 2026 Season',
      description: 'View the complete 2026 race schedule for RedsRacing. Track locations, dates, and series information for both #8 and #88 teams.',
      keywords: 'race schedule, 2026 season, racing calendar, super cup schedule',
      type: 'website'
    },
    sponsorship: {
      title: 'Sponsorship Opportunities - Partner with RedsRacing',
      description: 'Join RedsRacing as a sponsor. Bronze, Silver, and Gold partnership packages available. Maximize your brand exposure in motorsports.',
      keywords: 'racing sponsorship, motorsports marketing, sponsor opportunities, racing partnerships',
      type: 'website'
    },
    videos: {
      title: 'Race Videos & Highlights - RedsRacing',
      description: 'Watch race highlights, behind-the-scenes content, and exclusive videos from RedsRacing. Follow our journey on the track.',
      keywords: 'racing videos, race highlights, motorsports content, racing footage',
      type: 'website'
    },
    qna: {
      title: 'Q&A - Ask RedsRacing',
      description: 'Get answers from the RedsRacing team. Submit your questions about racing, the team, or how to get involved.',
      keywords: 'racing questions, team qa, fan questions, racing information',
      type: 'website'
    },
    gallery: {
      title: 'Photo Gallery - RedsRacing',
      description: 'Browse photos from races, the garage, and team events. High-quality racing photography from RedsRacing.',
      keywords: 'racing photos, race gallery, motorsports photography, racing images',
      type: 'website'
    }
  }
};

/**
 * Generate meta tags for a specific page
 */
function generateMetaTags(pageName, customData = {}) {
  const pageConfig = SEO_CONFIG.pages[pageName] || SEO_CONFIG.pages.home;
  const config = { ...pageConfig, ...customData };
  
  const url = customData.url || `${SEO_CONFIG.baseUrl}/${pageName === 'home' ? '' : pageName + '.html'}`;
  const image = customData.image || SEO_CONFIG.defaultImage;
  const title = config.title || `${config.pageTitle} - ${SEO_CONFIG.siteName}`;
  
  return {
    // Standard meta tags
    title: title,
    description: config.description,
    keywords: config.keywords,
    
    // Open Graph (Facebook, LinkedIn)
    'og:title': title,
    'og:description': config.description,
    'og:url': url,
    'og:image': image,
    'og:type': config.type || 'website',
    'og:site_name': SEO_CONFIG.siteName,
    'og:locale': 'en_US',
    
    // Twitter Card
    'twitter:card': 'summary_large_image',
    'twitter:site': SEO_CONFIG.twitterHandle,
    'twitter:title': title,
    'twitter:description': config.description,
    'twitter:image': image,
    'twitter:creator': SEO_CONFIG.twitterHandle,
    
    // Additional
    'theme-color': '#fbbf24',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent'
  };
}

/**
 * Apply meta tags to current page
 */
function applyMetaTags(pageName, customData = {}) {
  const tags = generateMetaTags(pageName, customData);
  
  // Update title
  if (tags.title) {
    document.title = tags.title;
  }
  
  // Update or create meta tags
  Object.entries(tags).forEach(([name, content]) => {
    if (name === 'title') return; // Already handled
    
    const isOg = name.startsWith('og:');
    const isTwitter = name.startsWith('twitter:');
    const property = isOg || isTwitter ? 'property' : 'name';
    
    let meta = document.querySelector(`meta[${property}="${name}"]`);
    
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(property, name);
      document.head.appendChild(meta);
    }
    
    meta.setAttribute('content', content);
  });
  
  // Add canonical link
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = customData.url || `${SEO_CONFIG.baseUrl}/${pageName === 'home' ? '' : pageName + '.html'}`;
}

/**
 * Generate structured data (Schema.org) for racing events
 */
function generateRaceEventSchema(raceData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    'name': raceData.name || raceData.eventName,
    'startDate': raceData.date,
    'location': {
      '@type': 'Place',
      'name': raceData.track,
      'address': raceData.location || raceData.track
    },
    'description': raceData.description || `${raceData.eventName} at ${raceData.track}`,
    'organizer': {
      '@type': 'Organization',
      'name': SEO_CONFIG.siteName,
      'url': SEO_CONFIG.baseUrl
    },
    'sport': 'Auto Racing',
    'eventStatus': 'https://schema.org/EventScheduled'
  };
}

/**
 * Add structured data to page
 */
function addStructuredData(schema) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateMetaTags, applyMetaTags, generateRaceEventSchema, addStructuredData, SEO_CONFIG };
}

// Make available globally
window.SEO = {
  applyMetaTags,
  generateRaceEventSchema,
  addStructuredData,
  config: SEO_CONFIG
};

console.log('[SEO] Meta tags system loaded');
