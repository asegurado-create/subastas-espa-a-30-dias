@echo off
REM Actualizador TGSS — hacer doble clic AQUI (no en scraper-node.js ni en actualizar.ps1).
REM Guarda todo en actualizar.log y mantiene la ventana abierta aunque haya error.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0actualizar.ps1" > "%~dp0actualizar.log" 2>&1
set CODE=%ERRORLEVEL%
echo ----------------------------------------
echo Codigo de salida: %CODE%
echo ----------------------------------------
type "%~dp0actualizar.log"
echo ----------------------------------------
if %CODE% NEQ 0 (
  echo HA FALLADO. Copia el contenido de actualizar.log para diagnosticarlo.
  echo Causas tipicas: sin internet, la TGSS caida, o sesion caducada - reintenta en 1 minuto.
) else (
  echo OK. Recarga index.html para ver los datos nuevos.
)
pause
