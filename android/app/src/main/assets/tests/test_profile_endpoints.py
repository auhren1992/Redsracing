import unittest
from unittest.mock import Mock, patch
import json
import os
import sys
from flask import Flask

# Add the functions_python directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'functions_python'))

from main import (
    handleGetProfile, 
    handleUpdateProfile, 
    handleGetAchievements, 
    handleAssignAchievement,
    _get_user_from_token,
    _is_admin
)

class MockRequest:
    """Mock Firebase Functions Request object."""
    def __init__(self, method='GET', path='/profile/user123', headers=None, json_data=None, base_url="https://example.com"):
        self.method = method
        self.path = path
        self.headers = headers or {}
        self._json_data = json_data
        self.base_url = base_url

    def get_json(self, silent=True):
        return self._json_data

class TestProfileEndpoints(unittest.TestCase):
    """Test cases for user profile and achievements endpoints."""

    def setUp(self):
        """Set up test fixtures."""
        self.app = Flask(__name__)
        self.mock_auth_token = {
            'uid': 'test_user_123',
            'email': 'test@example.com',
            'role': 'public-fan'
        }
        
        self.mock_admin_token = {
            'uid': 'admin_user_123',
            'email': 'admin@example.com',
            'role': 'team-member'
        }

    def test_get_user_from_token_valid(self):
        """Test extracting valid user from auth token."""
        mock_request = MockRequest(headers={'Authorization': 'Bearer valid_token'})
        with self.app.test_request_context(path=mock_request.path, headers=mock_request.headers):
            with patch('main.auth.verify_id_token') as mock_verify:
                mock_verify.return_value = self.mock_auth_token
                decoded_token, error = _get_user_from_token(mock_request)
                self.assertEqual(decoded_token, self.mock_auth_token)
                self.assertIsNone(error)

    def test_get_user_from_token_missing_header(self):
        """Test handling missing authorization header."""
        mock_request = MockRequest()
        with self.app.test_request_context(path=mock_request.path, headers=mock_request.headers):
            decoded_token, error = _get_user_from_token(mock_request)
            self.assertIsNone(decoded_token)
            self.assertIsNotNone(error)
            self.assertEqual(error.status_code, 401)

    def test_is_admin_true(self):
        """Test admin role detection."""
        self.assertTrue(_is_admin(self.mock_admin_token))

    def test_is_admin_false(self):
        """Test non-admin role detection."""
        self.assertFalse(_is_admin(self.mock_auth_token))

    @patch('main.firestore.client')
    def test_get_profile_success(self, mock_firestore_client):
        """Test successful profile retrieval."""
        request = MockRequest(path='/profile/user123')
        with self.app.test_request_context(path=request.path):
            mock_db = Mock()
            mock_firestore_client.return_value = mock_db
            mock_profile_doc = Mock()
            mock_profile_doc.exists = True
            mock_profile_doc.to_dict.return_value = {'username': 'testuser', 'displayName': 'Test User'}
            mock_db.collection.return_value.document.return_value.get.return_value = mock_profile_doc
            mock_db.collection.return_value.where.return_value.stream.return_value = []

            response = handleGetProfile(request)

            self.assertEqual(response.status_code, 200)
            response_data = json.loads(response.data)
            self.assertEqual(response_data['username'], 'testuser')

    @patch('main.firestore.client')
    def test_get_profile_not_found(self, mock_firestore_client):
        """Test profile not found scenario."""
        request = MockRequest(path='/profile/nonexistent')
        with self.app.test_request_context(path=request.path):
            mock_db = Mock()
            mock_firestore_client.return_value = mock_db
            mock_profile_doc = Mock()
            mock_profile_doc.exists = False
            mock_db.collection.return_value.document.return_value.get.return_value = mock_profile_doc

            response = handleGetProfile(request)

            self.assertEqual(response.status_code, 404)

    def test_get_profile_invalid_url(self):
        """Test invalid URL format handling."""
        request = MockRequest(path='/invalid')
        with self.app.test_request_context(path=request.path):
            response = handleGetProfile(request)
            self.assertEqual(response.status_code, 400)

    def test_get_profile_options_request(self):
        """Test CORS OPTIONS request."""
        request = MockRequest(method='OPTIONS')
        with self.app.test_request_context(path=request.path, method=request.method):
            response = handleGetProfile(request)
            self.assertEqual(response.status_code, 200)

    @patch('main.auth.verify_id_token')
    @patch('main.firestore.client')
    def test_update_profile_success(self, mock_firestore_client, mock_verify_token):
        """Test successful profile update."""
        profile_data = {'username': 'newusername', 'displayName': 'New Display Name'}
        request = MockRequest(method='PUT', path='/update_profile/test_user_123', headers={'Authorization': 'Bearer valid_token'}, json_data=profile_data)
        with self.app.test_request_context(path=request.path, method=request.method, headers=request.headers, json=request._json_data):
            mock_verify_token.return_value = self.mock_auth_token
            mock_db = Mock()
            mock_firestore_client.return_value = mock_db

            response = handleUpdateProfile(request)

            self.assertEqual(response.status_code, 200)
            mock_db.collection.assert_called_with("users")

    @patch('main.auth.verify_id_token')
    def test_update_profile_unauthorized(self, mock_verify_token):
        """Test unauthorized profile update attempt."""
        request = MockRequest(method='PUT', path='/update_profile/test_user_123', headers={'Authorization': 'Bearer valid_token'}, json_data={'displayName': 'New Name'})
        with self.app.test_request_context(path=request.path, method=request.method, headers=request.headers, json=request._json_data):
            mock_verify_token.return_value = {'uid': 'different_user'}
            response = handleUpdateProfile(request)
            self.assertEqual(response.status_code, 403)

    @patch('main.firestore.client')
    def test_get_achievements_success(self, mock_firestore_client):
        """Test successful achievements list retrieval."""
        request = MockRequest()
        with self.app.test_request_context(path=request.path):
            mock_db = Mock()
            mock_firestore_client.return_value = mock_db
            mock_achievement_doc = Mock()
            mock_achievement_doc.id = 'achievement_1'
            mock_achievement_doc.to_dict.return_value = {'name': 'First Race'}
            mock_db.collection.return_value.stream.return_value = [mock_achievement_doc]

            response = handleGetAchievements(request)

            self.assertEqual(response.status_code, 200)
            response_data = json.loads(response.data)
            self.assertEqual(len(response_data), 1)
            self.assertEqual(response_data[0]['name'], 'First Race')

    @patch('main.auth.verify_id_token')
    @patch('main.firestore.client')
    def test_assign_achievement_success(self, mock_firestore_client, mock_verify_token):
        """Test successful achievement assignment."""
        request_data = {'userId': 'test_user_123', 'achievementId': 'achievement_1'}
        request = MockRequest(method='POST', headers={'Authorization': 'Bearer admin_token'}, json_data=request_data)
        with self.app.test_request_context(path=request.path, method=request.method, headers=request.headers, json=request_data):
            mock_verify_token.return_value = self.mock_admin_token
            mock_db = Mock()
            mock_firestore_client.return_value = mock_db
            mock_achievement_doc = Mock()
            mock_achievement_doc.exists = True
            mock_db.collection.return_value.document.return_value.get.return_value = mock_achievement_doc
            mock_db.collection.return_value.where.return_value.where.return_value.limit.return_value.stream.return_value = []

            response = handleAssignAchievement(request)

            self.assertEqual(response.status_code, 200)

    @patch('main.auth.verify_id_token')
    def test_assign_achievement_forbidden(self, mock_verify_token):
        """Test achievement assignment by non-admin user."""
        request_data = {'userId': 'test_user_123', 'achievementId': 'achievement_1'}
        request = MockRequest(method='POST', headers={'Authorization': 'Bearer user_token'}, json_data=request_data)
        with self.app.test_request_context(path=request.path, method=request.method, headers=request.headers, json=request_data):
            mock_verify_token.return_value = self.mock_auth_token
            response = handleAssignAchievement(request)
            self.assertEqual(response.status_code, 403)

if __name__ == '__main__':
    unittest.main()