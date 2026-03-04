# User Profile and Achievements API

This document describes the API endpoints for the user profile and achievements system in RedsRacing.

## Authentication

All endpoints require authentication except for public profile viewing. Include the Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

## Endpoints

### GET /profile/{user_id}

Retrieve a user's profile and achievements.

**Parameters:**

- `user_id` (path): The Firebase user ID

**Response:**

```json
{
  "username": "johndoe",
  "displayName": "John Doe",
  "bio": "Racing enthusiast and weekend warrior",
  "avatarUrl": "https://example.com/avatar.jpg",
  "favoriteCars": ["Porsche 911", "BMW M3"],
  "joinDate": "2024-01-15T00:00:00Z",
  "achievements": [
    {
      "id": "first_race",
      "name": "First Race",
      "description": "Complete your first race",
      "icon": "🏁",
      "category": "racing",
      "dateEarned": "2024-02-01T10:30:00Z"
    }
  ]
}
```

**Status Codes:**

- `200 OK`: Profile retrieved successfully
- `404 Not Found`: Profile not found
- `500 Internal Server Error`: Server error

### PUT /profile/{user_id}

Update the authenticated user's profile. Users can only update their own profile.

**Parameters:**

- `user_id` (path): The Firebase user ID (must match authenticated user)

**Request Body:**

```json
{
  "username": "johndoe",
  "displayName": "John Doe",
  "bio": "Updated bio text",
  "avatarUrl": "https://example.com/new-avatar.jpg",
  "favoriteCars": ["McLaren 720S", "Ferrari 488"]
}
```

**Response:**

```
Profile updated successfully
```

**Status Codes:**

- `200 OK`: Profile updated successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User can only update their own profile
- `500 Internal Server Error`: Server error

### GET /achievements

List all available achievements/badges.

**Authentication:** Not required

**Response:**

```json
[
  {
    "id": "first_race",
    "name": "First Race",
    "description": "Complete your first race",
    "icon": "🏁",
    "category": "racing",
    "points": 10
  },
  {
    "id": "speed_demon",
    "name": "Speed Demon",
    "description": "Achieve a lap time under 2:00",
    "icon": "⚡",
    "category": "performance",
    "points": 25
  }
]
```

**Status Codes:**

- `200 OK`: Achievements retrieved successfully
- `500 Internal Server Error`: Server error

### POST /assign_achievement

Assign an achievement to a user. Admin role (`team-member`) required.

**Authentication:** Required (admin only)

**Request Body:**

```json
{
  "userId": "firebase-user-id",
  "achievementId": "first_race"
}
```

**Response:**

```
Achievement assigned successfully
```

**Status Codes:**

- `200 OK`: Achievement assigned successfully
- `400 Bad Request`: Missing required fields or user already has achievement
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Admin role required
- `404 Not Found`: Achievement not found
- `500 Internal Server Error`: Server error

## Data Models

### User Profile

```typescript
interface UserProfile {
  username: string; // Unique username
  displayName: string; // Display name
  bio?: string; // Optional bio text
  avatarUrl?: string; // Optional avatar image URL
  favoriteCars: string[]; // Array of favorite car names
  joinDate: string; // ISO 8601 date string
  lastUpdated: string; // Auto-generated timestamp
}
```

### Achievement

```typescript
interface Achievement {
  id: string; // Unique achievement ID
  name: string; // Achievement name
  description: string; // Achievement description
  icon: string; // Achievement icon (emoji or URL)
  category: string; // Achievement category
  points?: number; // Optional points value
}
```

### User Achievement

```typescript
interface UserAchievement {
  userId: string; // Firebase user ID
  achievementId: string; // Achievement ID
  dateEarned: string; // ISO 8601 date string
  assignedBy: string; // User ID who assigned the achievement
}
```

## Error Handling

All endpoints return appropriate HTTP status codes and error messages. Common error responses:

```json
{
  "error": "Error message description"
}
```

## Security

- Users can only view and edit their own profiles
- Only admins (`team-member` role) can assign achievements
- All write operations require authentication
- Profile viewing is public but profile editing requires authentication

## Database Collections

The system uses the following Firestore collections:

- `user_profiles`: User profile data
- `achievements`: Available achievements
- `user_achievements`: User-earned achievements mapping
