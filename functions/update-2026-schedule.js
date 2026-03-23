const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const races2026 = [
  { date: "2026-04-18", track: "Grundy County Speedway", city: "Morris", state: "IL", eventName: "Grundy County Speedway", startTime: "TBD", type: "superCup", season: 2026 },
  { date: "2026-05-25", track: "Golden Sands Speedway", city: "Wisconsin Rapids", state: "WI", eventName: "Golden Sands Speedway", startTime: "TBD", type: "superCup", season: 2026 },
  { date: "2026-06-07", track: "Slinger Speedway", city: "Slinger", state: "WI", eventName: "Slinger Speedway", startTime: "TBD", type: "superCup", season: 2026 },
  { date: "2026-06-13", track: "Grundy County Speedway", city: "Morris", state: "IL", eventName: "Grundy County Speedway", startTime: "TBD", type: "superCup", season: 2026 },
  { date: "2026-07-03", track: "Tomah Speedway", city: "Tomah", state: "WI", eventName: "Tomah Speedway", startTime: "TBD", type: "superCup", season: 2026 },
  { date: "2026-07-04", track: "La Crosse Speedway", city: "West Salem", state: "WI", eventName: "La Crosse Speedway", startTime: "TBD", type: "superCup", season: 2026 },
  { date: "2026-07-11", track: "Dells Raceway Park", city: "Wisconsin Dells", state: "WI", eventName: "Dells Raceway Park", startTime: "TBD", type: "superCup", season: 2026 },
  { date: "2026-07-19", track: "Slinger Speedway", city: "Slinger", state: "WI", eventName: "Small Car Nationals", startTime: "TBD", type: "superCup", season: 2026 },
  { date: "2026-08-02", track: "Slinger Speedway", city: "Slinger", state: "WI", eventName: "Slinger Speedway", startTime: "TBD", type: "superCup", season: 2026 },
  { date: "2026-08-15", track: "Dells Raceway Park", city: "Wisconsin Dells", state: "WI", eventName: "Dells Raceway Park", startTime: "TBD", type: "superCup", season: 2026 },
  { date: "2026-09-06", track: "Dells Raceway Park", city: "Wisconsin Dells", state: "WI", eventName: "Dells Raceway Park", startTime: "TBD", type: "superCup", season: 2026 },
];

async function updateSchedule() {
  try {
    // 1. Delete all existing 2026 races
    console.log('Fetching existing 2026 races...');
    const existing = await db.collection('races').where('season', '==', 2026).get();
    console.log(`Found ${existing.size} existing 2026 races to delete`);
    
    const batch1 = db.batch();
    existing.forEach(doc => batch1.delete(doc.ref));
    if (existing.size > 0) {
      await batch1.commit();
      console.log(`Deleted ${existing.size} old races`);
    }

    // 2. Add all new 2026 races
    console.log('Adding new 2026 schedule...');
    const batch2 = db.batch();
    races2026.forEach(race => {
      const ref = db.collection('races').doc();
      batch2.set(ref, race);
    });
    await batch2.commit();
    console.log(`Added ${races2026.length} new races`);

    console.log('\n2026 Schedule updated successfully!');
    races2026.forEach(r => console.log(`  ${r.date} - ${r.eventName} (${r.track}, ${r.state})`));
  } catch (error) {
    console.error('Error updating schedule:', error);
  }
}

updateSchedule().then(() => console.log('\nDone.'));
