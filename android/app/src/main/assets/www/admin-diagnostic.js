// Admin Console Diagnostic Tool
// Add this to your browser console to diagnose navigation issues

console.log("=== ADMIN CONSOLE DIAGNOSTIC ===");

// Check if navigation function exists
console.log("1. Navigation functions:");
console.log("  - showRace:", typeof showRace);
console.log("  - showLogs:", typeof showLogs);
console.log("  - showMedia:", typeof showMedia);
console.log("  - showAdvanced:", typeof showAdvanced);
console.log("  - hideAllSections:", typeof hideAllSections);

// Check if sections exist in DOM
console.log("\n2. Section elements:");
const sections = ['dashboard-content', 'gallery-approvals', 'race-section', 'logs-section', 'advanced-section', 'videos-section', 'qna-section'];
sections.forEach(id => {
  const el = document.getElementById(id);
  console.log(`  - ${id}:`, el ? 'EXISTS' : 'MISSING', 
    el ? `(display: ${el.style.display}, hidden: ${el.classList.contains('hidden')})` : '');
});

// Check navigation items
console.log("\n3. Navigation items:");
const navItems = document.querySelectorAll('.nav-item');
console.log(`  - Found ${navItems.length} nav items`);
navItems.forEach((item, i) => {
  const href = item.getAttribute('href');
  const text = item.textContent.trim();
  console.log(`  - [${i}] ${text}: ${href}`);
});

// Test clicking on Race Management
console.log("\n4. Testing showRace() function:");
try {
  if (typeof showRace === 'function') {
    showRace();
    const raceSection = document.getElementById('race-section');
    console.log("  - Race section after showRace():", 
      raceSection ? `display=${raceSection.style.display}, hidden=${raceSection.classList.contains('hidden')}` : 'NOT FOUND');
  } else {
    console.log("  - showRace function not available");
  }
} catch(e) {
  console.error("  - Error calling showRace():", e);
}

// Check for JavaScript errors
console.log("\n5. Checking for errors:");
console.log("  - Run this in console and click on Race Management, Error Logs, etc.");
console.log("  - Watch for any error messages below");

// Add click listeners to nav items for debugging
console.log("\n6. Adding debug click listeners...");
document.querySelectorAll('.nav-item').forEach((item, i) => {
  item.addEventListener('click', function(e) {
    const href = item.getAttribute('href') || '';
    console.log(`[DEBUG] Clicked nav item ${i}: ${item.textContent.trim()} (href: ${href})`);
    console.log(`[DEBUG] Event prevented: ${e.defaultPrevented}`);
  }, true); // Use capture phase
});

console.log("\n7. Try clicking a menu item now and watch the console!");
console.log("==================================");
