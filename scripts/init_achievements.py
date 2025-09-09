"""
Sample achievements initialization script for RedsRacing.
This script adds default achievements to the Firestore database.
Run this script once to populate the achievements collection.
"""

import json

# Sample achievements data
SAMPLE_ACHIEVEMENTS = [
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
        "description": "Achieve a lap time under 2:00 minutes",
        "icon": "⚡",
        "category": "performance",
        "points": 25
    },
    {
        "id": "consistent_racer",
        "name": "Consistent Racer",
        "description": "Complete 5 races in a season",
        "icon": "🎯",
        "category": "racing",
        "points": 30
    },
    {
        "id": "podium_finish",
        "name": "Podium Finish",
        "description": "Finish in the top 3 positions",
        "icon": "🏆",
        "category": "performance",
        "points": 50
    },
    {
        "id": "clean_racer",
        "name": "Clean Racer",
        "description": "Complete a race with no penalties",
        "icon": "✨",
        "category": "sportsmanship",
        "points": 20
    },
    {
        "id": "community_member",
        "name": "Community Member",
        "description": "Join the RedsRacing community",
        "icon": "👥",
        "category": "community",
        "points": 5
    },
    {
        "id": "photographer",
        "name": "Photographer",
        "description": "Upload 5 photos to the gallery",
        "icon": "📸",
        "category": "community",
        "points": 15
    },
    {
        "id": "fan_favorite",
        "name": "Fan Favorite",
        "description": "Receive 10 likes on your photos",
        "icon": "❤️",
        "category": "community",
        "points": 25
    },
    {
        "id": "season_veteran",
        "name": "Season Veteran",
        "description": "Participate in an entire racing season",
        "icon": "🗓️",
        "category": "racing",
        "points": 100
    },
    {
        "id": "track_master",
        "name": "Track Master",
        "description": "Win a race at your home track",
        "icon": "🏅",
        "category": "performance",
        "points": 75
    }
]

def save_achievements_json():
    """Save achievements to a JSON file for manual import."""
    with open('sample_achievements.json', 'w') as f:
        json.dump(SAMPLE_ACHIEVEMENTS, f, indent=2)
    print(f"Saved {len(SAMPLE_ACHIEVEMENTS)} achievements to sample_achievements.json")
    print("You can import these to Firestore using the Firebase console or Admin SDK.")

def print_firestore_commands():
    """Print Firestore console commands to create achievements."""
    print("\n=== Firestore Console Commands ===")
    print("Run these commands in the Firebase console to create achievements:\n")
    
    for achievement in SAMPLE_ACHIEVEMENTS:
        print(f"// Create achievement: {achievement['name']}")
        print(f"db.collection('achievements').doc('{achievement['id']}').set({{")
        for key, value in achievement.items():
            if key != 'id':
                if isinstance(value, str):
                    print(f"  {key}: '{value}',")
                else:
                    print(f"  {key}: {value},")
        print("});\n")

if __name__ == "__main__":
    print("RedsRacing Sample Achievements")
    print("=" * 30)
    
    # Save to JSON file
    save_achievements_json()
    
    # Print console commands
    print_firestore_commands()
    
    print("Manual Import Instructions:")
    print("1. Open Firebase Console > Firestore Database")
    print("2. Create a collection called 'achievements'")
    print("3. For each achievement, create a document with the ID and fields shown above")
    print("4. Or upload the sample_achievements.json file using the Firebase Admin SDK")