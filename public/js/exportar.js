// EXPORTACIONES EXCEL Y PDF

async function exportarExcel(tipo, titulo) {
    try {
        const response = await fetch(`/api/exportar/${tipo}/excel`);
        
        if (!response.ok) {
            throw new Error('Error en la exportación');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${titulo}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showNotification(`${titulo} exportado a Excel`, 'success');
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al exportar a Excel', 'error');
    }
}

async function exportarPDF(tipo, titulo) {
    try {
        const response = await fetch(`/api/exportar/${tipo}/pdf`);
        
        if (!response.ok) {
            throw new Error('Error en la exportación');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${titulo}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showNotification(`${titulo} exportado a PDF`, 'success');
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al exportar a PDF', 'error');
    }
}
