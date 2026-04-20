// Producto Terminado

function actualizarStockDisponible() {
    const select = document.getElementById('platoSalida');
    const selectedOption = select.options[select.selectedIndex];
    const stock = selectedOption.dataset.stock || 0;
    
    const stockDisplay = document.getElementById('stockDisponible');
    if (stock > 0) {
        stockDisplay.textContent = `Stock disponible: ${stock} unidades`;
        stockDisplay.style.color = '#21c354';
        document.getElementById('cantidadSalida').max = stock;
    } else {
        stockDisplay.textContent = 'Sin stock disponible';
        stockDisplay.style.color = '#ff4b4b';
    }
}

function mostrarStockActual() {
    const select = document.getElementById('platoAjuste');
    const selectedOption = select.options[select.selectedIndex];
    const stock = selectedOption.dataset.stock || 0;
    
    const stockDisplay = document.getElementById('stockActual');
    stockDisplay.textContent = `Stock actual: ${stock} unidades`;
}

async function registrarSalida(event) {
    event.preventDefault();
    
    const plato = document.getElementById('platoSalida').value;
    const cantidad = document.getElementById('cantidadSalida').value;
    const motivo = document.getElementById('motivoSalida').value;
    
    try {
        const response = await fetch('/producto-terminado/salida', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plato, cantidad, motivo })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Salida registrada: ${cantidad} ${plato}`, 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification(data.error || 'Error al registrar salida', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

function registrarSalidaRapida(plato, stockDisponible) {
    const cantidad = prompt(`¿Cuántas unidades de "${plato}" salieron?\n\nStock disponible: ${stockDisponible}`);
    
    if (!cantidad || cantidad <= 0) {
        return;
    }
    
    if (parseInt(cantidad) > stockDisponible) {
        alert(`No hay suficiente stock. Disponible: ${stockDisponible}`);
        return;
    }
    
    const motivo = prompt('Motivo de la salida:', 'Venta');
    
    if (!motivo) {
        return;
    }
    
    fetch('/producto-terminado/salida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plato, cantidad, motivo })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`Salida registrada: ${cantidad} ${plato}`, 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification(data.error || 'Error', 'error');
        }
    })
    .catch(error => {
        showNotification('Error de conexión', 'error');
    });
}

async function realizarAjuste(event) {
    event.preventDefault();
    
    const plato = document.getElementById('platoAjuste').value;
    const cantidadNueva = document.getElementById('nuevaCantidad').value;
    const motivo = document.getElementById('motivoAjuste').value;
    
    if (!confirm(`¿Confirmas ajustar el stock de "${plato}" a ${cantidadNueva} unidades?\n\nMotivo: ${motivo}`)) {
        return;
    }
    
    try {
        const response = await fetch('/producto-terminado/ajuste', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plato, cantidadNueva, motivo })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Ajuste realizado exitosamente', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification(data.error || 'Error al realizar ajuste', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    const platoSalida = document.getElementById('platoSalida');
    if (platoSalida) {
        platoSalida.addEventListener('change', actualizarStockDisponible);
    }
    
    const platoAjuste = document.getElementById('platoAjuste');
    if (platoAjuste) {
        platoAjuste.addEventListener('change', mostrarStockActual);
    }
});

// ==================================================
// ELIMINAR PRODUCTO TERMINADO
// ==================================================
async function eliminarProductoTerminado(id, plato) {
    if (!confirm(`¿Está seguro de eliminar "${plato}" del inventario de producto terminado?\n\n⚠️ Esta acción NO puede deshacerse.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/producto-terminado/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Producto eliminado exitosamente', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification(data.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

// ==================================================
// BUSCAR PRODUCTO TERMINADO
// ==================================================
function buscarProductoTerminado() {
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    const filas = document.querySelectorAll('#tbodyProductoTerminado tr');
    
    filas.forEach(fila => {
        const texto = fila.textContent.toLowerCase();
        
        if (busqueda === '' || texto.includes(busqueda)) {
            fila.style.display = '';
        } else {
            fila.style.display = 'none';
        }
    });
}
