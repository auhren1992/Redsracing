import "./app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "./firebase-core.js";
import { monitorAuthState } from "./auth-utils.js";

// Import sanitization utilities
import { html, safeSetHTML } from "./sanitize.js";

async function main() {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();

  const qnaContainer = document.getElementById("qna-container");
  const qnaFormContainer = document.getElementById("qna-form-container");
  const qnaForm = document.getElementById("qna-form");
  const qnaQuestionInput = document.getElementById("qna-question");
  const qnaFormStatus = document.getElementById("qna-form-status");

  monitorAuthState(
    (user) => {
      if (user) {
        if (qnaFormContainer) qnaFormContainer.style.display = "block";
      } else {
        if (qnaFormContainer) qnaFormContainer.style.display = "none";
      }
    },
    (error) => {
      if (qnaFormContainer) qnaFormContainer.style.display = "none";
    },
  );

  if (qnaForm) {
    qnaForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user) {
        if (qnaFormStatus) {
          qnaFormStatus.textContent =
            "You must be logged in to ask a question.";
          qnaFormStatus.style.color = "#ef4444";
        }
        return;
      }
      const questionText = qnaQuestionInput.value.trim();
      if (!questionText) return;

      try {
        await addDoc(collection(db, "qna_submissions"), {
          question: questionText,
          status: "submitted",
          submitterUid: user.uid,
          submitterName: user.displayName || "Anonymous",
          submittedAt: serverTimestamp(),
        });
        if (qnaFormStatus) {
          qnaFormStatus.textContent =
            "Your question has been submitted for approval!";
          qnaFormStatus.style.color = "#22c55e";
        }
        if (qnaQuestionInput) qnaQuestionInput.value = "";
      } catch (error) {
        if (qnaFormStatus) {
          qnaFormStatus.textContent =
            "Error submitting question. Please try again.";
          qnaFormStatus.style.color = "#ef4444";
        }
      }
      setTimeout(() => {
        if (qnaFormStatus) qnaFormStatus.textContent = "";
      }, 5000);
    });
  }

  const renderQAs = () => {
    if (!qnaContainer) return;
    const q = query(
      collection(db, "qna_submissions"),
      where("status", "==", "published"),
      orderBy("answeredAt", "desc"),
    );
    onSnapshot(q, (snapshot) => {
      qnaContainer.innerHTML = "";
      if (snapshot.empty) {
        qnaContainer.innerHTML = `<p class="text-slate-400 text-center">No questions have been answered yet. Be the first to ask one!</p>`;
        return;
      }
      snapshot.forEach((doc) => {
        const qna = doc.data();
        const qnaItem = document.createElement("div");
        qnaItem.className = "card p-6 rounded-lg";

        const qnaHTML = html`
          <p class="text-lg text-slate-400 font-semibold">Q: ${qna.question}</p>
          <p class="text-lg text-white mt-4 pl-4 border-l-4 border-neon-yellow">
            ${qna.answer}
          </p>
          <p class="text-sm text-slate-500 text-right mt-4">
            - Asked by ${qna.submitterName}
          </p>
        `;

        safeSetHTML(qnaItem, qnaHTML);
        qnaContainer.appendChild(qnaItem);
      });
    });
  };
  renderQAs();
}

main();
