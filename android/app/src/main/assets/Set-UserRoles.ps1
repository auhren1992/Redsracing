# User Role Management Script for RedsRacing
# This script helps manage admin (full access) and team-member (limited access) roles

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("SetAdmin", "SetTeamMember", "RemoveAdmin", "ListUsers", "ShowAccess")]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [string]$UserEmail,
    
    [Parameter(Mandatory=$false)]
    [string]$FirebaseProjectId = "redsracing-a7f8b"
)

# Configuration: Define what each role can access
$AccessControlConfig = @{
    "admin" = @{
        "DisplayName" = "Administrator"
        "Role" = "team-member"  # This is the actual role stored in Firebase
        "Description" = "Full access to everything"
        "CanAccess" = @(
            "Admin Console (admin-console.html)",
            "Dashboard Management", 
            "User Management",
            "Gallery Photo Approvals",
            "Race Management", 
            "Content Management",
            "Analytics & Reports",
            "System Settings",
            "Q&A Management",
            "Video Library Management",
            "Invitation Code Management"
        )
        "Permissions" = @{
            "CanApprovePhotos" = $true
            "CanManageUsers" = $true
            "CanEditContent" = $true
            "CanManageRaces" = $true
            "CanAccessAnalytics" = $true
            "CanManageSettings" = $true
        }
    }
    "team-member" = @{
        "DisplayName" = "Team Member"
        "Role" = "TeamRedFollower"  # This is the actual role stored in Firebase  
        "Description" = "Limited access to specific features"
        "CanAccess" = @(
            "Follower Dashboard (follower-dashboard.html)",
            "View Gallery",
            "View Schedule", 
            "View Leaderboard",
            "Basic Profile Management"
        )
        "Permissions" = @{
            "CanApprovePhotos" = $false
            "CanManageUsers" = $false
            "CanEditContent" = $false
            "CanManageRaces" = $false
            "CanAccessAnalytics" = $false
            "CanManageSettings" = $false
        }
    }
}

function Show-Header {
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host "  REDSRACING USER ROLE MANAGEMENT SYSTEM" -ForegroundColor Yellow
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host ""
}

function Show-AccessControl {
    Write-Host "ACCESS CONTROL CONFIGURATION:" -ForegroundColor Green
    Write-Host ""
    
    foreach ($roleKey in $AccessControlConfig.Keys) {
        $roleInfo = $AccessControlConfig[$roleKey]
        
        Write-Host "[$($roleInfo.DisplayName.ToUpper())]" -ForegroundColor Yellow
        Write-Host "  Firebase Role: $($roleInfo.Role)" -ForegroundColor Gray
        Write-Host "  Description: $($roleInfo.Description)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  Can Access:" -ForegroundColor White
        foreach ($access in $roleInfo.CanAccess) {
            Write-Host "    ✓ $access" -ForegroundColor Green
        }
        Write-Host ""
        Write-Host "  Permissions:" -ForegroundColor White
        foreach ($perm in $roleInfo.Permissions.GetEnumerator()) {
            $status = if ($perm.Value) { "✓" } else { "✗" }
            $color = if ($perm.Value) { "Green" } else { "Red" }
            Write-Host "    $status $($perm.Key)" -ForegroundColor $color
        }
        Write-Host ""
    }
}

function Set-UserRole {
    param(
        [string]$Email,
        [string]$TargetRole
    )
    
    if (-not $Email) {
        Write-Host "ERROR: Email address is required for this action" -ForegroundColor Red
        return
    }
    
    $roleConfig = $AccessControlConfig[$TargetRole]
    $firebaseRole = $roleConfig.Role
    
    Write-Host "Setting user role..." -ForegroundColor Yellow
    Write-Host "  User: $Email" -ForegroundColor White
    Write-Host "  Role: $($roleConfig.DisplayName)" -ForegroundColor White
    Write-Host "  Firebase Role: $firebaseRole" -ForegroundColor Gray
    Write-Host ""
    
    # Note: This would typically use Firebase Admin SDK or REST API
    # For now, we'll show the commands that would need to be run
    Write-Host "FIREBASE ADMIN COMMAND NEEDED:" -ForegroundColor Cyan
    Write-Host "firebase auth:set-custom-user-claims $Email '{`"role`":`"$firebaseRole`"}' --project $FirebaseProjectId" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "ALTERNATIVE NODE.JS COMMAND:" -ForegroundColor Cyan
    @"
const admin = require('firebase-admin');
admin.auth().setCustomUserClaims('$Email', { role: '$firebaseRole' })
  .then(() => console.log('Successfully set custom claims'))
  .catch(error => console.error('Error:', error));
"@ | Write-Host -ForegroundColor Yellow
    
    Write-Host ""
    Write-Host "After running the command above, the user will have:" -ForegroundColor Green
    foreach ($access in $roleConfig.CanAccess) {
        Write-Host "  ✓ $access" -ForegroundColor Green
    }
}

function Remove-AdminRole {
    param([string]$Email)
    
    if (-not $Email) {
        Write-Host "ERROR: Email address is required for this action" -ForegroundColor Red
        return
    }
    
    Write-Host "Removing admin privileges..." -ForegroundColor Yellow
    Write-Host "  User: $Email" -ForegroundColor White
    Write-Host "  New Role: Team Member (limited access)" -ForegroundColor White
    Write-Host ""
    
    Write-Host "FIREBASE ADMIN COMMAND NEEDED:" -ForegroundColor Cyan
    Write-Host "firebase auth:set-custom-user-claims $Email '{`"role`":`"TeamRedFollower`"}' --project $FirebaseProjectId" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "This will REMOVE the following permissions:" -ForegroundColor Red
    $adminPerms = $AccessControlConfig["admin"].Permissions
    foreach ($perm in $adminPerms.GetEnumerator()) {
        if ($perm.Value) {
            Write-Host "  ✗ $($perm.Key)" -ForegroundColor Red
        }
    }
}

function Show-UserList {
    Write-Host "To list all users and their current roles, use:" -ForegroundColor Cyan
    Write-Host "firebase auth:export users.json --project $FirebaseProjectId" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Then check the 'customClaims.role' field for each user." -ForegroundColor Gray
    Write-Host ""
    Write-Host "ROLE MAPPING:" -ForegroundColor White
    Write-Host "  'team-member' = Administrator (full access)" -ForegroundColor Green
    Write-Host "  'TeamRedFollower' = Team Member (limited access)" -ForegroundColor Yellow
    Write-Host "  No role or other = Regular visitor (no dashboard access)" -ForegroundColor Gray
}

function Show-Instructions {
    Write-Host "SETUP INSTRUCTIONS:" -ForegroundColor Green
    Write-Host ""
    Write-Host "1. Install Firebase CLI:" -ForegroundColor White
    Write-Host "   npm install -g firebase-tools" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Login to Firebase:" -ForegroundColor White
    Write-Host "   firebase login" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Set your project:" -ForegroundColor White
    Write-Host "   firebase use $FirebaseProjectId" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Run this script with desired action:" -ForegroundColor White
    Write-Host "   .\Set-UserRoles.ps1 -Action SetAdmin -UserEmail user@example.com" -ForegroundColor Gray
    Write-Host ""
}

# Main script execution
Clear-Host
Show-Header

switch ($Action) {
    "SetAdmin" {
        Write-Host "SETTING ADMIN ROLE (Full Access)" -ForegroundColor Green
        Write-Host ""
        Set-UserRole -Email $UserEmail -TargetRole "admin"
    }
    "SetTeamMember" {
        Write-Host "SETTING TEAM MEMBER ROLE (Limited Access)" -ForegroundColor Yellow  
        Write-Host ""
        Set-UserRole -Email $UserEmail -TargetRole "team-member"
    }
    "RemoveAdmin" {
        Write-Host "REMOVING ADMIN PRIVILEGES" -ForegroundColor Red
        Write-Host ""
        Remove-AdminRole -Email $UserEmail
    }
    "ListUsers" {
        Write-Host "USER LISTING INSTRUCTIONS" -ForegroundColor Blue
        Write-Host ""
        Show-UserList
    }
    "ShowAccess" {
        Show-AccessControl
    }
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Show help if needed
if ($Action -in @("SetAdmin", "SetTeamMember", "RemoveAdmin") -and -not $UserEmail) {
    Write-Host "USAGE EXAMPLES:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Make someone an admin:" -ForegroundColor White
    Write-Host "  .\Set-UserRoles.ps1 -Action SetAdmin -UserEmail admin@redsracing.com" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Make someone a regular team member:" -ForegroundColor White  
    Write-Host "  .\Set-UserRoles.ps1 -Action SetTeamMember -UserEmail member@redsracing.com" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Remove admin privileges:" -ForegroundColor White
    Write-Host "  .\Set-UserRoles.ps1 -Action RemoveAdmin -UserEmail former-admin@redsracing.com" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Show access control rules:" -ForegroundColor White
    Write-Host "  .\Set-UserRoles.ps1 -Action ShowAccess" -ForegroundColor Gray
    Write-Host ""
}

if ($Action -eq "SetAdmin" -or $Action -eq "SetTeamMember" -or $Action -eq "RemoveAdmin") {
    Show-Instructions
}