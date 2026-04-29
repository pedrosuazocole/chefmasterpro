# 🚀 Guía de Instalación Rápida

## Para Windows

### 1. Instalar Node.js

1. Descargá Node.js desde: https://nodejs.org/
2. Instalá la versión LTS (recomendada)
3. Verificá la instalación:
   - Abrí CMD o PowerShell
   - Ejecutá: `node --version`
   - Deberías ver algo como: `v18.x.x`

### 2. Instalar el Sistema

1. Descomprimí el archivo ZIP del sistema
2. Abrí CMD en la carpeta del sistema
3. Ejecutá: `npm install`
4. Esperá a que termine la instalación

### 3. Iniciar el Sistema

1. En CMD, ejecutá: `npm start`
2. Abrí tu navegador
3. Ingresá a: `http://localhost:3000`
4. Usuario: `admin` / Contraseña: `admin123`

## Para macOS

### 1. Instalar Node.js

```bash
# Opción 1: Desde el sitio web
# Descargá desde: https://nodejs.org/

# Opción 2: Con Homebrew
brew install node
```

### 2. Instalar el Sistema

```bash
cd ruta/al/sistema-cocina
npm install
```

### 3. Iniciar

```bash
npm start
```

## Para Linux (Ubuntu/Debian)

### 1. Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Instalar el Sistema

```bash
cd /ruta/al/sistema-cocina
npm install
```

### 3. Iniciar

```bash
npm start
```

## Verificación

Si todo salió bien, deberías ver:

```
🍳 ========================================
   SISTEMA DE CONTROL DE COCINA
   Node.js Professional Edition
========================================

✅ Servidor corriendo en: http://localhost:3000

👤 Credenciales por defecto:
   Usuario: admin
   Contraseña: admin123
========================================
```

## Problemas Comunes

### Error: "npm no se reconoce"

**Solución:** Node.js no está instalado o no está en el PATH.
- Reinstalá Node.js
- Reiniciá la terminal

### Error: "Puerto 3000 en uso"

**Solución:** Cambiá el puerto
1. Abrí el archivo `.env`
2. Cambiá `PORT=3000` por `PORT=3001`
3. Reiniciá el servidor

### Error de permisos (Linux/Mac)

**Solución:**
```bash
sudo npm install
sudo npm start
```

## 🎉 ¡Listo!

Tu sistema está funcionando. Ingresá a:
**http://localhost:3000**

Usuario: `admin`  
Contraseña: `admin123`
