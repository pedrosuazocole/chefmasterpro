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
    kardex: path.join(DATA_DIR, 'kardex.json'),
    historialPrecios: path.join(DATA_DIR, 'historial-precios.json')
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
    ['historial', 'recetas', 'produccion', 'auditoria', 'productoTerminado', 'movimientosProducto', 'kardex', 'historialPrecios'].forEach(key => {
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
    const inventario        = leerDatos(FILES.inventario);
    const recetas           = leerDatos(FILES.recetas);
    const produccion        = leerDatos(FILES.produccion);
    const movimientos       = leerDatos(FILES.movimientosProducto);
    const productoTerminado = leerDatos(FILES.productoTerminado);

    // Métricas base
    const totalInventario = inventario.reduce((s,i) => s + (i.stock * i.costoUnitario), 0);
    const stockBajo       = inventario.filter(i => i.stock < i.stockMinimo);
    const margenPromedio  = recetas.length > 0
        ? recetas.reduce((s,r) => s + (r.margenUtilidad||0), 0) / recetas.length : 0;

    // Widget 1: Platillos más vendidos (por salidas de PT)
    const ventasPorPlato = {};
    movimientos.filter(m => m.tipo === 'SALIDA').forEach(m => {
        ventasPorPlato[m.plato] = (ventasPorPlato[m.plato] || 0) + parseInt(m.cantidad || 0);
    });
    const platillosMasVendidos = Object.entries(ventasPorPlato)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5)
        .map(([plato, cantidad]) => {
            const rec = recetas.find(r => r.plato === plato);
            const ingresos = rec ? cantidad * rec.precioVenta : 0;
            return { plato, cantidad, ingresos };
        });

    // Widget 2: Recetas con margen bajo (umbral configurable, default 50%)
    const UMBRAL_MARGEN = 50;
    const recetasMargenBajo = recetas
        .map(r => ({
            plato: r.plato,
            margen: parseFloat((r.margenUtilidad * 100).toFixed(1)),
            costo: r.costoTotalPlato,
            precio: r.precioVenta
        }))
        .filter(r => r.margen < UMBRAL_MARGEN)
        .sort((a,b) => a.margen - b.margen);

    res.render('dashboard', {
        totalInventario,
        stockBajo:              stockBajo.length,
        stockBajoItems:         stockBajo,
        recetasActivas:         recetas.length,
        margenPromedio:         (margenPromedio * 100).toFixed(1),
        ultimasProduciones:     produccion.slice(-5).reverse(),
        platillosMasVendidos,
        recetasMargenBajo,
        umbralMargen:           UMBRAL_MARGEN,
        totalSalidas:           movimientos.filter(m=>m.tipo==='SALIDA').reduce((s,m)=>s+parseInt(m.cantidad||0),0)
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

    // Validar nombre duplicado (insensible a mayúsculas)
    const nombreNormalizado = nombre.toUpperCase().trim();
    const nombreDuplicado = catalogo.find(c =>
        (c.ingrediente || c.nombre || '').toUpperCase().trim() === nombreNormalizado
    );
    if (nombreDuplicado) {
        return res.status(400).json({
            error: `Ya existe un artículo con el nombre "${nombreNormalizado}" (Código: ${nombreDuplicado.codigo})`
        });
    }

    const ultimoCodigo = catalogo.length > 0 
        ? Math.max(...catalogo.map(c => parseInt(c.codigo))) 
        : 0;
    
    const nuevoCodigo = String(ultimoCodigo + 1).padStart(3, '0');
    
    const nuevoArticulo = {
        id: Date.now(),
        codigo: nuevoCodigo,
        nombre: nombreNormalizado,
        ingrediente: nombreNormalizado,
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
        ingrediente: nombreNormalizado,
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

    if (!articulo) {
        return res.status(404).json({ error: 'Artículo no encontrado' });
    }

    // Validar nombre duplicado — excluir el mismo artículo que se está editando
    const nombreNormalizado = nombre.toUpperCase().trim();
    const nombreDuplicado = catalogo.find(c =>
        c.id !== parseInt(id) &&
        (c.ingrediente || c.nombre || '').toUpperCase().trim() === nombreNormalizado
    );
    if (nombreDuplicado) {
        return res.status(400).json({
            error: `Ya existe otro artículo con el nombre "${nombreNormalizado}" (Código: ${nombreDuplicado.codigo})`
        });
    }

    articulo.nombre     = nombreNormalizado;
    articulo.ingrediente= nombreNormalizado;
    articulo.unidad     = unidad;
    guardarDatos(FILES.catalogo, catalogo);

    // Actualizar inventario
    const inventario = leerDatos(FILES.inventario);
    const inv = inventario.find(i => i.codigo === articulo.codigo);
    if (inv) {
        inv.ingrediente = nombreNormalizado;
        inv.unidad      = unidad;
        guardarDatos(FILES.inventario, inventario);
    }

    res.json({ success: true });
});

// Eliminar artículo del catálogo
app.delete('/catalogo/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);

    const catalogo = leerDatos(FILES.catalogo);
    const index = catalogo.findIndex(c => c.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Artículo no encontrado' });
    }

    const articulo = catalogo[index];

    // Verificar que no tenga stock antes de eliminar
    const inventario = leerDatos(FILES.inventario);
    const inv = inventario.find(i => i.codigo === articulo.codigo);
    if (inv && parseFloat(inv.stock) > 0) {
        return res.status(400).json({
            error: `No se puede eliminar: "${articulo.ingrediente || articulo.nombre}" tiene stock de ${inv.stock} ${inv.unidad}`
        });
    }

    // Eliminar del catálogo
    catalogo.splice(index, 1);
    guardarDatos(FILES.catalogo, catalogo);

    // Eliminar del inventario también
    if (inv) {
        const invIndex = inventario.findIndex(i => i.codigo === articulo.codigo);
        if (invIndex !== -1) inventario.splice(invIndex, 1);
        guardarDatos(FILES.inventario, inventario);
    }

    // Auditoría
    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({
        id: generarId(),
        fecha: new Date().toISOString(),
        usuario: req.session.userId,
        accion: 'DELETE_CATALOGO',
        detalle: `Eliminó artículo: ${articulo.ingrediente || articulo.nombre} (${articulo.codigo})`,
        ip: req.ip
    });
    guardarDatos(FILES.auditoria, auditoria);

    res.json({ success: true });
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
// RUTAS DE INVENTARIO/COMPRAS — GESTIÓN POR FACTURA
// ==================================================
app.get('/inventario', requireAuth, (req, res) => {
    const catalogo  = leerDatos(FILES.catalogo).filter(c => c.activo);
    const historial = leerDatos(FILES.historial)
        .sort((a, b) => new Date(a.createdAt || a.fechaFactura) - new Date(b.createdAt || b.fechaFactura));

    // Agrupar líneas por factura para la vista
    const facturas = {};
    historial.forEach(h => {
        const key = h.noFactura;
        if (!facturas[key]) {
            facturas[key] = {
                noFactura: h.noFactura,
                fechaFactura: h.fechaFactura,
                proveedor: h.proveedor || '',
                createdAt: h.createdAt,
                items: [],
                totalFactura: 0
            };
        }
        facturas[key].items.push(h);
        facturas[key].totalFactura += parseFloat(h.costoTotal || 0);
    });

    const facturasArray = Object.values(facturas)
        .sort((a, b) => new Date(a.createdAt || a.fechaFactura) - new Date(b.createdAt || b.fechaFactura));

    res.render('inventario', { catalogo, historial, facturas: facturasArray });
});

app.post('/inventario/registrar-compra', requireAuth, (req, res) => {
    const { noFactura, fecha, productos, proveedor } = req.body;

    if (!noFactura || !fecha || !productos || productos.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const historial  = leerDatos(FILES.historial);
    const inventario = leerDatos(FILES.inventario);

    // Verificar factura duplicada
    if (historial.some(h => h.noFactura === noFactura)) {
        return res.status(400).json({ error: `La factura ${noFactura} ya está registrada` });
    }

    // Procesar atomicamente — recolectar todos los cambios antes de guardar
    const cambiosInventario = [];
    const nuevasLineas = [];

    for (const p of productos) {
        const inv = inventario.find(i => i.codigo === p.codigo);
        if (!inv) return res.status(400).json({ error: `Producto ${p.codigo} no encontrado en inventario` });

        const cantidadNueva = parseFloat(p.cantidad);
        const costoNuevo    = parseFloat(p.costoUnitario);
        if (!cantidadNueva || cantidadNueva <= 0 || !costoNuevo || costoNuevo <= 0) {
            return res.status(400).json({ error: `Cantidad/Costo inválido para ${p.nombre}` });
        }

        cambiosInventario.push({ inv, cantidadNueva, costoNuevo });
        nuevasLineas.push({
            id: generarId(),
            fechaFactura: fecha,
            noFactura,
            codigo: p.codigo,
            producto: p.nombre,
            unidad: p.unidad,
            cantidad: cantidadNueva,
            costoUnitario: costoNuevo,
            costoTotal: cantidadNueva * costoNuevo,
            proveedor: proveedor || '',
            createdAt: new Date().toISOString(),
            createdBy: req.session.userId
        });
    }

    // Aplicar cambios (ya validados)
    cambiosInventario.forEach(({ inv, cantidadNueva, costoNuevo }) => {
        const stockAnterior = inv.stock;
        const valorAnterior = stockAnterior * inv.costoUnitario;
        const valorNuevo    = cantidadNueva * costoNuevo;
        const stockTotal    = stockAnterior + cantidadNueva;

        inv.costoUnitario = stockTotal > 0 ? (valorAnterior + valorNuevo) / stockTotal : costoNuevo;
        inv.stock = stockTotal;

        registrarKardex(inv.ingrediente, 'ENTRADA', `FACT-${noFactura}`,
            cantidadNueva, costoNuevo, stockAnterior, inv.stock,
            `Compra - ${proveedor || 'Sin proveedor'}`);
    });

    nuevasLineas.forEach(l => historial.push(l));

    guardarDatos(FILES.historial, historial);
    guardarDatos(FILES.inventario, inventario);

    res.json({ success: true });
});

// Obtener factura completa por número
app.get('/inventario/factura/:noFactura', requireAuth, (req, res) => {
    const { noFactura } = req.params;
    const historial = leerDatos(FILES.historial);
    const items = historial.filter(h => h.noFactura === decodeURIComponent(noFactura));
    if (items.length === 0) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json({
        noFactura: items[0].noFactura,
        fechaFactura: items[0].fechaFactura,
        proveedor: items[0].proveedor || '',
        items
    });
});

// Editar factura completa (ATOMIC: revierte todo y recalcula)
app.put('/inventario/factura/:noFactura', requireAuth, (req, res) => {
    const { noFactura } = req.params;
    const { fecha, proveedor, productos } = req.body;

    if (!productos || productos.length === 0) {
        return res.status(400).json({ error: 'La factura debe tener al menos un producto' });
    }

    let historial  = leerDatos(FILES.historial);
    let inventario = leerDatos(FILES.inventario);
    let kardex     = leerDatos(FILES.kardex);

    const lineasAnteriores = historial.filter(h => h.noFactura === noFactura);
    if (lineasAnteriores.length === 0) return res.status(404).json({ error: 'Factura no encontrada' });

    // PASO 1: Revertir efectos de la factura anterior en inventario y kardex
    lineasAnteriores.forEach(h => {
        const inv = inventario.find(i => i.codigo === h.codigo);
        if (inv) {
            const cantAnt = parseFloat(h.cantidad);
            const costoAnt= parseFloat(h.costoUnitario);
            const stockAnt = inv.stock;

            // Descontar del stock
            inv.stock = Math.max(0, inv.stock - cantAnt);

            // Recalcular costo promedio sin esta entrada
            const valorTotalSin = (stockAnt * inv.costoUnitario) - (cantAnt * costoAnt);
            inv.costoUnitario = inv.stock > 0 ? Math.max(0, valorTotalSin / inv.stock) : inv.costoUnitario;
        }
    });

    // Eliminar entradas del kardex relacionadas
    kardex = kardex.filter(k => k.documento !== `FACT-${noFactura}`);

    // PASO 2: Validar nuevos productos
    for (const p of productos) {
        const inv = inventario.find(i => i.codigo === p.codigo);
        if (!inv) return res.status(400).json({ error: `Producto ${p.codigo} no encontrado` });
        if (!p.cantidad || p.cantidad <= 0) return res.status(400).json({ error: `Cantidad inválida para ${p.nombre}` });
        if (!p.costoUnitario || p.costoUnitario <= 0) return res.status(400).json({ error: `Costo inválido para ${p.nombre}` });
    }

    // PASO 3: Eliminar líneas antiguas y crear nuevas
    historial = historial.filter(h => h.noFactura !== noFactura);

    const nuevasLineas = productos.map(p => ({
        id: generarId(),
        fechaFactura: fecha,
        noFactura,
        codigo: p.codigo,
        producto: p.nombre,
        unidad: p.unidad || '',
        cantidad: parseFloat(p.cantidad),
        costoUnitario: parseFloat(p.costoUnitario),
        costoTotal: parseFloat(p.cantidad) * parseFloat(p.costoUnitario),
        proveedor: proveedor || '',
        createdAt: new Date().toISOString(),
        createdBy: req.session.userId
    }));

    // PASO 4: Aplicar nuevos efectos
    nuevasLineas.forEach(l => {
        const inv = inventario.find(i => i.codigo === l.codigo);
        if (inv) {
            const stockAnt = inv.stock;
            const valAnt   = stockAnt * inv.costoUnitario;
            const cantNueva= parseFloat(l.cantidad);
            const costoNuevo= parseFloat(l.costoUnitario);
            const valNuevo = cantNueva * costoNuevo;
            const stockNuevo = stockAnt + cantNueva;

            inv.costoUnitario = stockNuevo > 0 ? (valAnt + valNuevo) / stockNuevo : costoNuevo;
            inv.stock = stockNuevo;

            kardex.push({
                id: generarId(),
                producto: inv.ingrediente,
                fecha: new Date().toISOString(),
                tipo: 'ENTRADA',
                documento: `FACT-${noFactura}`,
                cantidad: cantNueva,
                costoUnitario: costoNuevo,
                valorTotal: cantNueva * costoNuevo,
                stockAnterior: stockAnt,
                stockNuevo: inv.stock,
                observaciones: `Compra editada - ${proveedor || 'Sin proveedor'}`
            });
        }
        historial.push(l);
    });

    // PASO 5: Guardar todo atomicamente
    guardarDatos(FILES.historial, historial);
    guardarDatos(FILES.inventario, inventario);
    guardarDatos(FILES.kardex, kardex);

    // Recalcular recetas afectadas
    const codigosAfectados = new Set([
        ...lineasAnteriores.map(l => l.codigo),
        ...nuevasLineas.map(l => l.codigo)
    ]);
    const recetas = leerDatos(FILES.recetas);
    recetas.forEach(r => {
        const detalle = JSON.parse(r.detalleReceta);
        let cambiado = false;
        const nuevoDetalle = detalle.map(ing => {
            if (codigosAfectados.has(ing.Codigo)) {
                const inv = inventario.find(i => i.codigo === ing.Codigo);
                if (inv) {
                    cambiado = true;
                    return { ...ing, CostoUnitario: inv.costoUnitario, Costo_U: inv.costoUnitario, Subtotal: ing.Cantidad * inv.costoUnitario };
                }
            }
            return ing;
        });
        if (cambiado) {
            r.detalleReceta   = JSON.stringify(nuevoDetalle);
            r.costoTotalPlato = nuevoDetalle.reduce((s, i) => s + i.Subtotal, 0);
            r.valorUtilidad   = r.precioVenta - r.costoTotalPlato;
            r.margenUtilidad  = r.valorUtilidad / r.precioVenta;
        }
    });
    guardarDatos(FILES.recetas, recetas);

    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({ id: generarId(), fecha: new Date().toISOString(), usuario: req.session.userId,
        accion: 'UPDATE_FACTURA', detalle: `Editó factura ${noFactura} (${productos.length} items)`, ip: req.ip });
    guardarDatos(FILES.auditoria, auditoria);

    res.json({ success: true });
});

// Eliminar factura completa (ATOMIC)
app.delete('/inventario/factura/:noFactura', requireAuth, (req, res) => {
    const { noFactura } = req.params;

    let historial  = leerDatos(FILES.historial);
    let inventario = leerDatos(FILES.inventario);
    let kardex     = leerDatos(FILES.kardex);

    const lineas = historial.filter(h => h.noFactura === noFactura);
    if (lineas.length === 0) return res.status(404).json({ error: 'Factura no encontrada' });

    // Revertir inventario
    lineas.forEach(h => {
        const inv = inventario.find(i => i.codigo === h.codigo);
        if (inv) {
            const cant = parseFloat(h.cantidad);
            const costo= parseFloat(h.costoUnitario);
            const stockAnt = inv.stock;
            const valAnt   = stockAnt * inv.costoUnitario;

            inv.stock = Math.max(0, inv.stock - cant);
            const valNuevo = valAnt - (cant * costo);
            inv.costoUnitario = inv.stock > 0 ? Math.max(0, valNuevo / inv.stock) : inv.costoUnitario;
        }
    });

    // Eliminar del historial y kardex
    historial = historial.filter(h => h.noFactura !== noFactura);
    kardex    = kardex.filter(k => k.documento !== `FACT-${noFactura}`);

    guardarDatos(FILES.historial, historial);
    guardarDatos(FILES.inventario, inventario);
    guardarDatos(FILES.kardex, kardex);

    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({ id: generarId(), fecha: new Date().toISOString(), usuario: req.session.userId,
        accion: 'DELETE_FACTURA', detalle: `Eliminó factura ${noFactura} (${lineas.length} items)`, ip: req.ip });
    guardarDatos(FILES.auditoria, auditoria);

    res.json({ success: true });
});

// Eliminar línea individual del historial (mantener compatibilidad)
app.delete('/inventario/compra/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const historial = leerDatos(FILES.historial);
    const index = historial.findIndex(h => h.id === id);
    if (index === -1) return res.status(404).json({ error: 'Registro no encontrado' });
    historial.splice(index, 1);
    guardarDatos(FILES.historial, historial);
    res.json({ success: true });
});

// Modificar línea individual (mantener compatibilidad)
app.put('/inventario/compra/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { cantidad, costoUnitario, unidad, proveedor } = req.body;
    if (!cantidad || !costoUnitario || cantidad <= 0 || costoUnitario <= 0) {
        return res.status(400).json({ error: 'Cantidad y Costo Unitario deben ser mayores a 0' });
    }
    const historial  = leerDatos(FILES.historial);
    const inventario = leerDatos(FILES.inventario);
    const registro   = historial.find(h => h.id === id);
    if (!registro) return res.status(404).json({ error: 'Registro no encontrado' });

    const cantAnterior = parseFloat(registro.cantidad);
    const costoAnterior= parseFloat(registro.costoUnitario);
    const cantNueva    = parseFloat(cantidad);
    const costoNuevo   = parseFloat(costoUnitario);

    registro.cantidad      = cantNueva;
    registro.costoUnitario = costoNuevo;
    registro.costoTotal    = cantNueva * costoNuevo;
    registro.unidad        = unidad   || registro.unidad;
    registro.proveedor     = proveedor !== undefined ? proveedor : registro.proveedor;
    registro.updatedAt     = new Date().toISOString();
    guardarDatos(FILES.historial, historial);

    const inv = inventario.find(i => i.codigo === registro.codigo);
    if (inv) {
        const stockSin = inv.stock - cantAnterior;
        inv.stock         = stockSin + cantNueva;
        inv.costoUnitario = inv.stock > 0
            ? ((stockSin * inv.costoUnitario) - (cantAnterior * costoAnterior) + (cantNueva * costoNuevo)) / inv.stock
            : costoNuevo;
        guardarDatos(FILES.inventario, inventario);

        const recetas = leerDatos(FILES.recetas);
        recetas.forEach(r => {
            const detalle = JSON.parse(r.detalleReceta);
            let cambiado = false;
            const nuevoDetalle = detalle.map(ing => {
                if (ing.Codigo === registro.codigo) {
                    cambiado = true;
                    return { ...ing, CostoUnitario: inv.costoUnitario, Costo_U: inv.costoUnitario, Subtotal: ing.Cantidad * inv.costoUnitario };
                }
                return ing;
            });
            if (cambiado) {
                r.detalleReceta   = JSON.stringify(nuevoDetalle);
                r.costoTotalPlato = nuevoDetalle.reduce((s, i) => s + i.Subtotal, 0);
                r.valorUtilidad   = r.precioVenta - r.costoTotalPlato;
                r.margenUtilidad  = r.valorUtilidad / r.precioVenta;
            }
        });
        guardarDatos(FILES.recetas, recetas);
    }
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
    const recetas    = leerDatos(FILES.recetas);
    const inventario = leerDatos(FILES.inventario);
    
    // Agregar alertas + detalleExpandido con costo promedio actual por ingrediente
    const recetasConAlertas = recetas.map(r => {
        const alerta = verificarCambiosCostos(r);
        const detalle = JSON.parse(r.detalleReceta);
        const detalleExpandido = detalle.map(ing => {
            const inv = inventario.find(i => i.codigo === ing.Codigo);
            const costoPromedio = inv ? inv.costoUnitario : parseFloat(ing.Costo_U || ing.CostoUnitario || 0);
            const cantidad      = parseFloat(ing.Cantidad);
            return {
                ...ing,
                Unidad:       ing.Unidad || (inv ? inv.unidad : ''),
                costoPromedio,
                totalLinea:   cantidad * costoPromedio
            };
        });
        return { ...r, alerta, detalleExpandido };
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
    const costoAnterior = receta.costoTotalPlato;
    receta.costoTotalPlato = costoNuevo;
    receta.valorUtilidad = receta.precioVenta - costoNuevo;
    receta.margenUtilidad = receta.valorUtilidad / receta.precioVenta;
    receta.updatedAt = new Date().toISOString();
    
    guardarDatos(FILES.recetas, recetas);
    
    // Guardar en historial de precios
    const historialPrecios = leerDatos(FILES.historialPrecios);
    historialPrecios.push({
        id: generarId(),
        plato: receta.plato,
        fecha: new Date().toISOString(),
        tipo: 'ACTUALIZACION_COSTO',
        costoAnterior: parseFloat(costoAnterior),
        costoNuevo: parseFloat(costoNuevo),
        precioVenta: parseFloat(receta.precioVenta),
        margenNuevo: parseFloat((receta.margenUtilidad * 100).toFixed(2)),
        usuario: req.session.userId
    });
    guardarDatos(FILES.historialPrecios, historialPrecios);
    
    res.json({ 
        success: true, 
        costoNuevo,
        margenNuevo: (receta.margenUtilidad * 100).toFixed(1)
    });
});

// T4: Edición completa de receta con histórico automático
app.put('/recetas/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { plato, ingredientes, precioVenta, margenObjetivo } = req.body;

    if (!ingredientes || ingredientes.length === 0) {
        return res.status(400).json({ error: 'La receta debe tener al menos un ingrediente' });
    }

    const recetas    = leerDatos(FILES.recetas);
    const inventario = leerDatos(FILES.inventario);
    const receta     = recetas.find(r => r.id === id);

    if (!receta) return res.status(404).json({ error: 'Receta no encontrada' });

    // Reconstruir detalle con costo promedio actual del inventario
    const detalleReceta = ingredientes.map(ing => {
        const inv = inventario.find(i => i.codigo === ing.codigo);
        const costoActual = inv ? inv.costoUnitario : parseFloat(ing.costoUnitario || 0);
        return {
            Codigo:        ing.codigo,
            Nombre:        ing.nombre,
            Unidad:        ing.unidad || (inv ? inv.unidad : ''),
            Cantidad:      parseFloat(ing.cantidad),
            CostoUnitario: costoActual,
            Costo_U:       costoActual,
            Subtotal:      parseFloat(ing.cantidad) * costoActual
        };
    });

    const costoAnterior = receta.costoTotalPlato;
    const costoNuevo    = detalleReceta.reduce((s, i) => s + i.Subtotal, 0);
    const pv            = parseFloat(precioVenta);
    const valorUtilidad = pv - costoNuevo;
    const margenUt      = pv > 0 ? valorUtilidad / pv : 0;

    receta.plato          = (plato || receta.plato).toUpperCase();
    receta.detalleReceta  = JSON.stringify(detalleReceta);
    receta.costoTotalPlato= costoNuevo;
    receta.precioVenta    = pv;
    receta.valorUtilidad  = valorUtilidad;
    receta.margenUtilidad = margenUt;
    receta.margenObjetivo = parseFloat(margenObjetivo || receta.margenObjetivo || 0.7);
    receta.updatedAt      = new Date().toISOString();

    guardarDatos(FILES.recetas, recetas);

    // HISTÓRICO AUTOMÁTICO: registrar SIEMPRE que se edita
    const historialPrecios = leerDatos(FILES.historialPrecios);
    historialPrecios.push({
        id: generarId(),
        plato: receta.plato,
        fecha: new Date().toISOString(),
        tipo: 'EDICION_COMPLETA',
        costoAnterior: parseFloat(costoAnterior),
        costoNuevo,
        precioVenta: pv,
        margenNuevo: parseFloat((margenUt * 100).toFixed(2)),
        ingredientes: ingredientes.length,
        usuario: req.session.userId
    });
    guardarDatos(FILES.historialPrecios, historialPrecios);

    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({ id: generarId(), fecha: new Date().toISOString(), usuario: req.session.userId,
        accion: 'UPDATE_RECETA', detalle: `Editó receta ${receta.plato}: costo L.${costoAnterior.toFixed(2)}→L.${costoNuevo.toFixed(2)}`, ip: req.ip });
    guardarDatos(FILES.auditoria, auditoria);

    res.json({ success: true, costoNuevo, margenNuevo: (margenUt * 100).toFixed(1) });
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
    
    // Guardar en historial de precios
    const historialPrecios = leerDatos(FILES.historialPrecios);
    historialPrecios.push({
        id: generarId(),
        plato: receta.plato,
        fecha: new Date().toISOString(),
        tipo: 'CAMBIO_PRECIO_VENTA',
        costoAnterior: parseFloat(receta.costoTotalPlato),
        costoNuevo: parseFloat(receta.costoTotalPlato),
        precioVentaAnterior: parseFloat(precioAnterior),
        precioVenta: parseFloat(precioVenta),
        margenNuevo: parseFloat((receta.margenUtilidad * 100).toFixed(2)),
        usuario: req.session.userId
    });
    guardarDatos(FILES.historialPrecios, historialPrecios);
    
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

// API: Historial de precios por plato
app.get('/api/historial-precios/:plato', requireAuth, (req, res) => {
    const { plato } = req.params;
    const historialPrecios = leerDatos(FILES.historialPrecios);
    const resultado = historialPrecios
        .filter(h => h.plato === decodeURIComponent(plato))
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    res.json(resultado);
});

// ==================================================
// RUTAS DE PRODUCCIÓN
// ==================================================
app.get('/produccion', requireAuth, (req, res) => {
    const recetas    = leerDatos(FILES.recetas);
    const inventario = leerDatos(FILES.inventario);
    // Orden ascendente: más antiguo primero, igual que catálogo
    const produccion = leerDatos(FILES.produccion)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
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
    
    let produccion      = leerDatos(FILES.produccion);
    const index = produccion.findIndex(p => p.id === id);
    
    if (index === -1) return res.status(404).json({ error: 'Producción no encontrada' });
    
    const prod    = produccion[index];
    const detalle = JSON.parse(prod.detalle);

    // VALIDACIÓN CRÍTICA: verificar si hay salidas (ventas) vinculadas
    const movimientos = leerDatos(FILES.movimientosProducto);
    const salidaVinculada = movimientos.find(m =>
        m.plato === prod.plato &&
        m.tipo === 'SALIDA' &&
        m.origen && m.origen.includes(prod.idOperacion)
    );
    // También verificar si hay salidas DESPUÉS de esta producción
    const fechaProd = new Date(prod.fecha);
    const salidasPosteriores = movimientos.filter(m =>
        m.plato === prod.plato &&
        m.tipo === 'SALIDA' &&
        new Date(m.fecha) >= fechaProd
    );

    if (salidaVinculada || salidasPosteriores.length > 0) {
        return res.status(409).json({
            error: `No se puede revertir: "${prod.plato}" ya tiene ${salidasPosteriores.length} salida(s)/venta(s) registradas vinculadas. Eliminá primero las salidas.`
        });
    }

    // REVERSIÓN ATÓMICA
    const inventario        = leerDatos(FILES.inventario);
    const productoTerminado = leerDatos(FILES.productoTerminado);
    let kardex              = leerDatos(FILES.kardex);

    // 1. Devolver insumos al inventario
    detalle.forEach(ing => {
        const cantidad = parseFloat(ing.Cantidad) * parseInt(prod.cantidad);
        const inv = inventario.find(i => i.codigo === ing.Codigo);
        if (inv) {
            const stockAnt = inv.stock;
            inv.stock += cantidad;
            kardex.push({
                id: generarId(),
                producto: inv.ingrediente,
                fecha: new Date().toISOString(),
                tipo: 'ENTRADA',
                documento: `REV-${prod.idOperacion}`,
                cantidad,
                costoUnitario: inv.costoUnitario,
                valorTotal: cantidad * inv.costoUnitario,
                stockAnterior: stockAnt,
                stockNuevo: inv.stock,
                observaciones: `Reversión producción ${prod.plato}`
            });
        }
    });

    // 2. Restar del producto terminado
    const pt = productoTerminado.find(p => p.plato === prod.plato);
    if (pt) {
        const ptAnt = pt.cantidad;
        pt.cantidad = Math.max(0, pt.cantidad - parseInt(prod.cantidad));
        movimientos.push({
            id: generarId(),
            plato: prod.plato,
            tipo: 'SALIDA',
            cantidad: parseInt(prod.cantidad),
            origen: `Reversión ${prod.idOperacion}`,
            fecha: new Date().toISOString(),
            usuarioId: req.session.userId,
            stockAnterior: ptAnt,
            stockNuevo: pt.cantidad
        });
    }

    // 3. Eliminar el registro de producción
    produccion.splice(index, 1);

    // 4. Guardar todo atomicamente
    guardarDatos(FILES.inventario, inventario);
    guardarDatos(FILES.productoTerminado, productoTerminado);
    guardarDatos(FILES.movimientosProducto, movimientos);
    guardarDatos(FILES.kardex, kardex);
    guardarDatos(FILES.produccion, produccion);

    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({ id: generarId(), fecha: new Date().toISOString(), usuario: req.session.userId,
        accion: 'DELETE_PRODUCCION', detalle: `Revirtió producción ${prod.idOperacion} — ${prod.plato} x${prod.cantidad}`, ip: req.ip });
    guardarDatos(FILES.auditoria, auditoria);

    res.json({ success: true });
});

// T5: Editar producción con recálculo atómico y validación de ventas
app.put('/produccion/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { cantidad } = req.body;
    const cantNueva = parseInt(cantidad);
    if (!cantNueva || cantNueva < 1) return res.status(400).json({ error: 'Cantidad inválida' });

    const produccion = leerDatos(FILES.produccion);
    const prod = produccion.find(p => p.id === id);
    if (!prod) return res.status(404).json({ error: 'Producción no encontrada' });

    // VALIDACIÓN CRÍTICA: si se reduce, verificar que no haya salidas vinculadas
    const cantAnterior = parseInt(prod.cantidad);
    const diferencia   = cantNueva - cantAnterior;

    if (diferencia < 0) {
        const movimientos = leerDatos(FILES.movimientosProducto);
        const fechaProd   = new Date(prod.fecha);
        const salidasPost = movimientos.filter(m =>
            m.plato === prod.plato && m.tipo === 'SALIDA' && new Date(m.fecha) >= fechaProd
        );
        if (salidasPost.length > 0) {
            return res.status(409).json({
                error: `No se puede reducir: "${prod.plato}" tiene ${salidasPost.length} salida(s) registradas. Eliminá primero las salidas.`
            });
        }
    }

    const detalle       = JSON.parse(prod.detalle);
    const inventario    = leerDatos(FILES.inventario);
    const recetas       = leerDatos(FILES.recetas);
    const receta        = recetas.find(r => r.plato === prod.plato);
    let kardex          = leerDatos(FILES.kardex);

    // Verificar stock si se aumenta
    if (diferencia > 0) {
        for (const ing of detalle) {
            const necesario = parseFloat(ing.Cantidad) * diferencia;
            const inv = inventario.find(i => i.codigo === ing.Codigo);
            if (!inv || inv.stock < necesario) {
                return res.status(400).json({ error: `Stock insuficiente de ${ing.Nombre}` });
            }
        }
    }

    // Ajustar inventario
    detalle.forEach(ing => {
        const ajuste = parseFloat(ing.Cantidad) * diferencia;
        const inv = inventario.find(i => i.codigo === ing.Codigo);
        if (inv) {
            const stockAnt = inv.stock;
            inv.stock -= ajuste;
            kardex.push({
                id: generarId(),
                producto: inv.ingrediente,
                fecha: new Date().toISOString(),
                tipo: diferencia > 0 ? 'SALIDA' : 'ENTRADA',
                documento: `EDIT-${prod.idOperacion}`,
                cantidad: Math.abs(ajuste),
                costoUnitario: inv.costoUnitario,
                valorTotal: Math.abs(ajuste) * inv.costoUnitario,
                stockAnterior: stockAnt,
                stockNuevo: inv.stock,
                observaciones: `Edición producción ${prod.plato}`
            });
        }
    });

    // Ajustar producto terminado
    const productoTerminado = leerDatos(FILES.productoTerminado);
    const pt = productoTerminado.find(p => p.plato === prod.plato);
    const movimientos = leerDatos(FILES.movimientosProducto);
    if (pt) {
        const ptAnt = pt.cantidad;
        pt.cantidad = Math.max(0, pt.cantidad + diferencia);
        movimientos.push({ id: generarId(), plato: prod.plato,
            tipo: diferencia > 0 ? 'ENTRADA' : 'SALIDA',
            cantidad: Math.abs(diferencia), origen: `Edición producción ${prod.idOperacion}`,
            fecha: new Date().toISOString(), usuarioId: req.session.userId,
            stockAnterior: ptAnt, stockNuevo: pt.cantidad });
    }

    // Actualizar producción
    prod.cantidad        = cantNueva;
    prod.costoProduccion = receta ? receta.costoTotalPlato * cantNueva : prod.costoProduccion;
    prod.updatedAt       = new Date().toISOString();

    // Guardar todo
    guardarDatos(FILES.inventario, inventario);
    guardarDatos(FILES.kardex, kardex);
    guardarDatos(FILES.productoTerminado, productoTerminado);
    guardarDatos(FILES.movimientosProducto, movimientos);
    guardarDatos(FILES.produccion, produccion);

    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({ id: generarId(), fecha: new Date().toISOString(), usuario: req.session.userId,
        accion: 'UPDATE_PRODUCCION', detalle: `${prod.plato}: ${cantAnterior}→${cantNueva} uds`, ip: req.ip });
    guardarDatos(FILES.auditoria, auditoria);

    res.json({ success: true });
});

// T5: Exportar historial de producción a CSV
app.get('/api/exportar/produccion/excel', requireAuth, (req, res) => {
    const produccion = leerDatos(FILES.produccion);
    const cabeceras  = ['Fecha','ID Operación','Plato','Cantidad','Costo Producción (L.)'];
    const filas = produccion.map(p => [
        new Date(p.fecha).toLocaleDateString('es-HN'),
        p.idOperacion || '',
        p.plato,
        p.cantidad,
        parseFloat(p.costoProduccion || 0).toFixed(2)
    ]);
    const csv = generarCSV(cabeceras, filas);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=produccion_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
});

// T5: Exportar producción a HTML imprimible (PDF desde navegador)
app.get('/api/exportar/produccion/pdf', requireAuth, (req, res) => {
    const produccion = leerDatos(FILES.produccion);
    const fecha = new Date().toLocaleDateString('es-HN');
    const totalCosto = produccion.reduce((s,p)=>s+parseFloat(p.costoProduccion||0),0);
    const filas = produccion.map(p=>`<tr>
        <td>${new Date(p.fecha).toLocaleDateString('es-HN')}</td>
        <td><code>${p.idOperacion||''}</code></td>
        <td><strong>${p.plato}</strong></td>
        <td style="text-align:center">${p.cantidad}</td>
        <td style="text-align:right">L. ${parseFloat(p.costoProduccion||0).toFixed(2)}</td>
    </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Producción - Chef Master Pro</title>
    <style>body{font-family:Arial,sans-serif;margin:30px}h1{color:#ff4b4b;border-bottom:3px solid #ff4b4b;padding-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#ff4b4b;color:white;padding:10px;text-align:left}
    td{padding:8px 10px;border-bottom:1px solid #ddd}tfoot td{font-weight:bold;background:#f9f9f9}
    .footer{margin-top:20px;font-size:0.85rem;color:#999;text-align:right}</style></head><body>
    <h1>🍽️ CHEF MASTER PRO</h1>
    <p><strong>Historial de Producción</strong> | Fecha: ${fecha} | Total registros: ${produccion.length}</p>
    <table><thead><tr><th>Fecha</th><th>ID Operación</th><th>Plato</th><th>Cantidad</th><th>Costo Producción</th></tr></thead>
    <tbody>${filas}</tbody>
    <tfoot><tr><td colspan="4">TOTAL</td><td style="text-align:right">L. ${totalCosto.toFixed(2)}</td></tr></tfoot></table>
    <div class="footer">Instituto Tecnológico Santo Tomás · Chef Master Pro v1.6</div>
    <script>window.onload=()=>window.print();</script></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
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

// ==================================================
// FUNCIÓN HELPER: Generar CSV sin dependencias
// ==================================================
function generarCSV(cabeceras, filas) {
    const escapar = val => {
        const str = String(val == null ? '' : val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lineas = [
        cabeceras.map(escapar).join(','),
        ...filas.map(fila => fila.map(escapar).join(','))
    ];
    return '\uFEFF' + lineas.join('\r\n'); // BOM para Excel en español
}

// ==================================================
// RUTAS DE EXPORTACIÓN (CSV — compatible con Excel)
// ==================================================

// Exportar Kardex a CSV
app.get('/api/exportar/kardex/excel', requireAuth, (req, res) => {
    try {
        const kardex = leerDatos(FILES.kardex);
        const cabeceras = ['Fecha','Producto','Tipo','Documento','Entrada','Salida','Costo Unit.','Costo Promedio','Saldo','Valor'];
        const filas = kardex.map(k => {
            const cant  = parseFloat(k.cantidad || 0);
            const costo = parseFloat(k.costoUnitario || 0);
            const prom  = cant > 0 ? (parseFloat(k.valorTotal || cant*costo) / cant) : costo;
            return [
                new Date(k.fecha).toLocaleDateString('es-HN'),
                k.producto,
                k.tipo,
                k.documento,
                k.tipo === 'ENTRADA' ? cant.toFixed(2) : '',
                k.tipo === 'SALIDA'  ? cant.toFixed(2) : '',
                costo.toFixed(2),
                prom.toFixed(2),
                parseFloat(k.stockNuevo || 0).toFixed(2),
                parseFloat(k.valorTotal || 0).toFixed(2)
            ];
        });
        const csv = generarCSV(cabeceras, filas);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=kardex_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

// ==================================================
// RUTAS DE REPORTES
// ==================================================
// ==================================================
// B3: REPORTES FINANCIEROS — Estado Costo Producción y Ventas
// ==================================================
app.get('/api/reportes/financieros', requireAuth, (req, res) => {
    const { mes } = req.query; // formato: YYYY-MM (ej: 2026-04)

    const historial         = leerDatos(FILES.historial);
    const produccion        = leerDatos(FILES.produccion);
    const inventario        = leerDatos(FILES.inventario);
    const movimientos       = leerDatos(FILES.movimientosProducto);
    const productoTerminado = leerDatos(FILES.productoTerminado);

    // ── Helpers ──────────────────────────────────────────
    const esMismoMes = (fechaISO, mesStr) => {
        if (!mesStr) return true;
        return fechaISO && fechaISO.startsWith(mesStr);
    };

    const esAnteriorAlMes = (fechaISO, mesStr) => {
        if (!mesStr || !fechaISO) return false;
        return fechaISO.substring(0, 7) < mesStr;
    };

    // ── Estado de Costo de PRODUCCIÓN ────────────────────
    // Fórmula: Inv.Inicial + Compras del Mes - Inv.Final = Costo de Producción

    // Inventario Inicial = valor del inventario ANTES del mes (compras anteriores)
    const comprasAntes = historial.filter(h => esAnteriorAlMes(h.fechaFactura || h.createdAt, mes));
    let invInicialProd = 0;
    const stockPorCodigo = {};
    comprasAntes.forEach(h => {
        if (!stockPorCodigo[h.codigo]) stockPorCodigo[h.codigo] = { cant: 0, valor: 0 };
        stockPorCodigo[h.codigo].cant  += parseFloat(h.cantidad || 0);
        stockPorCodigo[h.codigo].valor += parseFloat(h.costoTotal || 0);
    });
    // Restar salidas por producción anteriores al mes
    const prodAntes = produccion.filter(p => esAnteriorAlMes(p.fecha, mes));
    prodAntes.forEach(p => {
        const det = JSON.parse(p.detalle || '[]');
        det.forEach(ing => {
            const cant = parseFloat(ing.Cantidad) * parseInt(p.cantidad);
            const costo= parseFloat(ing.Costo_U || ing.CostoUnitario || 0);
            if (stockPorCodigo[ing.Codigo]) {
                stockPorCodigo[ing.Codigo].cant  -= cant;
                stockPorCodigo[ing.Codigo].valor -= cant * costo;
            }
        });
    });
    Object.values(stockPorCodigo).forEach(s => {
        if (s.cant > 0) invInicialProd += Math.max(0, s.valor);
    });

    // Compras del mes
    const comprasMes = historial.filter(h => esMismoMes(h.fechaFactura || h.createdAt, mes));
    const totalComprasMes = comprasMes.reduce((s, h) => s + parseFloat(h.costoTotal || 0), 0);
    const disponibilidadMes = invInicialProd + totalComprasMes;

    // Inventario Final = valor actual del inventario
    const invFinalProd = inventario.reduce((s, i) => s + (Math.max(0, i.stock) * i.costoUnitario), 0);

    // Costo de Producción del mes
    const costoProdMes = disponibilidadMes - invFinalProd;

    // Acumulado anual (todos los meses del año del mes seleccionado)
    const anio = mes ? mes.substring(0, 4) : new Date().getFullYear().toString();
    const comprasAnio = historial.filter(h => (h.fechaFactura || h.createdAt || '').startsWith(anio));
    const totalComprasAnio = comprasAnio.reduce((s,h) => s + parseFloat(h.costoTotal || 0), 0);

    // ── Estado de Costo de VENTAS (PT) ───────────────────
    // Fórmula: Inv.Inicial PT + Entradas Prod = PT Disponible - Inv.Final PT = Costo Ventas

    // Entradas de producción del mes
    const entradasPTMes = movimientos
        .filter(m => m.tipo === 'ENTRADA' && esMismoMes(m.fecha, mes));
    const totalEntradasPTMes = entradasPTMes.reduce((s, m) => {
        const rec = produccion.find(p => p.plato === m.plato);
        const costo = rec ? rec.costoProduccion / parseInt(rec.cantidad || 1) : 0;
        return s + parseInt(m.cantidad || 0) * costo;
    }, 0);

    // Inventario Inicial PT (entradas antes del mes - salidas antes del mes)
    const entradasPTAntes = movimientos.filter(m => m.tipo === 'ENTRADA' && esAnteriorAlMes(m.fecha, mes));
    const salidasPTAntes  = movimientos.filter(m => m.tipo === 'SALIDA'  && esAnteriorAlMes(m.fecha, mes));
    const cantPTInicial = entradasPTAntes.reduce((s,m) => s + parseInt(m.cantidad||0), 0)
                        - salidasPTAntes.reduce((s,m) => s + parseInt(m.cantidad||0), 0);

    // Costo promedio PT por plato
    const costoPTPorPlato = {};
    productoTerminado.forEach(p => {
        costoPTPorPlato[p.plato] = p.costoUnitario || 0;
    });
    const invInicialPT = Math.max(0, cantPTInicial) *
        (Object.values(costoPTPorPlato).reduce((s,c) => s+c, 0) /
         Math.max(1, Object.keys(costoPTPorPlato).length));

    const ptDisponible = invInicialPT + totalEntradasPTMes;

    // Inventario Final PT (stock actual)
    const invFinalPT = productoTerminado.reduce((s,p) =>
        s + (Math.max(0, p.cantidad) * (p.costoUnitario || 0)), 0);

    const costoVentasPT = ptDisponible - invFinalPT;

    // Salidas del mes (ventas)
    const salidasMes = movimientos.filter(m => m.tipo === 'SALIDA' && esMismoMes(m.fecha, mes));
    const totalSalidasMes = salidasMes.reduce((s,m) => s + parseInt(m.cantidad||0), 0);

    // Acumulado anual PT
    const salidasAnio = movimientos.filter(m => m.tipo === 'SALIDA' && (m.fecha||'').startsWith(anio));
    const totalSalidasAnio = salidasAnio.reduce((s,m) => s + parseInt(m.cantidad||0), 0);

    res.json({
        periodo: mes || 'Acumulado',
        anio,
        estadoCostoProd: {
            invInicialProd: parseFloat(invInicialProd.toFixed(2)),
            totalComprasMes: parseFloat(totalComprasMes.toFixed(2)),
            disponibilidadMes: parseFloat(disponibilidadMes.toFixed(2)),
            invFinalProd: parseFloat(invFinalProd.toFixed(2)),
            costoProdMes: parseFloat(costoProdMes.toFixed(2)),
            totalComprasAnio: parseFloat(totalComprasAnio.toFixed(2))
        },
        estadoCostoVentas: {
            invInicialPT: parseFloat(invInicialPT.toFixed(2)),
            totalEntradasPTMes: parseFloat(totalEntradasPTMes.toFixed(2)),
            ptDisponible: parseFloat(ptDisponible.toFixed(2)),
            invFinalPT: parseFloat(invFinalPT.toFixed(2)),
            costoVentasPT: parseFloat(costoVentasPT.toFixed(2)),
            totalSalidasMes,
            totalSalidasAnio
        }
    });
});

app.get('/reportes', requireAuth, (req, res) => {
    const inventario = leerDatos(FILES.inventario);
    const recetas    = leerDatos(FILES.recetas);
    const produccion = leerDatos(FILES.produccion);
    const kardex     = leerDatos(FILES.kardex);
    
    const stockBajo = inventario.filter(i => i.stock < i.stockMinimo);
    const totalInventario = inventario.reduce((sum, i) => 
        sum + (i.stock * i.costoUnitario), 0
    );
    
    // Top 5 recetas más rentables
    const topRecetas = recetas
        .sort((a, b) => b.valorUtilidad - a.valorUtilidad)
        .slice(0, 5);

    // Kardex: orden ascendente (más antiguo primero, igual que catálogo)
    const kardexOrdenado = kardex
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    res.render('reportes', {
        inventario,
        stockBajo,
        totalInventario,
        topRecetas,
        recetas,
        produccion,
        kardex: kardexOrdenado
    });
});

// ==================================================
// C1: EXPORTAR CATÁLOGO — Excel (CSV) y PDF
// ==================================================
app.get('/api/exportar/catalogo/excel', requireAuth, (req, res) => {
    const catalogo  = leerDatos(FILES.catalogo).filter(c => c.activo);
    const inventario= leerDatos(FILES.inventario);

    const cabeceras = ['Código','Nombre/Ingrediente','Unidad','Stock Actual','Costo Promedio (L.)','Valor en Bodega (L.)'];
    const filas = catalogo.map(art => {
        const inv = inventario.find(i => i.codigo === art.codigo);
        const stock   = inv ? parseFloat(inv.stock).toFixed(2)           : '0.00';
        const costo   = inv ? parseFloat(inv.costoUnitario).toFixed(2)   : '0.00';
        const valor   = inv ? (inv.stock * inv.costoUnitario).toFixed(2) : '0.00';
        return [
            art.codigo,
            art.ingrediente || art.nombre || '',
            art.unidad,
            stock,
            costo,
            valor
        ];
    });

    const csv = generarCSV(cabeceras, filas);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=catalogo_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
});

app.get('/api/exportar/catalogo/pdf', requireAuth, (req, res) => {
    const catalogo  = leerDatos(FILES.catalogo).filter(c => c.activo);
    const inventario= leerDatos(FILES.inventario);
    const fecha     = new Date().toLocaleDateString('es-HN');

    const filas = catalogo.map(art => {
        const inv   = inventario.find(i => i.codigo === art.codigo);
        const stock = inv ? parseFloat(inv.stock).toFixed(2)           : '0.00';
        const costo = inv ? parseFloat(inv.costoUnitario).toFixed(4)   : '0.0000';
        const valor = inv ? (inv.stock * inv.costoUnitario).toFixed(2) : '0.00';
        const alerta= inv && inv.stock < (inv.stockMinimo || 0)
            ? '<span style="color:#ff4b4b;font-weight:bold;">⚠️ BAJO</span>' : '';
        return `<tr>
            <td><code style="background:#f0f4ff;padding:0.1rem 0.4rem;border-radius:4px;">${art.codigo}</code></td>
            <td><strong>${art.ingrediente || art.nombre || ''}</strong></td>
            <td>${art.unidad}</td>
            <td style="text-align:right;">${stock} ${alerta}</td>
            <td style="text-align:right;">L. ${costo}</td>
            <td style="text-align:right;font-weight:bold;color:#0068c9;">L. ${valor}</td>
        </tr>`;
    }).join('');

    const totalValor = catalogo.reduce((s, art) => {
        const inv = inventario.find(i => i.codigo === art.codigo);
        return s + (inv ? inv.stock * inv.costoUnitario : 0);
    }, 0);

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Catálogo de Artículos — Chef Master Pro</title>
    <style>
        body{font-family:Arial,sans-serif;margin:30px;color:#333;font-size:13px}
        h1{color:#ff4b4b;border-bottom:3px solid #ff4b4b;padding-bottom:8px;margin-bottom:4px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th{background:#ff4b4b;color:white;padding:8px 10px;text-align:left;font-size:0.88rem}
        td{padding:6px 10px;border-bottom:1px solid #eee}
        tfoot td{font-weight:bold;background:#f0f4ff;border-top:2px solid #0068c9}
        .footer{margin-top:20px;font-size:0.8rem;color:#999;text-align:right}
        @media print{body{margin:15px}}
    </style></head><body>
    <h1>🍽️ CHEF MASTER PRO</h1>
    <p><strong>Catálogo de Artículos</strong> &nbsp;|&nbsp; Fecha: ${fecha} &nbsp;|&nbsp; Total artículos: ${catalogo.length}</p>
    <table>
        <thead><tr><th>Código</th><th>Nombre</th><th>Unidad</th><th>Stock Actual</th><th>Costo Promedio</th><th>Valor Bodega</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr><td colspan="5" style="text-align:right;">VALOR TOTAL EN BODEGA:</td><td style="text-align:right;">L. ${totalValor.toFixed(2)}</td></tr></tfoot>
    </table>
    <div class="footer">Instituto Tecnológico Santo Tomás &nbsp;·&nbsp; Chef Master Pro</div>
    <script>window.onload = () => window.print();</script>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

// Exportar Recetas a CSV
app.get('/api/exportar/recetas/excel', requireAuth, (req, res) => {
    try {
        const recetas = leerDatos(FILES.recetas);
        const cabeceras = ['Plato','Costo (L.)','Precio Venta (L.)','Utilidad (L.)','Margen %','Estado'];
        const filas = recetas.map(r => {
            const margen = parseFloat(r.margenUtilidad || 0) * 100;
            return [
                r.plato,
                parseFloat(r.costoTotalPlato || 0).toFixed(2),
                parseFloat(r.precioVenta || 0).toFixed(2),
                parseFloat(r.valorUtilidad || 0).toFixed(2),
                margen.toFixed(1) + '%',
                margen >= 70 ? 'MARGEN OK' : 'BAJO OBJETIVO'
            ];
        });
        const csv = generarCSV(cabeceras, filas);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=recetas_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

// Exportar Recetas a PDF (HTML imprimible en su lugar)
app.get('/api/exportar/recetas/pdf', requireAuth, (req, res) => {
    try {
        const recetas = leerDatos(FILES.recetas);
        const fecha   = new Date().toLocaleDateString('es-HN');
        const filas   = recetas.map(r => {
            const margen  = parseFloat(r.margenUtilidad || 0) * 100;
            const esBajo  = margen < 70;
            const color   = esBajo ? '#ffe6e6' : '#e6ffe6';
            const badge   = esBajo ? '<span style="color:#c00;font-weight:bold;">⚠ BAJO</span>' : '<span style="color:#080;font-weight:bold;">✓ OK</span>';
            return `<tr style="background:${color}">
                <td>${r.plato}</td>
                <td style="text-align:right">L. ${parseFloat(r.costoTotalPlato||0).toFixed(2)}</td>
                <td style="text-align:right">L. ${parseFloat(r.precioVenta||0).toFixed(2)}</td>
                <td style="text-align:right">L. ${parseFloat(r.valorUtilidad||0).toFixed(2)}</td>
                <td style="text-align:center">${margen.toFixed(1)}%</td>
                <td style="text-align:center">${badge}</td>
            </tr>`;
        }).join('');
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Recetas - Chef Master Pro</title>
        <style>
            body{font-family:Arial,sans-serif;margin:30px;color:#333}
            h1{color:#ff4b4b;border-bottom:3px solid #ff4b4b;padding-bottom:8px}
            table{width:100%;border-collapse:collapse;margin-top:16px}
            th{background:#ff4b4b;color:white;padding:10px;text-align:left}
            td{padding:8px 10px;border-bottom:1px solid #ddd}
            .footer{margin-top:20px;font-size:0.85rem;color:#999;text-align:right}
        </style></head><body>
        <h1>🍽️ CHEF MASTER PRO</h1>
        <p><strong>Reporte de Recetas</strong> &nbsp;|&nbsp; Fecha: ${fecha} &nbsp;|&nbsp; Total: ${recetas.length} recetas</p>
        <table>
            <thead><tr><th>Plato</th><th>Costo</th><th>Precio Venta</th><th>Utilidad</th><th>Margen</th><th>Estado</th></tr></thead>
            <tbody>${filas}</tbody>
        </table>
        <div class="footer">Instituto Tecnológico Santo Tomás &nbsp;·&nbsp; Chef Master Pro v1.6</div>
        <script>window.onload=()=>window.print();</script>
        </body></html>`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

// Exportar Inventario a CSV
app.get('/api/exportar/inventario/excel', requireAuth, (req, res) => {
    try {
        const inventario = leerDatos(FILES.inventario);
        const cabeceras = ['Código','Ingrediente','Stock','Unidad','Costo Unitario (L.)','Costo Promedio (L.)','Valor Total (L.)','Estado'];
        const filas = inventario.map(i => {
            const stock = parseFloat(i.stock || 0);
            const costo = parseFloat(i.costoUnitario || 0);
            const min   = parseFloat(i.stockMinimo || 0);
            return [
                i.codigo,
                i.ingrediente,
                stock.toFixed(2),
                i.unidad,
                costo.toFixed(2),
                costo.toFixed(2),
                (stock * costo).toFixed(2),
                stock < min ? 'STOCK BAJO' : 'OK'
            ];
        });
        const csv = generarCSV(cabeceras, filas);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=inventario_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

// Exportar Historial de Compras a CSV
app.get('/api/exportar/historial/excel', requireAuth, (req, res) => {
    try {
        const historial = leerDatos(FILES.historial);
        const cabeceras = ['Fecha','No. Factura','Proveedor','Producto','Cantidad','Unidad','Costo Unit. (L.)','Total (L.)'];
        const filas = historial.map(h => [
            h.fechaFactura || '',
            h.noFactura    || '',
            h.proveedor    || '',
            h.producto     || '',
            parseFloat(h.cantidad     || 0).toFixed(2),
            h.unidad       || 'Unidad',
            parseFloat(h.costoUnitario|| 0).toFixed(2),
            parseFloat(h.costoTotal   || 0).toFixed(2)
        ]);
        const csv = generarCSV(cabeceras, filas);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=historial_compras_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

// ==================================================
// Exportar movimientos de Producto Terminado a CSV
app.get('/api/exportar/movimientos-pt/excel', requireAuth, (req, res) => {
    const movimientos = leerDatos(FILES.movimientosProducto);
    const cabeceras   = ['Fecha','Plato','Tipo','Entrada','Salida','Stock Anterior','Stock Nuevo','Origen'];
    const filas = movimientos.map(m => {
        const esEntrada = m.tipo === 'ENTRADA';
        return [
            new Date(m.fecha).toLocaleDateString('es-HN'),
            m.plato,
            m.tipo,
            esEntrada ? parseInt(m.cantidad) : '',
            !esEntrada ? parseInt(m.cantidad) : '',
            m.stockAnterior ?? '',
            m.stockNuevo ?? '',
            m.origen || m.motivo || ''
        ];
    });
    const csv = generarCSV(cabeceras, filas);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=movimientos_pt_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
});

// Exportar movimientos PT a HTML imprimible (Imprimir y PDF)
app.get('/api/exportar/movimientos-pt/pdf', requireAuth, (req, res) => {
    const movimientos = leerDatos(FILES.movimientosProducto);
    const fecha       = new Date().toLocaleDateString('es-HN');
    const totEnt = movimientos.filter(m=>m.tipo==='ENTRADA').reduce((s,m)=>s+parseInt(m.cantidad||0),0);
    const totSal = movimientos.filter(m=>m.tipo==='SALIDA').reduce((s,m)=>s+parseInt(m.cantidad||0),0);

    const filas = movimientos.map(m => {
        const esEnt   = m.tipo === 'ENTRADA';
        const color   = esEnt ? '#f0fff4' : '#fff5f5';
        const badgeC  = esEnt ? '#21c354' : '#ff4b4b';
        const badge   = `<span style="background:${badgeC};color:white;padding:0.15rem 0.5rem;border-radius:10px;font-size:0.82rem;">${m.tipo}</span>`;
        return `<tr style="background:${color}">
            <td style="font-size:0.85rem;">${new Date(m.fecha).toLocaleDateString('es-HN')}</td>
            <td><strong>${m.plato}</strong></td>
            <td>${badge}</td>
            <td style="text-align:center;color:#21c354;font-weight:bold;">${esEnt ? parseInt(m.cantidad) : '—'}</td>
            <td style="text-align:center;color:#ff4b4b;font-weight:bold;">${!esEnt ? parseInt(m.cantidad) : '—'}</td>
            <td style="text-align:center;">${m.stockAnterior ?? '—'}</td>
            <td style="text-align:center;"><strong>${m.stockNuevo ?? '—'}</strong></td>
            <td style="font-size:0.85rem;">${m.origen || m.motivo || '—'}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Movimientos Producto Terminado - Chef Master Pro</title>
    <style>
        body{font-family:Arial,sans-serif;margin:30px;color:#333;font-size:14px}
        h1{color:#ff4b4b;border-bottom:3px solid #ff4b4b;padding-bottom:8px;margin-bottom:4px}
        .resumen{display:flex;gap:2rem;margin:12px 0 18px;font-size:0.9rem}
        .res-item{background:#f8f9fa;border-radius:6px;padding:8px 16px;text-align:center}
        .res-item strong{display:block;font-size:1.2rem}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th{background:#ff4b4b;color:white;padding:8px;text-align:left;font-size:0.88rem}
        td{padding:6px 8px;border-bottom:1px solid #eee;font-size:0.88rem}
        .footer{margin-top:20px;font-size:0.82rem;color:#999;text-align:right}
        @media print{body{margin:15px}}
    </style></head><body>
    <h1>🍽️ CHEF MASTER PRO</h1>
    <p style="margin:0;color:#666;"><strong>Movimientos de Producto Terminado</strong> &nbsp;|&nbsp; Fecha: ${fecha}</p>
    <div class="resumen">
        <div class="res-item"><strong style="color:#21c354;">${totEnt}</strong>Total Entradas</div>
        <div class="res-item"><strong style="color:#ff4b4b;">${totSal}</strong>Total Salidas</div>
        <div class="res-item"><strong style="color:#0068c9;">${totEnt - totSal}</strong>Saldo Neto</div>
        <div class="res-item"><strong>${movimientos.length}</strong>Total Movimientos</div>
    </div>
    <table>
        <thead><tr><th>Fecha</th><th>Plato</th><th>Tipo</th><th>Entrada</th><th>Salida</th><th>Stock Ant.</th><th>Stock Nuevo</th><th>Origen</th></tr></thead>
        <tbody>${filas}</tbody>
    </table>
    <div class="footer">Instituto Tecnológico Santo Tomás &nbsp;·&nbsp; Chef Master Pro v1.7.5</div>
    <script>window.onload = () => window.print();</script>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

// ==================================================
// RUTAS DE INVENTARIO DE PRODUCTO TERMINADO
// ==================================================
app.get('/producto-terminado', requireAuth, (req, res) => {
    const productoTerminado = leerDatos(FILES.productoTerminado);
    const recetas = leerDatos(FILES.recetas);
    const movimientos = leerDatos(FILES.movimientosProducto);
    
    // Ordenar: primero ENTRADA luego SALIDA, dentro de cada tipo ascendente (igual que catálogo)
    const movimientosOrdenados = [
        ...movimientos.filter(m => m.tipo === 'ENTRADA').sort((a,b) => new Date(a.fecha) - new Date(b.fecha)),
        ...movimientos.filter(m => m.tipo === 'SALIDA').sort((a,b) => new Date(a.fecha) - new Date(b.fecha))
    ];
    
    res.render('producto-terminado', { 
        productoTerminado, 
        recetas,
        movimientos: movimientosOrdenados
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

// Editar salida de producto terminado
app.put('/producto-terminado/salida/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { cantidad, motivo } = req.body;
    const cantNueva = parseInt(cantidad);
    if (!cantNueva || cantNueva < 1) return res.status(400).json({ error: 'Cantidad inválida' });

    const movimientos       = leerDatos(FILES.movimientosProducto);
    const productoTerminado = leerDatos(FILES.productoTerminado);

    const mov = movimientos.find(m => m.id === id && m.tipo === 'SALIDA');
    if (!mov) return res.status(404).json({ error: 'Salida no encontrada' });

    const cantAnterior = parseInt(mov.cantidad);
    const diferencia   = cantNueva - cantAnterior; // positivo = más salida, negativo = menos

    const pt = productoTerminado.find(p => p.plato === mov.plato);
    if (!pt) return res.status(404).json({ error: 'Producto terminado no encontrado' });

    // Verificar que hay stock suficiente si se aumenta la salida
    if (diferencia > 0 && pt.cantidad < diferencia) {
        return res.status(400).json({ error: `Stock insuficiente. Solo hay ${pt.cantidad} unidades disponibles.` });
    }

    const ptAnt = pt.cantidad;
    pt.cantidad -= diferencia; // si diferencia < 0 devuelve stock
    pt.updatedAt = new Date().toISOString();

    mov.cantidad  = cantNueva;
    mov.motivo    = motivo || mov.motivo;
    mov.stockNuevo= pt.cantidad;

    guardarDatos(FILES.movimientosProducto, movimientos);
    guardarDatos(FILES.productoTerminado, productoTerminado);

    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({ id: generarId(), fecha: new Date().toISOString(), usuario: req.session.userId,
        accion: 'UPDATE_SALIDA_PT', detalle: `${mov.plato}: ${cantAnterior}→${cantNueva} uds`, ip: req.ip });
    guardarDatos(FILES.auditoria, auditoria);

    res.json({ success: true });
});

// Eliminar salida de producto terminado (restaura stock)
app.delete('/producto-terminado/salida/:id', requireAuth, (req, res) => {
    const { id } = req.params;

    const movimientos       = leerDatos(FILES.movimientosProducto);
    const productoTerminado = leerDatos(FILES.productoTerminado);

    const idx = movimientos.findIndex(m => m.id === id && m.tipo === 'SALIDA');
    if (idx === -1) return res.status(404).json({ error: 'Salida no encontrada' });

    const mov = movimientos[idx];
    const pt  = productoTerminado.find(p => p.plato === mov.plato);

    if (pt) {
        pt.cantidad += parseInt(mov.cantidad);
        pt.updatedAt = new Date().toISOString();
        guardarDatos(FILES.productoTerminado, productoTerminado);
    }

    movimientos.splice(idx, 1);
    guardarDatos(FILES.movimientosProducto, movimientos);

    const auditoria = leerDatos(FILES.auditoria);
    auditoria.push({ id: generarId(), fecha: new Date().toISOString(), usuario: req.session.userId,
        accion: 'DELETE_SALIDA_PT', detalle: `Eliminó salida de ${mov.plato} x${mov.cantidad}`, ip: req.ip });
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
