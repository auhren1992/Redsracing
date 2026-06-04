@echo off
cd /d C:\Users\Parts\Documents\Desktop\Redsracing
echo Syncing navigation.js...
copy /Y navigation.js android\app\src\main\assets\navigation.js
copy /Y navigation.js android\app\src\main\assets\www\navigation.js
copy /Y navigation.js android\app\src\main\assets\www\assets\js\navigation.js
copy /Y navigation.js android\app\src\main\assets\assets\js\navigation.js
copy /Y navigation.js ios\RedsRacing\www\navigation.js
copy /Y navigation.js ios\RedsRacing\www\assets\js\navigation.js
copy /Y navigation.js assets\js\navigation.js
echo Cleaning legacy files...
del /Q android\app\src\main\assets\temp_nav.html 2>nul
del /Q android\app\src\main\assets\www\temp_nav.html 2>nul
del /Q android\app\src\main\assets\www\HEADER_TEMPLATE.html 2>nul
del /Q android\app\src\main\assets\www\simple-debug.html 2>nul
del /Q android\app\src\main\assets\HEADER_TEMPLATE.html 2>nul
echo Deploying to Firebase...
firebase deploy --only hosting
echo Done!
pause