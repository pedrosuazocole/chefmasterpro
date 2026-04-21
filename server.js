import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ==================================================
// CONFIGURACIÓN DE ALMACENAMIENTO (JSON)
// ==================================================
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Archivos de datos
const FILES = {
    usuarios: path.join(DATA_DIR, 'usuarios.json'),
    catalogo: path.join(DATA_DIR, 'catalogo.json'),
    inventario: path.join(DATA_DIR, 'inventario.json'),
    historial: path.join(DATA_DIR, 'historial.json'),
    recetas: path.join(DATA_DIR, 'recetas.json'),
    produccion: path.join(DATA_DIR, 'produccion.json'),
    auditoria: path.join(DATA_DIR, 'auditoria.json'),
    productoTerminado: path.join(DATA_DIR, 'producto-terminado.json'),
    movimientosProducto: path.join(DATA_DIR, 'movimientos-producto.json'),
    kardex: path.join(DATA_DIR, 'kardex.json')
};

// ==================================================
// FUNCIONES HELPER PARA BASE DE DATOS JSON
// ==================================================
function leerDatos(archivo) {
    try {
        if (fs.existsSync(archivo)) {
            const data = fs.readFileSync(archivo, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`Error leyendo ${archivo}:`, error);
    }
    return [];
}

function guardarDatos(archivo, datos) {
    try {
        fs.writeFileSync(archivo, JSON.stringify(datos, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error guardando ${archivo}:`, error);
        return false;
    }
}

function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==================================================
// INICIALIZACIÓN DE DATOS
// ==================================================
function inicializarDatos() {
    // Usuarios
    if (!fs.existsSync(FILES.usuarios)) {
        const passwordHash = bcrypt.hashSync('admin123', 10);
        guardarDatos(FILES.usuarios, [{
            id: 1,
            username: 'admin',
            password: passwordHash,
            nombreCompleto: 'Administrador del Sistema',
            rol: 'admin',
            activo: true,
            intentosFallidos: 0,
            createdAt: new Date().toISOString()
        }]);
        console.log('✅ Usuario admin creado (admin/admin123)');
    }

    // Catálogo
    if (!fs.existsSync(FILES.catalogo)) {
        guardarDatos(FILES.catalogo, [
            { id: 1, codigo: '001', nombre: 'PAPAS', unidad: 'Libra', activo: true },
            { id: 2, codigo: '002', nombre: 'ZAMBOS', unidad: 'Unidad', activo: true },
            { id: 3, codigo: '003', nombre: 'CARNE MOLIDA', unidad: 'Libra', activo: true },
            { id: 4, codigo: '004', nombre: 'ACEITE', unidad: 'Litro', activo: true }
        ]);
    }

    // Inventario
    if (!fs.existsSync(FILES.inventario)) {
        guardarDatos(FILES.inventario, [
            { codigo: '001', ingrediente: 'PAPAS', unidad: 'Libra', stock: 12.0, costoUnitario: 2.31, stockMinimo: 5 },
            { codigo: '002', ingrediente: 'ZAMBOS', unidad: 'Unidad', stock: 11.0, costoUnitario: 1.38, stockMinimo: 5 },
            { codigo: '003', ingrediente: 'CARNE MOLIDA', unidad: 'Libra', stock: 8.0, costoUnitario: 2.3, stockMinimo: 5 },
            { codigo: '004', ingrediente: 'ACEITE', unidad: 'Litro', stock: 3.5, costoUnitario: 5.0, stockMinimo: 2 }
        ]);
    }

    // Otros archivos vacíos
    ['historial', 'recetas', 'produccion', 'auditoria', 'productoTerminado', 'movimientosProducto', 'kardex'].forEach(key => {
        if (!fs.existsSync(FILES[key])) {
            guardarDatos(FILES[key], []);
        }
    });
}

inicializarDatos();

// ==================================================
// MIDDLEWARE
// ==================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'sistema-cocina-secret-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 8 * 60 * 60 * 1000, // 8 horas
        httpOnly: true
    }
}));

// Motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware de autenticación
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

// Middleware para agregar usuario a las vistas
app.use((req, res, next) => {
    res.locals.user = null;
    res.locals.isAdmin = false;
    
    if (req.session && req.session.userId) {
        const usuarios = leerDatos(FILES.usuarios);
        const user = usuarios.find(u => u.id === req.session.userId);
        if (user) {
            res.locals.user = user;
            res.locals.isAdmin = user.rol === 'admin';
        }
    }
    next();
});

// ==================================================
// RUTAS DE AUTENTICACIÓN
// ==================================================
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.render('login', { error: 'Ingresá usuario y contraseña' });
    }

    const usuarios = leerDatos(FILES.usuarios);
    const user = usuarios.find(u => u.username === username);

    if (!user) {
        return res.render('login', { error: 'Usuario o contraseña incorrectos' });
    }

    if (!user.activo) {
        return res.render('login', { error: 'Usuario desactivado' });
    }

    // Verificar bloqueo
    if (user.bloqueadoHasta) {
        const ahora = new Date();
        const bloqueado = new Date(user.bloqueadoHasta);
        if (ahora < bloqueado) {
            const minutos = Math.ceil((bloqueado - ahora) / 60000);
            return res.render('login', { 
                error: `Usuario bloqueado. Intentá en ${minutos} minuto(s)` 
            });
        } else {
            user.intentosFallidos = 0;
            user.bloqueadoHasta = null;
        }
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
        user.intentosFallidos = (user.intentosFallidos || 0) + 1;
        
        if (user.intentosFallidos >= 5) {
            const bloqueado = new Date();
            bloqueado.setMinutes(bloqueado.getMinutes() + 15);
            user.bloqueadoHasta = bloqueado.toISOString();
            guardarDatos(FILES.usuarios, usuarios);
            return res.render('login', { 
                error: 'Demasiados intentos. Usuario bloqueado por 15 minutos' 
            });
        }

        guardarDatos(FILES.usuarios, usuarios);
        return res.render('login', { error: 'Usuario o contraseña incorrectos' });
    }

    // Login exitoso
    user.intentosFallidos = 0;
    user.bloqueadoHasta = null;
    user.ultimoAcceso = new Date().toISOString();
    guardarDatos(FILES.usuarios, usuarios);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.rol = user.rol;

    res.redirect('/');
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ==================================================
// RUTA PRINCIPAL - DASHBOARD
// ==================================================
app.get('/', requireAuth, (req, res) => {
    const inventario = leerDatos(FILES.inventario);
    const recetas = leerDatos(FILES.recetas);
    const produccion = leerDatos(FILES.produccion);
    
    // Calcular métricas
    const totalInventario = inventario.reduce((sum, i) => 
        sum + (i.stock * i.costoUnitario), 0
    );
    
    const stockBajo = inventario.filter(i => i.stock < i.stockMinimo);
    
    const margenPromedio = recetas.length > 0
        ? recetas.reduce((sum, r) => sum + (r.margenUtilidad || 0), 0) / recetas.length
        : 0;

    res.render('dashboard', {
        totalInventario,
        stockBajo: stockBajo.length,
        recetasActivas: recetas.length,
        margenPromedio: (margenPromedio * 100).toFixed(1),
        ultimasProduciones: produccion.slice(-5).reverse()
    });
});

// ==================================================
// RUTAS DE CATÁLOGO
// ==================================================
app.get('/catalogo', requireAuth, (req, res) => {
    const catalogo = leerDatos(FILES.catalogo).filter(c => c.activo);
    res.render('catalogo', { catalogo });
});

app.post('/catalogo/crear', requireAuth, (req, res) => {
    const { nombre, unidad } = req.body;
    
    const catalogo = leerDatos(FILES.catalogo);
    const ultimoCodigo = catalogo.length > 0 
        ? Math.max(...catalogo.map(c => parseInt(c.codigo))) 
        : 0;
    
    const nuevoCodigo = String(ultimoCodigo + 1).padStart(3, '0');
    
    const nuevoArticulo = {
        id: Date.now(),
        codigo: nuevoCodigo,
        nombre: nombre.toUpperCase(),
        unidad,
        activo: true,
        createdAt: new Date().toISOString()
    };
    
    catalogo.push(nuevoArticulo);
    guardarDatos(FILES.catalogo, catalogo);
    
    // Agregar al inventario
    const inventario = leerDatos(FILES.inventario);
    inventario.push({
        codigo: nuevoCodigo,
        ingrediente: nombre.toUpperCase(),
        unidad,
        stock: 0,
        costoUnitario: 0,
        stockMinimo: 5
    });
    guardarDatos(FILES.inventario, inventario);
    
    res.json({ success: true, codigo: nuevoCodigo });
});

app.post('/catalogo/actualizar/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { nombre, unidad } = req.body;
    
    const catalogo = leerDatos(FILES.catalogo);
    const articulo = catalogo.find(c => c.id === parseInt(id));
    
    if (articulo) {
        articulo.nombre = nombre.toUpperCase();
        articulo.unidad = unidad;
        guardarDatos(FILES.catalogo, catalogo);
        
        // Actualizar inventario
        const inventario = leerDatos(FILES.inventario);
        const inv = inventario.find(i => i.codigo === articulo.codigo);
        if (inv) {
            inv.ingrediente = nombre.toUpperCase();
            inv.unidad = unidad;
            guardarDatos(FILES.inventario, inventario);
        }
        
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Artículo no encontrado' });
    }
});

// ==================================================
// FUNCIÓN KARDEX - Registrar movimiento
// ==================================================
function registrarKardex(producto, tipo, documento, cantidad, costoUnitario, stockAnterior, stockNuevo, observaciones = '') {
    const kardex = leerDatos(FILES.kardex);
    
    kardex.push({
        id: generarId(),
        producto,
        fecha: new Date().toISOString(),
        tipo, // 'ENTRADA' o 'SALIDA'
        documento, // 'FACT-001' o 'PROD-001'
        cantidad: parseFloat(cantidad),
        costoUnitario: parseFloat(costoUnitario),
        valorTotal: parseFloat(cantidad) * parseFloat(costoUnitario),
        stockAnterior: parseFloat(stockAnterior),
        stockNuevo: parseFloat(stockNuevo),
        observaciones
    });
    
    guardarDatos(FILES.kardex, kardex);
}

// ==================================================
// RUTAS DE INVENTARIO/COMPRAS
// ==================================================
app.get('/inventario', requireAuth, (req, res) => {
    const catalogo = leerDatos(FILES.catalogo).filter(c => c.activo);
    const historial = leerDatos(FILES.historial);
    res.render('inventario', { catalogo, historial });
});

app.post('/inventario/registrar-compra', requireAuth, (req, res) => {
    const { noFactura, fecha, productos, proveedor } = req.body;
    
    const historial = leerDatos(FILES.historial);
    const inventario = leerDatos(FILES.inventario);
    
    productos.forEach(p => {
        const inv = inventario.find(i => i.codigo === p.codigo);
        
        if (inv) {
            const stockAnterior = inv.stock;
            const costoAnterior = inv.costoUnitario;
            const cantidadNueva = parseFloat(p.cantidad);
            const costoNuevo = parseFloat(p.costoUnitario);
            
            // Costo promedio ponderado
            const valorAnterior = stockAnterior * costoAnterior;
            const valorNuevo = cantidadNueva * costoNuevo;
            const valorTotal = valorAnterior + valorNuevo;
            const stockTotal = stockAnterior + cantidadNueva;
            
            inv.costoUnitario = stockTotal > 0 ? valorTotal / stockTotal : costoNuevo;
            inv.stock = stockTotal;
            
            // NUEVO: Registrar en Kardex
            registrarKardex(
                inv.ingrediente,
                'ENTRADA',
                `FACT-${noFactura}`,
                cantidadNueva,
                costoNuevo,
                stockAnterior,
                inv.stock,
                `Compra - ${proveedor || 'Sin proveedor'}`
            );
        }
        
        // Guardar en historial
        historial.push({
            id: generarId(),
            fechaFactura: fecha,
            noFactura,
            codigo: p.codigo,
            producto: p.nombre,
            unidad: p.unidad,
            cantidad: parseFloat(p.cantidad),
            costoUnitario: parseFloat(p.costoUnitario),
            costoTotal: parseFloat(p.cantidad) * parseFloat(p.costoUnitario),
            proveedor: proveedor || '',
            createdAt: new Date().toISOString(),
            createdBy: req.session.userId
        });
    });
    
    guardarDatos(FILES.historial, historial);
    guardarDatos(FILES.inventario, inventario);
    
    res.json({ success: true });
});

// Eliminar compra del historial
app.delete('/inventario/compra/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    const historial = leerDatos(FILES.historial);
    const index = historial.findIndex(h => h.id === id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Registro no encontrado' });
    }
    
    // Eliminar
    historial.splice(index, 1);
    guardarDatos(FILES.historial, historial);
    
    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        fecha: new Date().toISOString(),
        usuario: req.session.userId,
        accion: 'DELETE_COMPRA',
        detalle: `Eliminó registro de compra ${id}`,
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true });
});

// ==================================================
// FUNCIÓN PARA RECETAS INTELIGENTES
// ==================================================
function verificarCambiosCostos(receta) {
    const inventario = leerDatos(FILES.inventario);
    const detalleReceta = JSON.parse(receta.detalleReceta);
    
    let costoActual = 0;
    let hayCambios = false;
    const cambios = [];
    
    detalleReceta.forEach(ing => {
        const item = inventario.find(i => i.codigo === ing.Codigo);
        if (item) {
            const costoNuevo = item.costoUnitario;
            const costoAnterior = parseFloat(ing.CostoUnitario || 0);
            const cantidad = parseFloat(ing.Cantidad);
            
            costoActual += cantidad * costoNuevo;
            
            // Detectar cambio > 5%
            if (costoAnterior > 0) {
                const cambioPorc = Math.abs((costoNuevo - costoAnterior) / costoAnterior * 100);
                if (cambioPorc > 5) {
                    hayCambios = true;
                    cambios.push({
                        ingrediente: ing.Nombre,
                        costoAnterior: costoAnterior.toFixed(2),
                        costoNuevo: costoNuevo.toFixed(2),
                        cambioPorc: cambioPorc.toFixed(1)
                    });
                }
            }
        }
    });
    
    const margenActual = receta.precioVenta > 0 
        ? ((receta.precioVenta - costoActual) / receta.precioVenta) * 100 
        : 0;
    const margenObjetivo = receta.margenObjetivo || 70;
    const bajóMargen = margenActual < margenObjetivo;
    
    // Calcular precio sugerido para mantener margen objetivo
    const precioSugerido = costoActual / (1 - margenObjetivo / 100);
    
    return {
        costoActual: costoActual.toFixed(2),
        costoAnterior: receta.costoTotalPlato,
        margenActual: margenActual.toFixed(1),
        margenObjetivo,
        hayCambios,
        bajóMargen,
        cambios,
        precioSugerido: precioSugerido.toFixed(2),
        utilidadActual: (receta.precioVenta - costoActual).toFixed(2)
    };
}

// ==================================================
// RUTAS DE RECETAS
// ==================================================
app.get('/recetas', requireAuth, (req, res) => {
    const recetas = leerDatos(FILES.recetas);
    const inventario = leerDatos(FILES.inventario);
    
    // Agregar alertas a cada receta
    const recetasConAlertas = recetas.map(r => {
        const alerta = verificarCambiosCostos(r);
        return { ...r, alerta };
    });
    
    res.render('recetas', { recetas: recetasConAlertas, inventario });
});

app.post('/recetas/crear', requireAuth, (req, res) => {
    const { plato, ingredientes, precioVenta, margenObjetivo } = req.body;
    
    const detalleReceta = ingredientes.map(ing => ({
        Codigo: ing.codigo,
        Nombre: ing.nombre,
        Cantidad: parseFloat(ing.cantidad),
        Costo_U: parseFloat(ing.costoUnitario),
        Subtotal: parseFloat(ing.cantidad) * parseFloat(ing.costoUnitario)
    }));
    
    const costoTotal = detalleReceta.reduce((sum, i) => sum + i.Subtotal, 0);
    const valorUtilidad = parseFloat(precioVenta) - costoTotal;
    const margenUtilidad = valorUtilidad / parseFloat(precioVenta);
    
    const recetas = leerDatos(FILES.recetas);
    recetas.push({
        id: generarId(),
        plato: plato.toUpperCase(),
        detalleReceta: JSON.stringify(detalleReceta),
        costoTotalPlato: costoTotal,
        precioVenta: parseFloat(precioVenta),
        valorUtilidad,
        margenUtilidad,
        margenObjetivo: parseFloat(margenObjetivo || 0.7),
        activo: true,
        createdAt: new Date().toISOString(),
        createdBy: req.session.userId
    });
    
    guardarDatos(FILES.recetas, recetas);
    res.json({ success: true });
});

// Actualizar costos de receta
app.post('/recetas/actualizar-costos/:plato', requireAuth, (req, res) => {
    const { plato } = req.params;
    const recetas = leerDatos(FILES.recetas);
    const inventario = leerDatos(FILES.inventario);
    
    const receta = recetas.find(r => r.plato === plato);
    if (!receta) {
        return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    // Recalcular con costos actuales
    const detalleReceta = JSON.parse(receta.detalleReceta);
    let costoNuevo = 0;
    
    const detalleActualizado = detalleReceta.map(ing => {
        const item = inventario.find(i => i.codigo === ing.Codigo);
        const costoUnitarioActual = item ? item.costoUnitario : ing.Costo_U;
        const subtotal = ing.Cantidad * costoUnitarioActual;
        
        costoNuevo += subtotal;
        
        return {
            ...ing,
            CostoUnitario: costoUnitarioActual,
            Costo_U: costoUnitarioActual,
            Subtotal: subtotal
        };
    });
    
    // Actualizar receta
    receta.detalleReceta = JSON.stringify(detalleActualizado);
    receta.costoTotalPlato = costoNuevo;
    receta.valorUtilidad = receta.precioVenta - costoNuevo;
    receta.margenUtilidad = receta.valorUtilidad / receta.precioVenta;
    receta.updatedAt = new Date().toISOString();
    
    guardarDatos(FILES.recetas, recetas);
    
    res.json({ 
        success: true, 
        costoNuevo,
        margenNuevo: (receta.margenUtilidad * 100).toFixed(1)
    });
});

// Eliminar receta
app.delete('/recetas/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    const recetas = leerDatos(FILES.recetas);
    const index = recetas.findIndex(r => r.id === id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    const recetaEliminada = recetas[index];
    
    // Eliminar
    recetas.splice(index, 1);
    guardarDatos(FILES.recetas, recetas);
    
    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        fecha: new Date().toISOString(),
        usuario: req.session.userId,
        accion: 'DELETE_RECETA',
        detalle: `Eliminó receta: ${recetaEliminada.plato}`,
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true });
});

// Editar precio de venta de receta
app.put('/recetas/:id/precio', requireAuth, (req, res) => {
    const { id } = req.params;
    const { precioVenta } = req.body;
    
    if (!precioVenta || precioVenta <= 0) {
        return res.status(400).json({ error: 'Precio inválido' });
    }
    
    const recetas = leerDatos(FILES.recetas);
    const receta = recetas.find(r => r.id === id);
    
    if (!receta) {
        return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    const precioAnterior = receta.precioVenta;
    
    // Actualizar precio
    receta.precioVenta = parseFloat(precioVenta);
    receta.valorUtilidad = receta.precioVenta - receta.costoTotalPlato;
    receta.margenUtilidad = receta.valorUtilidad / receta.precioVenta;
    receta.updatedAt = new Date().toISOString();
    
    guardarDatos(FILES.recetas, recetas);
    
    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        fecha: new Date().toISOString(),
        usuario: req.session.userId,
        accion: 'UPDATE_PRECIO_RECETA',
        detalle: `${receta.plato}: L. ${precioAnterior.toFixed(2)} → L. ${precioVenta.toFixed(2)}`,
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true, nuevoPrecio: precioVenta });
});

// ==================================================
// RUTAS DE PRODUCCIÓN
// ==================================================
app.get('/produccion', requireAuth, (req, res) => {
    const recetas = leerDatos(FILES.recetas);
    const inventario = leerDatos(FILES.inventario);
    const produccion = leerDatos(FILES.produccion);
    res.render('produccion', { recetas, inventario, produccion });
});

app.post('/produccion/procesar', requireAuth, (req, res) => {
    const { plato, cantidad } = req.body;
    
    const recetas = leerDatos(FILES.recetas);
    const receta = recetas.find(r => r.plato === plato);
    
    if (!receta) {
        return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    const inventario = leerDatos(FILES.inventario);
    const detalleReceta = JSON.parse(receta.detalleReceta);
    
    // Verificar stock
    for (const ing of detalleReceta) {
        const necesario = parseFloat(ing.Cantidad) * parseInt(cantidad);
        const inv = inventario.find(i => i.codigo === ing.Codigo);
        
        if (!inv || inv.stock < necesario) {
            return res.status(400).json({ 
                error: `Stock insuficiente de ${ing.Nombre}` 
            });
        }
    }
    
    // Descontar stock y registrar en Kardex
    const idOperacion = `PROD-${Date.now()}`;
    
    detalleReceta.forEach(ing => {
        const necesario = parseFloat(ing.Cantidad) * parseInt(cantidad);
        const inv = inventario.find(i => i.codigo === ing.Codigo);
        if (inv) {
            const stockAnterior = inv.stock;
            inv.stock -= necesario;
            
            // Registrar SALIDA en Kardex
            registrarKardex(
                inv.ingrediente,
                'SALIDA',
                idOperacion,
                necesario,
                inv.costoUnitario,
                stockAnterior,
                inv.stock,
                `Producción de ${plato}`
            );
        }
    });
    
    guardarDatos(FILES.inventario, inventario);
    
    // Registrar producción
    const produccion = leerDatos(FILES.produccion);
    
    produccion.push({
        id: generarId(),
        fecha: new Date().toISOString(),
        idOperacion,
        plato,
        cantidad: parseInt(cantidad),
        detalle: JSON.stringify(detalleReceta),
        costoProduccion: receta.costoTotalPlato * parseInt(cantidad),
        createdAt: new Date().toISOString(),
        createdBy: req.session.userId
    });
    
    guardarDatos(FILES.produccion, produccion);
    
    // NUEVO: Agregar automáticamente al inventario de producto terminado
    const productoTerminado = leerDatos(FILES.productoTerminado);
    let producto = productoTerminado.find(p => p.plato === plato);
    
    if (!producto) {
        producto = {
            id: generarId(),
            plato,
            cantidad: 0,
            costoUnitario: receta.costoTotalPlato,
            precioVenta: receta.precioVenta,
            createdAt: new Date().toISOString()
        };
        productoTerminado.push(producto);
    }
    
    const stockAnterior = producto.cantidad;
    producto.cantidad += parseInt(cantidad);
    producto.updatedAt = new Date().toISOString();
    
    guardarDatos(FILES.productoTerminado, productoTerminado);
    
    // Registrar movimiento de producto terminado
    const movimientos = leerDatos(FILES.movimientosProducto);
    movimientos.push({
        id: generarId(),
        plato,
        tipo: 'ENTRADA',
        cantidad: parseInt(cantidad),
        origen: `Producción ${idOperacion}`,
        fecha: new Date().toISOString(),
        usuarioId: req.session.userId,
        stockAnterior,
        stockNuevo: producto.cantidad
    });
    guardarDatos(FILES.movimientosProducto, movimientos);
    
    res.json({ success: true, idOperacion });
});

app.post('/produccion/eliminar/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    const produccion = leerDatos(FILES.produccion);
    const index = produccion.findIndex(p => p.id === id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Producción no encontrada' });
    }
    
    const prod = produccion[index];
    const detalle = JSON.parse(prod.detalle);
    const inventario = leerDatos(FILES.inventario);
    
    // Revertir stock
    detalle.forEach(ing => {
        const cantidad = parseFloat(ing.Cantidad) * parseInt(prod.cantidad);
        const inv = inventario.find(i => i.codigo === ing.Codigo);
        if (inv) {
            inv.stock += cantidad;
        }
    });
    
    guardarDatos(FILES.inventario, inventario);
    
    // Eliminar registro
    produccion.splice(index, 1);
    guardarDatos(FILES.produccion, produccion);
    
    res.json({ success: true });
});

// ==================================================
// RUTAS DE KARDEX
// ==================================================
app.get('/kardex', requireAuth, (req, res) => {
    const kardex = leerDatos(FILES.kardex);
    const inventario = leerDatos(FILES.inventario);
    
    res.render('kardex', { kardex, inventario });
});

app.get('/api/kardex/:producto', requireAuth, (req, res) => {
    const { producto } = req.params;
    const kardex = leerDatos(FILES.kardex);
    
    const movimientos = kardex.filter(k => 
        k.producto.toLowerCase().includes(producto.toLowerCase())
    );
    
    res.json(movimientos);
});

app.get('/api/exportar/kardex/excel', requireAuth, async (req, res) => {
    try {
        const kardex = leerDatos(FILES.kardex);
        const ExcelJS = (await import('exceljs')).default;
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Kardex');
        
        worksheet.columns = [
            { header: 'Fecha', key: 'fecha', width: 12 },
            { header: 'Producto', key: 'producto', width: 20 },
            { header: 'Tipo', key: 'tipo', width: 10 },
            { header: 'Documento', key: 'documento', width: 15 },
            { header: 'Entrada', key: 'entrada', width: 10 },
            { header: 'Salida', key: 'salida', width: 10 },
            { header: 'Costo Unit.', key: 'costo', width: 12 },
            { header: 'Saldo', key: 'saldo', width: 10 },
            { header: 'Valor', key: 'valor', width: 12 }
        ];
        
        worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF4B4B' }
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        
        kardex.forEach(k => {
            worksheet.addRow({
                fecha: new Date(k.fecha).toLocaleDateString('es-HN'),
                producto: k.producto,
                tipo: k.tipo,
                documento: k.documento,
                entrada: k.tipo === 'ENTRADA' ? k.cantidad : '',
                salida: k.tipo === 'SALIDA' ? k.cantidad : '',
                costo: parseFloat(k.costoUnitario).toFixed(2),
                saldo: parseFloat(k.stockNuevo).toFixed(2),
                valor: parseFloat(k.valorTotal).toFixed(2)
            });
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=kardex_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

// ==================================================
// RUTAS DE REPORTES
// ==================================================
app.get('/reportes', requireAuth, (req, res) => {
    const inventario = leerDatos(FILES.inventario);
    const recetas = leerDatos(FILES.recetas);
    const produccion = leerDatos(FILES.produccion);
    
    const stockBajo = inventario.filter(i => i.stock < i.stockMinimo);
    const totalInventario = inventario.reduce((sum, i) => 
        sum + (i.stock * i.costoUnitario), 0
    );
    
    // Top 5 recetas más rentables
    const topRecetas = recetas
        .sort((a, b) => b.valorUtilidad - a.valorUtilidad)
        .slice(0, 5);
    
    res.render('reportes', {
        inventario,
        stockBajo,
        totalInventario,
        topRecetas,
        recetas,
        produccion
    });
});

// ==================================================
// RUTAS DE EXPORTACIÓN EXCEL/PDF
// ==================================================
app.get('/api/exportar/recetas/excel', requireAuth, async (req, res) => {
    try {
        const recetas = leerDatos(FILES.recetas);
        const ExcelJS = (await import('exceljs')).default;
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Recetas');
        
        // Configurar columnas
        worksheet.columns = [
            { header: 'Plato', key: 'plato', width: 25 },
            { header: 'Costo', key: 'costo', width: 12 },
            { header: 'Precio Venta', key: 'precio', width: 12 },
            { header: 'Utilidad', key: 'utilidad', width: 12 },
            { header: 'Margen %', key: 'margen', width: 12 }
        ];
        
        // Estilo de encabezados
        worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF4B4B' }
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 25;
        
        // Agregar datos
        recetas.forEach(r => {
            const row = worksheet.addRow({
                plato: r.plato,
                costo: parseFloat(r.costoTotalPlato).toFixed(2),
                precio: parseFloat(r.precioVenta).toFixed(2),
                utilidad: parseFloat(r.valorUtilidad).toFixed(2),
                margen: (parseFloat(r.margenUtilidad) * 100).toFixed(1) + '%'
            });
            
            // Color de fondo según margen
            const margen = parseFloat(r.margenUtilidad) * 100;
            const colorFondo = margen < 70 ? 'FFFFE6E6' : 'FFE6FFE6';
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: colorFondo }
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
        
        // Enviar archivo
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=recetas_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exportando Excel:', error);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

app.get('/api/exportar/recetas/pdf', requireAuth, async (req, res) => {
    try {
        const recetas = leerDatos(FILES.recetas);
        const { jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const doc = new jsPDF();
        
        // Título
        doc.setFontSize(20);
        doc.setTextColor(255, 75, 75);
        doc.text('CHEF MASTER PRO', 105, 15, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Reporte de Recetas', 105, 25, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-HN')}`, 105, 32, { align: 'center' });
        
        // Tabla
        const tableData = recetas.map(r => [
            r.plato,
            `L. ${parseFloat(r.costoTotalPlato).toFixed(2)}`,
            `L. ${parseFloat(r.precioVenta).toFixed(2)}`,
            `L. ${parseFloat(r.valorUtilidad).toFixed(2)}`,
            `${(parseFloat(r.margenUtilidad) * 100).toFixed(1)}%`
        ]);
        
        autoTable(doc, {
            startY: 40,
            head: [['Plato', 'Costo', 'Precio Venta', 'Utilidad', 'Margen']],
            body: tableData,
            theme: 'grid',
            headStyles: { 
                fillColor: [255, 75, 75],
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold'
            },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { halign: 'right', cellWidth: 30 },
                2: { halign: 'right', cellWidth: 30 },
                3: { halign: 'right', cellWidth: 30 },
                4: { halign: 'center', cellWidth: 25 }
            }
        });
        
        // Totales
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.text(`Total de recetas: ${recetas.length}`, 14, finalY);
        
        // Enviar PDF
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=recetas_${new Date().toISOString().split('T')[0]}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error exportando PDF:', error);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

app.get('/api/exportar/inventario/excel', requireAuth, async (req, res) => {
    try {
        const inventario = leerDatos(FILES.inventario);
        const ExcelJS = (await import('exceljs')).default;
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inventario');
        
        worksheet.columns = [
            { header: 'Código', key: 'codigo', width: 10 },
            { header: 'Ingrediente', key: 'ingrediente', width: 25 },
            { header: 'Stock', key: 'stock', width: 12 },
            { header: 'Unidad', key: 'unidad', width: 12 },
            { header: 'Costo Unit.', key: 'costo', width: 12 },
            { header: 'Valor Total', key: 'valor', width: 15 }
        ];
        
        worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF4B4B' }
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        
        inventario.forEach(i => {
            worksheet.addRow({
                codigo: i.codigo,
                ingrediente: i.ingrediente,
                stock: parseFloat(i.stock).toFixed(2),
                unidad: i.unidad,
                costo: parseFloat(i.costoUnitario).toFixed(2),
                valor: (parseFloat(i.stock) * parseFloat(i.costoUnitario)).toFixed(2)
            });
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

// Exportar historial de compras a Excel
app.get('/api/exportar/historial/excel', requireAuth, async (req, res) => {
    try {
        const historial = leerDatos(FILES.historial);
        const ExcelJS = (await import('exceljs')).default;
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Historial de Compras');
        
        worksheet.columns = [
            { header: 'Fecha', key: 'fecha', width: 14 },
            { header: 'No. Factura', key: 'factura', width: 16 },
            { header: 'Proveedor', key: 'proveedor', width: 20 },
            { header: 'Producto', key: 'producto', width: 25 },
            { header: 'Cantidad', key: 'cantidad', width: 12 },
            { header: 'Unidad', key: 'unidad', width: 10 },
            { header: 'Costo Unit.', key: 'costo', width: 14 },
            { header: 'Total', key: 'total', width: 14 }
        ];
        
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF4B4B' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;
        
        historial.forEach(h => {
            worksheet.addRow({
                fecha: h.fechaFactura || '',
                factura: h.noFactura || '',
                proveedor: h.proveedor || '',
                producto: h.producto || '',
                cantidad: parseFloat(h.cantidad || 0).toFixed(2),
                unidad: h.unidad || 'Unidad',
                costo: parseFloat(h.costoUnitario || 0).toFixed(2),
                total: parseFloat(h.costoTotal || 0).toFixed(2)
            });
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=historial_compras_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exportar historial:', error);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

// ==================================================
// RUTAS DE INVENTARIO DE PRODUCTO TERMINADO
// ==================================================
app.get('/producto-terminado', requireAuth, (req, res) => {
    const productoTerminado = leerDatos(FILES.productoTerminado);
    const recetas = leerDatos(FILES.recetas);
    const movimientos = leerDatos(FILES.movimientosProducto);
    
    res.render('producto-terminado', { 
        productoTerminado, 
        recetas,
        movimientos 
    });
});

app.post('/producto-terminado/agregar', requireAuth, (req, res) => {
    const { plato, cantidad, origen } = req.body;
    
    if (!plato || !cantidad) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }
    
    const productoTerminado = leerDatos(FILES.productoTerminado);
    const recetas = leerDatos(FILES.recetas);
    
    // Buscar o crear entrada de producto terminado
    let producto = productoTerminado.find(p => p.plato === plato);
    const receta = recetas.find(r => r.plato === plato);
    
    if (!receta) {
        return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    if (!producto) {
        // Crear nueva entrada
        producto = {
            id: generarId(),
            plato,
            cantidad: 0,
            costoUnitario: receta.costoTotalPlato,
            precioVenta: receta.precioVenta,
            createdAt: new Date().toISOString()
        };
        productoTerminado.push(producto);
    }
    
    // Agregar cantidad
    const cantidadNum = parseInt(cantidad);
    producto.cantidad += cantidadNum;
    producto.updatedAt = new Date().toISOString();
    
    guardarDatos(FILES.productoTerminado, productoTerminado);
    
    // Registrar movimiento
    const movimientos = leerDatos(FILES.movimientosProducto);
    movimientos.push({
        id: generarId(),
        plato,
        tipo: 'ENTRADA',
        cantidad: cantidadNum,
        origen: origen || 'Producción',
        fecha: new Date().toISOString(),
        usuarioId: req.session.userId,
        stockAnterior: producto.cantidad - cantidadNum,
        stockNuevo: producto.cantidad
    });
    guardarDatos(FILES.movimientosProducto, movimientos);
    
    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        usuarioId: req.session.userId,
        accion: 'ENTRADA_PRODUCTO_TERMINADO',
        detalles: `Entrada: ${cantidadNum} ${plato}`,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true });
});

app.post('/producto-terminado/salida', requireAuth, (req, res) => {
    const { plato, cantidad, motivo } = req.body;
    
    if (!plato || !cantidad) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }
    
    const productoTerminado = leerDatos(FILES.productoTerminado);
    const producto = productoTerminado.find(p => p.plato === plato);
    
    if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const cantidadNum = parseInt(cantidad);
    
    if (producto.cantidad < cantidadNum) {
        return res.status(400).json({ error: 'Stock insuficiente' });
    }
    
    // Descontar cantidad
    const stockAnterior = producto.cantidad;
    producto.cantidad -= cantidadNum;
    producto.updatedAt = new Date().toISOString();
    
    guardarDatos(FILES.productoTerminado, productoTerminado);
    
    // Registrar movimiento
    const movimientos = leerDatos(FILES.movimientosProducto);
    movimientos.push({
        id: generarId(),
        plato,
        tipo: 'SALIDA',
        cantidad: cantidadNum,
        motivo: motivo || 'Venta',
        fecha: new Date().toISOString(),
        usuarioId: req.session.userId,
        stockAnterior,
        stockNuevo: producto.cantidad
    });
    guardarDatos(FILES.movimientosProducto, movimientos);
    
    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        usuarioId: req.session.userId,
        accion: 'SALIDA_PRODUCTO_TERMINADO',
        detalles: `Salida: ${cantidadNum} ${plato} - ${motivo}`,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true });
});

app.post('/producto-terminado/ajuste', requireAuth, (req, res) => {
    const user = leerDatos(FILES.usuarios).find(u => u.id === req.session.userId);
    if (user.rol !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores pueden hacer ajustes' });
    }
    
    const { plato, cantidadNueva, motivo } = req.body;
    
    const productoTerminado = leerDatos(FILES.productoTerminado);
    const producto = productoTerminado.find(p => p.plato === plato);
    
    if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const stockAnterior = producto.cantidad;
    producto.cantidad = parseInt(cantidadNueva);
    producto.updatedAt = new Date().toISOString();
    
    guardarDatos(FILES.productoTerminado, productoTerminado);
    
    // Registrar movimiento
    const movimientos = leerDatos(FILES.movimientosProducto);
    movimientos.push({
        id: generarId(),
        plato,
        tipo: 'AJUSTE',
        cantidad: Math.abs(producto.cantidad - stockAnterior),
        motivo: motivo || 'Ajuste de inventario',
        fecha: new Date().toISOString(),
        usuarioId: req.session.userId,
        stockAnterior,
        stockNuevo: producto.cantidad
    });
    guardarDatos(FILES.movimientosProducto, movimientos);
    
    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        usuarioId: req.session.userId,
        accion: 'AJUSTE_PRODUCTO_TERMINADO',
        detalles: `Ajuste: ${plato} de ${stockAnterior} a ${producto.cantidad}`,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true });
});

// Eliminar producto terminado
app.delete('/producto-terminado/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    const productoTerminado = leerDatos(FILES.productoTerminado);
    const index = productoTerminado.findIndex(p => p.id === id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const producto = productoTerminado[index];
    
    // Eliminar
    productoTerminado.splice(index, 1);
    guardarDatos(FILES.productoTerminado, productoTerminado);
    
    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        usuarioId: req.session.userId,
        accion: 'DELETE_PRODUCTO_TERMINADO',
        detalles: `Eliminó: ${producto.plato}`,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true });
});

// ==================================================
// RUTAS DE GESTIÓN DE USUARIOS
// ==================================================
app.get('/usuarios', requireAuth, (req, res) => {
    // Solo admin puede acceder
    const user = leerDatos(FILES.usuarios).find(u => u.id === req.session.userId);
    if (user.rol !== 'admin') {
        return res.status(403).send('Acceso denegado. Solo administradores.');
    }
    
    const usuarios = leerDatos(FILES.usuarios);
    const auditoria = leerDatos(FILES.auditoria);
    
    res.render('usuarios', { usuarios, auditoria });
});

app.post('/usuarios/crear', requireAuth, async (req, res) => {
    const user = leerDatos(FILES.usuarios).find(u => u.id === req.session.userId);
    if (user.rol !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores' });
    }
    
    const { username, password, nombreCompleto, rol } = req.body;
    
    if (!username || !password || !nombreCompleto || !rol) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    const usuarios = leerDatos(FILES.usuarios);
    
    // Verificar si el usuario ya existe
    if (usuarios.find(u => u.username === username)) {
        return res.status(400).json({ error: 'El usuario ya existe' });
    }
    
    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);
    
    const nuevoUsuario = {
        id: Date.now(),
        username,
        password: passwordHash,
        nombreCompleto,
        rol,
        activo: true,
        intentosFallidos: 0,
        createdAt: new Date().toISOString(),
        createdBy: req.session.userId
    };
    
    usuarios.push(nuevoUsuario);
    guardarDatos(FILES.usuarios, usuarios);
    
    // Registrar en auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        usuarioId: req.session.userId,
        accion: 'CREAR_USUARIO',
        detalles: `Usuario creado: ${username} (${rol})`,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true, message: 'Usuario creado exitosamente' });
});

app.post('/usuarios/actualizar/:id', requireAuth, async (req, res) => {
    const user = leerDatos(FILES.usuarios).find(u => u.id === req.session.userId);
    if (user.rol !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores' });
    }
    
    const { id } = req.params;
    const { nombreCompleto, rol, activo } = req.body;
    
    const usuarios = leerDatos(FILES.usuarios);
    const index = usuarios.findIndex(u => u.id === parseInt(id));
    
    if (index === -1) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    usuarios[index].nombreCompleto = nombreCompleto;
    usuarios[index].rol = rol;
    usuarios[index].activo = activo;
    usuarios[index].updatedAt = new Date().toISOString();
    
    guardarDatos(FILES.usuarios, usuarios);
    
    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        usuarioId: req.session.userId,
        accion: 'ACTUALIZAR_USUARIO',
        detalles: `Usuario actualizado: ${usuarios[index].username}`,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true });
});

app.post('/usuarios/cambiar-password/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    
    const user = leerDatos(FILES.usuarios).find(u => u.id === req.session.userId);
    
    // Solo admin puede cambiar password de otros, o el mismo usuario
    if (user.rol !== 'admin' && req.session.userId !== parseInt(id)) {
        return res.status(403).json({ error: 'No autorizado' });
    }
    
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    const usuarios = leerDatos(FILES.usuarios);
    const index = usuarios.findIndex(u => u.id === parseInt(id));
    
    if (index === -1) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    usuarios[index].password = await bcrypt.hash(password, 10);
    usuarios[index].updatedAt = new Date().toISOString();
    
    guardarDatos(FILES.usuarios, usuarios);
    
    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        usuarioId: req.session.userId,
        accion: 'CAMBIAR_PASSWORD',
        detalles: `Contraseña cambiada para: ${usuarios[index].username}`,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true, message: 'Contraseña actualizada' });
});

app.post('/usuarios/toggle/:id', requireAuth, (req, res) => {
    const user = leerDatos(FILES.usuarios).find(u => u.id === req.session.userId);
    if (user.rol !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores' });
    }
    
    const { id } = req.params;
    const usuarios = leerDatos(FILES.usuarios);
    const index = usuarios.findIndex(u => u.id === parseInt(id));
    
    if (index === -1) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // No permitir desactivar el propio usuario
    if (parseInt(id) === req.session.userId) {
        return res.status(400).json({ error: 'No podés desactivar tu propio usuario' });
    }
    
    usuarios[index].activo = !usuarios[index].activo;
    usuarios[index].updatedAt = new Date().toISOString();
    
    guardarDatos(FILES.usuarios, usuarios);
    
    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        usuarioId: req.session.userId,
        accion: usuarios[index].activo ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO',
        detalles: `Usuario ${usuarios[index].activo ? 'activado' : 'desactivado'}: ${usuarios[index].username}`,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);
    
    res.json({ success: true, activo: usuarios[index].activo });
});

// ==================================================
// API ENDPOINTS
// ==================================================
app.get('/api/inventario', requireAuth, (req, res) => {
    const inventario = leerDatos(FILES.inventario);
    res.json(inventario);
});

app.get('/api/receta/:plato', requireAuth, (req, res) => {
    const recetas = leerDatos(FILES.recetas);
    const receta = recetas.find(r => r.plato === req.params.plato);
    
    if (receta) {
        receta.detalleReceta = JSON.parse(receta.detalleReceta);
        res.json(receta);
    } else {
        res.status(404).json({ error: 'Receta no encontrada' });
    }
});

// ==================================================
// INICIAR SERVIDOR
// ==================================================
app.listen(PORT, () => {
    console.log('\n🍳 ========================================');
    console.log('   SISTEMA DE CONTROL DE COCINA');
    console.log('   Node.js Professional Edition');
    console.log('========================================');
    console.log(`\n✅ Servidor corriendo en: http://localhost:${PORT}`);
    console.log('\n👤 Credenciales por defecto:');
    console.log('   Usuario: admin');
    console.log('   Contraseña: admin123');
    console.log('\n📁 Datos almacenados en: ${DATA_DIR}');
    console.log('========================================\n');
});
