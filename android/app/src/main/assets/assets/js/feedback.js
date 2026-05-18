import { getFirebaseDb } from "./firebase-core.js";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const db = getFirebaseDb();

/** Notifies staff via deployed Cloud Function (MailerSend). Firestore doc is the durable record. */
const FEEDBACK_EMAIL_FN =
  "https://us-central1-redsracing-a7f8b.cloudfunctions.net/handleSendFeedback";

async function notifyFeedbackByEmail(name, email, message) {
  const res = await fetch(FEEDBACK_EMAIL_FN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, message }),
  });
  if (!res.ok && res.status !== 202) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Notification request failed (${res.status})`);
  }
}

// Update feedback stats
async function updateFeedbackStats() {
  try {
    const feedbackRef = collection(db, 'feedback');
    const snapshot = await getDocs(feedbackRef);
    
    let totalFeedback = 0;
    let respondedFeedback = 0;
    let totalResponseTime = 0;
    let responseCount = 0;
    let improvementsMade = 0;
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      totalFeedback++;
      
      if (data.responded) {
        respondedFeedback++;
        
        if (data.responseTime) {
          totalResponseTime += data.responseTime;
          responseCount++;
        }
      }
      
      if (data.improvementMade) {
        improvementsMade++;
      }
    });
    
    // Update UI
    document.getElementById('feedback-received').textContent = totalFeedback;
    
    const responseRate = totalFeedback > 0 ? Math.round((respondedFeedback / totalFeedback) * 100) : 0;
    document.getElementById('response-rate').textContent = responseRate + '%';
    
    if (responseCount > 0) {
      const avgHours = Math.round(totalResponseTime / responseCount / (1000 * 60 * 60));
      document.getElementById('avg-response-time').textContent = avgHours + 'h';
    } else {
      document.getElementById('avg-response-time').textContent = '--';
    }
    
    document.getElementById('improvements-made').textContent = improvementsMade;
  } catch (error) {
    console.error('Error updating feedback stats:', error);
  }
}

async function main() {
  // Load stats on page load
  updateFeedbackStats();
  
  const feedbackForm = document.getElementById("feedbackForm");
  const feedbackStatus = document.getElementById("feedbackStatus");

  if (feedbackForm) {
    feedbackForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = (feedbackForm.name.value || "").trim();
      const email = (feedbackForm.email.value || "").trim();
      const message = (feedbackForm.message.value || "").trim();

      feedbackStatus.textContent = "Sending...";
      feedbackStatus.classList.remove("text-red-500", "text-green-500", "text-amber-400");

      try {
        const feedbackRef = collection(db, 'feedback');
        await addDoc(feedbackRef, {
          // Keep payload aligned with firestore.rules onlyHasKeys() for /feedback
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          message,
          createdAt: serverTimestamp(),
          source: 'web',
          page: (window.location && window.location.pathname ? window.location.pathname : 'feedback.html')
        });

        try {
          await notifyFeedbackByEmail(name, email, message);
        } catch (emailErr) {
          console.warn("Feedback saved; email notification failed:", emailErr);
          feedbackStatus.textContent =
            "Your feedback was saved. When we respond, we’ll reply to the email you entered above—please watch that inbox (and spam). We couldn’t notify the team by email this instant, but they can still read your message in the admin console.";
          feedbackStatus.classList.add("text-amber-400");
          feedbackForm.reset();
          updateFeedbackStats();
          return;
        }

        feedbackStatus.textContent =
          `Thanks! We received your feedback. When we respond, we’ll reply directly to ${email}—please check that inbox and your spam folder.`;
        feedbackStatus.classList.add("text-green-500");
        feedbackForm.reset();
        
        // Update stats after submission
        updateFeedbackStats();
      } catch (error) {
        console.error('Error submitting feedback:', error);
        feedbackStatus.textContent = "Failed to send feedback. Please try again.";
        feedbackStatus.classList.add("text-red-500");
      }
    });
  }
}

main();
