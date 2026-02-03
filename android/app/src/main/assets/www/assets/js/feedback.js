import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDu91Bi9SiF4K6P_sBjHBUNbjXjEB02X74",
  authDomain: "redsracing-a7f8b.firebaseapp.com",
  projectId: "redsracing-a7f8b",
  storageBucket: "redsracing-a7f8b.firebasestorage.app",
  messagingSenderId: "517034606151",
  appId: "1:517034606151:web:ea84d9fb6b21f5ba99c8a9"
};

const app = initializeApp(firebaseConfig, 'feedback-app');
const db = getFirestore(app);

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
      const name = feedbackForm.name.value;
      const email = feedbackForm.email.value;
      const message = feedbackForm.message.value;

      feedbackStatus.textContent = "Sending...";
      feedbackStatus.classList.remove("text-red-500", "text-green-500");

      try {
        const feedbackRef = collection(db, 'feedback');
        await addDoc(feedbackRef, {
          name: name,
          email: email,
          message: message,
          createdAt: serverTimestamp(),
          responded: false,
          improvementMade: false
        });

        feedbackStatus.textContent = "Feedback sent successfully! We'll get back to you soon.";
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
