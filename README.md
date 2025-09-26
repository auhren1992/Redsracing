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

### Build & Deployment Workflow

As the project has grown, a consistent workflow is required to avoid the "double dist" problems that previously surfaced. In summary:

1. Treat `assets/js/` as the source directory for JavaScript modules.
2. Add every new page bundle as an entry in `webpack.config.js`.
3. Run `npm run build` to emit bundles into the `dist/` directory.
4. Reference built assets from HTML **without** prefixing `dist/` (Firebase already serves that directory).
5. Deploy only the contents of `dist/` to Firebase Hosting.

See [DEVELOPMENT_GUIDELINES.md](./DEVELOPMENT_GUIDELINES.md) for a deeper explanation of the historical issues and recommended team practices.

### Note on Tailwind CSS

This project previously used Tailwind CSS via CDN, which showed warnings in production. We've migrated to a local build process using the Tailwind CLI for better production performance and to eliminate the development warnings.
