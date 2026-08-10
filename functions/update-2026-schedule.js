const { races2026 } = require('../scripts/asc-2026-schedule.js');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateSchedule() {
  try {
    console.log('Fetching existing 2026 races...');
    const existing = await db.collection('races').where('season', '==', 2026).get();
    console.log(`Found ${existing.size} existing 2026 races to delete`);

    const batch1 = db.batch();
    existing.forEach(doc => batch1.delete(doc.ref));
    if (existing.size > 0) {
      await batch1.commit();
      console.log(`Deleted ${existing.size} old races`);
    }

    console.log('Adding new 2026 schedule...');
    const batch2 = db.batch();
    races2026.forEach(race => {
      const ref = db.collection('races').doc();
      batch2.set(ref, race);
    });
    await batch2.commit();
    console.log(`Added ${races2026.length} new races`);

    console.log('\n2026 Schedule updated successfully!');
    races2026.forEach(r => console.log(`  #${r.raceNumber} ${r.date} - ${r.eventName} (${r.track}, ${r.state}) [${r.status}]`));
  } catch (error) {
    console.error('Error updating schedule:', error);
  }
}

updateSchedule().then(() => console.log('\nDone.'));
