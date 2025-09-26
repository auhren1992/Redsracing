# RedsRacing #8 Frontend

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