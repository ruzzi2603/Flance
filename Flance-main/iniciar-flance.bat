@echo off
setlocal
cd /d "%~dp0"

where ngrok >nul 2>&1
if errorlevel 1 (
  echo ngrok nao foi encontrado no PATH.
  echo Instale o ngrok ou abra um novo terminal e tente novamente.
  pause
  exit /b 1
)

start "Flance - npm run dev" powershell.exe -NoExit -NoProfile -Command "Set-Location -LiteralPath '%~dp0'; npm run dev"
start "Flance - ngrok" powershell.exe -NoExit -NoProfile -Command "ngrok http 3001"

echo Servidor e ngrok iniciados em janelas separadas.
echo Mantenha ambas abertas enquanto estiver testando.
endlocal
