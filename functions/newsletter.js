const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { MailerSend, EmailParams, Sender, Recipient } = require("mailersend");

// Initialize MailerSend client
const getMailerSend = () => {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) {
    logger.warn('MailerSend API key not found');
    return null;
  }
  return new MailerSend({ apiKey });
};

// Welcome email when someone subscribes
exports.sendWelcomeEmail = onDocumentCreated({
  document: 'subscribers/{subscriberId}',
  secrets: ['MAILERSEND_API_KEY']
}, async (event) => {
  try {
    const mailerSend = getMailerSend();
    if (!mailerSend) {
      throw new Error('MailerSend not initialized');
    }
    
    const subscriber = event.data.data();
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #fbbf24; font-size: 36px; margin: 0;">REDSRACING</h1>
          <p style="color: #94a3b8; font-size: 14px; margin: 5px 0;">EST. 2023</p>
        </div>
        
        <div style="background: rgba(30, 41, 59, 0.6); padding: 30px; border-radius: 12px; border: 1px solid rgba(251, 191, 36, 0.3);">
          <h2 style="color: #ffffff; margin-top: 0;">Welcome to the Team! 🏎️</h2>
          <p style="color: #cbd5e1; line-height: 1.6;">
            Thanks for subscribing to RedsRacing updates! You're now part of the racing family.
          </p>
          <ul style="color: #cbd5e1; line-height: 1.8;">
            <li>🏁 <strong>Upcoming Races</strong> - Notified 24-48 hours before race day</li>
            <li>📊 <strong>Race Results</strong> - Latest stats and standings</li>
            <li>📸 <strong>Exclusive Content</strong> - Behind-the-scenes updates</li>
          </ul>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://redsracing.org" style="display: inline-block; background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #0f172a; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Visit RedsRacing.org
            </a>
          </div>
        </div>
      </div>
    `;

    const sentFrom = new Sender('newsletter@redsracing.org', 'RedsRacing');
    const recipients = [new Recipient(subscriber.email)];
    
    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject('🏁 Welcome to RedsRacing Newsletter!')
      .setHtml(htmlContent)
      .setText('Welcome to RedsRacing! You\'re now subscribed to updates.');

    await mailerSend.email.send(emailParams);
    logger.info('Welcome email sent to:', subscriber.email);
    await event.data.ref.update({ 
      welcomeEmailSent: true, 
      welcomeEmailSentAt: FieldValue.serverTimestamp() 
    });
  } catch (error) {
    logger.error('Error sending welcome email:', error);
  }
});

// Callable function to send new race notification
exports.notifyNewRace = onCall({ 
  secrets: ['MAILERSEND_API_KEY'] 
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required');
  }
  
  const role = request.auth.token?.role || '';
  if (role !== 'admin' && role !== 'team-member') {
    throw new HttpsError('permission-denied', 'Admin or team member only');
  }

  const { raceTitle, raceDate, raceLocation, raceDetails } = request.data;
  if (!raceTitle || !raceDate || !raceLocation) {
    throw new HttpsError('invalid-argument', 'raceTitle, raceDate, and raceLocation are required');
  }

  try {
    const mailerSend = getMailerSend();
    if (!mailerSend) {
      throw new HttpsError('failed-precondition', 'MailerSend not initialized');
    }
    
    const db = getFirestore();
    
    const subscribersSnapshot = await db.collection('subscribers')
      .where('subscribed', '==', true)
      .get();
    const subscribers = subscribersSnapshot.docs.map(doc => doc.data().email);

    if (subscribers.length === 0) {
      return { success: true, message: 'No subscribers to notify' };
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px; border-radius: 16px;">
        <h1 style="color: #fbbf24; text-align: center;">REDSRACING</h1>
        <div style="background: rgba(30, 41, 59, 0.6); padding: 30px; border-radius: 12px; border: 1px solid rgba(251, 191, 36, 0.3);">
          <h2 style="color: #fbbf24; margin-top: 0;">📅 ${raceTitle}</h2>
          <div style="color: #cbd5e1; line-height: 1.8;">
            <p><strong style="color: #ffffff;">Date:</strong> ${raceDate}</p>
            <p><strong style="color: #ffffff;">Location:</strong> ${raceLocation}</p>
            ${raceDetails ? `<p style="margin-top: 15px;">${raceDetails}</p>` : ''}
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://redsracing.org/schedule.html" style="display: inline-block; background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #0f172a; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              View Schedule
            </a>
          </div>
        </div>
      </div>
    `;

    const sentFrom = new Sender('newsletter@redsracing.org', 'RedsRacing');
    const recipients = subscribers.map(email => new Recipient(email));
    
    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject(`🏁 New Race: ${raceTitle}`)
      .setHtml(htmlContent)
      .setText(`New Race: ${raceTitle}\nDate: ${raceDate}\nLocation: ${raceLocation}`);

    await mailerSend.email.send(emailParams);
    logger.info(`Race notification sent to ${subscribers.length} subscribers`);
    
    return { success: true, message: `Sent to ${subscribers.length} subscribers` };
  } catch (error) {
    logger.error('Error sending race notification:', error);
    throw new HttpsError('internal', 'Failed to send notifications');
  }
});

// Scheduled function for upcoming race reminders
exports.sendUpcomingRaceReminders = onSchedule({
  schedule: 'every 24 hours',
  timeZone: 'America/Chicago',
  secrets: ['MAILERSEND_API_KEY']
}, async () => {
  try {
    const mailerSend = getMailerSend();
    if (!mailerSend) {
      logger.warn('MailerSend not initialized, skipping race reminders');
      return null;
    }
    
    const db = getFirestore();
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + (48 * 60 * 60 * 1000));

    const racesSnapshot = await db.collection('races')
      .where('date', '>=', now)
      .where('date', '<=', twoDaysFromNow)
      .where('reminderSent', '==', false)
      .get();

    if (racesSnapshot.empty) {
      logger.info('No upcoming races to remind about');
      return null;
    }

    const subscribersSnapshot = await db.collection('subscribers')
      .where('subscribed', '==', true)
      .get();
    const subscribers = subscribersSnapshot.docs.map(doc => doc.data().email);

    if (subscribers.length === 0) {
      logger.info('No subscribers to notify');
      return null;
    }

    for (const raceDoc of racesSnapshot.docs) {
      const race = raceDoc.data();
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ef4444; font-size: 36px; margin: 0;">⏰ RACE REMINDER</h1>
          </div>
          <div style="background: rgba(30, 41, 59, 0.6); padding: 30px; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3);">
            <h2 style="color: #fbbf24; margin-top: 0;">🏁 ${race.title}</h2>
            <p style="color: #cbd5e1; font-size: 18px;"><strong>Coming up in less than 48 hours!</strong></p>
            <div style="color: #cbd5e1; line-height: 1.8;">
              <p><strong style="color: #ffffff;">Date:</strong> ${race.date.toDate().toLocaleDateString()}</p>
              <p><strong style="color: #ffffff;">Location:</strong> ${race.location}</p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://redsracing.org/schedule.html" style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View Race Details
              </a>
            </div>
          </div>
        </div>
      `;

      const sentFrom = new Sender('newsletter@redsracing.org', 'RedsRacing');
      const recipients = subscribers.map(email => new Recipient(email));
      
      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(`⏰ Race Reminder: ${race.title} Coming Up!`)
        .setHtml(htmlContent)
        .setText(`Race Reminder: ${race.title} coming up in less than 48 hours!`);

      await mailerSend.email.send(emailParams);
      logger.info(`Reminder sent for race: ${race.title}`);
      await raceDoc.ref.update({ 
        reminderSent: true, 
        reminderSentAt: FieldValue.serverTimestamp() 
      });
    }

    return null;
  } catch (error) {
    logger.error('Error sending race reminders:', error);
    return null;
  }
});
