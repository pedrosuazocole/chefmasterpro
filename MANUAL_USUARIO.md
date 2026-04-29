# 📖 Manual de Usuario - Sistema de Cocina

## 🎯 Guía Rápida de Uso

### 1. Iniciar el Sistema

1. Abrí una terminal
2. Navegá a la carpeta del sistema
3. Ejecutá: `npm start`
4. Abrí tu navegador en: `http://localhost:3000`

### 2. Iniciar Sesión

- Usuario: `admin`
- Contraseña: `admin123`

### 3. Flujo de Trabajo Recomendado

#### Paso 1: Crear Catálogo de Productos

1. Ir a **Catálogo** en el menú lateral
2. Ir a la pestaña "Registrar"
3. Ingresar:
   - Nombre del producto (ej: "PAPAS")
   - Unidad de medida (ej: "Libra")
4. Clic en "Guardar"

#### Paso 2: Registrar Compras (Actualizar Inventario)

1. Ir a **Inventario/Compras**
2. Registrar factura de compra:
   - Número de factura
   - Fecha
   - Productos comprados
   - Cantidad y costo

El sistema automáticamente:
- ✅ Suma al inventario
- ✅ Recalcula costos promedio
- ✅ Actualiza el stock

#### Paso 3: Crear Recetas

1. Ir a **Recetas**
2. Crear nueva receta:
   - Nombre del plato
   - Seleccionar ingredientes
   - Cantidad de cada uno
   - Precio de venta deseado

El sistema calcula automáticamente:
- ✅ Costo total del plato
- ✅ Utilidad
- ✅ Margen de ganancia

#### Paso 4: Procesar Producción

1. Ir a **Producción**
2. Seleccionar plato a producir
3. Indicar cantidad de porciones
4. El sistema valida stock disponible
5. Clic en "Procesar"

El sistema automáticamente:
- ✅ Descuenta ingredientes del inventario
- ✅ Genera ID único de operación
- ✅ Registra en historial

### 4. Ver Reportes

Ir a **Reportes** para ver:

- 📊 Inversión total en bodega
- ⚠️ Productos con stock bajo
- 💰 Recetas más rentables
- 📈 Análisis de márgenes

## 🔑 Gestión de Usuarios (Solo Admin)

### Crear Nuevo Usuario

Actualmente en desarrollo - próximamente disponible.

### Cambiar Contraseña

1. Ir a configuración de usuario
2. Ingresar contraseña actual
3. Ingresar nueva contraseña
4. Confirmar

## 💡 Tips y Mejores Prácticas

### 1. Control de Inventario

- ✅ Registrá todas las compras inmediatamente
- ✅ Revisá el stock antes de producir
- ✅ Configurá alertas de stock mínimo

### 2. Recetas

- ✅ Usá nombres descriptivos
- ✅ Revisá costos regularmente
- ✅ Ajustá márgenes según el mercado

### 3. Producción

- ✅ Verificá stock antes de procesar
- ✅ Si te equivocás, podés revertir la operación
- ✅ Guardá los IDs de operación

### 4. Reportes

- ✅ Revisá stock bajo diariamente
- ✅ Analizá recetas rentables mensualmente
- ✅ Exportá reportes para análisis

## 🆘 Solución de Problemas

### No puedo iniciar sesión

- Verificá que el usuario y contraseña sean correctos
- Si olvidaste la contraseña, contactá al administrador
- Después de 5 intentos fallidos, esperá 15 minutos

### El stock no se actualiza

- Asegurate de registrar las compras
- Verificá que los códigos de producto coincidan
- Revisá el historial de compras

### Error al procesar producción

- Verificá que haya stock suficiente
- Asegurate que la receta esté completa
- Revisá que los ingredientes existan

## 📞 Contacto

Para soporte técnico o consultas:
- Instituto Tecnológico Santo Tomás
- Departamento de Informática

---

**¡Éxito con tu sistema de cocina!** 🍳
