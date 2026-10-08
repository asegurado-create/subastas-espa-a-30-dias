@echo off
REM Diagnostico TGSS — doble clic AQUI. Tarda ~30 segundos. No cierra la ventana.
cd /d "%~dp0"
del diagnostico.log 2>nul
echo === 1. PowerShell disponible === > diagnostico.log
where powershell >> diagnostico.log 2>&1
echo. >> diagnostico.log
echo === 2. Version y politicas === >> diagnostico.log
powershell -NoProfile -ExecutionPolicy Bypass -Command "$PSVersionTable.PSVersion; Get-ExecutionPolicy -List" >> diagnostico.log 2>&1
echo. >> diagnostico.log
echo === 3. Alcance a la TGSS (15s) === >> diagnostico.log
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$r=Invoke-WebRequest -Uri 'https://w6.seg-social.es/subastas/SubaSeControladorInter?opcion=3&avanzada=0' -UseBasicParsing -TimeoutSec 15;Write-Output ('TGSS_OK len='+($r.Content.Length))}catch{Write-Output ('TGSS_FALLO: '+$_.Exception.Message)}" >> diagnostico.log 2>&1
echo. >> diagnostico.log
echo === 4. Ficheros === >> diagnostico.log
dir /b actualizar.bat actualizar.ps1 datos\inmuebles.json >> diagnostico.log 2>&1
echo. >> diagnostico.log
type diagnostico.log
echo ----------------------------------------
pause
