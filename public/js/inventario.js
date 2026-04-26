// ============================================================
// CHEF MASTER PRO v1.5.4 - inventario.js
// ============================================================
let catalogoProductos = [];

async function cargarCatalogo() {
    try {
        const response = await fetch('/api/inventario');
        catalogoProductos = await response.json();
        agregarProductoCompra();
    } catch (error) {
        console.error('Error cargando catálogo:', error);
    }
}

// ============================================================
// AGREGAR FILA DE PRODUCTO EN FORMULARIO DE COMPRA
// ============================================================
function agregarProductoCompra() {
    const container = document.getElementById('productosCompra');
    const id = Date.now();
    
    const html = `
        <div class="producto-item" id="item-${id}" 
             style="background:var(--light);padding:1rem;border-radius:8px;margin-bottom:0.75rem;border:1px solid var(--border);">
            <div style="display:grid;grid-template-columns:2.5fr 1fr 1fr 1fr 1fr auto;gap:0.75rem;align-items:end;">
                
                <div class="form-group" style="margin-bottom:0;">
                    <label style="font-size:0.85rem;font-weight:600;">Producto</label>
                    <select class="producto-select" required onchange="autocompletarUnidad(this); actualizarTotalFactura()">
                        <option value="">Seleccionar producto...</option>
                        ${catalogoProductos.map(p => 
                            `<option value="${p.codigo}" 
                                     data-nombre="${p.ingrediente}" 
                                     data-unidad="${p.unidad}"
                                     data-costo="${p.costoUnitario}">
                                ${p.codigo} - ${p.ingrediente}
                             </option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="form-group" style="margin-bottom:0;">
                    <label style="font-size:0.85rem;font-weight:600;">Cantidad</label>
                    <input type="number" class="cantidad-input" step="0.01" min="0.01" 
                           required placeholder="0" onchange="actualizarTotalFactura()" 
                           oninput="actualizarTotalFactura()">
                </div>
                
                <div class="form-group" style="margin-bottom:0;">
                    <label style="font-size:0.85rem;font-weight:600;">Unidad</label>
                    <select class="unidad-select" required>
                        <option value="Unidad">Unidad</option>
                        <option value="Libra">Libra</option>
                        <option value="Kg">Kilogramo</option>
                        <option value="Gramo">Gramo</option>
                        <option value="Litro">Litro</option>
                        <option value="Ml">Mililitro</option>
                        <option value="Onza">Onza</option>
                        <option value="Docena">Docena</option>
                        <option value="Caja">Caja</option>
                        <option value="Bolsa">Bolsa</option>
                    </select>
                </div>
                
                <div class="form-group" style="margin-bottom:0;">
                    <label style="font-size:0.85rem;font-weight:600;">Costo Unit. (L.)</label>
                    <input type="number" class="costo-input" step="0.01" min="0.01" 
                           required placeholder="0.00" onchange="actualizarTotalFactura()"
                           oninput="actualizarTotalFactura()">
                </div>
                
                <div class="form-group" style="margin-bottom:0;">
                    <label style="font-size:0.85rem;font-weight:600;">Subtotal</label>
                    <input type="text" class="subtotal-input" readonly 
                           style="background:#f9f9f9;font-weight:bold;color:var(--primary);" 
                           value="L. 0.00">
                </div>
                
                <button type="button" onclick="eliminarFilaProducto('item-${id}')" 
                        style="background:#ff4b4b;color:white;border:none;border-radius:6px;
                               padding:0.5rem 0.75rem;cursor:pointer;font-size:1.1rem;margin-bottom:0;">
                    🗑️
                </button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

function eliminarFilaProducto(id) {
    const el = document.getElementById(id);
    if (el) {
        el.remove();
        actualizarTotalFactura();
    }
}

function autocompletarUnidad(select) {
    const option = select.options[select.selectedIndex];
    const unidad = option.dataset.unidad;
    const costoRef = option.dataset.costo;
    const item = select.closest('.producto-item');
    
    if (unidad && item) {
        const unidadSelect = item.querySelector('.unidad-select');
        if (unidadSelect) {
            for (let i = 0; i < unidadSelect.options.length; i++) {
                if (unidadSelect.options[i].value === unidad) {
                    unidadSelect.selectedIndex = i;
                    break;
                }
            }
        }
        // Sugerir costo de referencia (costo promedio actual)
        if (costoRef && parseFloat(costoRef) > 0) {
            const costoInput = item.querySelector('.costo-input');
            if (costoInput && !costoInput.value) {
                costoInput.value = parseFloat(costoRef).toFixed(2);
                actualizarTotalFactura();
            }
        }
    }
}

function actualizarTotalFactura() {
    const items = document.querySelectorAll('.producto-item');
    let total = 0;
    
    items.forEach(item => {
        const cantidad = parseFloat(item.querySelector('.cantidad-input').value) || 0;
        const costo = parseFloat(item.querySelector('.costo-input').value) || 0;
        const subtotal = cantidad * costo;
        item.querySelector('.subtotal-input').value = 'L. ' + subtotal.toFixed(2);
        total += subtotal;
    });
    
    document.getElementById('totalFactura').textContent = 'L. ' + total.toFixed(2);
}

// ============================================================
// REGISTRAR COMPRA
// ============================================================
async function registrarCompra(event) {
    event.preventDefault();
    
    const noFactura = document.getElementById('noFactura').value.trim();
    const fechaFactura = document.getElementById('fechaFactura').value;
    const proveedor = document.getElementById('proveedor').value.trim();
    
    if (!noFactura || !fechaFactura) {
        showNotification('Completa el número de factura y la fecha', 'error');
        return;
    }
    
    const productos = [];
    let hayError = false;
    
    document.querySelectorAll('.producto-item').forEach(item => {
        const select = item.querySelector('.producto-select');
        const unidadSelect = item.querySelector('.unidad-select');
        const cantidadInput = item.querySelector('.cantidad-input');
        const costoInput = item.querySelector('.costo-input');
        const selectedOption = select.options[select.selectedIndex];
        
        if (!selectedOption.value) return;
        
        const cantidad = parseFloat(cantidadInput.value);
        const costo = parseFloat(costoInput.value);
        
        if (!cantidad || cantidad <= 0) {
            showNotification(`Cantidad inválida para ${selectedOption.dataset.nombre}`, 'error');
            hayError = true;
            return;
        }
        if (!costo || costo <= 0) {
            showNotification(`Costo inválido para ${selectedOption.dataset.nombre}`, 'error');
            hayError = true;
            return;
        }
        
        productos.push({
            codigo: selectedOption.value,
            nombre: selectedOption.dataset.nombre,
            unidad: unidadSelect.value,
            cantidad: cantidad,
            costoUnitario: costo
        });
    });
    
    if (hayError) return;
    
    if (productos.length === 0) {
        showNotification('Agregá al menos un producto a la factura', 'error');
        return;
    }
    
    try {
        const btn = event.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = '⏳ Guardando...';
        
        const response = await fetch('/inventario/registrar-compra', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ noFactura, fecha: fechaFactura, productos, proveedor })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Factura registrada correctamente. Kardex actualizado.', 'success');
            setTimeout(() => location.reload(), 1800);
        } else {
            showNotification(data.error || 'Error al registrar la factura', 'error');
            btn.disabled = false;
            btn.textContent = '💾 Guardar Factura';
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error de conexión al servidor', 'error');
    }
}

// ============================================================
// CARGAR STOCK
// ============================================================
async function cargarStock() {
    try {
        const response = await fetch('/api/inventario');
        const inventario = await response.json();
        const tbody = document.getElementById('tbodyStock');
        
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (inventario.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay productos en inventario</td></tr>';
            return;
        }
        
        inventario.forEach(item => {
            const stock = parseFloat(item.stock || 0);
            const costoUnitario = parseFloat(item.costoUnitario || 0);
            const stockMinimo = parseFloat(item.stockMinimo || 0);
            const valorTotal = stock * costoUnitario;
            const esBajo = stock < stockMinimo;
            
            const estadoBadge = esBajo
                ? '<span style="background:#ff4b4b;color:white;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.8rem;">⚠️ BAJO</span>'
                : '<span style="background:#21c354;color:white;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.8rem;">✅ OK</span>';
            
            tbody.innerHTML += `
                <tr style="background:${esBajo ? '#fff5f5' : ''}">
                    <td><code>${item.codigo}</code></td>
                    <td><strong>${item.ingrediente}</strong></td>
                    <td><strong style="font-size:1.1rem;">${stock.toFixed(2)}</strong></td>
                    <td>${item.unidad}</td>
                    <td>L. ${costoUnitario.toFixed(2)}</td>
                    <td style="color:#0068c9;font-weight:bold;">L. ${costoUnitario.toFixed(2)}</td>
                    <td><strong>L. ${valorTotal.toFixed(2)}</strong></td>
                    <td>${estadoBadge}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error cargando stock:', error);
    }
}

// ============================================================
// ELIMINAR COMPRA DEL HISTORIAL
// ============================================================
async function eliminarCompra(id, noFactura, producto) {
    if (!id) {
        showNotification('Este registro no tiene ID y no puede eliminarse', 'error');
        return;
    }
    
    const confirmMsg = `¿Eliminar este registro?\n\nFactura: ${noFactura}\nProducto: ${producto}\n\n⚠️ ADVERTENCIA: Esta acción no puede deshacerse.\nEl inventario NO se recalculará automáticamente.`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
        const response = await fetch(`/inventario/compra/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Registro eliminado del historial', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification(data.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

// ============================================================
// INICIALIZAR
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    cargarCatalogo();
    cargarStock();
});
