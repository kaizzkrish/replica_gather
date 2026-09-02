# PowerShell script to move generated kitty images to the project assets
$sourceDir = "C:\Users\ksri2\.gemini\antigravity\brain\e7029045-2387-4480-86cd-63baefb25f1f"
$targetDir = "c:\Kaizz\kaizz\replica_gather\client\public\kitties"

if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force
}

Copy-Item "$sourceDir\toggle_kitty_1778787604761.png" "$targetDir\toggle_kitty.png" -Force
# User has custom Chat.png and Connect.png, skipping those
# User has custom Music.png and Settings.png, skipping those
Copy-Item "$sourceDir\logout_kitty_1778787694786.png" "$targetDir\logout_kitty.png" -Force

Write-Host "Kitties have been moved to $targetDir successfully!" -ForegroundColor Cyan
