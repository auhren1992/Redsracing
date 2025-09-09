import { getFirebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, increment, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

async function main() {
    const firebaseConfig = await getFirebaseConfig();
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);

    // UI Elements
    const uploadContainer = document.getElementById('upload-container');
    const uploadInput = document.getElementById('photo-upload-input');
    const uploadBtn = document.getElementById('upload-btn');
    const progressBar = document.getElementById('upload-progress-bar');
    const uploadStatus = document.getElementById('upload-status');
    const galleryContainer = document.getElementById('dynamic-gallery-container');
    let selectedFile = null;

    // Auth State Change
    onAuthStateChanged(auth, user => {
        if (user) {
            if(uploadContainer) uploadContainer.style.display = 'block';
        } else {
            if(uploadContainer) uploadContainer.style.display = 'none';
        }
    });

    // Photo Upload Logic
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
            const storageRef = ref(storage, `gallery/jonny/${timestamp}-${selectedFile.name}`);
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
                            uploaderEmail: auth.currentUser.email,
                            uploaderDisplayName: auth.currentUser.displayName || 'Anonymous',
                            createdAt: serverTimestamp(),
                            tags: [],
                            approved: false,
                            category: 'jonny',
                            likes: [],
                            likeCount: 0
                        });
                        
                        // Check for photographer achievement
                        try {
                            const userPhotosQuery = query(
                                collection(db, 'gallery_images'),
                                where('uploaderUid', '==', userId)
                            );
                            const userPhotos = await getDocs(userPhotosQuery);
                            await autoAwardAchievement(userId, 'photo_upload', { 
                                totalPhotos: userPhotos.size 
                            });
                        } catch (error) {
                            console.error('Error checking for photo achievements:', error);
                        }
                        
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

    // Dynamic Gallery Rendering for Jonny's page
    const renderGallery = () => {
        if(!galleryContainer) return;
        const q = query(
            collection(db, "gallery_images"),
            where("approved", "==", true),
            where("category", "==", "jonny"),
            orderBy("createdAt", "desc")
        );
        onSnapshot(q, (snapshot) => {
            galleryContainer.innerHTML = '';
            if (snapshot.empty) {
                galleryContainer.innerHTML = `<p class="text-slate-400 col-span-full text-center">No photos of Jonny yet. Be the first to upload one!</p>`;
                return;
            }
            snapshot.forEach(docSnapshot => {
                const image = docSnapshot.data();
                const imageId = docSnapshot.id;
                const galleryItem = document.createElement('div');
                galleryItem.className = 'gallery-item aspect-square reveal-up relative overflow-hidden rounded-lg group';
                
                const currentUser = auth.currentUser;
                const isLiked = currentUser && image.likes && image.likes.includes(currentUser.uid);
                const likeCount = image.likeCount || 0;
                
                galleryItem.innerHTML = `
                    <img src="${image.imageUrl}" alt="User uploaded photo of Jonny Kirsch" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300">
                    <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <p class="text-sm text-slate-300">Uploaded by: ${image.uploaderDisplayName || 'Anonymous'}</p>
                        <div class="mt-3 flex items-center justify-between">
                            <button class="like-btn flex items-center space-x-1 text-xs ${isLiked ? 'text-red-400' : 'text-slate-400'} hover:text-red-400 transition" 
                                    data-image-id="${imageId}" ${!currentUser ? 'disabled' : ''}>
                                <svg class="w-4 h-4" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 000-6.364 4.5 4.5 0 00-6.364 0L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                                </svg>
                                <span class="like-count">${likeCount}</span>
                            </button>
                            <button class="comment-btn flex items-center space-x-1 text-xs text-slate-400 hover:text-blue-400 transition" 
                                    data-image-id="${imageId}" ${!currentUser ? 'disabled' : ''}>
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                                </svg>
                                <span>Comment</span>
                            </button>
                        </div>
                    </div>
                `;
                galleryContainer.appendChild(galleryItem);
            });
        });
    };
    
    // --- Social Features ---
    const toggleLike = async (imageId) => {
        if (!auth.currentUser) return;
        
        const userId = auth.currentUser.uid;
        const imageRef = doc(db, 'gallery_images', imageId);
        
        try {
            // Get current state
            const imageDoc = await getDocs(query(collection(db, 'gallery_images'), where('__name__', '==', imageId)));
            if (imageDoc.empty) return;
            
            const imageData = imageDoc.docs[0].data();
            const currentLikes = imageData.likes || [];
            const isLiked = currentLikes.includes(userId);
            
            if (isLiked) {
                // Unlike
                await updateDoc(imageRef, {
                    likes: arrayRemove(userId),
                    likeCount: increment(-1)
                });
            } else {
                // Like
                await updateDoc(imageRef, {
                    likes: arrayUnion(userId),
                    likeCount: increment(1)
                });
                
                // Check if this was a like on someone else's photo for fan favorite achievement
                if (imageData.uploaderUid && imageData.uploaderUid !== userId) {
                    try {
                        // Get all photos by the photo owner
                        const ownerPhotosQuery = query(
                            collection(db, 'gallery_images'),
                            where('uploaderUid', '==', imageData.uploaderUid)
                        );
                        const ownerPhotos = await getDocs(ownerPhotosQuery);
                        
                        // Calculate total likes across all their photos
                        let totalLikes = 0;
                        ownerPhotos.docs.forEach(photoDoc => {
                            const photoData = photoDoc.data();
                            totalLikes += photoData.likeCount || 0;
                        });
                        
                        // Award fan favorite achievement if threshold reached
                        await autoAwardAchievement(imageData.uploaderUid, 'photo_liked', { 
                            totalLikes: totalLikes + 1 // +1 for the new like we just added
                        });
                    } catch (error) {
                        console.error('Error checking for like achievements:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };
    
    const showCommentModal = (imageId) => {
        // Create modal dynamically
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
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
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('#add-comment-btn').addEventListener('click', () => {
            addComment(imageId);
        });
        
        modal.querySelector('#comment-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addComment(imageId);
            }
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    };
    
    const loadComments = async (imageId) => {
        const commentsList = document.getElementById('comments-list');
        if (!commentsList) return;
        
        try {
            const commentsQuery = query(
                collection(db, 'gallery_images', imageId, 'comments'),
                orderBy('createdAt', 'desc')
            );
            
            onSnapshot(commentsQuery, (snapshot) => {
                commentsList.innerHTML = '';
                if (snapshot.empty) {
                    commentsList.innerHTML = '<p class="text-slate-400 text-sm">No comments yet. Be the first to comment!</p>';
                    return;
                }
                
                snapshot.forEach(doc => {
                    const comment = doc.data();
                    const commentEl = document.createElement('div');
                    commentEl.className = 'bg-slate-700 p-3 rounded-md';
                    commentEl.innerHTML = `
                        <p class="text-sm text-slate-300 font-semibold">${comment.authorDisplayName || 'Anonymous'}</p>
                        <p class="text-sm text-slate-100 mt-1">${comment.text}</p>
                        <p class="text-xs text-slate-400 mt-2">${comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleString() : 'Just now'}</p>
                    `;
                    commentsList.appendChild(commentEl);
                });
            });
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsList.innerHTML = '<p class="text-red-400 text-sm">Error loading comments.</p>';
        }
    };
    
    const addComment = async (imageId) => {
        if (!auth.currentUser) return;
        
        const commentInput = document.getElementById('comment-input');
        const commentText = commentInput.value.trim();
        
        if (!commentText) return;
        
        try {
            await addDoc(collection(db, 'gallery_images', imageId, 'comments'), {
                text: commentText,
                authorUid: auth.currentUser.uid,
                authorDisplayName: auth.currentUser.displayName || 'Anonymous',
                createdAt: serverTimestamp()
            });
            
            commentInput.value = '';
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };
    
    // Event delegation for like and comment buttons
    galleryContainer.addEventListener('click', (e) => {
        if (e.target.closest('.like-btn')) {
            e.preventDefault();
            const imageId = e.target.closest('.like-btn').dataset.imageId;
            toggleLike(imageId);
        }
        
        if (e.target.closest('.comment-btn')) {
            e.preventDefault();
            const imageId = e.target.closest('.comment-btn').dataset.imageId;
            showCommentModal(imageId);
        }
    });
    
    renderGallery();
}

// Auto award achievement helper function
async function autoAwardAchievement(userId, actionType, actionData = {}) {
    try {
        const response = await fetch('/auto_award_achievement', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                actionType: actionType,
                actionData: actionData
            })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.awardedAchievements && result.awardedAchievements.length > 0) {
                console.log('Achievements awarded:', result.awardedAchievements);
                showAchievementNotification(result.awardedAchievements);
            }
            return result;
        }
    } catch (error) {
        console.error('Error auto-awarding achievement:', error);
    }
}

// Show achievement notification
function showAchievementNotification(achievements) {
    achievements.forEach(achievement => {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-neon-yellow text-black p-4 rounded-lg shadow-lg z-50 animate-pulse';
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">🏆</div>
                <div>
                    <h4 class="font-bold">Achievement Unlocked!</h4>
                    <p class="text-sm">${achievement.name}</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (notification && notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    });
}

main();
