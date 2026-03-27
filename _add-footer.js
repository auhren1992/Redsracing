const fs = require('fs');
const path = require('path');
const base = 'C:/Users/Parts/Documents/Desktop/Redsracing';

const footerLinks = '<div style="text-align:center;padding:1.5rem 1rem;border-top:1px solid rgba(148,163,184,0.1);margin-top:2rem;font-size:0.75rem;color:#64748b;"><a href="privacy.html" style="color:#94a3b8;text-decoration:none;margin:0 8px;">Privacy Policy</a> | <a href="terms.html" style="color:#94a3b8;text-decoration:none;margin:0 8px;">Terms of Service</a> | <a href="contact.html" style="color:#94a3b8;text-decoration:none;margin:0 8px;">Contact</a><div style="margin-top:4px;">&copy; 2026 RedsRacing #8 &amp; #88</div></div>';

// Pages to add footer to (content pages that have ads and need legal links)
const pages = [
  'team.html', 'about.html', 'driver.html', 'jonny.html', 'gallery.html',
  'jonny-gallery.html', 'schedule.html', 'leaderboard.html', 'videos.html',
  'qna.html', 'feedback.html', 'sponsorship.html', 'contact.html',
  'racing-guide.html', 'legends.html', 'fan-wall.html', 'predictions.html',
  'tracks.html', 'recaps.html', 'stats.html', 'jons.html', 'jonny-results.html'
];

let added = 0;
pages.forEach(file => {
  const fp = path.join(base, file);
  if (!fs.existsSync(fp)) return;
  let content = fs.readFileSync(fp, 'utf8');
  // Skip if already has privacy link
  if (content.indexOf('privacy.html') > -1) {
    console.log('Already has privacy link:', file);
    return;
  }
  // Insert before </body>
  const bodyClose = content.lastIndexOf('</body>');
  if (bodyClose > -1) {
    content = content.substring(0, bodyClose) + footerLinks + '\n' + content.substring(bodyClose);
    fs.writeFileSync(fp, content);
    added++;
    console.log('Added footer to:', file);
  }
});

console.log('\nAdded footer links to', added, 'pages');
