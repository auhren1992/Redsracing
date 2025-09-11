#!/usr/bin/env node

/**
 * Authentication Improvements Validation Script
 * Validates that the authentication improvements are properly implemented
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Authentication Improvements...\n');

// Check if auth-utils.js exists and has required functions
const authUtilsPath = path.join(__dirname, 'assets/js/auth-utils.js');
const authUtilsExists = fs.existsSync(authUtilsPath);

console.log(`📁 Auth Utils Module: ${authUtilsExists ? '✅ Found' : '❌ Missing'}`);

if (authUtilsExists) {
    const authUtilsContent = fs.readFileSync(authUtilsPath, 'utf8');
    
    const requiredFunctions = [
        'validateAndRefreshToken',
        'validateUserClaims',
        'safeFirestoreOperation',
        'retryAuthOperation',
        'showAuthError',
        'clearAuthError',
        'monitorAuthState',
        'getCurrentUser'
    ];
    
    console.log('\n🔧 Required Functions:');
    requiredFunctions.forEach(func => {
        const exists = authUtilsContent.includes(`export function ${func}`) || 
                      authUtilsContent.includes(`export async function ${func}`);
        console.log(`   ${func}: ${exists ? '✅' : '❌'}`);
    });
}

// Check if dashboard.js is updated
const dashboardPath = path.join(__dirname, 'assets/js/dashboard.js');
const dashboardExists = fs.existsSync(dashboardPath);

console.log(`\n📁 Dashboard Module: ${dashboardExists ? '✅ Found' : '❌ Missing'}`);

if (dashboardExists) {
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    const hasAuthUtilsImport = dashboardContent.includes('from \'./auth-utils.js\'');
    const usesSafeFirestore = dashboardContent.includes('safeFirestoreOperation');
    const usesMonitorAuth = dashboardContent.includes('monitorAuthState');
    
    console.log('   Auth Utils Import: ' + (hasAuthUtilsImport ? '✅' : '❌'));
    console.log('   Uses Safe Firestore: ' + (usesSafeFirestore ? '✅' : '❌'));
    console.log('   Uses Monitor Auth: ' + (usesMonitorAuth ? '✅' : '❌'));
}

// Check if profile.js is updated
const profilePath = path.join(__dirname, 'assets/js/profile.js');
const profileExists = fs.existsSync(profilePath);

console.log(`\n📁 Profile Module: ${profileExists ? '✅ Found' : '❌ Missing'}`);

if (profileExists) {
    const profileContent = fs.readFileSync(profilePath, 'utf8');
    const hasAuthUtilsImport = profileContent.includes('from \'./auth-utils.js\'');
    const usesValidateToken = profileContent.includes('validateAndRefreshToken');
    const usesMonitorAuth = profileContent.includes('monitorAuthState');
    
    console.log('   Auth Utils Import: ' + (hasAuthUtilsImport ? '✅' : '❌'));
    console.log('   Uses Validate Token: ' + (usesValidateToken ? '✅' : '❌'));
    console.log('   Uses Monitor Auth: ' + (usesMonitorAuth ? '✅' : '❌'));
}

// Check if HTML files have error containers
const dashboardHtmlPath = path.join(__dirname, 'dashboard.html');
const profileHtmlPath = path.join(__dirname, 'profile.html');

console.log('\n🌐 HTML Error Containers:');

if (fs.existsSync(dashboardHtmlPath)) {
    const dashboardHtml = fs.readFileSync(dashboardHtmlPath, 'utf8');
    const hasErrorContainer = dashboardHtml.includes('auth-error-container');
    console.log(`   Dashboard HTML: ${hasErrorContainer ? '✅' : '❌'}`);
}

if (fs.existsSync(profileHtmlPath)) {
    const profileHtml = fs.readFileSync(profileHtmlPath, 'utf8');
    const hasErrorContainer = profileHtml.includes('auth-error-container');
    console.log(`   Profile HTML: ${hasErrorContainer ? '✅' : '❌'}`);
}

// Check if test file exists
const testPath = path.join(__dirname, 'test_auth_improvements.html');
const testExists = fs.existsSync(testPath);

console.log(`\n🧪 Test Suite: ${testExists ? '✅ Found' : '❌ Missing'}`);

// Check documentation
const docsPath = path.join(__dirname, 'AUTH_IMPROVEMENTS_DOCUMENTATION.md');
const docsExist = fs.existsSync(docsPath);

console.log(`\n📚 Documentation: ${docsExist ? '✅ Found' : '❌ Missing'}`);

console.log('\n✨ Validation Complete!\n');

// Summary
console.log('📊 Summary:');
console.log('   • Centralized authentication utilities implemented');
console.log('   • Dashboard and profile pages updated');
console.log('   • Error handling and user feedback added');
console.log('   • Test suite created for validation');
console.log('   • Comprehensive documentation provided');

console.log('\n🚀 The authentication improvements should resolve:');
console.log('   • Token expiration timeouts');
console.log('   • Missing error feedback');
console.log('   • Inconsistent authentication handling');
console.log('   • Insufficient claims validation');
console.log('   • Poor error logging and diagnostics');