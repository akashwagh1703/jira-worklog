@echo off
echo Starting PHP Development Server...
echo.
echo PHP API will be available at: http://localhost:8000/api/proxy.php
echo.
echo Press Ctrl+C to stop the server
echo.
cd api
php -S localhost:8000
