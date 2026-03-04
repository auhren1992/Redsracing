#!/usr/bin/env python3
"""
Verification script to test mailgun functionality for Redsracing Firebase Functions.

This script verifies:
1. All required packages can be imported
2. MailgunClient can be instantiated 
3. The API structure matches what the code expects
4. The email sending workflow is correct (without actually sending)

Run this after installing dependencies to ensure everything works.
"""

import sys
import os
from pathlib import Path


def test_imports():
    """Test that all required imports work."""
    print("🔍 Testing imports...")
    
    try:
        import firebase_admin
        print("  ✓ firebase_admin imported")
    except ImportError as e:
        print(f"  ❌ firebase_admin failed: {e}")
        return False
        
    try:
        from firebase_admin import firestore, initialize_app, auth
        print("  ✓ firebase_admin components imported")
    except ImportError as e:
        print(f"  ❌ firebase_admin components failed: {e}")
        return False
        
    try:
        from firebase_functions import https_fn, options
        print("  ✓ firebase_functions imported")
    except ImportError as e:
        print(f"  ❌ firebase_functions failed: {e}")
        return False
        
    try:
        from mailgun.client import Client as MailgunClient
        print("  ✓ mailgun.client imported")
    except ImportError as e:
        print(f"  ❌ mailgun.client failed: {e}")
        return False
        
    return True


def test_mailgun_client():
    """Test MailgunClient functionality."""
    print("\n🔍 Testing MailgunClient...")
    
    try:
        from mailgun.client import Client as MailgunClient
        
        # Test client instantiation
        mg = MailgunClient(auth=("api", "fake_key_for_testing"))
        print("  ✓ MailgunClient instantiated")
        
        # Test expected attributes
        if not hasattr(mg, 'messages'):
            print("  ❌ mg.messages attribute missing")
            return False
        print("  ✓ mg.messages attribute exists")
        
        if not hasattr(mg.messages, 'create'):
            print("  ❌ mg.messages.create method missing")  
            return False
        print("  ✓ mg.messages.create method exists")
        
        # Test method signature (this should not raise exception)
        test_data = {
            "from": "test@mg.redsracing.org",
            "to": "test@example.com", 
            "subject": "Test Email",
            "text": "Test message"
        }
        
        try:
            # This will fail with API error, but should not fail with AttributeError
            mg.messages.create(data=test_data, domain="mg.redsracing.org")
        except Exception as e:
            # We expect this to fail (no real API key), but not with import/attribute errors
            if "AttributeError" in str(type(e)):
                print(f"  ❌ Unexpected AttributeError: {e}")
                return False
            print(f"  ✓ Method call structure correct (expected API error: {type(e).__name__})")
            
        return True
        
    except Exception as e:
        print(f"  ❌ MailgunClient test failed: {e}")
        return False


def test_main_module():
    """Test that main.py can be imported without errors."""
    print("\n🔍 Testing main.py import...")
    
    # Set environment variable to avoid missing key errors
    os.environ['MAILGUN_API_KEY'] = 'fake_key_for_testing'
    
    # Add functions_python to path
    functions_dir = Path(__file__).parent / "functions_python"
    if functions_dir.exists():
        sys.path.insert(0, str(functions_dir))
        
    try:
        import main
        print("  ✓ main.py imported successfully")
        
        if hasattr(main, 'mg'):
            print("  ✓ mg (MailgunClient) available in main")
        else:
            print("  ❌ mg (MailgunClient) not found in main")
            return False
            
        return True
        
    except Exception as e:
        print(f"  ❌ main.py import failed: {e}")
        return False


def main():
    """Run all verification tests."""
    print("🚀 Starting Redsracing mailgun verification tests...\n")
    
    tests = [
        ("Package Imports", test_imports),
        ("MailgunClient API", test_mailgun_client), 
        ("Main Module", test_main_module)
    ]
    
    results = []
    for test_name, test_func in tests:
        result = test_func()
        results.append((test_name, result))
        
    print("\n" + "="*50)
    print("📊 Test Results Summary:")
    print("="*50)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name}")
        if not passed:
            all_passed = False
    
    print("="*50)
    if all_passed:
        print("🎉 All tests passed! The mailgun setup is working correctly.")
        print("\nYou should now be able to deploy Firebase Functions without the mailgun import error.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the error messages above.")
        print("\nTroubleshooting steps:")
        print("1. Make sure you're in the correct Python environment")
        print("2. Run: pip install -r requirements.txt")
        print("3. Check that requirements.txt has the correct package versions")
        return 1


if __name__ == "__main__":
    sys.exit(main())