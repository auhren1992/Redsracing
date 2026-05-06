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
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getFirebaseAuth, getFirebaseDb } from "./firebase-core.js";
import { monitorAuthState } from "./auth-utils.js";

// Import sanitization utilities
import { html, safeSetHTML } from "./sanitize.js";

function formatAnsweredAt(ts) {
  try {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function clampText(value, maxLen) {
  const s = String(value || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
}

async function main() {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();

  const qnaContainer = document.getElementById("qna-container");
  const qnaLatest = document.getElementById("rr-qna-latest");
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
      if (qnaLatest) qnaLatest.innerHTML = "";

      if (snapshot.empty) {
        qnaContainer.innerHTML = `<p class="text-slate-400 text-center">No questions have been answered yet. Be the first to ask one!</p>`;
        if (qnaLatest) {
          qnaLatest.innerHTML = `<div class="rr-qna-mini"><div class="rr-qna-mini-q">No answered questions yet</div><p class="rr-qna-mini-a">Ask the first question and we’ll answer it here.</p><div class="rr-qna-mini-meta"><span class="rr-qna-mini-pill">NEW</span><span>—</span></div></div>`;
        }
        return;
      }

      // Hero preview: top 3 most recent published answers (same query ordering)
      if (qnaLatest) {
        const top = snapshot.docs.slice(0, 3).map((d) => d.data());
        top.forEach((qna) => {
          const answeredLabel = formatAnsweredAt(qna.answeredAt) || "Answered";
          const mini = document.createElement("div");
          mini.className = "rr-qna-mini";
          const miniHTML = html`
            <div class="rr-qna-mini-q">${clampText(qna.question, 120)}</div>
            <p class="rr-qna-mini-a">${clampText(qna.answer, 160)}</p>
            <div class="rr-qna-mini-meta">
              <span class="rr-qna-mini-pill">ANSWERED</span>
              <span>${answeredLabel}</span>
            </div>
          `;
          safeSetHTML(mini, miniHTML);
          qnaLatest.appendChild(mini);
        });
      }

      snapshot.forEach((doc) => {
        const qna = doc.data();
        const qnaItem = document.createElement("div");
        qnaItem.className = "rr-qna-card p-6 rounded-2xl";
        const answeredLabel = formatAnsweredAt(qna.answeredAt);

        const qnaHTML = html`
          <div class="rr-qna-meta">
            <span class="rr-qna-badge">ANSWERED</span>
            ${answeredLabel ? html`<span class="rr-qna-date">${answeredLabel}</span>` : ""}
          </div>
          <p class="text-lg text-slate-200 font-semibold rr-qna-q">Q: ${qna.question}</p>
          <p class="text-lg text-white mt-4 pl-4 rr-qna-a">
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
