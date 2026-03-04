/**
 * Script to add visual editor capabilities to all HTML pages
 * Run this script to automatically inject the visual editor into all your pages
 */

const fs = require('fs');
const path = require('path');

// Visual editor script tag to inject
const VISUAL_EDITOR_SCRIPT = `    <script src="cms/js/visual-editor.js"></script>`;

// Function to recursively find all HTML files
function findHtmlFiles(dir, htmlFiles = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Skip cms directory and other system directories
            if (!['cms', 'node_modules', '.git', 'android'].includes(file)) {
                findHtmlFiles(filePath, htmlFiles);
            }
        } else if (path.extname(file) === '.html') {
            htmlFiles.push(filePath);
        }
    }
    
    return htmlFiles;
}

// Function to inject visual editor script into HTML file
function injectVisualEditor(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if visual editor is already injected
        if (content.includes('cms/js/visual-editor.js')) {
            console.log(`⚠️  Visual editor already injected in: ${filePath}`);
            return false;
        }
        
        // Find the closing </body> tag and inject before it
        const bodyCloseIndex = content.lastIndexOf('</body>');
        
        if (bodyCloseIndex === -1) {
            console.log(`⚠️  No </body> tag found in: ${filePath}`);
            return false;
        }
        
        // Inject the script before </body>
        const beforeBody = content.substring(0, bodyCloseIndex);
        const afterBody = content.substring(bodyCloseIndex);
        
        const newContent = beforeBody + VISUAL_EDITOR_SCRIPT + '\n' + afterBody;
        
        // Write the updated content back
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✅ Visual editor injected into: ${filePath}`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
        return false;
    }
}

// Main function
function main() {
    console.log('🚀 Adding Visual Editor to all HTML pages...\n');
    
    const projectRoot = __dirname; // Current directory where this script is located
    const htmlFiles = findHtmlFiles(projectRoot);
    
    console.log(`📁 Found ${htmlFiles.length} HTML files to process\n`);
    
    let injectedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const filePath of htmlFiles) {
        const success = injectVisualEditor(filePath);
        if (success === true) {
            injectedCount++;
        } else if (success === false && fs.readFileSync(filePath, 'utf8').includes('cms/js/visual-editor.js')) {
            skippedCount++;
        } else {
            errorCount++;
        }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Successfully injected: ${injectedCount} files`);
    console.log(`⚠️  Already had editor: ${skippedCount} files`);
    console.log(`❌ Errors encountered: ${errorCount} files`);
    console.log(`📁 Total files processed: ${htmlFiles.length} files`);
    
    if (injectedCount > 0) {
        console.log('\n🎉 Visual Editor successfully added to your website!');
        console.log('📝 Instructions:');
        console.log('   1. Open any page on your website');
        console.log('   2. Add "?cms_edit=true" to the URL');
        console.log('   3. Click on any text, image, or element to edit it!');
        console.log('   4. Or use the CMS Dashboard visual editor button');
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { injectVisualEditor, findHtmlFiles };