@echo off
chcp 65001 > nul
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║       🍽️  CHEF MASTER PRO v1.6                  ║
echo ║       Iniciando servidor...                      ║
echo ╚══════════════════════════════════════════════════╝
echo.
echo ✅ Servidor iniciando en http://localhost:3000
echo.
echo Usuario: admin
echo Contraseña: admin123
echo.
echo Presiona Ctrl+C para detener el servidor.
echo.
node server.js
pause
