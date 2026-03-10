# Voice Update Setup for Live Race Control

This guide shows you how to update race positions hands-free using Siri or Google Assistant.

## Option 1: iOS Siri Shortcuts (Recommended for iPhone)

###Step 1: Install the Shortcut
1. Open **Shortcuts** app on iPhone
2. Tap **+** to create new shortcut
3. Add these actions in order:

**Action 1: Ask for Input**
- Question: "What's the lap number?"
- Input type: Number
- Save as: `Lap`

**Action 2: Ask for Input**
- Question: "Jon's position?"
- Input type: Number
- Save as: `JonPos`

**Action 3: Ask for Input**
- Question: "Jonny's position?"
- Input type: Number
- Save as: `JonnyPos`

**Action 4: Get Contents of URL**
- URL: `https://us-central1-redsracing-a7f8b.cloudfunctions.net/voiceRaceUpdate`
- Method: POST
- Headers:
  - `Content-Type`: `application/json`
- Request Body (JSON):
```json
{
  "lap": [Lap],
  "jonPos": [JonPos],
  "jonnyPos": [JonnyPos],
  "key": "YOUR_SECRET_KEY_HERE"
}
```

**Action 5: Show Notification**
- Title: "Race Update Posted!"
- Body: "Lap [Lap]: Jon P[JonPos], Jonny P[JonnyPos]"

### Step 2: Name the Shortcut
- Name it: **"Race Update"**
- Add to Home Screen for quick access

### Step 3: Use It!
Say: **"Hey Siri, Race Update"**
- Siri will ask for lap, Jon's position, Jonny's position
- Confirm and it's posted!

---

## Option 2: IFTTT (Works with Google Assistant & Alexa)

### Step 1: Create IFTTT Applet
1. Go to [ifttt.com](https://ifttt.com)
2. Create New Applet
3. **IF THIS**: Google Assistant
   - Say phrase: "Jon is in 3rd place"
   - Response: "Posted Jon's position"

4. **THEN THAT**: Webhooks
   - URL: `https://us-central1-redsracing-a7f8b.cloudfunctions.net/voiceRaceUpdate`
   - Method: POST
   - Content Type: `application/json`
   - Body:
```json
{
  "driver": "jon",
  "position": "{{NumberField}}",
  "key": "YOUR_SECRET_KEY_HERE"
}
```

### Step 2: Create More Applets
Repeat for:
- "Jonny is in 8th place"
- "Set lap to 15"
- "Green flag"
- "Caution flag"

### Step 3: Use It!
Say: **"OK Google, Jon is in 3rd place"**

---

## Option 3: Simple URL (Any Device)

Create bookmarks on your phone:

**Update Jon:**
```
https://us-central1-redsracing-a7f8b.cloudfunctions.net/voiceRaceUpdate?driver=jon&position=3&key=YOUR_KEY
```

**Update Jonny:**
```
https://us-central1-redsracing-a7f8b.cloudfunctions.net/voiceRaceUpdate?driver=jonny&position=8&key=YOUR_KEY
```

Just tap the bookmark to update!

---

## Firebase Function Code

Add this to `functions/index.js`:

```javascript
/**
 * Voice-activated race update webhook
 * Accepts simple voice commands to update live race positions
 */
exports.voiceRaceUpdate = onRequest({ secrets: ["SENTRY_DSN"] }, async (req, res) => {
  cors(req, res, async () => {
    try {
      // Simple API key check
      const apiKey = req.body?.key || req.query?.key;
      if (apiKey !== process.env.VOICE_UPDATE_KEY) {
        res.status(403).json({ error: 'Invalid API key' });
        return;
      }

      const db = getFirestore();
      const raceRef = db.collection('live_race').doc('current');
      
      // Get current race data
      const raceDoc = await raceRef.get();
      if (!raceDoc.exists) {
        res.status(404).json({ error: 'No active race session' });
        return;
      }

      const updates = {};
      
      // Parse voice command
      const { driver, position, lap, event } = req.body || req.query;
      
      if (driver && position) {
        // Update specific driver position
        if (driver === 'jon' || driver === 'Jon') {
          updates['drivers.jon.position'] = position;
        } else if (driver === 'jonny' || driver === 'Jonny') {
          updates['drivers.jonny.position'] = position;
        }
      }
      
      if (lap) {
        updates.currentLap = parseInt(lap);
      }
      
      if (event) {
        updates.event = event; // e.g., "🟢 Green Flag", "🟡 Caution"
        updates.eventTimestamp = FieldValue.serverTimestamp();
      }
      
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'No valid updates provided' });
        return;
      }

      // Update Firestore
      updates.lastUpdate = FieldValue.serverTimestamp();
      await raceRef.update(updates);
      
      logger.info('Voice race update:', updates);
      res.status(200).json({ success: true, updates });
      
    } catch (error) {
      logger.error('Voice update error:', error);
      try { Sentry.captureException(error); } catch (_) {}
      res.status(500).json({ error: 'Update failed' });
    }
  });
});
```

## Security Setup

1. Generate a random API key:
```bash
openssl rand -hex 32
```

2. Add to Firebase config:
```bash
firebase functions:secrets:set VOICE_UPDATE_KEY
# Paste your generated key
```

3. Replace `YOUR_SECRET_KEY_HERE` in shortcuts with this key

---

## Testing

Test the webhook with curl:
```bash
curl -X POST https://us-central1-redsracing-a7f8b.cloudfunctions.net/voiceRaceUpdate \
  -H "Content-Type: application/json" \
  -d '{"driver":"jon","position":"3","key":"YOUR_KEY"}'
```

---

## Tips

- **At the track**: Use Siri Shortcuts for fastest updates
- **Pre-race**: Set lap info and track name via admin panel
- **During race**: Just say positions via voice
- **Post-race**: Tap "End Race Session" in admin panel

---

## Troubleshooting

**"Invalid API key"** - Check your secret key matches
**"No active race session"** - Start race via admin panel first
**"Update failed"** - Check Firebase logs for details
