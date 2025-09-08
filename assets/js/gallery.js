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
        
        // Add demo placeholder divs to showcase the new clean display
        const demoColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#6C5CE7'];
        
        galleryContainer.innerHTML = '';
        
        // Create demo gallery items to show the clean layout
        demoColors.forEach((color, index) => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item aspect-square reveal-up relative overflow-hidden rounded-lg group cursor-pointer';
            galleryItem.innerHTML = `
                <div class="w-full h-full flex items-center justify-center text-white font-bold text-lg group-hover:scale-110 transition-transform duration-300" 
                     style="background: linear-gradient(135deg, ${color}, ${color}88);">
                    Photo ${index + 1}
                </div>
            `;
            
            // Add click handler to open image in modal
            galleryItem.addEventListener('click', () => {
                openImageModal(`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="24" font-family="Arial">Demo Photo ${index + 1}</text></svg>`);
            });
            
            galleryContainer.appendChild(galleryItem);
        });
        
        // Try to load Firebase images if available
        try {
            const q = query(collection(db, "gallery_images"), where("approved", "==", true), orderBy("createdAt", "desc"));
            onSnapshot(q, (snapshot) => {
                // Only clear demo images if we have real images
                if (!snapshot.empty) {
                    galleryContainer.innerHTML = '';
                }
                
                snapshot.forEach(doc => {
                    const image = doc.data();
                    const galleryItem = document.createElement('div');
                    galleryItem.className = 'gallery-item aspect-square reveal-up relative overflow-hidden rounded-lg group cursor-pointer';
                    galleryItem.innerHTML = `
                        <img src="${image.imageUrl}" alt="Race photo" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300">
                    `;
                    
                    // Add click handler to open image in modal
                    galleryItem.addEventListener('click', () => {
                        openImageModal(image.imageUrl);
                    });
                    
                    galleryContainer.appendChild(galleryItem);
                });
            });
        } catch (error) {
            console.log('Firebase not available, showing demo images only');
        }
    };
    renderGallery();

    // --- Modal functionality for viewing full-size images ---
    function openImageModal(imageUrl) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('image-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'image-modal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 hidden';
            modal.innerHTML = `
                <div class="relative max-w-4xl max-h-screen p-4">
                    <button id="close-modal" class="absolute top-2 right-2 text-white hover:text-neon-yellow text-3xl font-bold z-10">&times;</button>
                    <img id="modal-image" src="" alt="Full size race photo" class="max-w-full max-h-full object-contain rounded-lg">
                </div>
            `;
            document.body.appendChild(modal);

            // Add close functionality
            const closeBtn = modal.querySelector('#close-modal');
            closeBtn.addEventListener('click', closeImageModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeImageModal();
                }
            });

            // Add escape key listener
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    closeImageModal();
                }
            });
        }

        // Show modal with the image
        const modalImage = modal.querySelector('#modal-image');
        modalImage.src = imageUrl;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    function closeImageModal() {
        const modal = document.getElementById('image-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = ''; // Restore scrolling
        }
    }
}

main();
