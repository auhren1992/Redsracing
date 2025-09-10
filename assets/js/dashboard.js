// Importing Firebase services and specific functions
import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut, sendEmailVerification, RecaptchaVerifier, linkWithPhoneNumber } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Wrap everything in an async function to allow early returns
(async function() {
    // Add immediate loading timeout as backup
    let loadingTimeout = setTimeout(() => {
        console.warn('Loading timeout reached, showing fallback content');
        hideLoadingAndShowFallback();
    }, 5000); // 5 second timeout

    function hideLoadingAndShowFallback() {
        const loadingState = document.getElementById('loading-state');
        const dashboardContent = document.getElementById('dashboard-content');

        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.style.visibility = 'hidden';
            loadingState.classList.add('hidden');
            loadingState.setAttribute('hidden', 'true');
            console.log('Loading state hidden');
        }

        if (dashboardContent) {
            dashboardContent.innerHTML = `
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">Driver <span class="neon-yellow">Dashboard</span></h1>
                    <div class="text-yellow-400 mb-6">
                        <h2 class="text-2xl font-bold">Dashboard Temporarily Unavailable</h2>
                        <p class="mt-2">Our services are currently unavailable.</p>
                        <p class="text-sm text-slate-400 mt-2">This could be due to network issues or temporary service downtime.</p>
                        <p class="text-sm text-slate-400 mt-1">Please check your internet connection and try again.</p>
                    </div>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">
                            Try Again
                        </button>
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">
                            Go Home
                        </a>
                    </div>
                </div>
            `;
            dashboardContent.classList.remove('hidden');
            console.log('Fallback content shown');
        }

        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
    }

    const loadingState = document.getElementById('loading-state');
    const dashboardContent = document.getElementById('dashboard-content');
    const userEmailEl = document.getElementById('user-email');
    const logoutButton = document.getElementById('logout-button');
    const emailVerificationNotice = document.getElementById('email-verification-notice');
    const resendVerificationBtn = document.getElementById('resend-verification-btn');
    const driverNotesCard = document.getElementById('driver-notes-card');
    const raceManagementCard = document.getElementById('race-management-card');
    const driverNotesEl = document.getElementById('driver-notes');
    const notesStatusEl = document.getElementById('notes-status');
    const mfaCard = document.getElementById('mfa-card');
    const mfaStatus = document.getElementById('mfa-status');
    const mfaEnrollForm = document.getElementById('mfa-enroll-form');
    const mfaVerifyForm = document.getElementById('mfa-verify-form');
    const mfaPhoneNumberInput = document.getElementById('mfa-phone-number');
    const mfaSendCodeBtn = document.getElementById('mfa-send-code-btn');
    const mfaVerificationCodeInput = document.getElementById('mfa-verification-code');
    const mfaVerifyBtn = document.getElementById('mfa-verify-btn');

    // Modal elements
    const raceModal = document.getElementById('race-modal');
    const modalTitle = document.getElementById('modal-title');
    const raceForm = document.getElementById('race-form');
    const raceIdInput = document.getElementById('race-id');
    const raceDateInput = document.getElementById('race-date');
    const raceNameInput = document.getElementById('race-name');
    const raceTypeInput = document.getElementById('race-type');
    const raceNumberContainer = document.getElementById('race-number-container');
    const raceNumberInput = document.getElementById('race-number');
    const specialNameContainer = document.getElementById('special-name-container');
    const specialNameInput = document.getElementById('special-name');
    const raceResultsInput = document.getElementById('race-results');
    const raceSummaryInput = document.getElementById('race-summary');
    const liveTimingLinkInput = document.getElementById('live-timing-link');
    const addRaceBtn = document.getElementById('add-race-btn');
    const cancelRaceBtn = document.getElementById('cancel-race-btn');

    // Q&A elements
    const qnaManagementCard = document.getElementById('qna-management-card');
    const qnaList = document.getElementById('qna-list');
    const qnaModal = document.getElementById('qna-modal');
    const qnaAnswerForm = document.getElementById('qna-answer-form');
    const qnaIdInput = document.getElementById('qna-id');
    const qnaModalQuestion = document.getElementById('qna-modal-question');
    const qnaAnswerInput = document.getElementById('qna-answer');
    const cancelQnaBtn = document.getElementById('cancel-qna-btn');

    // Photo Approval elements
    const photoApprovalCard = document.getElementById('photo-approval-card');
    const unapprovedPhotosList = document.getElementById('unapproved-photos-list');
    const jonnyPhotoApprovalCard = document.getElementById('jonny-photo-approval-card');
    const jonnyUnapprovedPhotosList = document.getElementById('jonny-unapproved-photos-list');

    // Jonny's Video elements
    const jonnyVideoManagementCard = document.getElementById('jonny-video-management-card');
    const addVideoForm = document.getElementById('add-video-form');
    const videoUrlInput = document.getElementById('video-url');
    const videoTitleInput = document.getElementById('video-title');
    const jonnyVideosList = document.getElementById('jonny-videos-list');

    let notesSaveTimeout;
    let countdownInterval;

    // Countdown function
    const startCountdown = (races) => {
        if (countdownInterval) clearInterval(countdownInterval);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextRace = races.find(race => new Date(race.date + 'T00:00:00') >= today);

        if (!nextRace) {
            document.getElementById('next-race-name').textContent = "Season Complete!";
            document.getElementById('countdown-timer').innerHTML = "<div class='col-span-4 text-2xl font-racing'>Thanks for a great season!</div>";
            return;
        }

        document.getElementById('next-race-name').textContent = nextRace.name;
        const nextRaceDate = new Date(nextRace.date + 'T19:00:00').getTime();

        countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = nextRaceDate - now;
            if (distance < 0) {
                clearInterval(countdownInterval);
                document.getElementById('countdown-timer').innerHTML = "<div class='col-span-4 text-3xl font-racing neon-yellow'>RACE DAY!</div>";
                return;
            }
            document.getElementById('days').textContent = Math.floor(distance / (1000 * 60 * 60 * 24));
            document.getElementById('hours').textContent = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            document.getElementById('minutes').textContent = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            document.getElementById('seconds').textContent = Math.floor((distance % (1000 * 60)) / 1000);
        }, 1000);
    };

    // --- CRUD Functions ---

    // 1. READ Races and Render Table
    const renderRacesTable = (races) => {
        const tableBody = document.getElementById('races-table-body');
        tableBody.innerHTML = ''; // Clear existing rows
        races.forEach(race => {
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-700 hover:bg-slate-800';
            row.innerHTML = `
                <td class="p-2">${race.date}</td>
                <td class="p-2">${race.name}</td>
                <td class="p-2">
                    <button class="edit-race-btn bg-yellow-500 text-white px-2 py-1 rounded text-sm" data-id="${race.id}">Edit</button>
                    <button class="delete-race-btn bg-red-600 text-white px-2 py-1 rounded text-sm ml-2" data-id="${race.id}">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners for the new buttons
        document.querySelectorAll('.edit-race-btn').forEach(btn => btn.addEventListener('click', () => openRaceModal(races.find(r => r.id === btn.dataset.id))));
        document.querySelectorAll('.delete-race-btn').forEach(btn => btn.addEventListener('click', () => deleteRace(btn.dataset.id)));
    };

    // Fetch race data from Firestore
    const getRaceData = async () => {
        const racesCol = collection(db, "races");
        const q = query(racesCol, orderBy("date", "asc"));
        const raceSnapshot = await getDocs(q);
        const raceList = raceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderRacesTable(raceList);
        startCountdown(raceList);
    };

    // 2. CREATE/UPDATE Races
    const openRaceModal = (race = null) => {
        raceForm.reset();
        if (race) {
            modalTitle.textContent = 'Edit Race';
            raceIdInput.value = race.id;
            raceDateInput.value = race.date;
            raceNameInput.value = race.name;
            raceTypeInput.value = race.type;
            if (race.type === 'superCup') {
                raceNumberInput.value = race.race || '';
                specialNameInput.value = '';
            } else {
                specialNameInput.value = race.special || '';
                raceNumberInput.value = '';
            }
            raceResultsInput.value = race.results || '';
            raceSummaryInput.value = race.summary || '';
            liveTimingLinkInput.value = race.liveTimingLink || '';
        } else {
            modalTitle.textContent = 'Add New Race';
            raceIdInput.value = '';
        }
        toggleRaceTypeFields();
        raceModal.classList.remove('hidden');
        raceModal.classList.add('flex');
    };

    const closeRaceModal = () => {
        raceModal.classList.add('hidden');
        raceModal.classList.remove('flex');
        // Clear form when closing
        raceForm.reset();
    };

    const toggleRaceTypeFields = () => {
        if (raceTypeInput.value === 'superCup') {
            raceNumberContainer.classList.remove('hidden');
            specialNameContainer.classList.add('hidden');
        } else {
            raceNumberContainer.classList.add('hidden');
            specialNameContainer.classList.remove('hidden');
        }
    };

    raceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const raceId = raceIdInput.value;
        const raceData = {
            date: raceDateInput.value,
            name: raceNameInput.value,
            type: raceTypeInput.value,
            ...(raceTypeInput.value === 'superCup'
                ? { race: raceNumberInput.value }
                : { special: specialNameInput.value }),
            results: raceResultsInput.value,
            summary: raceSummaryInput.value,
            liveTimingLink: liveTimingLinkInput.value
        };

        try {
            if (raceId) {
                await updateDoc(doc(db, 'races', raceId), raceData);
            } else {
                await addDoc(collection(db, 'races'), raceData);
            }
            closeRaceModal();
            await getRaceData();
        } catch (error) {
            console.error("Error saving race:", error);
            alert("Failed to save race. Check console for details.");
        }
    });

    // 3. DELETE Races
    const deleteRace = async (id) => {
        if (confirm('Are you sure you want to delete this race?')) {
            try {
                await deleteDoc(doc(db, 'races', id));
                await getRaceData();
            } catch (error) {
                console.error("Error deleting race:", error);
                alert("Failed to delete race. Check console for details.");
            }
        }
    };

    // Wire up modal buttons
    addRaceBtn.addEventListener('click', () => openRaceModal());
    cancelRaceBtn.addEventListener('click', closeRaceModal);
    raceTypeInput.addEventListener('change', toggleRaceTypeFields);

    // Add click outside modal to close functionality for race modal
    raceModal.addEventListener('click', (e) => {
        if (e.target === raceModal) {
            closeRaceModal();
        }
    });

    // Add ESC key support (already covered above for both modals)

    // --- Q&A Management Functions ---
    const renderQnaSubmissions = (submissions) => {
        qnaList.innerHTML = '';
        if (submissions.length === 0) {
            qnaList.innerHTML = '<p class="text-slate-400">No pending questions.</p>';
            return;
        }
        submissions.forEach(sub => {
            const item = document.createElement('div');
            item.className = 'p-4 bg-slate-800 rounded-md';
            item.innerHTML = `
                <p class="text-white">${sub.question}</p>
                <p class="text-sm text-slate-400 mt-2">Submitted by: ${sub.submitterName}</p>
                <div class="mt-4 flex space-x-2">
                    <button class="approve-qna-btn bg-green-600 text-white px-2 py-1 rounded text-sm" data-id="${sub.id}">Approve & Answer</button>
                    <button class="delete-qna-btn bg-red-600 text-white px-2 py-1 rounded text-sm" data-id="${sub.id}">Delete</button>
                </div>
            `;
            qnaList.appendChild(item);
        });

        document.querySelectorAll('.approve-qna-btn').forEach(btn => btn.addEventListener('click', () => openQnaModal(submissions.find(s => s.id === btn.dataset.id))));
        document.querySelectorAll('.delete-qna-btn').forEach(btn => btn.addEventListener('click', () => deleteQnaSubmission(btn.dataset.id)));
    };

    const getQnaSubmissions = async () => {
        const q = query(collection(db, "qna_submissions"), where("status", "==", "submitted"), orderBy("submittedAt", "asc"));
        const snapshot = await getDocs(q);
        const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderQnaSubmissions(submissions);
    };

    const openQnaModal = (submission) => {
        qnaAnswerForm.reset();
        qnaIdInput.value = submission.id;
        qnaModalQuestion.textContent = submission.question;
        qnaModal.classList.remove('hidden');
        qnaModal.classList.add('flex');
    };

    const closeQnaModal = () => {
        qnaModal.classList.add('hidden');
        qnaModal.classList.remove('flex');
        // Clear form when closing
        qnaAnswerForm.reset();
    };

    qnaAnswerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = qnaIdInput.value;
        const answer = qnaAnswerInput.value.trim();
        if (!answer) return;
        if (!id) {
            console.error("Error publishing answer: Missing question ID");
            alert("Error: Missing question ID. Please try again.");
            return;
        }

        try {
            const qnaRef = doc(db, 'qna_submissions', id);
            await updateDoc(qnaRef, {
                answer: answer,
                status: 'published',
                answeredAt: new Date()
            });
            closeQnaModal();
            await getQnaSubmissions(); // Refresh the list
        } catch (error) {
            console.error("Error publishing answer:", error);
            alert("Failed to publish answer. Check console for details.");
        }
    });

    const deleteQnaSubmission = async (id) => {
        if (!id) {
            console.error("Error deleting question: Missing question ID");
            alert("Error: Missing question ID. Please try again.");
            return;
        }
        if (confirm('Are you sure you want to delete this question permanently?')) {
            try {
                await deleteDoc(doc(db, 'qna_submissions', id));
                await getQnaSubmissions(); // Refresh list
            } catch (error) {
                console.error("Error deleting question:", error);
                alert("Failed to delete question. Check console for details.");
            }
        }
    };

    cancelQnaBtn.addEventListener('click', closeQnaModal);

    // Add click outside modal to close functionality
    qnaModal.addEventListener('click', (e) => {
        if (e.target === qnaModal) {
            closeQnaModal();
        }
    });

    // Add ESC key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!qnaModal.classList.contains('hidden')) {
                closeQnaModal();
            } else if (!raceModal.classList.contains('hidden')) {
                closeRaceModal();
            }
        }
    });

    // --- Photo Approval Functions ---
    const renderUnapprovedPhotos = (photos, container, category) => {
        container.innerHTML = '';
        if (photos.length === 0) {
            container.innerHTML = `<p class="text-slate-400">No photos are currently pending approval in this category.</p>`;
            return;
        }
        photos.forEach(photo => {
            const item = document.createElement('div');
            item.className = 'p-4 bg-slate-800 rounded-md flex items-center justify-between';
            item.innerHTML = `
                <div class="flex items-center">
                    <img src="${photo.imageUrl}" class="w-16 h-16 object-cover rounded-md mr-4" alt="Thumbnail">
                    <div>
                        <p class="text-white">${photo.uploaderEmail || 'Unknown Uploader'}</p>
                        <p class="text-sm text-slate-400">${new Date(photo.createdAt.seconds * 1000).toLocaleString()}</p>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button class="approve-photo-btn bg-green-600 text-white px-3 py-1 rounded text-sm" data-id="${photo.id}">Approve</button>
                    <button class="delete-photo-btn bg-red-600 text-white px-3 py-1 rounded text-sm" data-id="${photo.id}" data-url="${photo.imageUrl}">Delete</button>
                </div>
            `;
            container.appendChild(item);
        });

        document.querySelectorAll('.approve-photo-btn').forEach(btn => btn.addEventListener('click', () => approvePhoto(btn.dataset.id)));
        document.querySelectorAll('.delete-photo-btn').forEach(btn => btn.addEventListener('click', () => deletePhoto(btn.dataset.id, btn.dataset.url)));
    };

    const getUnapprovedPhotos = async (category, container) => {
        let photos = [];
        if (category) {
            // Query for specific category (e.g., "jonny")
            const q = query(
                collection(db, "gallery_images"),
                where("category", "==", category),
                where("approved", "==", false),
                orderBy("createdAt", "asc")
            );
            const snapshot = await getDocs(q);
            photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            // Query for main gallery photos (those without jonny category or with explicit main category)
            // First get all unapproved photos, then filter client-side to avoid complex index requirements
            const q = query(
                collection(db, "gallery_images"),
                where("approved", "==", false),
                orderBy("createdAt", "asc")
            );
            const snapshot = await getDocs(q);
            // Filter out photos with "jonny" category client-side
            photos = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(photo => !photo.category || photo.category !== "jonny");
        }
        renderUnapprovedPhotos(photos, container, category);
    };

    const approvePhoto = async (id) => {
        try {
            const photoRef = doc(db, 'gallery_images', id);
            await updateDoc(photoRef, { approved: true });
            // Refresh both lists after any approval
            getUnapprovedPhotos(null, unapprovedPhotosList);
            getUnapprovedPhotos('jonny', jonnyUnapprovedPhotosList);
        } catch (error) {
            console.error("Error approving photo:", error);
            alert("Failed to approve photo.");
        }
    };

    const deletePhoto = async (id, imageUrl) => {
        if (!confirm('Are you sure you want to permanently delete this photo?')) return;
        try {
            // Delete the Firestore document
            await deleteDoc(doc(db, 'gallery_images', id));

            // Delete the file from Cloud Storage
            const photoRef = ref(storage, imageUrl);
            await deleteObject(photoRef);

            // Refresh both lists after any deletion
            getUnapprovedPhotos(null, unapprovedPhotosList);
            getUnapprovedPhotos('jonny', jonnyUnapprovedPhotosList);
        } catch (error) {
            console.error("Error deleting photo:", error);
            alert("Failed to delete photo. It may have already been deleted from storage.");
        }
    };

    // --- Jonny's Video Management ---

    const getYouTubeVideoId = (url) => {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname === "youtu.be") {
                return urlObj.pathname.slice(1);
            } else if (urlObj.hostname === "www.youtube.com" || urlObj.hostname === "youtube.com") {
                return urlObj.searchParams.get("v");
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    const renderJonnyVideos = (videos) => {
        jonnyVideosList.innerHTML = '';
        if (videos.length === 0) {
            jonnyVideosList.innerHTML = '<p class="text-slate-400">No videos added yet.</p>';
            return;
        }
        videos.forEach(video => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2 bg-slate-800 rounded-md';
            item.innerHTML = `
                <p class="text-white truncate">${video.title}</p>
                <button class="delete-video-btn bg-red-600 text-white px-2 py-1 rounded text-sm" data-id="${video.id}">Delete</button>
            `;
            jonnyVideosList.appendChild(item);
        });
        document.querySelectorAll('.delete-video-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteJonnyVideo(btn.dataset.id));
        });
    };

    const getJonnyVideos = async () => {
        try {
            const q = query(collection(db, "jonny_videos"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderJonnyVideos(videos);
        } catch (error) {
            console.error("Error loading Jonny videos:", error);
            if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
                console.log("Insufficient permissions to access Jonny videos. User may not be a team member or authentication token needs refresh.");
                renderJonnyVideos([]); // Render empty list to prevent UI issues
            } else {
                throw error; // Re-throw other errors
            }
        }
    };

    const deleteJonnyVideo = async (id) => {
         if (confirm('Are you sure you want to delete this video?')) {
            try {
                await deleteDoc(doc(db, 'jonny_videos', id));
                getJonnyVideos(); // Refresh the list
            } catch (error) {
                console.error("Error deleting video:", error);
                alert("Failed to delete video.");
            }
        }
    };

    addVideoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = videoUrlInput.value.trim();
        const title = videoTitleInput.value.trim();
        const videoId = getYouTubeVideoId(url);

        if (!title || !videoId) {
            alert("Please enter a valid YouTube URL and a title.");
            return;
        }

        try {
            await addDoc(collection(db, "jonny_videos"), {
                youtubeId: videoId,
                title: title,
                createdAt: new Date()
            });
            addVideoForm.reset();
            getJonnyVideos(); // Refresh list
        } catch (error) {
            console.error("Error adding video:", error);
            alert("Failed to add video.");
        }
    });


    // --- MFA Setup ---
    const setupMfa = (user) => {
        const hasPhoneNumber = user.providerData.some(p => p.providerId === 'phone');

        if (hasPhoneNumber) {
            mfaStatus.innerHTML = `<p class="text-green-400 font-bold">2-Step Verification is enabled.</p>`;
            mfaEnrollForm.style.display = 'none';
            mfaVerifyForm.style.display = 'none';
        } else {
            mfaStatus.innerHTML = `<p class="text-yellow-400 font-bold">2-Step Verification is not enabled.</p>`;
            mfaEnrollForm.style.display = 'block';
            mfaVerifyForm.style.display = 'none';

            if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'mfa-recaptcha-container', {
                    'size': 'invisible',
                    'callback': () => {}
                });
                window.recaptchaVerifier.render();
            }

            mfaSendCodeBtn.onclick = async () => {
                const phoneNumber = mfaPhoneNumberInput.value;
                const appVerifier = window.recaptchaVerifier;
                try {
                    mfaSendCodeBtn.disabled = true;
                    mfaSendCodeBtn.textContent = 'Sending...';
                    window.confirmationResult = await linkWithPhoneNumber(user, phoneNumber, appVerifier);
                    mfaEnrollForm.style.display = 'none';
                    mfaVerifyForm.style.display = 'block';
                    alert('Verification code sent!');
                } catch (error) {
                    console.error('Error sending MFA code:', error);
                    alert(`Error: ${error.message}`);
                    window.recaptchaVerifier.render().then(widgetId => window.recaptchaVerifier.reset(widgetId));
                } finally {
                    mfaSendCodeBtn.disabled = false;
                    mfaSendCodeBtn.textContent = 'Send Code';
                }
            };

            mfaVerifyBtn.onclick = async () => {
                const code = mfaVerificationCodeInput.value;
                try {
                    mfaVerifyBtn.disabled = true;
                    mfaVerifyBtn.textContent = 'Verifying...';
                    await window.confirmationResult.confirm(code);
                    alert('2-Step Verification enabled successfully!');
                    setupMfa(user);
                } catch (error) {
                    console.error('Error verifying MFA code:', error);
                    alert(`Error: ${error.message}`);
                } finally {
                    mfaVerifyBtn.disabled = false;
                    mfaVerifyBtn.textContent = 'Verify & Enable';
                }
            };
        }
    };

    // Reset loading timeout to prevent infinite loading
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
    }
    loadingTimeout = setTimeout(() => {
        console.warn('Loading timeout reached, hiding loading state');
        hideLoadingAndShowContent();
    }, 10000); // 10 second timeout

    function hideLoadingAndShowContent() {
        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.setAttribute('hidden', 'true');
        }
        if (dashboardContent) {
            dashboardContent.classList.remove('hidden');
        }
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
    }

    // Auth State Change Listener
    onAuthStateChanged(auth, async (user) => {
        try {
            if (user) {
                try {
                    userEmailEl.textContent = user.displayName || user.email;

                    if (!user.emailVerified) {
                        emailVerificationNotice.classList.remove('hidden');

                        // Handle resending the verification email
                        resendVerificationBtn.addEventListener('click', async () => {
                            try {
                                await sendEmailVerification(user);
                                alert('Verification email sent! Please check your inbox.');
                            } catch (error) {
                                console.error('Error resending verification email:', error);
                                alert('Failed to resend verification email. Please try again later.');
                            }
                        });

                        // Handle checking the verification status
                        const refreshStatusBtn = document.getElementById('refresh-status-btn');
                        refreshStatusBtn.addEventListener('click', async () => {
                            // Force a reload of the user's profile from Firebase servers
                            await auth.currentUser.reload();

                            // Check the new status
                            if (auth.currentUser.emailVerified) {
                                emailVerificationNotice.classList.add('hidden');
                                alert('Thank you for verifying your email!');
                            } else {
                                alert('Your email is still not verified. Please check your inbox for the verification link.');
                            }
                        });
                    }

                    await getRaceData();

                    const idTokenResult = await user.getIdTokenResult();
                    console.log("User's custom claims:", idTokenResult.claims);
                    const userRole = idTokenResult.claims.role;

                    if (userRole === 'team-member') {
                        driverNotesCard.classList.remove('hidden');
                        raceManagementCard.style.display = 'block';
                        qnaManagementCard.style.display = 'block';
                        photoApprovalCard.style.display = 'block';
                        jonnyPhotoApprovalCard.style.display = 'block';
                        mfaCard.style.display = 'block';

                        getQnaSubmissions();
                        getUnapprovedPhotos(null, unapprovedPhotosList); // Main gallery
                        getUnapprovedPhotos('jonny', jonnyUnapprovedPhotosList); // Jonny's gallery
                        getJonnyVideos();

                        const userNotesRef = doc(db, "driver_notes", user.uid);
                        const docSnap = await getDoc(userNotesRef);
                        if (docSnap.exists()) {
                            driverNotesEl.value = docSnap.data().notes;
                        }
                        driverNotesEl.addEventListener('keyup', () => {
                            notesStatusEl.textContent = 'Saving...';
                            clearTimeout(notesSaveTimeout);
                            notesSaveTimeout = setTimeout(async () => {
                                try {
                                    await setDoc(userNotesRef, { notes: driverNotesEl.value }, { merge: true });
                                    notesStatusEl.textContent = 'Saved!';
                                } catch (e) {
                                    notesStatusEl.textContent = 'Error saving notes.';
                                }
                                setTimeout(() => { notesStatusEl.textContent = ''; }, 2000);
                            }, 1000);
                        });
                    } else {
                        driverNotesCard.classList.add('hidden');
                    }

                    if (userRole === 'team-member') {
                        setupMfa(user);
                    }
                } catch (error) {
                    console.error("Failed to load dashboard content:", error);
                    // Show fallback content when Firebase services fail
                    dashboardContent.innerHTML = `<div class="text-center py-20">
                        <h1 class="text-5xl font-racing uppercase mb-2">Driver <span class="neon-yellow">Dashboard</span></h1>
                        <div class="text-red-400 mb-4">
                            <h2 class="text-2xl font-bold">Dashboard Temporarily Unavailable</h2>
                            <p class="mt-2">There was a problem connecting to our services.</p>
                            <p class="text-sm text-slate-400 mt-2">This could be due to network issues or temporary service downtime.</p>
                        </div>
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">
                            Try Again
                        </button>
                    </div>`;
                }
            } else {
                // User not authenticated, redirect to login
                window.location.href = 'login.html';
            }
        } catch (authError) {
            console.error("Authentication error:", authError);
            // Show fallback content for auth errors
            dashboardContent.innerHTML = `<div class="text-center py-20">
                <h1 class="text-5xl font-racing uppercase mb-2">Driver <span class="neon-yellow">Dashboard</span></h1>
                <div class="text-red-400 mb-4">
                    <h2 class="text-2xl font-bold">Authentication Error</h2>
                    <p class="mt-2">Unable to verify your identity.</p>
                    <p class="text-sm text-slate-400 mt-2">Please try logging in again.</p>
                </div>
                <a href="login.html" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">
                    Go to Login
                </a>
            </div>`;
        } finally {
            // Always hide loading and show content
            hideLoadingAndShowContent();
        }
    });

    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).catch(error => console.error('Logout Error:', error));
    });

    document.getElementById('year').textContent = new Date().getFullYear();

    // Clear the loading timeout since we successfully loaded
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }

})(); // End of async function wrapper
