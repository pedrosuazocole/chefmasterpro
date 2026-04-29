@echo off
chcp 65001 > nul
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║       🍽️  CHEF MASTER PRO v1.6                  ║
echo ║       Instalación - Windows                      ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: Verificar versión de Node.js
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js no está instalado.
    echo.
    echo Por favor instalá Node.js v18 LTS desde:
    echo https://nodejs.org/es/download
    echo.
    echo Elegí la opción: Windows Installer (.msi) - 64-bit
    echo.
    pause
    exit /b 1
)

for /f "tokens=1" %%v in ('node --version') do set NODE_VER=%%v
echo ✅ Node.js encontrado: %NODE_VER%

:: Verificar que sea Node 14+
node -e "if(parseInt(process.version.slice(1))<14){process.exit(1)}" > nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Tu Node.js es muy antiguo: %NODE_VER%
    echo.
    echo Este sistema requiere Node.js v14 o superior.
    echo.
    echo Descargá la versión actualizada desde:
    echo https://nodejs.org/es/download
    echo.
    echo Elegí: Windows Installer - LTS - 64-bit
    echo.
    pause
    exit /b 1
)

echo.
echo 📦 Instalando dependencias...
npm install

if %errorlevel% neq 0 (
    echo.
    echo ❌ Error instalando dependencias.
    echo Intentá ejecutar como Administrador.
    pause
    exit /b 1
)

echo.
echo ✅ ¡Instalación completada exitosamente!
echo.
echo Para iniciar el sistema ejecutá: START.bat
echo.
pause
