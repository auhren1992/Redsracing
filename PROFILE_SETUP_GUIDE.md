# User Profile and Achievements System - Setup Guide

This guide explains how to set up and use the new user profile and achievements system in RedsRacing.

## Features Implemented

### 1. User Profiles
- **Complete Profile Management**: Users can create and edit their profiles with username, display name, bio, avatar, and favorite cars
- **Public Profile Viewing**: Anyone can view user profiles
- **Secure Editing**: Users can only edit their own profiles
- **Auto Profile Creation**: New users get default profiles created automatically

### 2. Achievements System
- **Achievement Management**: Comprehensive system for tracking user accomplishments
- **Admin Controls**: Team members can assign achievements to users
- **Achievement Categories**: Racing, performance, community, and sportsmanship achievements
- **Points System**: Each achievement has point values for gamification

### 3. Security & Authentication
- **Role-Based Access**: Different permissions for regular users vs team members
- **Secure API**: All endpoints properly authenticated and authorized
- **Firebase Integration**: Seamless integration with existing Firebase Auth

## Setup Instructions

### 1. Database Setup

First, initialize the achievements in your Firestore database:

```bash
cd scripts
python init_achievements.py
```

This will create `sample_achievements.json` and print Firestore console commands. Follow the printed instructions to add achievements to your Firestore database.

### 2. Firebase Configuration

The following collections will be created in Firestore:
- `user_profiles`: User profile data
- `achievements`: Available achievements/badges  
- `user_achievements`: User-earned achievements mapping

The Firestore security rules have been updated to handle these new collections with appropriate permissions.

### 3. Backend Deployment

The Python Cloud Functions have been updated with new endpoints:
- `GET /profile/{user_id}`: Get user profile and achievements
- `PUT /profile/{user_id}`: Update user profile (own profile only)
- `GET /achievements`: List all available achievements
- `POST /assign_achievement`: Assign achievement to user (admin only)

Deploy the functions using Firebase CLI:
```bash
firebase deploy --only functions:python-api
```

### 4. Frontend Access

The new profile page is available at `/profile.html`. Users can:
- View their own profile or other users' profiles
- Edit their profile information (username, display name, bio, avatar, favorite cars)
- See their earned achievements
- Admins can assign achievements to users when viewing other profiles

## Usage Guide

### For Regular Users

1. **Access Your Profile**: Click "Profile" in the navigation menu
2. **Edit Profile**: Click "Edit Profile" button to modify your information
3. **View Achievements**: Your earned achievements appear on the right sidebar
4. **View Other Profiles**: Add `?id=user_id` to the URL to view other users' profiles

### For Administrators (Team Members)

1. **Assign Achievements**: When viewing another user's profile, use the "Assign" buttons in the admin panel
2. **Manage Achievements**: All available achievements are listed with assign functionality
3. **Monitor Users**: Full access to view and manage all user profiles

### Profile URL Parameters
- `/profile.html` - View your own profile
- `/profile.html?id=USER_ID` - View specific user's profile

## API Documentation

Complete API documentation is available in `API_DOCUMENTATION.md` with:
- Detailed endpoint descriptions
- Request/response examples
- Authentication requirements
- Error handling
- Data model schemas

## Sample Achievements

The system includes 10 default achievements:

### Racing Category
- **First Race** (10 pts): Complete your first race
- **Consistent Racer** (30 pts): Complete 5 races in a season  
- **Season Veteran** (100 pts): Participate in an entire racing season

### Performance Category
- **Speed Demon** (25 pts): Achieve a lap time under 2:00 minutes
- **Podium Finish** (50 pts): Finish in the top 3 positions
- **Track Master** (75 pts): Win a race at your home track

### Community Category
- **Community Member** (5 pts): Join the RedsRacing community
- **Photographer** (15 pts): Upload 5 photos to the gallery
- **Fan Favorite** (25 pts): Receive 10 likes on your photos

### Sportsmanship Category
- **Clean Racer** (20 pts): Complete a race with no penalties

## Testing

Comprehensive tests are available in `tests/test_profile_endpoints.py`. Run tests with:

```bash
python -m unittest tests.test_profile_endpoints -v
```

Note: Tests require Firebase Admin SDK dependencies.

## Mobile Responsiveness

The profile page is fully responsive and works on:
- Desktop computers
- Tablets 
- Mobile phones

The UI adapts to different screen sizes while maintaining functionality.

## Data Models

### User Profile
```json
{
  "username": "johndoe",
  "displayName": "John Doe", 
  "bio": "Racing enthusiast",
  "avatarUrl": "https://...",
  "favoriteCars": ["Porsche 911", "BMW M3"],
  "joinDate": "2024-01-15T00:00:00Z",
  "lastUpdated": "2024-01-20T10:30:00Z"
}
```

### Achievement
```json
{
  "name": "First Race",
  "description": "Complete your first race",
  "icon": "🏁",
  "category": "racing",
  "points": 10
}
```

## Future Enhancements

The system is designed to support:
- Avatar upload functionality
- Automatic achievement awarding based on user actions
- Achievement progress tracking
- Leaderboards and competition features
- Social features like following other users