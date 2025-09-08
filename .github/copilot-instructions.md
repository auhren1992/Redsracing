# RedsRacing Firebase Web Application

RedsRacing is a Firebase-hosted web application for a racing team featuring driver profiles, schedules, galleries, and user authentication. The application uses static HTML/CSS/JS with Firebase backend services and is deployed via Firebase Hosting.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Setup
- Install Node.js 20: `curl -fsSL https://nodejs.org/dist/v20.19.4/node-v20.19.4-linux-x64.tar.xz | tar -xJ -C /usr/local --strip-components=1`
- Install Python 3.12 dependencies: `pip3 install -r functions_python/requirements.txt` -- takes 2-3 minutes. NEVER CANCEL. Set timeout to 5+ minutes.
- Install Node.js Functions dependencies: `npm ci --prefix functions` -- takes 1-2 minutes. NEVER CANCEL. Set timeout to 3+ minutes.
- Install Firebase CLI: `curl -sL https://firebase.tools | bash` OR use `npx firebase-tools@latest` for commands

### Development Server
- **Simple local testing**: `python3 -m http.server 8000` -- starts immediately
- **Firebase emulators**: `npx firebase-tools@latest emulators:start` -- takes 3-5 minutes to start. NEVER CANCEL. Set timeout to 10+ minutes.
  - **WARNING**: Firebase CLI installation via npm can take 10-15 minutes due to large dependency tree
  - Emulators provide local Firestore, Auth, Functions, and Hosting
  - Access at http://localhost:5000 (hosting) and http://localhost:4000 (emulator UI)

### Build and Deploy Commands
- **Functions deployment**: `npx firebase-tools@latest deploy --only functions` -- takes 3-5 minutes. NEVER CANCEL. Set timeout to 10+ minutes.
- **Full deployment**: `npx firebase-tools@latest deploy` -- takes 5-8 minutes. NEVER CANCEL. Set timeout to 15+ minutes.
- **Hosting only**: `npx firebase-tools@latest deploy --only hosting` -- takes 1-2 minutes. NEVER CANCEL. Set timeout to 5+ minutes.

## Validation

### Manual Testing Scenarios
- **ALWAYS test these complete workflows after making changes**:
  1. **Homepage Navigation**: Load index.html, verify header navigation, dropdowns, and mobile menu functionality
  2. **Authentication Flow**: Navigate to signup.html → create account → verify login.html → access dashboard.html
  3. **Gallery Upload**: Login → gallery.html → upload image → verify Firebase Storage integration
  4. **Q&A Submission**: Login → qna.html → submit question → verify Firestore integration
  5. **Schedule Display**: schedule.html → verify race data loads from Firestore

### Firebase Configuration Testing
- **CRITICAL**: Firebase config is fetched dynamically from `/__/firebase/init.json` in production
- For local development without Firebase Hosting, update `assets/js/firebase-config.js` with actual config
- **NEVER commit real Firebase API keys to public repository**
- Test Firebase services: `curl http://localhost:9099/emulator/v1/projects` (when emulators running)

### Build Validation
- **ALWAYS run these before committing**:
  - Test static file serving: `python3 -m http.server 8000` then `curl http://localhost:8000/`
  - Validate JavaScript modules load: Check browser console for import errors
  - Test Firebase functions locally: Run emulators and test callable functions

## Architecture Overview

### Frontend Structure
```
/ (root)
├── index.html              # Homepage with hero section
├── dashboard.html          # User dashboard (auth required)
├── login.html & signup.html # Authentication pages
├── gallery.html            # Photo gallery with upload
├── schedule.html           # Race schedule display
├── assets/js/              # JavaScript modules
│   ├── main.js            # Global navigation and auth
│   ├── firebase-config.js  # Dynamic config loader
│   └── *.js               # Page-specific modules
└── styles/main.css         # Custom CSS (uses Tailwind via CDN)
```

### Backend Services
- **Node.js Functions** (`functions/`): processInvitationCode, generateTags (Vision API)
- **Python Functions** (`functions_python/`): Email handling via Mailgun
- **Firestore Collections**: users, gallery_images, qna_submissions, races, subscribers
- **Firebase Storage**: Photo uploads in `/gallery/` path with automatic tagging

### Key Dependencies
- **Frontend**: Tailwind CSS (CDN), Firebase SDK v11.6.1 (CDN), ScrollReveal, Swiper
- **Node.js Functions**: firebase-functions v6.4.0, firebase-admin v12.0.0, @google-cloud/vision v4.0.2
- **Python Functions**: firebase-functions, firebase-admin, mailgun

## Common Issues and Solutions

### Firebase CLI Installation
- **Problem**: `npm i -g firebase-tools` hangs or times out
- **Solution**: Use `curl -sL https://firebase.tools | bash` OR `npx firebase-tools@latest` commands
- **Timing**: npm installation can take 10-15 minutes, curl method is faster

### Local Development Limitations
- Firebase config endpoint `/__/firebase/init.json` only works with Firebase Hosting
- For local testing, manually configure `assets/js/firebase-config.js` fallback
- Vision API and Mailgun functions require proper API keys in environment

### Authentication Testing
- Use Firebase Auth Emulator for local development: http://localhost:9099
- Test user creation, login, and custom claims (roles: public-fan, premium-fan, crew)
- Invitation codes stored in `invitation_codes` Firestore collection

## Deployment Pipeline
- **GitHub Actions** (`.github/workflows/firebase-deploy.yml`):
  - **Preview**: PR deployments to temporary channels
  - **Production**: main branch deployments to live site
  - **Dependencies**: Node.js 20, Python 3.12, Firebase CLI
  - **Timing**: Full deployment takes 8-12 minutes in CI

## Time Expectations
- **NEVER CANCEL these operations**:
  - Firebase CLI installation: 10-15 minutes (npm) / 2-3 minutes (curl)
  - Python dependencies: 2-3 minutes
  - Node.js dependencies: 1-2 minutes  
  - Firebase emulators startup: 3-5 minutes
  - Functions deployment: 3-5 minutes
  - Full Firebase deployment: 5-8 minutes
  - CI/CD pipeline: 8-12 minutes

## Security Notes
- Firestore rules in `firestore.rules` control data access
- Storage rules in `storage.rules` protect uploaded files
- Custom user claims manage role-based access
- **NEVER commit Firebase API keys or service account credentials**