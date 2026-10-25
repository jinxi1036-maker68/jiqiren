@echo off
"%~dp0..\..\native-env\Scripts\python.exe" -I -B "%~dp0..\..\native_cli.py" %*
exit /b %errorlevel%
