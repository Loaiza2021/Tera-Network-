// c:\Users\Adrian\Desktop\Pasarela\invoice.js

async function generateInvoice(data, payment, invoiceNumber) {
    // Asegurarse de que jsPDF esté disponible
    if (typeof window.jspdf === 'undefined') {
        console.error('Error: jsPDF no está cargado.');
        throw new Error('jsPDF no está cargado correctamente. Asegúrate de que la librería esté incluida antes que este script.');
    }

    // Crear un nuevo documento PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- Añadir color de fondo ---
    const pageBgColor = '#eef1f3'; // Color de fondo del PDF
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(pageBgColor); // Establecer color de relleno
    doc.rect(0, 0, pageWidth, pageHeight, 'F'); // Dibujar rectángulo relleno
    // --- Fin color de fondo ---

    // --- Encabezado ---
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURA', 105, 20, { align: 'center' });

    // --- Añadir el logo específico para la factura ---
    try {
        // Define la ruta al logo que quieres USAR SOLO EN EL PDF
        const logoFacturaSrc = 'img/tera.jpg'; //<-- CAMBIA ESTO si tu archivo se llama diferente o está en otra ruta

        // Cargar la imagen de forma asíncrona
        const logoFacturaImg = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => {
                console.error(`Error cargando el logo de la factura: ${logoFacturaSrc}`, err);
                reject(new Error(`No se pudo cargar la imagen del logo: ${logoFacturaSrc}`));
            };
            img.src = logoFacturaSrc; // Inicia la carga
        });

        // Añadir la imagen cargada al PDF
        if (logoFacturaImg) {
            // Parámetros: imagen, formato, x, y, ancho, alto
            // Ajusta formato (PNG/JPEG), posición (15,15) y tamaño (50,18) según necesites
            doc.addImage(logoFacturaImg, 'PNG', 15, 15, 50, 18);
        }
    } catch (error) {
        console.error("Error al añadir el logo al PDF:", error);
        // Opcionalmente, añadir texto si el logo falla
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("Nombre Empresa", 15, 20); // Texto alternativo
    }
    // --- Fin añadir logo ---

    // Fecha y Número de Factura
    const today = new Date();
    const formattedDate = today.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${formattedDate}`, 145, 35);

    // Usar el número de factura secuencial obtenido del backend
    doc.text(`Factura Nro: ${invoiceNumber}`, 145, 40);

    // --- Información del Cliente ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Facturado a:', 20, 65);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${data.nombre} ${data.apellido}`, 20, 75);
    doc.text(`Cédula/RIF: ${data.cedula}`, 20, 80);
    doc.text(`Teléfono: ${data.telefono}`, 20, 85);

    // --- Detalles del Pago ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalles del Servicio Contratado', 20, 105);

    // Encabezado de tabla
    const tableStartY = 110;
    doc.setFillColor(230, 230, 230); // Fondo gris claro para encabezado
    doc.rect(20, tableStartY, 170, 8, 'F'); // Rectángulo del encabezado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50); // Texto gris oscuro
    doc.text('Descripción', 22, tableStartY + 6);
    doc.text('Referencia Pago', 100, tableStartY + 6);
    doc.text('Monto Base', 188, tableStartY + 6, { align: 'right' });
    doc.setTextColor(0, 0, 0); // Restaurar color de texto a negro

    // Fila de tabla (Contenido)
    const contentY = tableStartY + 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(payment.planName, 22, contentY); // Nombre del plan
    doc.text(data.referenciaPago, 100, contentY); // Referencia
    doc.text(`${payment.baseAmount.toFixed(2)}`, 188, contentY, { align: 'right' }); // Monto base

    // Línea separadora debajo del contenido
    doc.setDrawColor(200, 200, 200); // Color gris claro para la línea
    doc.setLineWidth(0.2);
    doc.line(20, contentY + 5, 190, contentY + 5);

    // --- Desglose del Total ---
    const summaryY = contentY + 15; // Posición Y para empezar el resumen
    const summaryX = 140; // Posición X para las etiquetas (Subtotal, IVA)
    const amountX = 188; // Posición X para los montos (alineados a la derecha)

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', summaryX, summaryY);
    doc.text(`${payment.baseAmount.toFixed(2)}`, amountX, summaryY, { align: 'right' });

    doc.text(`IVA (${(payment.taxRate * 100).toFixed(0)}%):`, summaryX, summaryY + 5);
    doc.text(`${payment.taxAmount.toFixed(2)}`, amountX, summaryY + 5, { align: 'right' });

    // Línea antes del total
    doc.setDrawColor(0, 0, 0); // Color negro para la línea
    doc.setLineWidth(0.5);
    doc.line(summaryX, summaryY + 8, amountX + 2, summaryY + 8); // Línea un poco más ancha que el texto

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TOTAL A PAGAR:', summaryX, summaryY + 14);
    doc.text(`${payment.totalAmount.toFixed(2)}`, amountX, summaryY + 14, { align: 'right' });

    // --- Notas y Pie de Página ---
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100); // Texto gris
    doc.text('Este documento representa la confirmación de un pago mensual.', 105, 250, { align: 'center' });
    // Puedes añadir más información aquí si es necesario

    // Devolver el PDF como blob para poder enviarlo/descargarlo
    console.log('Generación de PDF completada, devolviendo blob...');
    return doc.output('blob');
}
