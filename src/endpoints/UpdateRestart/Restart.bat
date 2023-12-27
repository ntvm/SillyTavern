@echo off
pushd %~dp0
git --version 
cd ../../../
call npm install
node server.js
pause
popd
