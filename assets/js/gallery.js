import "./app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import {
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseStorage,
} from "./firebase-core.js";

// Import sanitization utilities
import { html, safeSetHTML, createSafeElement, escapeHTML } from "./sanitize.js";
import { validateUserClaims } from "./auth-utils.js";

async function main() {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();

  // --- Auth State ---
  const uploadContainer = document.getElementById("upload-container");
  let isModerator = false; // team-member or admin
  let unsubscribePending = null;

  // --- Photo Upload Logic ---
  const uploadInput = document.getElementById("photo-upload-input");
  const uploadBtn = document.getElementById("upload-btn");
  const progressBar = document.getElementById("upload-progress-bar");
  const uploadStatus = document.getElementById("upload-status");
  let selectedFile = null;

  onAuthStateChanged(auth, async (user) => {
    updateUploadVisibility(user);
    await checkModerator();
  });

  // Apply initial state in case the listener fires later
  updateUploadVisibility(auth.currentUser);
  await checkModerator();

  // Ensure upload UI is visible with proper state based on auth
  function updateUploadVisibility(user) {
    if (!uploadContainer) return;
    // Always show the container so it doesn't look missing
    uploadContainer.style.display = "block";
    const isAuthed = !!user;

    // Disable/enable controls accordingly
    if (uploadInput) uploadInput.disabled = !isAuthed;
    if (uploadBtn) uploadBtn.disabled = !isAuthed || !selectedFile;

    // Friendly status prompt
    if (uploadStatus) {
      if (!isAuthed) {
        uploadStatus.textContent = "Please log in to upload photos.";
        uploadStatus.style.color = "#94a3b8"; // slate-400
      } else if (!selectedFile) {
        uploadStatus.textContent = "";
        uploadStatus.style.color = "";
      }
    }
  }

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
      // Recompute visibility/state (e.g., if not authed, keep disabled)
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
        `gallery/${userId}/${timestamp}-${selectedFile.name}`,
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
            
            // Get the best available display name
            const getDisplayName = () => {
              const user = auth.currentUser;
              if (!user) return "Anonymous";
              
              // Priority order: displayName > email username > email
              if (user.displayName && user.displayName.trim()) {
                return user.displayName.trim();
              }
              
              if (user.email) {
                // Extract username from email (before @)
                const emailUsername = user.email.split('@')[0];
                if (emailUsername && emailUsername !== user.email) {
                  // Capitalize first letter and clean up
                  return emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1).replace(/[._-]/g, ' ');
                }
                return user.email;
              }
              
              return "Racing Fan";
            };
            
            await addDoc(collection(db, "gallery_images"), {
              imageUrl: downloadURL,
              uploaderUid: userId,
              uploaderEmail: auth.currentUser.email, // Kept for internal reference
              uploaderDisplayName: getDisplayName(),
              createdAt: serverTimestamp(),
              tags: [],
              approved: false,
              likes: [],
              likeCount: 0,
              storagePath: `gallery/${userId}/${timestamp}-${selectedFile.name}`,
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

  // --- Moderator check & Pending Approvals ---
  const moderationSection = document.getElementById("moderation-section");
  const pendingContainer = document.getElementById("pending-approvals");
  const pendingCountEl = document.getElementById("pending-count");

  async function checkModerator() {
    try {
      const res = await validateUserClaims(["team-member", "admin"]);
      isModerator = !!res?.success;
      if (moderationSection) {
        moderationSection.style.display = isModerator ? "block" : "none";
      }
      if (isModerator) {
        startPendingListener();
      } else {
        stopPendingListener();
        if (pendingContainer) pendingContainer.innerHTML = "";
        if (pendingCountEl) pendingCountEl.textContent = "";
      }
    } catch (_) {}
  }

  function stopPendingListener() {
    if (typeof unsubscribePending === "function") {
      unsubscribePending();
      unsubscribePending = null;
    }
  }

  function startPendingListener() {
    if (!pendingContainer || !db) return;
    stopPendingListener();
    const q = query(
      collection(db, "gallery_images"),
      where("approved", "==", false),
      orderBy("createdAt", "desc"),
    );
    unsubscribePending = onSnapshot(q, (snapshot) => {
      pendingContainer.innerHTML = "";
      const total = snapshot.size;
      if (pendingCountEl) pendingCountEl.textContent = total === 0 ? "No pending items" : `${total} awaiting approval`;
      if (snapshot.empty) {
        pendingContainer.innerHTML = `<p class="text-slate-400 col-span-full text-center">No pending photos.</p>`;
        return;
      }
      snapshot.forEach((docSnapshot) => {
        const image = docSnapshot.data();
        const imageId = docSnapshot.id;
        const card = document.createElement("div");
        card.className = "rounded-lg overflow-hidden bg-slate-800 border border-slate-700";
        safeSetHTML(
          card,
          html`
            <div class="aspect-video overflow-hidden">
              <img src="${image.imageUrl}" alt="Pending photo" class="w-full h-full object-cover" />
            </div>
            <div class="p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-sm text-slate-300">${(() => {
                  if (image.uploaderDisplayName && image.uploaderDisplayName.trim() && image.uploaderDisplayName !== 'Anonymous') {
                    return image.uploaderDisplayName.trim();
                  }
                  if (image.uploaderEmail) {
                    const emailUsername = image.uploaderEmail.split('@')[0];
                    if (emailUsername && emailUsername !== image.uploaderEmail) {
                      return emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1).replace(/[._-]/g, ' ');
                    }
                    return image.uploaderEmail;
                  }
                  return "Racing Fan";
                })()}</div>
                <div class="text-xs text-slate-400">${image.uploaderEmail || ""}</div>
              </div>
              <div class="flex items-center gap-3">
                <button class="approve-btn bg-green-600 hover:bg-green-500 text-white font-bold px-3 py-2 rounded-md" data-image-id="${imageId}">Approve</button>
                <button class="reject-btn bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-2 rounded-md" data-image-id="${imageId}">Delete</button>
              </div>
            </div>
          `,
        );
        pendingContainer.appendChild(card);
      });
    });
  }

  if (pendingContainer) {
    pendingContainer.addEventListener("click", async (e) => {
      const approveEl = e.target.closest(".approve-btn");
      const rejectEl = e.target.closest(".reject-btn");
      if (!approveEl && !rejectEl) return;
      const imageId = (approveEl || rejectEl)?.dataset?.imageId;
      if (!imageId) return;
      try {
        if (approveEl) {
          await updateDoc(doc(db, "gallery_images", imageId), { approved: true });
        } else if (rejectEl) {
          if (!confirm("Delete this photo? This action cannot be undone.")) return;
          const imageQuery = await getDocs(query(collection(db, "gallery_images"), where("__name__", "==", imageId)));
          if (!imageQuery.empty) {
            const imageData = imageQuery.docs[0].data();
            const storagePath = imageData.storagePath;
const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js");
            await deleteDoc(doc(db, "gallery_images", imageId));
            if (storagePath) {
              try {
const { deleteObject, ref } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js");
                const storageRef = ref(getStorage(), storagePath);
                await deleteObject(storageRef);
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        alert("Operation failed. Please try again.");
      }
    });
  }

  // --- Dynamic Gallery Rendering ---
  const galleryContainer = document.getElementById("dynamic-gallery-container");
  const renderGallery = () => {
    if (!galleryContainer) return;
    const q = query(
      collection(db, "gallery_images"),
      where("approved", "==", true),
      orderBy("createdAt", "desc"),
    );
    onSnapshot(q, (snapshot) => {
      galleryContainer.innerHTML = "";
      if (snapshot.empty) {
        galleryContainer.innerHTML = `<p class="text-slate-400 col-span-full text-center">No photos yet. Be the first to upload one!</p>`;
        return;
      }
      snapshot.forEach((docSnapshot) => {
        const image = docSnapshot.data();
        const imageId = docSnapshot.id;
        const galleryItem = document.createElement("div");
        galleryItem.className =
          "gallery-item aspect-square reveal-up relative overflow-hidden rounded-lg group max-w-xs";

        // Build tags safely
        const tagsContainer = document.createElement("div");
        if (image.tags && image.tags.length > 0) {
          image.tags.slice(0, 3).forEach((tag) => {
            const tagSpan = createSafeElement(
              "span",
              tag,
              "bg-black/50 text-white text-xs font-bold mr-2 px-2.5 py-0.5 rounded-full",
            );
            tagsContainer.appendChild(tagSpan);
          });
        }

        const currentUser = auth.currentUser;
        const isLiked =
          currentUser && image.likes && image.likes.includes(currentUser.uid);
        const likeCount = image.likeCount || 0;

        const likeButtonClass = isLiked ? "text-red-400" : "text-slate-400";
        const fillValue = isLiked ? "currentColor" : "none";
        const disabledAttr = !currentUser ? "disabled" : "";

        // Check if user is admin for delete functionality
        const adminEmails = ['auhren1992@gmail.com']; // Add your admin emails here
        const isAdmin = currentUser && adminEmails.includes(currentUser.email);

        // Get better display name for existing photos
        const getExistingDisplayName = (image) => {
          if (image.uploaderDisplayName && image.uploaderDisplayName.trim() && image.uploaderDisplayName !== 'Anonymous') {
            return image.uploaderDisplayName.trim();
          }
          
          if (image.uploaderEmail) {
            const emailUsername = image.uploaderEmail.split('@')[0];
            if (emailUsername && emailUsername !== image.uploaderEmail) {
              return emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1).replace(/[._-]/g, ' ');
            }
            return image.uploaderEmail;
          }
          
          return "Racing Fan";
        };
        
        // Create the main gallery HTML without admin buttons
        const baseHTML = `
          <img
            src="${escapeHTML(image.imageUrl)}"
            alt="User uploaded race photo"
            class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <div
            class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent"
          >
            <p class="text-sm text-slate-300">
              Uploaded by: ${escapeHTML(getExistingDisplayName(image))}
            </p>
            <div class="mt-2" id="tags-container-${escapeHTML(imageId)}"></div>
            <div class="mt-3 flex items-center justify-between">
              <div class="flex items-center space-x-2" id="action-buttons-${escapeHTML(imageId)}">
                <button
                  class="like-btn flex items-center space-x-1 text-xs ${likeButtonClass} hover:text-red-400 transition"
                  data-image-id="${escapeHTML(imageId)}"
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
              </div>
              <button
                class="comment-btn flex items-center space-x-1 text-xs text-slate-400 hover:text-blue-400 transition"
                data-image-id="${escapeHTML(imageId)}"
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

        safeSetHTML(galleryItem, baseHTML);
        
        // Add delete button manually if admin
        if (isAdmin) {
          const actionContainer = galleryItem.querySelector(`#action-buttons-${imageId}`);
          if (actionContainer) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn flex items-center space-x-1 text-xs text-red-400 hover:text-red-300 transition';
            deleteBtn.setAttribute('data-image-id', imageId);
            
            // Create SVG element programmatically for security
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'w-4 h-4');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('viewBox', '0 0 24 24');
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('d', 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16');
            
            svg.appendChild(path);
            
            const span = document.createElement('span');
            span.textContent = 'Delete';
            
            deleteBtn.appendChild(svg);
            deleteBtn.appendChild(span);
            actionContainer.appendChild(deleteBtn);
          }
        }

        // Add tags safely to the tags container
        const tagsContainerInDOM = galleryItem.querySelector(
          `#tags-container-${imageId}`,
        );
        if (tagsContainerInDOM && tagsContainer.children.length > 0) {
          while (tagsContainer.firstChild) {
            tagsContainerInDOM.appendChild(tagsContainer.firstChild);
          }
        }

        // Wire delete button if present
        const delBtn = galleryItem.querySelector('.delete-btn');
        if (delBtn) {
          delBtn.addEventListener('click', async () => {
            if (!confirm('Delete this photo? This action cannot be undone.')) return;
            try {
              // Delete from Firestore
              try {
                const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
                await deleteDoc(doc(db, 'gallery_images', imageId));
              } catch (firestoreError) {
                console.error('Failed to delete from Firestore:', firestoreError);
                throw firestoreError;
              }
              
              // Try to delete from Storage if we have the path
              if (image.storagePath) {
                try {
                  const { deleteObject, ref } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js');
                  const storageRef = ref(storage, image.storagePath);
                  await deleteObject(storageRef);
                } catch (storageError) {
                  console.warn('Could not delete from storage:', storageError);
                }
              }
              
              console.log('Photo deleted successfully');
            } catch (error) {
              console.error('Error deleting photo:', error);
              alert('Failed to delete photo. Please try again.');
            }
          });
        }
        
        galleryContainer.appendChild(galleryItem);
      });
    });
  };

  // --- Social Features ---
  const toggleLike = async (imageId) => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const imageRef = doc(db, "gallery_images", imageId);

    try {
      // Get current state
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
        // Unlike
        await updateDoc(imageRef, {
          likes: arrayRemove(userId),
          likeCount: increment(-1),
        });
      } else {
        // Like
        await updateDoc(imageRef, {
          likes: arrayUnion(userId),
          likeCount: increment(1),
        });
      }
    } catch (error) {}
  };

  const showCommentModal = (imageId) => {
    // Create modal dynamically
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

    // Load comments
    loadComments(imageId);

    // Event listeners
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

    // Close on backdrop click
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

  renderGallery();
}

main();
