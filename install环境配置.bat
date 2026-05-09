@echo off
cd /d "%~dp0"
echo Installing root dependencies...
call npm install --loglevel=error
echo.
echo Installing server dependencies...
cd /d "%~dp0\server"
call npm install --loglevel=error
echo.
echo Installing client dependencies...
cd /d "%~dp0\client"
call npm install --loglevel=error
echo.
echo All done. Press any key to exit.
pause
