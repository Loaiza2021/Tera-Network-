// c:\Users\Adrian\Desktop\Pasarela\script.js

document.addEventListener('DOMContentLoaded', function() {
    // --- CONFIGURACIÓN ---
    const TAX_RATE = 0.16; // Tasa de IVA (16%)
    const BACKEND_URL = 'http://localhost:3000/send-invoice'; // URL para enviar la factura
    const INVOICE_NUMBER_URL = 'http://localhost:3000/get-next-invoice-number'; // URL para obtener el número de factura

    const FIXED_RECIPIENT_EMAIL = 'adrianloaiza816@gmail.com'; // Correo fijo

    const PLANS = {
        "20": { name: "Plan 20 Mbps", price: 20.00 },
        "25": { name: "Plan 25 Mbps", price: 25.00 },
        "30": { name: "Plan 30 Mbps", price: 30.00 }
    };

    // Selección de elementos del DOM
    const form = document.getElementById('payment-form');
    const submitButton = document.getElementById('submit-button');
    const planSelect = document.getElementById('plan');
    const baseAmountDisplay = document.getElementById('base-amount-display');
    const taxRateDisplay = document.getElementById('tax-rate-display');
    const taxAmountDisplay = document.getElementById('tax-amount-display');
    const totalAmountDisplay = document.getElementById('total-amount-display');

    // --- POBLAR PLANES DINÁMICAMENTE ---
    function populatePlans() {
        Object.entries(PLANS).forEach(([value, details]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `${details.name} - $${details.price.toFixed(2)}`;
            planSelect.appendChild(option);
        });
    }

    // --- ACTUALIZAR DESGLOSE DE PRECIOS ---
    function updatePriceDisplay(selectedPlanValue) {
        let baseAmount = 0;
        let taxAmount = 0;
        let totalAmount = 0;
        const planDetails = PLANS[selectedPlanValue];

        if (planDetails) {
            baseAmount = planDetails.price;
            taxAmount = baseAmount * TAX_RATE;
            totalAmount = baseAmount + taxAmount;
        }

        baseAmountDisplay.textContent = `$${baseAmount.toFixed(2)}`;
        taxRateDisplay.textContent = (TAX_RATE * 100).toFixed(0);
        taxAmountDisplay.textContent = `$${taxAmount.toFixed(2)}`;
        totalAmountDisplay.textContent = `$${totalAmount.toFixed(2)}`;
    }

    // --- INICIALIZACIÓN ---
    populatePlans();
    updatePriceDisplay(planSelect.value);

    // --- EVENT LISTENERS ---
    planSelect.addEventListener('change', function(event) {
        updatePriceDisplay(event.target.value);
        validateField(planSelect);
    });

    // *** CAMBIO: El manejador del submit ahora es ASÍNCRONO (async) ***
    form.addEventListener('submit', async function(event) { // <-- Añadido async
        event.preventDefault();

        if (validateForm()) {
            submitButton.disabled = true;
            submitButton.textContent = 'Procesando...';

            let invoiceNumber = 'ERROR-NUM'; // Valor por defecto

            try {
                // 1. Obtener el número de factura del backend ANTES de generar el PDF
                console.log('Solicitando número de factura al backend...');
                const numberResponse = await fetch(INVOICE_NUMBER_URL);
                if (!numberResponse.ok) {
                    const errorData = await numberResponse.json().catch(() => ({ message: `Error ${numberResponse.status}` }));
                    throw new Error(`Error del servidor al obtener número: ${errorData.message || numberResponse.status}`);
                }
                const numberData = await numberResponse.json();
                if (!numberData.nextInvoiceNumber) {
                    throw new Error('Respuesta inválida del servidor (falta nextInvoiceNumber).');
                }
                invoiceNumber = numberData.nextInvoiceNumber; // Asume que el backend devuelve { nextInvoiceNumber: 'FACT-000101' }
                console.log('Número de factura obtenido:', invoiceNumber);

                // 2. Recopilar datos del formulario (como antes)
                const formData = {
                    nombre: document.getElementById('nombre').value.trim(),
                    apellido: document.getElementById('apellido').value.trim(),
                    telefono: document.getElementById('telefono').value.trim(),
                    cedula: document.getElementById('cedula').value.trim(),
                    referenciaPago: document.getElementById('referenciaPago').value.trim(),
                    clienteEmail: FIXED_RECIPIENT_EMAIL,
                    selectedPlanValue: planSelect.value
                };

                const selectedPlanKey = formData.selectedPlanValue;
                const selectedPlanDetails = PLANS[selectedPlanKey];

                if (!selectedPlanDetails) {
                    throw new Error('Plan seleccionado no válido.'); // Lanzar error para el catch
                }

                const calculatedBaseAmount = selectedPlanDetails.price;
                const calculatedTaxAmount = calculatedBaseAmount * TAX_RATE;
                const calculatedTotalAmount = calculatedBaseAmount + calculatedTaxAmount;

                const paymentDetails = {
                    planName: selectedPlanDetails.name,
                    baseAmount: calculatedBaseAmount,
                    taxRate: TAX_RATE,
                    taxAmount: calculatedTaxAmount,
                    totalAmount: calculatedTotalAmount
                };

                // 3. Generar la factura PASANDO el número obtenido
                console.log(`Generando factura PDF con número: ${invoiceNumber}`);
                // generateInvoice ahora es async, así que usamos await
                const pdfBlob = await generateInvoice(formData, paymentDetails, invoiceNumber); // <-- Pasamos invoiceNumber
                console.log('PDF generado correctamente.');

                // 4. Descargar el PDF (opcional, pero útil para el usuario)
                const downloadUrl = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                // Incluir número de factura en el nombre del archivo
                a.download = `factura-${invoiceNumber}-${formData.nombre}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
                console.log(`Factura ${invoiceNumber} descargada localmente.`);

                // 5. Enviar correo con la factura
                console.log(`Enviando factura ${invoiceNumber} al backend...`);
                // Pasamos invoiceNumber a sendInvoiceEmail también
                const emailSent = await sendInvoiceEmail(formData, paymentDetails, pdfBlob, invoiceNumber);

                if (emailSent) {
                    // Notificación de éxito modificada
                    showToast('Correo Enviado', `Factura ${invoiceNumber} enviada correctamente a ${formData.clienteEmail}.`, 'success');
                    form.reset();
                    updatePriceDisplay('');
                    clearAllErrors();
                } else {
                    // El error ya se mostró en sendInvoiceEmail, pero podemos añadir un log
                    console.warn(`Factura ${invoiceNumber} generada y descargada, pero el envío por correo falló.`);
                    // Podrías mostrar un mensaje específico si quieres
                    showToast('Factura Generada (Error Envío)', `Factura ${invoiceNumber} descargada. No se pudo enviar por correo.`, 'warning');
                }

            } catch (error) {
                // Captura errores de fetch, generateInvoice o validaciones internas
                console.error('Error en el proceso de generación/envío:', error);
                const errorMsg = error.message && error.message.includes('jsPDF no está cargado')
                    ? 'Error de Configuración: Falta la librería jsPDF.'
                    : `Hubo un problema al procesar la factura: ${error.message || 'Error desconocido'}`;
                showToast('Error Crítico', errorMsg, 'error');
            } finally {
                // Esto se ejecuta siempre, haya error o no
                submitButton.disabled = false;
                submitButton.textContent = 'Confirmar Pago';
            }

        } else {
             showToast('Error de Validación', 'Por favor, corrija los errores en el formulario.', 'error');
        }
    });

    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
    });

    // --- FUNCIONES DE VALIDACIÓN Y UTILIDAD ---

    function validateForm() {
        let isValid = true;
        const fieldsToValidate = ['plan', 'nombre', 'apellido', 'telefono', 'cedula', 'referenciaPago'];
        fieldsToValidate.forEach(id => {
            const field = document.getElementById(id);
            if (field && !validateField(field)) {
                isValid = false;
            }
        });
        return isValid;
    }

    function validateField(field) {
        if (!field) return true;
        let fieldIsValid = true;
        const value = field.value.trim();
        clearError(field);
        switch(field.id) {
            case 'plan':
                if (value === "") { showError(field, 'Por favor, seleccione un plan'); fieldIsValid = false; }
                break;
            case 'nombre':
                if (value.length < 2) { showError(field, 'El nombre debe tener al menos 2 caracteres'); fieldIsValid = false; }
                break;
            case 'apellido':
                if (value.length < 2) { showError(field, 'El apellido debe tener al menos 2 caracteres'); fieldIsValid = false; }
                break;
            case 'telefono':
                // Validar formato específico: 04 seguido de 9 dígitos (Total 11 dígitos)
                if (!/^04\d{9}$/.test(value.replace(/\s/g, ''))) {
                    showError(field, 'Ingrese un teléfono válido (Ej: 0412xxxxxxx)'); fieldIsValid = false;
                }
                break;
            case 'cedula':
                // Validar formato específico: V, E, J o G seguido de 7 a 9 dígitos.
                // Ejemplo: V28054349 (V + 8 dígitos)
                const cedulaClean = value.toUpperCase().replace(/[\s.-]/g, ''); // Limpia espacios, puntos, guiones
                if (!/^[VEJG]\d{7,9}$/.test(cedulaClean)) {
                    showError(field, 'Formato inválido (Ej: V12345678)'); fieldIsValid = false;
                }
                break;
            case 'referenciaPago':
                if (value.length < 4) { showError(field, 'La referencia de pago debe tener al menos 4 caracteres'); fieldIsValid = false; }
                break;
        }
        if (!fieldIsValid) { field.classList.add('error-input'); }
        else { field.classList.remove('error-input'); }
        return fieldIsValid;
    }

    function showError(field, message) {
        const errorElement = document.getElementById(`${field.id}-error`);
        if (errorElement) { errorElement.textContent = message; errorElement.style.display = 'block'; }
        field.classList.add('error-input');
    }

    function clearError(field) {
        const errorElement = document.getElementById(`${field.id}-error`);
        if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; }
        field.classList.remove('error-input');
    }

    function clearAllErrors() {
        const fieldsToClear = ['plan', 'nombre', 'apellido', 'telefono', 'cedula', 'referenciaPago'];
        fieldsToClear.forEach(id => {
            const field = document.getElementById(id);
            if (field) { clearError(field); }
        });
    }

    // --- FUNCIÓN PARA ENVIAR DATOS Y PDF AL BACKEND ---
    async function sendInvoiceEmail(formData, paymentDetails, pdfBlob, invoiceNumber) {
        console.log(`Preparando FormData para enviar factura ${invoiceNumber}...`);
        const dataToSend = new FormData();

        // Añadir datos del formulario y detalles del pago
        dataToSend.append('nombre', formData.nombre);
        dataToSend.append('apellido', formData.apellido);
        dataToSend.append('telefono', formData.telefono);
        dataToSend.append('cedula', formData.cedula);
        dataToSend.append('referenciaPago', formData.referenciaPago);
        dataToSend.append('clienteEmail', formData.clienteEmail); // Email fijo
        dataToSend.append('planName', paymentDetails.planName);
        dataToSend.append('baseAmount', paymentDetails.baseAmount.toFixed(2));
        dataToSend.append('taxRate', paymentDetails.taxRate.toFixed(2));
        dataToSend.append('taxAmount', paymentDetails.taxAmount.toFixed(2));
        dataToSend.append('totalAmount', paymentDetails.totalAmount.toFixed(2));

        // Añadir el número de factura al FormData
        dataToSend.append('invoiceNumber', invoiceNumber);

        // Añadir el PDF
        dataToSend.append('invoicePdf', pdfBlob, `factura-${invoiceNumber}-${formData.nombre}.pdf`); // Usar número en nombre de archivo

        try {
            const response = await fetch(BACKEND_URL, { // BACKEND_URL es /send-invoice
                method: 'POST',
                body: dataToSend
                // No se necesita 'Content-Type': 'multipart/form-data',
                // el navegador lo establece automáticamente con FormData
            });

            const result = await response.json().catch(() => ({ message: `Respuesta no JSON del servidor (Status: ${response.status})` })); // Intenta parsear JSON, si falla usa status

            if (!response.ok) {
                console.error('Error del backend al enviar correo:', response.status, result.message);
                throw new Error(result.message || `Error del servidor: ${response.status}`);
            }

            console.log('Respuesta del backend (envío de correo exitoso):', result.message);
            return true; // Indica éxito

        } catch (error) {
            console.error('Error en la función sendInvoiceEmail (fetch o red):', error);
            // Mostrar error específico del envío de correo
            showToast('Error de Envío', `No se pudo enviar el correo para la factura ${invoiceNumber}: ${error.message}`, 'error');
            return false; // Indica fallo
        }
    }

    // --- FUNCIÓN TOAST (Notificaciones) ---
    function showToast(title, message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastTitle = document.getElementById('toast-title');
        const toastMessage = document.getElementById('toast-message');
        if (!toast || !toastTitle || !toastMessage) {
            console.warn('Elementos del Toast no encontrados en el DOM.');
            alert(`${title}: ${message}`); // Fallback a alert
            return;
        }
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        toast.className = 'toast'; // Reset classes
        toast.classList.add(type, 'show');
        // Autohide after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    }

    // Chequeo inicial de generateInvoice
    if (typeof generateInvoice === 'undefined') {
        console.error("La función generateInvoice no está definida. Asegúrate de que invoice.js se cargue correctamente antes de script.js.");
        showToast('Error Crítico', 'Falta la función para generar facturas (invoice.js).', 'error');
        if(submitButton) submitButton.disabled = true;
    }

}); // Fin de DOMContentLoaded
