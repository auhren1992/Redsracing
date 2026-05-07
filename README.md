# RedsRacing #8 Frontend

## Bundle analysis

To analyze bundle size locally:

1. Install deps and build once:
   - `npm ci`
   - `npm run build`
2. Generate stats and open analyzer:
   - `npm run analyze`

This writes `stats.json` and launches an interactive treemap.

This is the official website for RedsRacing #8, featuring Jon's racing journey.

## Development Setup

This project uses Tailwind CSS for styling. The CSS is built locally instead of using the CDN for production usage.

### Prerequisites

- Node.js (version 14 or higher)
- npm

### Building CSS

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build CSS for production:

   ```bash
   npm run build-css-prod
   ```

3. For development with watch mode:
   ```bash
   npm run build-css
   ```

### Project Structure

- `/styles/` - Contains built CSS files
  - `main.css` - Custom CSS styles
  - `tailwind.css` - Built Tailwind CSS (generated)
- `/src/input.css` - Tailwind CSS source file
- `tailwind.config.js` - Tailwind configuration
- `*.html` - All HTML pages use local Tailwind CSS

### Firebase Setup

The project uses Firebase for authentication and Firestore for data storage. See Firebase documentation for setup instructions.

### Note on Tailwind CSS

This project previously used Tailwind CSS via CDN, which showed warnings in production. We've migrated to a local build process using the Tailwind CLI for better production performance and to eliminate the development warnings.

## Android app bundle (download signed .aab)

CI builds a signed **Android App Bundle** on every **Android Build** workflow run.

1. Go to [Android Build workflow runs](https://github.com/auhren1992/Redsracing/actions/workflows/android-build.yml).
2. Open a successful run (or use **Run workflow** to build manually).
3. Under **Artifacts**, download `reds-racing-aab-v{version}-b{code}` (zip). Inside is `app-release.aab` for Play Console.

More detail: `.github/SECRET_SETUP.md` → **Download the signed Android bundle (.aab)**.
