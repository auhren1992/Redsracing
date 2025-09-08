import { getFirebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

async function main() {
    const firebaseConfig = await getFirebaseConfig();
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);

    // --- Auth State ---
    const uploadContainer = document.getElementById('upload-container');
    onAuthStateChanged(auth, user => {
        if (user) {
            if(uploadContainer) uploadContainer.style.display = 'block';
        } else {
            if(uploadContainer) uploadContainer.style.display = 'none';
        }
    });

    // --- Photo Upload Logic ---
    const uploadInput = document.getElementById('photo-upload-input');
    const uploadBtn = document.getElementById('upload-btn');
    const progressBar = document.getElementById('upload-progress-bar');
    const uploadStatus = document.getElementById('upload-status');
    let selectedFile = null;

    if(uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            selectedFile = e.target.files[0];
            if (selectedFile) {
                if(uploadBtn) uploadBtn.disabled = false;
                if(uploadStatus) uploadStatus.textContent = `Selected: ${selectedFile.name}`;
            } else {
                if(uploadBtn) uploadBtn.disabled = true;
            }
        });
    }

    if(uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            if (!selectedFile || !auth.currentUser) return;
            uploadBtn.disabled = true;
            if(uploadInput) uploadInput.disabled = true;

            const userId = auth.currentUser.uid;
            const timestamp = Date.now();
            const storageRef = ref(storage, `gallery/${userId}/${timestamp}-${selectedFile.name}`);
            const uploadTask = uploadBytesResumable(storageRef, selectedFile);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if(progressBar) progressBar.style.width = progress + '%';
                    if(uploadStatus) uploadStatus.textContent = `Uploading... ${Math.round(progress)}%`;
                },
                (error) => {
                    console.error("Upload failed:", error);
                    if(uploadStatus) {
                        uploadStatus.textContent = `Upload failed: ${error.message}`;
                        uploadStatus.style.color = '#ef4444';
                    }
                    uploadBtn.disabled = false;
                    if(uploadInput) uploadInput.disabled = false;
                },
                async () => {
                    if(uploadStatus) uploadStatus.textContent = 'Processing...';
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        await addDoc(collection(db, "gallery_images"), {
                            imageUrl: downloadURL,
                            uploaderUid: userId,
                            uploaderEmail: auth.currentUser.email, // Kept for internal reference
                            createdAt: serverTimestamp(),
                            tags: [],
                            approved: false
                        });
                        if(uploadStatus) {
                            uploadStatus.textContent = 'Upload complete! Waiting for approval.';
                            uploadStatus.style.color = '#22c55e';
                        }
                        selectedFile = null;
                        if(uploadInput) uploadInput.value = '';
                    } catch (error) {
                        console.error("Error creating Firestore entry:", error);
                        if(uploadStatus) {
                            uploadStatus.textContent = 'Error saving file data.';
                            uploadStatus.style.color = '#ef4444';
                        }
                    } finally {
                        if(uploadInput) uploadInput.disabled = false;
                    }
                }
            );
        });
    }

    // --- Dynamic Gallery Rendering ---
    const galleryContainer = document.getElementById('dynamic-gallery-container');
    const renderGallery = () => {
        if(!galleryContainer) return;
        const q = query(collection(db, "gallery_images"), where("approved", "==", true), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            galleryContainer.innerHTML = '';
            if (snapshot.empty) {
                galleryContainer.innerHTML = `<p class="text-slate-400 col-span-full text-center">No photos yet. Be the first to upload one!</p>`;
                return;
            }
            snapshot.forEach(doc => {
                const image = doc.data();
                const galleryItem = document.createElement('div');
                galleryItem.className = 'gallery-item aspect-square reveal-up relative overflow-hidden rounded-lg group';
                let tagsHTML = '';
                if (image.tags && image.tags.length > 0) {
                    tagsHTML = image.tags.slice(0, 3).map(tag => `<span class="bg-black/50 text-white text-xs font-bold mr-2 px-2.5 py-0.5 rounded-full">${tag}</span>`).join(' ');
                }
                galleryItem.innerHTML = `
                    <img src="${image.imageUrl}" alt="User uploaded race photo" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300">
                    <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <p class="text-sm text-slate-300">Uploaded by: ${image.uploaderDisplayName || 'Anonymous'}</p>
                        <div class="mt-2">
                            ${tagsHTML}
                        </div>
                    </div>
                `;
                galleryContainer.appendChild(galleryItem);
            });
        });
    };
    renderGallery();
}

main();
