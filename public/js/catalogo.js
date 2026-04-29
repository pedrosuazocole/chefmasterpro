// ============================================================
// CHEF MASTER PRO — catalogo.js
// ============================================================

// Crear nuevo artículo
async function crearArticulo(event) {
    event.preventDefault();

    var nombre = document.getElementById('nombreNuevo').value.trim();
    var unidad = document.getElementById('unidadNueva').value;

    if (!nombre) {
        showNotification('Ingresá el nombre del artículo', 'error');
        return;
    }

    try {
        var btn = event.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = '⏳ Guardando...';

        var response = await fetch('/catalogo/crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre, unidad: unidad })
        });

        var data = await response.json();

        if (data.success) {
            showNotification('Artículo ' + data.codigo + ' creado exitosamente', 'success');
            setTimeout(function() { location.reload(); }, 1200);
        } else {
            showNotification(data.error || 'Error al crear artículo', 'error');
            btn.disabled = false;
            btn.textContent = '💾 Guardar';
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

// Abrir modal de edición usando data-* attributes del botón
function editarArticulo(btn) {
    var id     = btn.getAttribute('data-id');
    var nombre = btn.getAttribute('data-nombre');
    var unidad = btn.getAttribute('data-unidad');

    document.getElementById('editCatId').value     = id;
    document.getElementById('editCatNombre').value = nombre;

    var sel = document.getElementById('editCatUnidad');
    for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === unidad) {
            sel.selectedIndex = i;
            break;
        }
    }

    var btnGuardar = document.getElementById('btnGuardarCatalogo');
    btnGuardar.disabled = false;
    btnGuardar.textContent = '💾 Guardar Cambios';

    document.getElementById('modalEditarCatalogo').style.display = 'flex';
    setTimeout(function() { document.getElementById('editCatNombre').focus(); }, 100);
}

// Cerrar modal
function cerrarModalCatalogo() {
    document.getElementById('modalEditarCatalogo').style.display = 'none';
}

// Guardar cambios del artículo
async function guardarEdicionCatalogo() {
    var id     = document.getElementById('editCatId').value;
    var nombre = document.getElementById('editCatNombre').value.trim();
    var unidad = document.getElementById('editCatUnidad').value;

    if (!nombre) {
        showNotification('El nombre no puede estar vacío', 'error');
        return;
    }

    try {
        var btn = document.getElementById('btnGuardarCatalogo');
        btn.disabled = true;
        btn.textContent = '⏳ Guardando...';

        var response = await fetch('/catalogo/actualizar/' + id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre, unidad: unidad })
        });

        var data = await response.json();

        if (data.success) {
            showNotification('✅ Artículo actualizado correctamente', 'success');
            cerrarModalCatalogo();
            setTimeout(function() { location.reload(); }, 1200);
        } else {
            showNotification(data.error || 'Error al actualizar', 'error');
            btn.disabled = false;
            btn.textContent = '💾 Guardar Cambios';
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

// Eliminar artículo usando data-* attributes del botón
async function eliminarArticulo(btn) {
    var id     = btn.getAttribute('data-id');
    var nombre = btn.getAttribute('data-nombre');

    if (!confirm('¿Estás seguro de eliminar "' + nombre + '"?\n\n⚠️ Solo se puede eliminar si no tiene stock.\nTambién se eliminará del Inventario.')) {
        return;
    }

    try {
        var response = await fetch('/catalogo/' + id, {
            method: 'DELETE'
        });

        var data = await response.json();

        if (data.success) {
            showNotification('✅ Artículo "' + nombre + '" eliminado correctamente', 'success');
            setTimeout(function() { location.reload(); }, 1200);
        } else {
            showNotification(data.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

// Exportar catálogo a CSV/Excel
function exportarCatalogoExcel() {
    window.location.href = '/api/exportar/catalogo/excel';
}

// Exportar catálogo a PDF (HTML imprimible)
function exportarCatalogoPDF() {
    window.open('/api/exportar/catalogo/pdf', '_blank');
}
