// Funciones globales del sistema

// Menú hamburguesa para móvil
function initMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    
    if (!sidebar) return;
    
    // Crear botón hamburguesa si no existe
    if (!document.querySelector('.menu-toggle')) {
        const menuBtn = document.createElement('button');
        menuBtn.className = 'menu-toggle';
        menuBtn.innerHTML = '☰';
        menuBtn.setAttribute('aria-label', 'Abrir menú');
        document.body.appendChild(menuBtn);
        
        // Crear overlay
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        
        // Toggle menú
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
            menuBtn.innerHTML = sidebar.classList.contains('open') ? '✕' : '☰';
        });
        
        // Cerrar al hacer click en overlay
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            menuBtn.innerHTML = '☰';
        });
        
        // Cerrar menú al hacer click en un link (solo en móvil)
        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('active');
                    menuBtn.innerHTML = '☰';
                }
            });
        });
    }
}

// Cambio de tabs
function switchTab(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Desactivar todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activar el tab seleccionado
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Activar el botón correspondiente
    event.target.classList.add('active');
}

// Resaltar nav-link activo
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
    
    // Inicializar menú móvil
    initMobileMenu();
    
    // Hacer tablas responsive
    makeTablesResponsive();
});

// Hacer tablas scrolleables en móvil
function makeTablesResponsive() {
    const tables = document.querySelectorAll('.table');
    tables.forEach(table => {
        if (!table.parentElement.classList.contains('table-container')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-container';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

// Mostrar notificaciones
function showNotification(message, type = 'success') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '10000';
    alert.style.minWidth = '250px';
    alert.style.maxWidth = '90%';
    alert.style.animation = 'slideIn 0.3s';
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.style.animation = 'slideOut 0.3s';
        setTimeout(() => alert.remove(), 300);
    }, 3000);
}

// Formatear moneda
function formatCurrency(amount) {
    return 'L. ' + parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Confirmar acción
function confirmAction(message) {
    return confirm(message);
}

// Detectar cambio de orientación
window.addEventListener('orientationchange', () => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const menuBtn = document.querySelector('.menu-toggle');
    
    if (sidebar && overlay && menuBtn) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        menuBtn.innerHTML = '☰';
    }
});

// Animaciones CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
