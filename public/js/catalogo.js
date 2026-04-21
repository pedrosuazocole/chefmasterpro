// Crear nuevo artículo
async function crearArticulo(event) {
    event.preventDefault();
    
    const nombre = document.getElementById('nombreNuevo').value;
    const unidad = document.getElementById('unidadNueva').value;
    
    try {
        const response = await fetch('/catalogo/crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, unidad })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Artículo ${data.codigo} creado exitosamente`, 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showNotification('Error al crear artículo', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

function editarArticulo(id) {
    // Implementar modal de edición
    showNotification('Función de edición próximamente', 'warning');
}
