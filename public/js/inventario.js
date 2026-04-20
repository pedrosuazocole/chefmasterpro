// Sistema de Inventario
let catalogoProductos = [];

async function cargarCatalogo() {
    try {
        const response = await fetch('/api/inventario');
        catalogoProductos = await response.json();
        agregarProductoCompra();
    } catch (error) {
        console.error('Error:', error);
    }
}

function agregarProductoCompra() {
    const container = document.getElementById('productosCompra');
    const productoHTML = `
        <div class="producto-item" style="background: var(--light); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <div class="form-row" style="grid-template-columns: 2fr 1fr 1fr 1fr auto; align-items: end;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Producto</label>
                    <select class="producto-select" required onchange="actualizarTotalFactura()">
                        <option value="">Seleccionar...</option>
                        ${catalogoProductos.map(p => 
                            `<option value="${p.codigo}" data-nombre="${p.ingrediente}" data-unidad="${p.unidad}">
                                ${p.codigo} - ${p.ingrediente}
                            </option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Cantidad</label>
                    <input type="number" class="cantidad-input" step="0.01" min="0.01" required 
                           placeholder="0" onchange="actualizarTotalFactura()">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Costo Unit.</label>
                    <input type="number" class="costo-input" step="0.01" min="0.01" required 
                           placeholder="0.00" onchange="actualizarTotalFactura()">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Subtotal</label>
                    <input type="text" class="subtotal-input" readonly style="background: #f9f9f9; font-weight: bold;" value="L. 0.00">
                </div>
                <button type="button" class="btn btn-sm" onclick="this.parentElement.parentElement.remove(); actualizarTotalFactura();" 
                        style="background: #ff4b4b; color: white; margin-bottom: 0;">🗑️</button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', productoHTML);
}

function actualizarTotalFactura() {
    const productos = document.querySelectorAll('.producto-item');
    let total = 0;
    
    productos.forEach(item => {
        const cantidad = parseFloat(item.querySelector('.cantidad-input').value) || 0;
        const costo = parseFloat(item.querySelector('.costo-input').value) || 0;
        const subtotal = cantidad * costo;
        
        item.querySelector('.subtotal-input').value = 'L. ' + subtotal.toFixed(2);
        total += subtotal;
    });
    
    document.getElementById('totalFactura').textContent = 'L. ' + total.toFixed(2);
}

async function registrarCompra(event) {
    event.preventDefault();
    
    const noFactura = document.getElementById('noFactura').value;
    const fechaFactura = document.getElementById('fechaFactura').value;
    const proveedor = document.getElementById('proveedor').value;
    
    const productos = [];
    document.querySelectorAll('.producto-item').forEach(item => {
        const select = item.querySelector('.producto-select');
        const selectedOption = select.options[select.selectedIndex];
        
        if (selectedOption.value) {
            productos.push({
                codigo: selectedOption.value,
                nombre: selectedOption.dataset.nombre,
                unidad: selectedOption.dataset.unidad,
                cantidad: item.querySelector('.cantidad-input').value,
                costoUnitario: item.querySelector('.costo-input').value
            });
        }
    });
    
    if (productos.length === 0) {
        alert('Debés agregar al menos un producto');
        return;
    }
    
    try {
        const response = await fetch('/inventario/registrar-compra', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ noFactura, fecha: fechaFactura, productos, proveedor })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Factura registrada exitosamente', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification('Error al registrar la factura', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

async function cargarStock() {
    try {
        const response = await fetch('/api/inventario');
        const inventario = await response.json();
        
        const tbody = document.getElementById('tablaStock');
        tbody.innerHTML = '';
        
        inventario.forEach(item => {
            const valorTotal = item.stock * item.costoUnitario;
            const estado = item.stock < item.stockMinimo ? 
                '<span style="color: #ff4b4b; font-weight: bold;">⚠️ BAJO</span>' : 
                '<span style="color: #21c354;">✅ OK</span>';
            
            tbody.innerHTML += `
                <tr>
                    <td>${item.codigo}</td>
                    <td><strong>${item.ingrediente}</strong></td>
                    <td>${item.stock.toFixed(2)}</td>
                    <td>${item.unidad}</td>
                    <td>L. ${item.costoUnitario.toFixed(2)}</td>
                    <td><strong>L. ${valorTotal.toFixed(2)}</strong></td>
                    <td>${estado}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error cargando stock:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarCatalogo();
    cargarStock();
});

// ==================================================
// MODIFICAR Y ELIMINAR COMPRAS
// ==================================================
async function editarCompra(id) {
    showNotification('Funcionalidad de edición disponible próximamente', 'info');
    // TODO: Implementar modal de edición
}

async function eliminarCompra(id, noFactura) {
    if (!confirm(`¿Está seguro de eliminar el registro de la factura ${noFactura}?\n\n⚠️ ADVERTENCIA: Esta acción NO puede deshacerse y NO recalculará el inventario automáticamente.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/inventario/compra/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Registro eliminado exitosamente', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification(data.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}
