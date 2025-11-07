# 🐍 Python Cloud Functions for RedsRacing

Complete guide to your Python backend functions and ideas for new features.

---

## 🎯 Current Python Functions

### 1. **Email & Communication**

#### `handleSendFeedback`
- **Purpose:** Sends user feedback via SendGrid email
- **Queue fallback:** Stores in Firestore if email fails
- **Monitoring:** Integrated with Sentry error tracking
- **URL:** `https://redsracing-a7f8b.web.app/api/send-feedback`

#### `handleSendSponsorship`
- **Purpose:** Sends sponsorship inquiries via email
- **Queue fallback:** Stores in Firestore if email fails
- **URL:** `https://redsracing-a7f8b.web.app/api/send-sponsorship`

#### `handleProcessQueues`
- **Purpose:** Retries failed emails with exponential backoff
- **Schedule:** Can be triggered by Cloud Scheduler
- **Dead letter queue:** Moves failed items after 5 retries
- **URL:** `https://redsracing-a7f8b.web.app/api/process-queues`

### 2. **User Management**

#### `handleAddSubscriber`
- **Purpose:** Adds email subscribers to Firestore
- **URL:** `https://redsracing-a7f8b.web.app/api/add-subscriber`

#### `handleGetProfile`
- **Purpose:** Retrieves user profile with achievements
- **URL:** `https://redsracing-a7f8b.web.app/api/profile/<user_id>`

#### `handleUpdateProfile`
- **Purpose:** Updates authenticated user profile
- **Validation:** Username, displayName, bio, avatarUrl, favoriteCars
- **URL:** `https://redsracing-a7f8b.web.app/api/update-profile/<user_id>`

### 3. **Achievements System**

#### `handleGetAchievements`
- **Purpose:** Lists all available achievements/badges
- **URL:** `https://redsracing-a7f8b.web.app/api/achievements`

#### `handleAssignAchievement`
- **Purpose:** Manually assign achievements (admins only)
- **URL:** `https://redsracing-a7f8b.web.app/api/assign-achievement`

#### `handleAutoAwardAchievement`
- **Purpose:** Automatically awards achievements based on actions
- **Triggers:** first_login, photo_upload, photo_liked, profile_created
- **URL:** `https://redsracing-a7f8b.web.app/api/auto-award-achievement`

#### `handleGetAchievementProgress`
- **Purpose:** Track user progress toward achievements
- **URL:** `https://redsracing-a7f8b.web.app/api/achievement-progress/<user_id>`

#### `handleGetLeaderboard`
- **Purpose:** Get top 50 users by achievement points
- **URL:** `https://redsracing-a7f8b.web.app/api/leaderboard`

### 4. **Utilities**

#### `handleTest`
- **Purpose:** Test function to verify rewrites
- **Sentry test:** Add `?test_error=true` to test error reporting
- **URL:** `https://redsracing-a7f8b.web.app/api/test`

#### `handleAuthAction`
- **Purpose:** Validates authentication action types
- **URL:** `https://redsracing-a7f8b.web.app/api/auth-action`

#### `handlePasswordReset`
- **Purpose:** Acknowledges password reset requests
- **URL:** `https://redsracing-a7f8b.web.app/api/password-reset`

---

## 💡 NEW Python Function Ideas

### 1. **Race Data Analytics** ⭐⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleRaceAnalytics(req: https_fn.Request):
    """
    Advanced race statistics and trends
    - Lap time averages
    - Position changes throughout race
    - Performance improvement over time
    - Compare multiple races
    - Weather impact on performance
    """
```

**Frontend Integration:**
- Live charts on driver pages
- Performance dashboard
- Historical comparisons

---

### 2. **AI Race Predictions** ⭐⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleRacePredictions(req: https_fn.Request):
    """
    ML-powered race outcome predictions
    - Predict finishing position based on qualifying
    - Weather-adjusted predictions
    - Track-specific performance analysis
    - Confidence scores
    """
```

**Uses:**
- Pre-race analysis section
- Fan engagement ("Predict the finish!")
- Performance insights

---

### 3. **Photo AI Enhancements** ⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handlePhotoAnalysis(req: https_fn.Request):
    """
    AI-powered photo features
    - Auto-tag car numbers in photos
    - Detect race track locations
    - Identify drivers
    - Generate captions
    - Find similar photos
    """
```

**Integration:**
- Auto-tagging on upload
- Smart photo search
- "More like this" recommendations

---

### 4. **Live Race Updates** ⭐⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleLiveRaceUpdate(req: https_fn.Request):
    """
    Real-time race position tracking
    - Push position updates
    - Lap-by-lap progress
    - Live timing data
    - Incident reports
    - WebSocket integration
    """
```

**Features:**
- Live race map
- Real-time leaderboard
- Push notifications for position changes

---

### 5. **Social Features** ⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleSocialInteractions(req: https_fn.Request):
    """
    Enhanced community features
    - User following system
    - Activity feed
    - Photo comments
    - Driver fan clubs
    - Team chat rooms
    """
```

**Additions:**
- Follow favorite drivers
- Community activity feed
- Photo comment threads

---

### 6. **Merchandise Integration** ⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleMerchManagement(req: https_fn.Request):
    """
    Team merchandise and apparel
    - Product catalog
    - Size availability
    - Order tracking
    - Shopify/WooCommerce integration
    - Custom jersey builder
    """
```

**Store Features:**
- Team apparel shop
- Custom car number jerseys
- Order history

---

### 7. **Weather & Track Conditions** ⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleTrackConditions(req: https_fn.Request):
    """
    Track and weather data integration
    - Real-time weather at track
    - Track temperature
    - Historical weather patterns
    - Setup recommendations
    - Tire strategy suggestions
    """
```

**Uses:**
- Pre-race planning
- Setup optimization
- Fan insights

---

### 8. **Video Highlights Generator** ⭐⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleVideoHighlights(req: https_fn.Request):
    """
    Auto-generate race highlights
    - Extract key moments from full race video
    - Identify overtakes, incidents
    - Generate thumbnail images
    - Add captions and graphics
    - Social media clips
    """
```

**Features:**
- Auto-highlight reels
- Shareable clips
- Thumbnail generation

---

### 9. **Telemetry Data Processing** ⭐⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleTelemetryAnalysis(req: https_fn.Request):
    """
    Advanced car telemetry processing
    - RPM, speed, throttle analysis
    - Brake point identification
    - Cornering G-forces
    - Compare laps
    - Setup recommendations
    """
```

**Professional Features:**
- Telemetry viewer
- Performance optimization
- Data-driven improvements

---

### 10. **Notification System** ⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleNotifications(req: https_fn.Request):
    """
    Push notification management
    - Race day reminders
    - Position change alerts
    - Photo likes/comments
    - New achievement unlocked
    - Schedule changes
    """
```

**Push Types:**
- Browser push notifications
- Email notifications
- SMS alerts (Twilio)

---

### 11. **Q&A AI Assistant** ⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleQAAssistant(req: https_fn.Request):
    """
    AI chatbot for fan questions
    - Answer racing questions
    - Provide driver stats
    - Explain rules
    - Schedule lookup
    - Historical data
    """
```

**ChatGPT Integration:**
- Embed on Q&A page
- Instant answers
- 24/7 support

---

### 12. **Sponsorship Analytics** ⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleSponsorshipMetrics(req: https_fn.Request):
    """
    Sponsor ROI tracking
    - Social media impressions
    - Website traffic from sponsor content
    - Photo views with sponsor logos
    - Engagement metrics
    - Generate sponsor reports
    """
```

**For Sponsors:**
- Monthly reports
- ROI dashboard
- Engagement stats

---

### 13. **Race Calendar Sync** ⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleCalendarExport(req: https_fn.Request):
    """
    Calendar integration
    - Export to Google Calendar
    - iCal format
    - Outlook integration
    - Reminders
    - Add to phone calendar
    """
```

**Integration:**
- One-click calendar add
- Automatic updates
- Pre-race reminders

---

### 14. **Fan Poll & Voting** ⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleFanPolls(req: https_fn.Request):
    """
    Interactive fan engagement
    - Pre-race predictions
    - Driver of the week
    - Best overtake vote
    - Photo of the month
    - Real-time poll results
    """
```

**Engagement:**
- Weekly polls
- Race predictions
- Community voting

---

### 15. **Performance Comparison Tool** ⭐⭐⭐

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handlePerformanceComparison(req: https_fn.Request):
    """
    Compare drivers side-by-side
    - Jon vs Jonny stats
    - Track-specific comparisons
    - Head-to-head records
    - Historical trends
    - Visual charts
    """
```

**Comparisons:**
- Jon #8 vs Jonny #88
- Season-over-season
- Track records

---

## 🚀 Priority Recommendations

### **Must Have (Implement First):**
1. ✅ Race Data Analytics - Already have some data, enhance it
2. ✅ Live Race Updates - Major fan engagement
3. ✅ Telemetry Analysis - Professional driver tool
4. ✅ Performance Comparison - Great content

### **Nice to Have:**
5. Video Highlights Generator - Social media gold
6. AI Race Predictions - Unique feature
7. Notification System - Keep fans engaged

### **Future Features:**
8. Merchandise Integration
9. Photo AI Enhancements
10. Weather & Track Conditions

---

## 🛠 Deployment Commands

### Deploy Python Functions:
```bash
firebase deploy --only "functions:python-api"
```

### Deploy Specific Function:
```bash
firebase functions:deploy handleRaceAnalytics --runtime python311
```

### View Logs:
```bash
firebase functions:log
```

### Test Locally:
```bash
firebase emulators:start --only functions
```

---

## 📊 Current Status

✅ **Working Functions:** 12 endpoints deployed
⚠️ **Python venv issue:** Needs reinstallation
🔧 **SendGrid:** Email service configured
🔐 **Sentry:** Error monitoring active
🎯 **CORS:** Enabled for frontend access

---

## 🔥 Quick Implementation Plan

### Week 1: Race Analytics
- Create `handleRaceAnalytics` function
- Build performance charts on frontend
- Add lap time comparisons

### Week 2: Live Updates
- Implement `handleLiveRaceUpdate`
- Create WebSocket connection
- Build live leaderboard UI

### Week 3: Telemetry
- Create `handleTelemetryAnalysis`
- Upload sample telemetry data
- Build telemetry viewer

### Week 4: Comparisons
- Create `handlePerformanceComparison`
- Build comparison UI
- Add charts and graphs

---

## 💻 Sample Implementation

### Race Analytics Example:

```python
@https_fn.on_request(cors=CORS_OPTIONS)
def handleRaceAnalytics(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)
    
    driver_id = req.args.get('driver_id')
    season = req.args.get('season', '2025')
    
    db = firestore.client()
    
    # Get all races for driver
    races = db.collection('races').where('driverId', '==', driver_id).where('season', '==', season).get()
    
    analytics = {
        'totalRaces': len(races),
        'avgFinishPosition': 0,
        'bestFinish': 999,
        'worstFinish': 0,
        'lapTimeImprovement': 0,
        'pointsEarned': 0,
        'races': []
    }
    
    for race in races:
        race_data = race.to_dict()
        analytics['races'].append(race_data)
        analytics['pointsEarned'] += race_data.get('points', 0)
        
        finish = race_data.get('finishPosition', 0)
        if finish > 0:
            analytics['bestFinish'] = min(analytics['bestFinish'], finish)
            analytics['worstFinish'] = max(analytics['worstFinish'], finish)
    
    if len(races) > 0:
        analytics['avgFinishPosition'] = analytics['pointsEarned'] / len(races)
    
    return https_fn.Response(
        json.dumps(analytics),
        status=200,
        headers={"Content-Type": "application/json"}
    )
```

---

## 📞 Support

Need help implementing any of these? Let me know which features you want to prioritize!

**Current Issues:**
- Python venv needs reinstall before deployment
- Need to run: `python -m venv functions_python/venv` and reinstall dependencies
