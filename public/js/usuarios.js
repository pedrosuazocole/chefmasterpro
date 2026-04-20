// Gestión de Usuarios

async function crearUsuario(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const nombreCompleto = document.getElementById('nombreCompleto').value;
    const rol = document.getElementById('rol').value;
    
    // Validar que las contraseñas coincidan
    if (password !== passwordConfirm) {
        alert('Las contraseñas no coinciden');
        return;
    }
    
    try {
        const response = await fetch('/usuarios/crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, nombreCompleto, rol })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Usuario creado exitosamente', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification(data.error || 'Error al crear usuario', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

function editarUsuario(userId) {
    // Buscar datos del usuario en la tabla
    const rows = document.querySelectorAll('table tbody tr');
    let userData = null;
    
    rows.forEach(row => {
        const cells = row.cells;
        if (cells && cells.length > 0) {
            const username = cells[0].textContent.trim();
            const nombreCompleto = cells[1].textContent.trim();
            const rolBadge = cells[2].textContent.trim();
            
            // Extraer el rol del badge
            let rol = 'cocinero';
            if (rolBadge.includes('Admin')) rol = 'admin';
            else if (rolBadge.includes('Supervisor')) rol = 'supervisor';
            
            if (row.querySelector(`button[onclick="editarUsuario(${userId})"]`)) {
                userData = { nombreCompleto, rol };
            }
        }
    });
    
    if (userData) {
        document.getElementById('editUserId').value = userId;
        document.getElementById('editNombreCompleto').value = userData.nombreCompleto;
        document.getElementById('editRol').value = userData.rol;
        document.getElementById('modalEditarUsuario').style.display = 'flex';
    }
}

function cerrarModal() {
    document.getElementById('modalEditarUsuario').style.display = 'none';
}

async function actualizarUsuario(event) {
    event.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const nombreCompleto = document.getElementById('editNombreCompleto').value;
    const rol = document.getElementById('editRol').value;
    
    try {
        const response = await fetch(`/usuarios/actualizar/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombreCompleto, rol, activo: true })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Usuario actualizado exitosamente', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification(data.error || 'Error al actualizar', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

function cambiarPassword(userId) {
    document.getElementById('passwordUserId').value = userId;
    document.getElementById('modalPassword').style.display = 'flex';
}

function cerrarModalPassword() {
    document.getElementById('modalPassword').style.display = 'none';
}

async function actualizarPassword(event) {
    event.preventDefault();
    
    const userId = document.getElementById('passwordUserId').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
    }
    
    if (newPassword.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    
    try {
        const response = await fetch(`/usuarios/cambiar-password/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPassword })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Contraseña actualizada exitosamente', 'success');
            cerrarModalPassword();
            document.getElementById('formPassword').reset();
        } else {
            showNotification(data.error || 'Error al cambiar contraseña', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

async function toggleUsuario(userId) {
    if (!confirm('¿Confirmas cambiar el estado de este usuario?')) {
        return;
    }
    
    try {
        const response = await fetch(`/usuarios/toggle/${userId}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(
                data.activo ? 'Usuario activado' : 'Usuario desactivado',
                'success'
            );
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification(data.error || 'Error al cambiar estado', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
}

// Cerrar modales al hacer click fuera
window.onclick = function(event) {
    const modalEditar = document.getElementById('modalEditarUsuario');
    const modalPassword = document.getElementById('modalPassword');
    
    if (event.target === modalEditar) {
        cerrarModal();
    }
    if (event.target === modalPassword) {
        cerrarModalPassword();
    }
}
