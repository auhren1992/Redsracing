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
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import {
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseStorage,
} from "./firebase-core.js";
import { monitorAuthState, validateUserClaims } from "./auth-utils.js";

// Import sanitization utilities
import {
  html,
  safeSetHTML,
  setSafeText,
  createSafeElement,
} from "./sanitize.js";

async function main() {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();
  let canTeamDelete = false;
  try {
    const claims = await validateUserClaims();
    canTeamDelete = claims.success && claims.claims.role === 'team-member';
  } catch {}

  // UI Elements
  const uploadContainer = document.getElementById("upload-container");
  const uploadInput = document.getElementById("photo-upload-input");
  const uploadBtn = document.getElementById("upload-btn");
  const progressBar = document.getElementById("upload-progress-bar");
  const uploadStatus = document.getElementById("upload-status");
  const galleryContainer = document.getElementById("dynamic-gallery-container");
  let selectedFile = null;

  // Ensure upload UI is visible with proper state based on auth
  function updateUploadVisibility(user) {
    if (!uploadContainer) return;
    uploadContainer.style.display = "block";
    const isAuthed = !!user;

    if (uploadInput) uploadInput.disabled = !isAuthed;
    if (uploadBtn) uploadBtn.disabled = !isAuthed || !selectedFile;

    if (uploadStatus) {
      if (!isAuthed) {
        uploadStatus.textContent = "Please log in to upload photos.";
        uploadStatus.style.color = "#94a3b8";
      } else if (!selectedFile) {
        uploadStatus.textContent = "";
        uploadStatus.style.color = "";
      }
    }
  }

  // Auth State Change
  monitorAuthState(
    (user) => {
      updateUploadVisibility(user);
    },
    (error) => {
      if (uploadContainer) {
        uploadContainer.style.display = "block";
      }
      updateUploadVisibility(null);
    },
  );

  updateUploadVisibility(auth.currentUser);

  // Photo Upload Logic
  if (uploadInput) {
    uploadInput.addEventListener("change", (e) => {
      selectedFile = e.target.files[0];
      if (selectedFile) {
        if (uploadBtn) uploadBtn.disabled = false;
        if (uploadStatus)
          uploadStatus.textContent = `Selected: ${selectedFile.name}`;
        if (uploadStatus) uploadStatus.style.color = "";
      } else {
        if (uploadBtn) uploadBtn.disabled = true;
      }
      updateUploadVisibility(auth.currentUser);
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
      if (!selectedFile || !auth.currentUser) return;
      uploadBtn.disabled = true;
      if (uploadInput) uploadInput.disabled = true;

      const userId = auth.currentUser.uid;
      const timestamp = Date.now();
      const storageRef = ref(
        storage,
        `gallery/jonny/${timestamp}-${selectedFile.name}`,
      );
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (progressBar) progressBar.style.width = progress + "%";
          if (uploadStatus)
            uploadStatus.textContent = `Uploading... ${Math.round(progress)}%`;
        },
        (error) => {
          if (uploadStatus) {
            uploadStatus.textContent = `Upload failed: ${error.message}`;
            uploadStatus.style.color = "#ef4444";
          }
          uploadBtn.disabled = false;
          if (uploadInput) uploadInput.disabled = false;
        },
        async () => {
          if (uploadStatus) uploadStatus.textContent = "Processing...";
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, "gallery_images"), {
              imageUrl: downloadURL,
              uploaderUid: userId,
              uploaderEmail: auth.currentUser.email,
              uploaderDisplayName: auth.currentUser.displayName || "Anonymous",
              createdAt: serverTimestamp(),
              tags: [],
              approved: false,
              category: "jonny",
              likes: [],
              likeCount: 0,
              storagePath: `gallery/jonny/${timestamp}-${selectedFile.name}`,
            });

            if (uploadStatus) {
              uploadStatus.textContent =
                "Upload complete! Waiting for approval.";
              uploadStatus.style.color = "#22c55e";
            }
            selectedFile = null;
            if (uploadInput) uploadInput.value = "";
          } catch (error) {
            if (uploadStatus) {
              uploadStatus.textContent = "Error saving file data.";
              uploadStatus.style.color = "#ef4444";
            }
          } finally {
            if (uploadInput) uploadInput.disabled = false;
          }
        },
      );
    });
  }

  // Dynamic Gallery Rendering - GALLERY ONLY
  const renderGallery = () => {
    if (!galleryContainer) return;
    const q = query(
      collection(db, "gallery_images"),
      where("approved", "==", true),
      where("category", "==", "jonny"),
      orderBy("createdAt", "desc"),
    );
    onSnapshot(q, (snapshot) => {
      galleryContainer.innerHTML = "";
      if (snapshot.empty) {
        galleryContainer.innerHTML = "";
        const placeholders = [
          'https://placehold.co/800x800/1e293b/ff3333?text=Jonny+\u2022+1',
          'https://placehold.co/800x800/1e293b/ff3333?text=Jonny+\u2022+2',
          'https://placehold.co/800x800/1e293b/ff3333?text=Jonny+\u2022+3',
          'https://placehold.co/800x800/1e293b/ff3333?text=Jonny+\u2022+4'
        ];
        placeholders.forEach((src) => {
          const ph = document.createElement('div');
          ph.className = 'gallery-item gallery-item-3d aspect-square relative overflow-hidden rounded-lg group';
          ph.innerHTML = `
            <img src="${src}" alt="Placeholder - Jonny" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
            <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <p class="text-xs text-slate-300">Placeholder preview — upload photos to replace</p>
            </div>
          `;
          galleryContainer.appendChild(ph);
        });
        const note = document.createElement('p');
        note.className = 'text-slate-400 col-span-full text-center mt-4';
        note.textContent = 'No approved photos of Jonny yet. These are placeholders to preview the effect.';
        galleryContainer.appendChild(note);
        return;
      }
      snapshot.forEach((docSnapshot) => {
        const image = docSnapshot.data();
        const imageId = docSnapshot.id;
        const galleryItem = document.createElement("div");
        galleryItem.className =
          "gallery-item gallery-item-3d aspect-square reveal-up relative overflow-hidden rounded-lg group";

        const currentUser = auth.currentUser;
        const isLiked =
          currentUser && image.likes && image.likes.includes(currentUser.uid);
        const likeCount = image.likeCount || 0;

        const likeButtonClass = isLiked ? "text-red-400" : "text-slate-400";
        const canDelete = canTeamDelete;
        const fillValue = isLiked ? "currentColor" : "none";
        const disabledAttr = !currentUser ? "disabled" : "";

        const galleryHTML = html`
          <img
            src="${image.imageUrl}"
            alt="User uploaded photo of Jonny Kirsch"
            class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <div
            class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent"
          >
            <p class="text-sm text-slate-300">
              Uploaded by: ${image.uploaderDisplayName || "Anonymous"}
            </p>
            <div class="mt-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
              <button
                class="like-btn flex items-center space-x-1 text-xs ${likeButtonClass} hover:text-red-400 transition"
                data-image-id="${imageId}"
                ${disabledAttr}
              >
                <svg
                  class="w-4 h-4"
                  fill="${fillValue}"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 000-6.364 4.5 4.5 0 00-6.364 0L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  ></path>
                </svg>
                <span class="like-count">${likeCount}</span>
              </button>
              ${canDelete ? html`<button class="delete-btn flex items-center space-x-1 text-xs text-red-400 hover:text-red-300 transition" data-image-id="${imageId}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                <span>Delete</span>
              </button>` : ""}
              </div>
              <button
                class="comment-btn flex items-center space-x-1 text-xs text-slate-400 hover:text-blue-400 transition"
                data-image-id="${imageId}"
                ${disabledAttr}
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  ></path>
                </svg>
                <span>Comment</span>
              </button>
            </div>
          </div>
        `;

        safeSetHTML(galleryItem, galleryHTML);
        const delBtn = galleryItem.querySelector('.delete-btn');
        if (delBtn) {
          delBtn.addEventListener('click', async () => {
            if (!confirm('Delete this photo?')) return;
            try {
              await deleteImage(imageId, image);
            } catch (e) {}
          });
        }
        galleryContainer.appendChild(galleryItem);
      });
    });
  };

  async function deleteImage(imageId, image) {
    try {
      const imageRef = doc(db, 'gallery_images', imageId);
      try {
        const s = getFirebaseStorage();
const { ref: sref, deleteObject } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js');
        let path = image.storagePath;
        if (!path && image.imageUrl) {
          const m = image.imageUrl.match(/\/o\/([^?]+)\?/);
          if (m) path = decodeURIComponent(m[1]);
        }
        if (path) {
          const objRef = sref(s, path);
          await deleteObject(objRef).catch(()=>{});
        }
      } catch {}
await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js').then(async ({ deleteDoc }) => {
        await deleteDoc(imageRef);
      });
    } catch {}
  }

  // --- Social Features ---
  const toggleLike = async (imageId) => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const imageRef = doc(db, "gallery_images", imageId);

    try {
      const imageDoc = await getDocs(
        query(
          collection(db, "gallery_images"),
          where("__name__", "==", imageId),
        ),
      );
      if (imageDoc.empty) return;

      const imageData = imageDoc.docs[0].data();
      const currentLikes = imageData.likes || [];
      const isLiked = currentLikes.includes(userId);

      if (isLiked) {
        await updateDoc(imageRef, {
          likes: arrayRemove(userId),
          likeCount: increment(-1),
        });
      } else {
        await updateDoc(imageRef, {
          likes: arrayUnion(userId),
          likeCount: increment(1),
        });
      }
    } catch (error) {}
  };

  const showCommentModal = (imageId) => {
    const modal = document.createElement("div");
    modal.className =
      "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
    modal.innerHTML = `
            <div class="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-white">Comments</h3>
                    <button class="close-modal text-slate-400 hover:text-white text-xl">&times;</button>
                </div>
                <div id="comments-list" class="space-y-3 mb-4 max-h-60 overflow-y-auto">
                    <p class="text-slate-400 text-sm">Loading comments...</p>
                </div>
                <div class="flex space-x-2">
                    <input type="text" id="comment-input" placeholder="Add a comment..." 
                           class="flex-1 bg-slate-700 text-white px-3 py-2 rounded-md border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <button id="add-comment-btn" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-500">Post</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);

    loadComments(imageId);

    modal.querySelector(".close-modal").addEventListener("click", () => {
      document.body.removeChild(modal);
    });

    modal.querySelector("#add-comment-btn").addEventListener("click", () => {
      addComment(imageId);
    });

    modal.querySelector("#comment-input").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        addComment(imageId);
      }
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  };

  const loadComments = async (imageId) => {
    const commentsList = document.getElementById("comments-list");
    if (!commentsList) return;

    try {
      const commentsQuery = query(
        collection(db, "gallery_images", imageId, "comments"),
        orderBy("createdAt", "desc"),
      );

      onSnapshot(commentsQuery, (snapshot) => {
        commentsList.innerHTML = "";
        if (snapshot.empty) {
          commentsList.innerHTML =
            '<p class="text-slate-400 text-sm">No comments yet. Be the first to comment!</p>';
          return;
        }

        snapshot.forEach((doc) => {
          const comment = doc.data();
          const commentEl = document.createElement("div");
          commentEl.className = "bg-slate-700 p-3 rounded-md";
          commentEl.innerHTML = `
                        <p class="text-sm text-slate-300 font-semibold">${comment.authorDisplayName || "Anonymous"}</p>
                        <p class="text-sm text-slate-100 mt-1">${comment.text}</p>
                        <p class="text-xs text-slate-400 mt-2">${comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleString() : "Just now"}</p>
                    `;
          commentsList.appendChild(commentEl);
        });
      });
    } catch (error) {
      commentsList.innerHTML =
        '<p class="text-red-400 text-sm">Error loading comments.</p>';
    }
  };

  const addComment = async (imageId) => {
    if (!auth.currentUser) return;

    const commentInput = document.getElementById("comment-input");
    const commentText = commentInput.value.trim();

    if (!commentText) return;

    try {
      await addDoc(collection(db, "gallery_images", imageId, "comments"), {
        text: commentText,
        authorUid: auth.currentUser.uid,
        authorDisplayName: auth.currentUser.displayName || "Anonymous",
        createdAt: serverTimestamp(),
      });

      commentInput.value = "";
    } catch (error) {}
  };

  // Event delegation for like and comment buttons
  if (galleryContainer) {
    galleryContainer.addEventListener("click", (e) => {
      if (e.target.closest(".like-btn")) {
        e.preventDefault();
        const imageId = e.target.closest(".like-btn").dataset.imageId;
        toggleLike(imageId);
      }

      if (e.target.closest(".comment-btn")) {
        e.preventDefault();
        const imageId = e.target.closest(".comment-btn").dataset.imageId;
        showCommentModal(imageId);
      }
    });
  }

  // ONLY render gallery - no videos, no other sections
  renderGallery();
}

main();
