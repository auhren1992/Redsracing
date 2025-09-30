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
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from "./firebase-core.js";
import { monitorAuthState, validateUserClaims } from "./auth-utils.js";
import { html, safeSetHTML } from "./sanitize.js";

async function main() {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();

  // UI Elements
  const uploadContainer = document.getElementById("upload-container");
  const uploadInput = document.getElementById("photo-upload-input");
  const uploadBtn = document.getElementById("upload-btn");
  const progressBar = document.getElementById("upload-progress-bar");
  const uploadStatus = document.getElementById("upload-status");
  const galleryContainer = document.getElementById("dynamic-gallery-container");
  let selectedFile = null;
  let isAdmin = false;
  
  // Create and manage admin indicator
  const updateAdminIndicator = () => {
    let indicator = document.getElementById('admin-mode-indicator');
    
    if (isAdmin && !indicator) {
      // Create indicator
      indicator = document.createElement('div');
      indicator.id = 'admin-mode-indicator';
      indicator.className = 'admin-mode-indicator';
      indicator.innerHTML = '🛠️ ADMIN MODE';
      document.body.appendChild(indicator);
    } else if (!isAdmin && indicator) {
      // Remove indicator
      indicator.remove();
    }
  };

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

  monitorAuthState(
    async (user) => {
      updateUploadVisibility(user);
      
      // Check if user is admin (team-member role)
      if (user) {
        try {
          const validation = await validateUserClaims(["team-member"]);
          isAdmin = validation.success;
        } catch (error) {
          isAdmin = false;
        }
      } else {
        isAdmin = false;
      }
      
      // Update admin indicator and re-render gallery
      updateAdminIndicator();
      renderGallery();
    },
    () => {
      if (uploadContainer) uploadContainer.style.display = "block";
      updateUploadVisibility(null);
      isAdmin = false;
      updateAdminIndicator();
    },
  );

  updateUploadVisibility(auth.currentUser);

  if (uploadInput) {
    uploadInput.addEventListener("change", (e) => {
      selectedFile = e.target.files[0];
      if (selectedFile) {
        if (uploadBtn) uploadBtn.disabled = false;
        if (uploadStatus) uploadStatus.textContent = `Selected: ${selectedFile.name}`;
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
      const storageRef = ref(storage, `gallery/${userId}/${timestamp}-${selectedFile.name}`);
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (progressBar) progressBar.style.width = progress + "%";
          if (uploadStatus) uploadStatus.textContent = `Uploading... ${Math.round(progress)}%`;
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
              category: "jon",
              likes: [],
              likeCount: 0,
              storagePath: `gallery/${userId}/${timestamp}-${selectedFile.name}`,
            });
            if (uploadStatus) {
              uploadStatus.textContent = "Upload complete! Waiting for approval.";
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

  // Delete photo function for admins
  const deletePhoto = async (imageId, storagePath) => {
    if (!isAdmin) {
      alert('You do not have permission to delete photos.');
      return;
    }

    if (!confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "gallery_images", imageId));
      
      // Delete from Storage if storagePath exists
      if (storagePath) {
        try {
          const storageRef = ref(storage, storagePath);
          await deleteObject(storageRef);
        } catch (storageError) {
          console.warn('Could not delete from storage:', storageError);
          // Continue even if storage delete fails
        }
      }
      
      console.log('Photo deleted successfully');
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo. Please try again.');
    }
  };

  const renderGallery = () => {
    if (!galleryContainer) return;
    const q = query(
      collection(db, "gallery_images"),
      where("approved", "==", true),
      where("category", "==", "jon"),
      orderBy("createdAt", "desc"),
    );
    onSnapshot(q, (snapshot) => {
      galleryContainer.innerHTML = "";
      if (snapshot.empty) {
        galleryContainer.innerHTML = `<p class=\"text-slate-400 col-span-full text-center\">No photos of Jon yet. Be the first to upload one!</p>`;
        return;
      }
      snapshot.forEach((docSnapshot) => {
        const image = docSnapshot.data();
        const imageId = docSnapshot.id;
        const galleryItem = document.createElement("div");
        galleryItem.className = "gallery-item-3d aspect-square relative group cursor-pointer";
        
        // Build gallery HTML with conditional admin delete button
        const galleryHTML = html`
          <img src="${image.imageUrl}" alt="User uploaded photo of Jon Kirsch" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
          ${isAdmin ? `
            <button 
              class="admin-delete-btn absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
              title="Delete photo (Admin only)"
              onclick="window.deletePhoto('${imageId}', '${image.storagePath || ''}')"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          ` : ''}
        `;
        
        safeSetHTML(galleryItem, galleryHTML);
        galleryContainer.appendChild(galleryItem);
      });
    });
  };

  // Expose deletePhoto function globally for onclick handlers
  window.deletePhoto = deletePhoto;
  
  // Initial admin check if user is already logged in
  const currentUser = auth.currentUser;
  if (currentUser) {
    validateUserClaims(["team-member"])
      .then(validation => {
        isAdmin = validation.success;
        updateAdminIndicator();
        renderGallery();
      })
      .catch(() => {
        isAdmin = false;
        updateAdminIndicator();
        renderGallery();
      });
  } else {
    renderGallery();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
