# Update navigation across all HTML pages
$pages = @(
    "driver.html",
    "jonny.html",
    "legends.html",
    "schedule.html",
    "leaderboard.html",
    "gallery.html",
    "jonny-gallery.html",
    "jonny-results.html",
    "videos.html",
    "qna.html",
    "feedback.html",
    "sponsorship.html",
    "profile.html"
)

$oldDriversDesktop = @'
          <div class="relative dropdown">
            <button class="dropdown-toggle nav-link">
              🏎️ Drivers <i class="fas fa-chevron-down"></i>
            </button>
            <div class="dropdown-menu modern-dropdown">
              <a href="driver.html" class="dropdown-item">Jon Kirsch #8</a>
              <a href="jonny.html" class="dropdown-item">Jonny Kirsch #88</a>
              <a href="jonny-results.html" class="dropdown-item">📊 Jonny Race Results</a>
              <a href="jonny-gallery.html" class="dropdown-item">📸 Jonny Race Gallery</a>
              <a href="legends.html" class="dropdown-item">Team Legends</a>
            </div>
          </div>
'@

$newDriversDesktop = @'
          <div class="relative dropdown">
            <button class="dropdown-toggle nav-link">
              🏎️ Drivers <i class="fas fa-chevron-down"></i>
            </button>
            <div class="dropdown-menu modern-dropdown">
              <!-- Jon Kirsch Nested Dropdown -->
              <div class="relative dropdown-nested">
                <button class="dropdown-item dropdown-nested-toggle flex items-center justify-between w-full">
                  <span>Jon Kirsch #8</span>
                  <i class="fas fa-chevron-right ml-2 text-xs"></i>
                </button>
                <div class="dropdown-menu-nested modern-dropdown">
                  <a href="driver.html" class="dropdown-item">👤 Profile</a>
                  <a href="gallery.html" class="dropdown-item">📸 Gallery</a>
                </div>
              </div>
              
              <!-- Jonny Kirsch Nested Dropdown -->
              <div class="relative dropdown-nested">
                <button class="dropdown-item dropdown-nested-toggle flex items-center justify-between w-full">
                  <span>Jonny Kirsch #88</span>
                  <i class="fas fa-chevron-right ml-2 text-xs"></i>
                </button>
                <div class="dropdown-menu-nested modern-dropdown">
                  <a href="jonny.html" class="dropdown-item">👤 Profile</a>
                  <a href="jonny-gallery.html" class="dropdown-item">📸 Gallery</a>
                  <a href="jonny-results.html" class="dropdown-item">📊 Race Results</a>
                </div>
              </div>
              
              <a href="legends.html" class="dropdown-item">Team Legends</a>
            </div>
          </div>
'@

$oldRacingWithGallery = @'
              <a href="gallery.html" class="dropdown-item">📸 Gallery</a>
              <a href="videos.html" class="dropdown-item">🎥 Videos</a>
'@

$newRacingNoGallery = @'
              <a href="videos.html" class="dropdown-item">🎥 Videos</a>
'@

$oldMobileDrivers = @'
        <div class="mobile-accordion-content">
          <a href="driver.html" class="mobile-nav-subitem">Jon Kirsch #8</a>
          <a href="jonny.html" class="mobile-nav-subitem">Jonny Kirsch #88</a>
          <a href="legends.html" class="mobile-nav-subitem">Team Legends</a>
        </div>
'@

$newMobileDrivers = @'
        <div class="mobile-accordion-content">
          <!-- Jon Kirsch Nested -->
          <button class="mobile-accordion mobile-accordion-nested">
            <span>Jon Kirsch #8</span><i class="fas fa-chevron-down accordion-icon"></i>
          </button>
          <div class="mobile-accordion-content mobile-accordion-content-nested">
            <a href="driver.html" class="mobile-nav-subitem mobile-nav-subitem-nested">👤 Profile</a>
            <a href="gallery.html" class="mobile-nav-subitem mobile-nav-subitem-nested">📸 Gallery</a>
          </div>
          
          <!-- Jonny Kirsch Nested -->
          <button class="mobile-accordion mobile-accordion-nested">
            <span>Jonny Kirsch #88</span><i class="fas fa-chevron-down accordion-icon"></i>
          </button>
          <div class="mobile-accordion-content mobile-accordion-content-nested">
            <a href="jonny.html" class="mobile-nav-subitem mobile-nav-subitem-nested">👤 Profile</a>
            <a href="jonny-gallery.html" class="mobile-nav-subitem mobile-nav-subitem-nested">📸 Gallery</a>
            <a href="jonny-results.html" class="mobile-nav-subitem mobile-nav-subitem-nested">📊 Race Results</a>
          </div>
          
          <a href="legends.html" class="mobile-nav-subitem">Team Legends</a>
        </div>
'@

foreach ($page in $pages) {
    if (Test-Path $page) {
        Write-Host "Updating $page..."
        $content = Get-Content $page -Raw
        
        # Update desktop navigation
        $content = $content -replace [regex]::Escape($oldDriversDesktop), $newDriversDesktop
        
        # Remove gallery from racing dropdown if present
        $content = $content -replace [regex]::Escape($oldRacingWithGallery), $newRacingNoGallery
        
        # Update mobile navigation
        $content = $content -replace [regex]::Escape($oldMobileDrivers), $newMobileDrivers
        
        Set-Content $page -Value $content -NoNewline
        Write-Host "  ✓ Updated $page"
    } else {
        Write-Host "  ✗ Skipped $page (not found)"
    }
}

Write-Host "`n`nDone! Updated navigation across all pages."
