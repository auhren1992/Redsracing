# Batch Footer Replacement Script for RedsRacing
# Updates all HTML pages with new newsletter footer

$files = @(
    "feedback.html",
    "gallery.html",
    "jonny-gallery.html",
    "jonny.html",
    "jons.html",
    "legends.html",
    "qna.html",
    "sponsorship.html",
    "videos.html",
    "driver-new.html"
)

$newFooter = @'
    <!-- Modern Newsletter Footer -->
    <footer class="newsletter-footer">
        <div class="newsletter-container">
            <div class="newsletter-content">
                <h2 class="newsletter-title">Get In Touch</h2>
                <p class="newsletter-subtitle">Subscribe for race updates and follow the journey on social media.</p>
                
                <form id="newsletter-form" class="newsletter-form">
                    <div class="newsletter-input-group">
                        <input 
                            type="email" 
                            id="newsletter-email" 
                            placeholder="Enter your email" 
                            required 
                            class="newsletter-input"
                        />
                        <button type="submit" class="newsletter-button">
                            <span class="button-text">Subscribe</span>
                            <span class="button-loader hidden">●●●</span>
                        </button>
                    </div>
                    <p id="newsletter-message" class="newsletter-message"></p>
                </form>
                
                <div class="social-links">
                    <a href="https://www.facebook.com/share/1F1RTxz9xa/" target="_blank" class="social-link" aria-label="Facebook">
                        <i class="fab fa-facebook"></i>
                    </a>
                    <a href="https://www.tiktok.com/@redsracing" target="_blank" class="social-link" aria-label="TikTok">
                        <i class="fab fa-tiktok"></i>
                    </a>
                    <a href="https://www.instagram.com/redsracing8/" target="_blank" class="social-link" aria-label="Instagram">
                        <i class="fab fa-instagram"></i>
                    </a>
                </div>
            </div>
        </div>
        
        <div class="footer-bottom">
            <p>&copy; 2025 RedsRacing. All Rights Reserved.</p>
        </div>
    </footer>

    <style>
    .newsletter-footer {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        padding: 60px 20px 30px;
        color: white;
    }

    .newsletter-container {
        max-width: 600px;
        margin: 0 auto;
    }

    .newsletter-content {
        text-align: center;
    }

    .newsletter-title {
        font-size: 2.5rem;
        font-weight: 900;
        background: linear-gradient(45deg, #fbbf24, #f59e0b);
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        margin-bottom: 10px;
    }

    .newsletter-subtitle {
        color: #94a3b8;
        font-size: 1.1rem;
        margin-bottom: 30px;
    }

    .newsletter-form {
        margin-bottom: 40px;
    }

    .newsletter-input-group {
        display: flex;
        gap: 10px;
        max-width: 500px;
        margin: 0 auto 15px;
    }

    .newsletter-input {
        flex: 1;
        padding: 15px 20px;
        border: 2px solid rgba(251, 191, 36, 0.3);
        border-radius: 12px;
        background: rgba(30, 41, 59, 0.6);
        color: white;
        font-size: 1rem;
        transition: all 0.3s ease;
    }

    .newsletter-input:focus {
        outline: none;
        border-color: #fbbf24;
        background: rgba(30, 41, 59, 0.8);
    }

    .newsletter-input::placeholder {
        color: #64748b;
    }

    .newsletter-button {
        padding: 15px 35px;
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        color: #0f172a;
        border: none;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .newsletter-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 30px rgba(251, 191, 36, 0.4);
    }

    .newsletter-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .button-loader {
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    .hidden {
        display: none;
    }

    .newsletter-message {
        min-height: 24px;
        font-size: 0.9rem;
        margin-top: 10px;
    }

    .newsletter-message.success {
        color: #4ade80;
    }

    .newsletter-message.error {
        color: #ef4444;
    }

    .social-links {
        display: flex;
        justify-content: center;
        gap: 20px;
        margin-top: 30px;
    }

    .social-link {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: rgba(251, 191, 36, 0.1);
        border: 2px solid rgba(251, 191, 36, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fbbf24;
        font-size: 1.5rem;
        transition: all 0.3s ease;
        text-decoration: none;
    }

    .social-link:hover {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        color: #0f172a;
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(251, 191, 36, 0.3);
    }

    .footer-bottom {
        text-align: center;
        padding-top: 30px;
        margin-top: 40px;
        border-top: 1px solid rgba(148, 163, 184, 0.2);
        color: #64748b;
        font-size: 0.9rem;
    }

    @media (max-width: 768px) {
        .newsletter-title {
            font-size: 2rem;
        }
        
        .newsletter-input-group {
            flex-direction: column;
        }
        
        .newsletter-button {
            width: 100%;
        }
    }
    </style>

    <script type="module">
    import { getApp, initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
    import { getFirestore, collection, addDoc, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

    // Get or initialize Firebase
    let app;
    try {
        app = getApp();
    } catch (error) {
        const firebaseConfig = {
            apiKey: "AIzaSyDu91Bi9SiF4K6P_sBjHBUNbjXjEB02X74",
            authDomain: "redsracing-d3f36.firebaseapp.com",
            projectId: "redsracing-d3f36",
            storageBucket: "redsracing-d3f36.firebasestorage.app",
            messagingSenderId: "536299135078",
            appId: "1:536299135078:web:ea84d9fb6b21f5ba99c8a9",
            measurementId: "G-MNHR1VW81Z"
        };
        app = initializeApp(firebaseConfig);
    }

    const db = getFirestore(app);

    // Newsletter form handler
    const form = document.getElementById('newsletter-form');
    const emailInput = document.getElementById('newsletter-email');
    const submitButton = form.querySelector('button[type="submit"]');
    const buttonText = submitButton.querySelector('.button-text');
    const buttonLoader = submitButton.querySelector('.button-loader');
    const message = document.getElementById('newsletter-message');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        if (!email) return;
        
        // Validate email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showMessage('Please enter a valid email address', 'error');
            return;
        }
        
        // Show loading state
        submitButton.disabled = true;
        buttonText.classList.add('hidden');
        buttonLoader.classList.remove('hidden');
        message.textContent = '';
        
        try {
            // Check if email already exists
            const subscribersRef = collection(db, 'subscribers');
            const q = query(subscribersRef, where('email', '==', email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                showMessage('You\'re already subscribed! 🎉', 'success');
                emailInput.value = '';
                return;
            }
            
            // Add new subscriber
            await addDoc(subscribersRef, {
                email: email,
                subscribed: true,
                createdAt: serverTimestamp(),
                source: 'website_footer'
            });
            
            showMessage('Welcome to the team! Check your email 📧', 'success');
            emailInput.value = '';
            
            // Track event
            if (window.gtag) {
                gtag('event', 'newsletter_signup', {
                    method: 'footer_form'
                });
            }
            
        } catch (error) {
            console.error('Newsletter signup error:', error);
            showMessage('Something went wrong. Please try again.', 'error');
        } finally {
            submitButton.disabled = false;
            buttonText.classList.remove('hidden');
            buttonLoader.classList.add('hidden');
        }
    });

    function showMessage(text, type) {
        message.textContent = text;
        message.className = `newsletter-message ${type}`;
    }
    </script>
'@

$baseDir = "C:\Users\Parts\Documents\Desktop\Redsracing"

foreach ($file in $files) {
    $filePath = Join-Path $baseDir $file
    
    if (Test-Path $filePath) {
        Write-Host "Processing $file..." -ForegroundColor Cyan
        
        $content = Get-Content $filePath -Raw
        
        # Replace old footer with new footer (pattern matching the old footer structure)
        $pattern = '(?s)<footer class="bg-black/50.*?</footer>'
        $updatedContent = $content -replace $pattern, $newFooter
        
        # Save updated content
        $updatedContent | Set-Content $filePath -NoNewline
        
        Write-Host "  ✓ Updated $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ File not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nFooter replacement complete!" -ForegroundColor Green
Write-Host "Updated $($files.Count) files with new newsletter footer." -ForegroundColor Green
