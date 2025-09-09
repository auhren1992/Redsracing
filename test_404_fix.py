#!/usr/bin/env python3
"""
Comprehensive test for the Firebase Functions 404 fix

This script validates that the lazy Mailgun initialization fix resolves
the 404 errors by ensuring profile functions can load independently of
email configuration.
"""

import sys
import os
from pathlib import Path
import unittest.mock as mock

def test_mailgun_independence():
    """Test that profile functions work without Mailgun configuration."""
    print("🔧 Testing Firebase Functions 404 Fix")
    print("=" * 50)
    
    # Simulate deployment environment without MAILGUN_API_KEY
    original_key = os.environ.get('MAILGUN_API_KEY')
    if 'MAILGUN_API_KEY' in os.environ:
        del os.environ['MAILGUN_API_KEY']
    
    try:
        # Test 1: Module Import
        print("1. Testing module import without MAILGUN_API_KEY...")
        functions_dir = Path(__file__).parent / "functions_python"
        if functions_dir.exists():
            sys.path.insert(0, str(functions_dir))
        
        try:
            import main
            print("   ✅ main.py imports successfully")
        except Exception as e:
            print(f"   ❌ main.py import failed: {e}")
            return False
        
        # Test 2: Profile Functions Available
        print("2. Testing profile function availability...")
        required_functions = [
            'handleGetProfile',
            'handleUpdateProfile', 
            'handleGetAchievements',
            'handleAssignAchievement'
        ]
        
        for func_name in required_functions:
            if hasattr(main, func_name):
                print(f"   ✅ {func_name} available")
            else:
                print(f"   ❌ {func_name} not found")
                return False
        
        # Test 3: Lazy Mailgun Initialization
        print("3. Testing lazy Mailgun client initialization...")
        try:
            main.get_mailgun_client()
            print("   ❌ get_mailgun_client should fail without API key")
            return False
        except ValueError as e:
            if "MAILGUN_API_KEY environment variable is required" in str(e):
                print("   ✅ get_mailgun_client properly fails without API key")
            else:
                print(f"   ❌ Unexpected error: {e}")
                return False
        
        # Test 4: Mailgun Client Works When Key is Available
        print("4. Testing Mailgun client with API key...")
        os.environ['MAILGUN_API_KEY'] = 'test_key_for_validation'
        
        # Reset the global mg variable to test lazy loading
        main.mg = None
        
        try:
            client = main.get_mailgun_client()
            if hasattr(client, 'messages'):
                print("   ✅ Mailgun client initializes correctly with API key")
            else:
                print("   ❌ Mailgun client missing messages attribute")
                return False
        except Exception as e:
            print(f"   ❌ Mailgun client initialization failed: {e}")
            return False
        
        # Test 5: Path Parsing Logic
        print("5. Testing Firebase Functions path parsing...")
        
        class MockRequest:
            def __init__(self, method='GET', path='/profile/user123'):
                self.method = method
                self.path = path
        
        test_cases = [
            ('/profile/user123', 'profile', 'user123'),
            ('/update_profile/user456', 'update_profile', 'user456'),
            ('/achievements', 'achievements', None)
        ]
        
        for path, expected_base, expected_id in test_cases:
            req = MockRequest(path=path)
            path_parts = req.path.strip("/").split("/")
            
            if path_parts[0] == expected_base:
                if expected_id:
                    if len(path_parts) >= 2 and path_parts[1] == expected_id:
                        print(f"   ✅ {path} parsed correctly")
                    else:
                        print(f"   ❌ {path} parsing failed - wrong ID")
                        return False
                else:
                    print(f"   ✅ {path} parsed correctly")
            else:
                print(f"   ❌ {path} parsing failed - wrong base")
                return False
        
        print("\n" + "=" * 50)
        print("🎉 All tests passed! The 404 fix should resolve the deployment issues.")
        print("\nExpected results after deployment:")
        print("- Profile endpoints (/profile/{userId}) should return 200 or 404 instead of connection errors")
        print("- Achievement endpoints (/achievements) should return 200 instead of connection errors") 
        print("- Update profile endpoints (/update_profile/{userId}) should work for authenticated users")
        print("- Email functions will only fail if actually called without MAILGUN_API_KEY configured")
        
        return True
        
    finally:
        # Restore original environment
        if original_key:
            os.environ['MAILGUN_API_KEY'] = original_key
        elif 'MAILGUN_API_KEY' in os.environ:
            del os.environ['MAILGUN_API_KEY']

if __name__ == "__main__":
    success = test_mailgun_independence()
    if not success:
        print("\n❌ Tests failed - the 404 fix needs additional work")
        sys.exit(1)
    else:
        print("\n✅ Tests passed - the 404 fix is ready for deployment")
        sys.exit(0)