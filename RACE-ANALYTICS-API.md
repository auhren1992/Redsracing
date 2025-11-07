# 🏁 Race Analytics & Photo Management API

New Python Cloud Functions for race data tracking and photo processing.

---

## 🏆 Race Analytics Endpoints

### 1. Add Race Result (Admin Only)
**Endpoint:** `POST /api/add-race-result`  
**Auth:** Required (Team Member role)

**Request Body:**
```json
{
  "driverId": "jon_kirsch",
  "driverName": "Jon Kirsch",
  "carNumber": "8",
  "raceDate": "2025-08-31",
  "trackName": "Dells Raceway Park",
  "trackLocation": "Wisconsin Dells, WI",
  "season": "2025",
  "raceType": "Feature",
  "startPosition": 8,
  "finishPosition": 4,
  "lapTimes": [15.234, 15.198, 15.156],
  "fastestLap": 15.156,
  "points": 415,
  "incidents": ["Contact on lap 12"],
  "weather": "Sunny, 75°F",
  "notes": "Great race, gained 4 positions"
}
```

**Response:**
```json
{
  "message": "Race result added successfully",
  "id": "race_doc_id"
}
```

---

### 2. Get Race Analytics
**Endpoint:** `GET /api/race-analytics?driverId={id}&season={year}&trackName={track}`  
**Auth:** Not required

**Query Parameters:**
- `driverId` (required): Driver identifier
- `season` (optional): Filter by season year
- `trackName` (optional): Filter by specific track

**Response:**
```json
{
  "driverId": "jon_kirsch",
  "totalRaces": 12,
  "totalPoints": 415,
  "avgFinishPosition": 8.5,
  "medianFinishPosition": 9,
  "bestFinish": 1,
  "worstFinish": 18,
  "avgStartPosition": 11.2,
  "avgPositionsGained": 2.7,
  "fastestLapTime": 15.156,
  "avgLapTime": 15.234,
  "races": [...]
}
```

---

### 3. Driver Comparison
**Endpoint:** `GET /api/driver-comparison?driver1Id={id1}&driver2Id={id2}&season={year}`  
**Auth:** Not required

**Query Parameters:**
- `driver1Id` (required): First driver ID
- `driver2Id` (required): Second driver ID  
- `season` (optional): Filter by season

**Response:**
```json
{
  "driver1": {
    "driverId": "jon_kirsch",
    "driverName": "Jon Kirsch",
    "totalRaces": 12,
    "totalPoints": 415,
    "avgFinishPosition": 8.5,
    "bestFinish": 1,
    "worstFinish": 18,
    "fastestLapTime": 15.156
  },
  "driver2": {
    "driverId": "jonny_kirsch",
    "driverName": "Jonny Kirsch",
    "totalRaces": 10,
    "totalPoints": 380,
    "avgFinishPosition": 9.2,
    "bestFinish": 2,
    "worstFinish": 15,
    "fastestLapTime": 15.201
  },
  "winner": {
    "avgFinish": "jon_kirsch",
    "totalPoints": "jon_kirsch",
    "bestFinish": "jon_kirsch"
  }
}
```

---

### 4. Track Records
**Endpoint:** `GET /api/track-records?trackName={track}&season={year}`  
**Auth:** Not required

**Query Parameters:**
- `trackName` (optional): Filter by track
- `season` (optional): Filter by season

**Response:**
```json
{
  "trackName": "Dells Raceway Park",
  "season": "2025",
  "fastestLapRecord": {
    "driverName": "Jon Kirsch",
    "fastestLap": 15.156,
    "raceDate": "2025-08-31",
    "trackName": "Dells Raceway Park"
  },
  "bestFinishRecord": {
    "driverName": "Jon Kirsch",
    "raceDate": "2025-07-15",
    "trackName": "Dells Raceway Park"
  },
  "totalRaces": 12
}
```

---

### 5. Season Standings
**Endpoint:** `GET /api/season-standings?season={year}`  
**Auth:** Not required

**Query Parameters:**
- `season` (optional): Default "2025"

**Response:**
```json
{
  "season": "2025",
  "standings": [
    {
      "position": 1,
      "driverId": "jon_kirsch",
      "driverName": "Jon Kirsch",
      "carNumber": "8",
      "totalPoints": 415,
      "racesEntered": 12,
      "wins": 1,
      "top5s": 4
    },
    {
      "position": 2,
      "driverId": "jonny_kirsch",
      "driverName": "Jonny Kirsch",
      "carNumber": "88",
      "totalPoints": 380,
      "racesEntered": 10,
      "wins": 0,
      "top5s": 3
    }
  ]
}
```

---

## 📸 Photo Management Endpoints

### 6. Process Photo
**Endpoint:** `POST /api/photo-process`  
**Auth:** Required

**Request Body:**
```json
{
  "imageUrl": "https://storage.googleapis.com/bucket/photo.jpg"
}
```

**Response:**
```json
{
  "format": "JPEG",
  "mode": "RGB",
  "sizes": {
    "original": {"width": 4032, "height": 3024},
    "large": {"width": 1920, "height": 1440},
    "medium": {"width": 1024, "height": 768},
    "small": {"width": 640, "height": 480},
    "thumbnail": {"width": 320, "height": 240}
  },
  "exif": {
    "dateTaken": "2025:08:31 14:30:00",
    "hasGPS": true
  },
  "fileSize": 2457600
}
```

---

### 7. Sort Photos
**Endpoint:** `GET /api/photo-sort?sortBy={type}&driverId={id}&trackName={track}`  
**Auth:** Not required

**Query Parameters:**
- `sortBy` (optional): "date" (default), "track", "driver", "likes"
- `driverId` (optional): Filter by driver
- `trackName` (optional): Filter by track
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date

**Response:**
```json
{
  "photos": [...],
  "totalCount": 150,
  "sortedBy": "date",
  "grouped": {
    "Dells Raceway Park": [...],
    "Golden Sands Speedway": [...]
  }
}
```

---

## 🔥 Firebase Rewrites Configuration

Add these to your `firebase.json` rewrites section:

```json
{
  "source": "/api/add-race-result",
  "function": "python-api/handleAddRaceResult"
},
{
  "source": "/api/race-analytics",
  "function": "python-api/handleGetRaceAnalytics"
},
{
  "source": "/api/driver-comparison",
  "function": "python-api/handleDriverComparison"
},
{
  "source": "/api/track-records",
  "function": "python-api/handleGetTrackRecords"
},
{
  "source": "/api/season-standings",
  "function": "python-api/handleGetSeasonStandings"
},
{
  "source": "/api/photo-process",
  "function": "python-api/handlePhotoProcess"
},
{
  "source": "/api/photo-sort",
  "function": "python-api/handlePhotoSort"
}
```

---

## 💻 JavaScript Usage Examples

### Add Race Result (Admin)
```javascript
async function addRaceResult(raceData) {
  const token = await firebase.auth().currentUser.getIdToken();
  
  const response = await fetch('/api/add-race-result', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(raceData)
  });
  
  return await response.json();
}
```

### Get Driver Analytics
```javascript
async function getDriverAnalytics(driverId, season = '2025') {
  const response = await fetch(`/api/race-analytics?driverId=${driverId}&season=${season}`);
  const data = await response.json();
  return data;
}
```

### Compare Drivers
```javascript
async function compareDrivers(driver1Id, driver2Id) {
  const response = await fetch(`/api/driver-comparison?driver1Id=${driver1Id}&driver2Id=${driver2Id}`);
  const data = await response.json();
  return data;
}
```

### Get Season Standings
```javascript
async function getStandings(season = '2025') {
  const response = await fetch(`/api/season-standings?season=${season}`);
  const data = await response.json();
  return data.standings;
}
```

---

## 📊 Firestore Data Structure

### Race Results Collection: `race_results`
```javascript
{
  driverId: "jon_kirsch",
  driverName: "Jon Kirsch",
  carNumber: "8",
  raceDate: "2025-08-31",
  trackName: "Dells Raceway Park",
  trackLocation: "Wisconsin Dells, WI",
  season: "2025",
  raceType: "Feature",
  startPosition: 8,
  finishPosition: 4,
  lapTimes: [15.234, 15.198, 15.156],
  fastestLap: 15.156,
  points: 415,
  incidents: ["Contact on lap 12"],
  weather: "Sunny, 75°F",
  notes: "Great race",
  createdAt: Timestamp,
  createdBy: "uid_of_admin"
}
```

---

## 🎯 Next Steps

1. Deploy Python functions: `firebase deploy --only "functions:python-api"`
2. Add firebase.json rewrites
3. Create admin UI for data entry
4. Build analytics dashboard with charts
5. Test all endpoints

---

## 📞 Support

All functions include error handling and Sentry integration for monitoring.
