const { ipcRenderer } = require('electron');

// Importar jsPDF de manera compatible con Electron
let jsPDF;
try {
    const jsPDFModule = require('jspdf');
    jsPDF = jsPDFModule.default || jsPDFModule;
    require('jspdf-autotable');
    console.log('jsPDF cargado correctamente');
} catch (error) {
    console.error('Error al cargar jsPDF:', error);
    jsPDF = null;
}

// Variables globales para fichas técnicas
let currentRecipe = null;
let savedRecipes = [];
let currentRecipeImage = null;
let autoSaveInterval = null;
let selectedHistoryRecipe = null;

// Elementos del DOM
const newRecipeBtn = document.getElementById('new-recipe');
const exportRecipeBtn = document.getElementById('export-recipe');
const printRecipeBtn = document.getElementById('print-recipe');
const recipeForm = document.getElementById('recipe-form');
const addIngredientBtn = document.getElementById('add-ingredient');

// ==================== INICIALIZACIÓN ====================
function initializeRecipeCards() {
    newRecipeBtn.addEventListener('click', createNewRecipe);
    exportRecipeBtn.addEventListener('click', exportRecipe);
    printRecipeBtn.addEventListener('click', printRecipe);
    recipeForm.addEventListener('submit', saveRecipe);
    addIngredientBtn.addEventListener('click', addIngredientRow);
    
    // Event listeners para eliminar elementos
    document.addEventListener('click', handleRemoveIngredient);
    
    // Event listeners para actualizar cálculos
    document.addEventListener('input', updateCalculations);
    
    // Event listener específico para alérgenos
    const allergensInput = document.getElementById('recipe-allergens');
    if (allergensInput) {
        allergensInput.addEventListener('input', () => {
            updateAllergens();
        });
    }

    // Event listener para imagen
    const imageInput = document.getElementById('recipe-image');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageUpload);
    }

    // Limpiar imagen al resetear
    recipeForm.addEventListener('reset', () => {
        currentRecipeImage = null;
        updateImagePreview();
        clearAutoSave();
    });

    // Iniciar autoguardado
    startAutoSave();

    // Inicializar historial
    initializeHistory();
}

// ==================== GESTIÓN DE INGREDIENTES ====================
function addIngredientRow() {
    const tbody = document.getElementById('ingredients-table-body');
    const newRow = document.createElement('tr');
    newRow.className = 'ingredient-row adding';
    newRow.innerHTML = `
        <td><input type="text" placeholder="Nombre del ingrediente" class="ingredient-name"></td>
        <td><input type="number" placeholder="0" class="ingredient-weight" step="0.1" min="0"></td>
        <td><input type="number" placeholder="0.00" class="ingredient-cost" step="0.01" min="0"></td>
        <td><input type="number" placeholder="0.00" class="ingredient-expenses" step="0.01" min="0"></td>
        <td><button type="button" class="btn btn-danger remove-ingredient"><i data-feather="trash-2"></i></button></td>
    `;
    tbody.appendChild(newRow);
    setTimeout(() => newRow.classList.remove('adding'), 400);
    
    // Renderizar icono Feather
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

function handleRemoveIngredient(e) {
    if (e.target.classList.contains('remove-ingredient')) {
        const row = e.target.closest('.ingredient-row');
        if (row) {
            row.classList.add('removing');
            setTimeout(() => {
                row.remove();
                updateCalculations();
            }, 300);
        }
    }
}

function clearIngredientRows() {
    const tbody = document.getElementById('ingredients-table-body');
    tbody.innerHTML = '';
}

// ==================== CÁLCULOS Y ACTUALIZACIONES ====================
function updateCalculations() {
    const rows = document.querySelectorAll('.ingredient-row');
    let totalWeight = 0;
    let totalCost = 0;
    let totalExpenses = 0;
    
    rows.forEach(row => {
        const weight = parseFloat(row.querySelector('.ingredient-weight').value) || 0;
        const cost = parseFloat(row.querySelector('.ingredient-cost').value) || 0;
        const expenses = parseFloat(row.querySelector('.ingredient-expenses').value) || 0;
        
        totalWeight += weight;
        totalCost += cost;
        totalExpenses += expenses;
    });
    
    const grandTotal = totalCost + totalExpenses;
    
    // Actualizar resumen
    document.getElementById('total-weight').textContent = `${totalWeight.toFixed(1)} g`;
    document.getElementById('total-cost').textContent = `${totalCost.toFixed(2)} €`;
    document.getElementById('total-expenses').textContent = `${totalExpenses.toFixed(2)} €`;
    document.getElementById('grand-total').textContent = `${grandTotal.toFixed(2)} €`;
}

function updateAllergens() {
    const allergensInput = document.getElementById('recipe-allergens');
    const allergensText = allergensInput ? allergensInput.value : '';
    const allergensSet = new Set();
    
    if (allergensText.trim()) {
        const allergenList = allergensText.split(',').map(a => a.trim()).filter(a => a);
        allergenList.forEach(allergen => allergensSet.add(allergen));
    }
    
    const allergensList = document.getElementById('allergens-list');
    allergensList.innerHTML = '';
    
    if (allergensSet.size > 0) {
        allergensSet.forEach(allergen => {
            const tag = document.createElement('span');
            tag.className = 'allergen-tag';
            tag.textContent = allergen;
            allergensList.appendChild(tag);
        });
        // Mensaje de advertencia
        const warning = document.createElement('div');
        warning.className = 'alert-warning';
        warning.textContent = 'Recuerda informar a los clientes sobre la presencia de estos alérgenos antes del servicio.';
        allergensList.appendChild(warning);
    } else if (allergensText.trim() === '') {
        // Mensaje informativo si no se han especificado alérgenos
        const info = document.createElement('div');
        info.className = 'alert-info';
        info.textContent = 'No se han especificado alérgenos';
        allergensList.appendChild(info);
    } else {
        // Mensaje de éxito si no hay alérgenos
        const success = document.createElement('div');
        success.className = 'alert-success';
        success.textContent = 'Este plato no contiene alérgenos identificados en los ingredientes especificados.';
        allergensList.appendChild(success);
    }
}

// ==================== GESTIÓN DE IMÁGENES ====================
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) {
        currentRecipeImage = null;
        updateImagePreview();
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecciona un archivo de imagen válido', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showNotification('La imagen es demasiado grande. Máximo 5MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const maxWidth = 400;
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            currentRecipeImage = canvas.toDataURL('image/jpeg', 0.85);
            updateImagePreview();
            showNotification('Imagen cargada exitosamente', 'success');
        };
        img.onerror = function() {
            showNotification('Error al cargar la imagen', 'error');
        };
        img.src = event.target.result;
    };
    reader.onerror = function() {
        showNotification('Error al leer el archivo', 'error');
    };
    reader.readAsDataURL(file);
}

function updateImagePreview() {
    const preview = document.getElementById('image-preview');
    const clearImageBtn = document.getElementById('clear-image');
    const imageLabel = document.querySelector('.image-upload-label');
    if (!preview) return;
    preview.innerHTML = '';
    if (currentRecipeImage) {
        // Ocultar icono y texto de subir foto
        if (imageLabel) imageLabel.style.display = 'none';
        const img = document.createElement('img');
        img.src = currentRecipeImage;
        img.alt = 'Foto del plato';
        img.style.maxWidth = '180px';
        img.style.maxHeight = '120px';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        preview.appendChild(img);
        if (clearImageBtn) {
            clearImageBtn.disabled = false;
        }
    } else {
        // Mostrar icono y texto de subir foto
        if (imageLabel) imageLabel.style.display = 'block';
        const span = document.createElement('span');
        span.textContent = 'Sin foto seleccionada';
        span.style.color = '#bbb';
        span.style.fontStyle = 'italic';
        preview.appendChild(span);
        if (clearImageBtn) {
            clearImageBtn.disabled = true;
        }
    }
}

// ==================== GESTIÓN DE DATOS ====================
function getRecipeData() {
    const rows = document.querySelectorAll('.ingredient-row');
    const ingredients = Array.from(rows).map(row => ({
        name: row.querySelector('.ingredient-name').value,
        weight: parseFloat(row.querySelector('.ingredient-weight').value) || 0,
        cost: parseFloat(row.querySelector('.ingredient-cost').value) || 0,
        expenses: parseFloat(row.querySelector('.ingredient-expenses').value) || 0
    })).filter(ing => ing.name.trim());
    
    const allergensInput = document.getElementById('recipe-allergens');
    const allergensText = allergensInput ? allergensInput.value : '';
    const allergens = allergensText.trim() ? 
        allergensText.split(',').map(a => a.trim()).filter(a => a) : [];
    
    return {
        name: document.getElementById('recipe-name').value,
        ingredients,
        totalWeight: parseFloat(document.getElementById('total-weight').textContent) || 0,
        totalCost: parseFloat(document.getElementById('total-cost').textContent) || 0,
        totalExpenses: parseFloat(document.getElementById('total-expenses').textContent) || 0,
        grandTotal: parseFloat(document.getElementById('grand-total').textContent) || 0,
        allergens: allergens,
        image: currentRecipeImage,
        timestamp: new Date().toISOString()
    };
}

function saveRecipeInternal() {
    const recipeData = getRecipeData();
    if (!recipeData.name.trim()) {
        showNotification('Por favor, introduce el nombre del plato.', 'error');
        return false;
    }
    if (recipeData.ingredients.length === 0) {
        showNotification('Debes añadir al menos un ingrediente.', 'error');
        return false;
    }
    
    if (currentRecipe) {
        const index = savedRecipes.findIndex(r => r.timestamp === currentRecipe.timestamp);
        if (index !== -1) {
            savedRecipes[index] = recipeData;
        }
    } else {
        savedRecipes.push(recipeData);
    }
    currentRecipe = recipeData;
    saveRecipesLocally();
    enableRecipeButtons(true);
    clearAutoSave();
    
    updateHistoryTable();
    
    updateSidebarStats();
    
    return true;
}

// ==================== FUNCIONES PRINCIPALES ====================
function saveRecipe(e) {
    e.preventDefault();
    if (saveRecipeInternal()) {
        showNotification('Ficha técnica guardada exitosamente.', 'success');
    }
}

function createNewRecipe() {
    recipeForm.reset();
    
    currentRecipeImage = null;
    updateImagePreview();
    
    clearIngredientRows();
    addIngredientRow();
    
    currentRecipe = null;
    
    updateCalculations();
    updateAllergens();
    
    enableRecipeButtons(false);
    
    clearAutoSave();
    
    const selectedRow = document.querySelector('.history-table tbody tr.selected');
    if (selectedRow) {
        selectedRow.classList.remove('selected');
        selectedHistoryRecipe = null;
        const duplicateBtn = document.getElementById('duplicate-recipe');
        if (duplicateBtn) {
            duplicateBtn.disabled = true;
        }
    }
    
    const nameInput = document.getElementById('recipe-name');
    if (nameInput) {
        nameInput.focus();
    }
    
    updateSidebarStats();
    
    showNotification('Nueva ficha técnica creada', 'info');
}

function enableRecipeButtons(enabled) {
    exportRecipeBtn.disabled = !enabled;
    printRecipeBtn.disabled = !enabled;
}

// ==================== EXPORTACIÓN E IMPRESIÓN ====================
async function exportRecipe() {
    if (!currentRecipe) {
        showNotification('No hay una ficha técnica para exportar.', 'error');
        return;
    }
    
    const safeName = currentRecipe.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_');
    const fileName = `Ficha_Tecnica_${safeName}.html`;
    const htmlContent = generatePDFHTML(currentRecipe);
    const filePath = await ipcRenderer.invoke('export-table', htmlContent, fileName);
    if (filePath) {
        showNotification(`✅ Ficha técnica exportada exitosamente a: ${filePath}`, 'success');
    }
}

function printRecipe() {
    if (!currentRecipe) {
        showNotification('No hay una ficha técnica para imprimir.', 'error');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    const htmlContent = generatePDFHTML(currentRecipe);
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ficha Técnica - ${currentRecipe.name}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .recipe-header { text-align: center; margin-bottom: 30px; }
                .recipe-info { margin: 20px 0; }
                .info-item { margin: 10px 0; }
                .section { margin: 30px 0; }
                .section h3 { border-bottom: 2px solid #333; padding-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                th { background: #4CAF50; color: white; padding: 0.5rem; text-align: left; }
                td { padding: 0.5rem; border-bottom: 1px solid #e9ecef; }
                .allergen-tag { background: #ffebee; color: #c62828; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 1px solid #ffcdd2; display: inline-block; margin: 0.25rem; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
}

function generatePDFHTML(recipe) {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ficha Técnica - ${recipe.name} | IDONI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @font-face {
            font-family: 'Address Sans Pro';
            src: url('fonts/address-sans-pro-bold.otf') format('opentype');
            font-weight: bold;
            font-style: normal;
        }
        
        @font-face {
            font-family: 'Fredoka Bold';
            src: url('fonts/fredoka-bold.ttf') format('truetype');
            font-weight: bold;
            font-style: normal;
        }
        
        body {
            font-family: 'Nimbus Sans', Arial, Helvetica, sans-serif;
            background: #fafafa;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            line-height: 1.4;
        }
        .header-idoni {
            background: #e1efd6;
            color: #405e47;
            padding: 1.5rem 2rem;
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            gap: 2rem;
        }
        .header-idoni-content {
            flex: 1;
        }
        .idoni-logo-text {
            font-family: 'Address Sans Pro', Arial, sans-serif;
            font-size: 3.5rem;
            font-weight: bold;
            color: #ed1566;
            letter-spacing: 2px;
            text-transform: uppercase;
            background: none;
            padding: 0;
            border-radius: 0;
            box-shadow: none;
            min-width: unset;
            text-align: left;
            margin-bottom: 0.5rem;
        }
        .header-idoni .info {
            font-size: 0.8rem;
            color: #405e47;
            display: block;
            margin-bottom: 0.2rem;
        }
        .header-idoni-img {
            min-width: 180px;
            min-height: 120px;
            max-width: 220px;
            max-height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            margin-left: 2rem;
        }
        .header-idoni-img img {
            max-width: 200px;
            max-height: 140px;
            border-radius: 8px;
            object-fit: cover;
        }
        .header-idoni-img .no-image {
            color: #bbb;
            font-style: italic;
            font-size: 1rem;
            text-align: center;
        }
        .main-content {
            max-width: 900px;
            margin: 1.5rem auto;
            padding: 0 2rem;
        }
        .plato-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #2E7D32;
            margin: 0 0 1.5rem 0;
            letter-spacing: -0.5px;
        }
        .card-section {
            background: #fff;
            border: 1px solid #e0e0e0;
            margin-bottom: 1.5rem;
            padding: 1.2rem 1.2rem;
        }
        .section-title {
            font-size: 1rem;
            color: #2E7D32;
            font-weight: 600;
            margin-bottom: 0.8rem;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 0.2rem;
            letter-spacing: -0.3px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.8rem;
        }
        th, td {
            padding: 0.5rem 0.4rem;
            border-bottom: 1px solid #e0e0e0;
            text-align: left;
        }
        th {
            background: #4CAF50;
            color: #fff;
            font-weight: 600;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        tr:nth-child(even) {
            background: #f8f9fa;
        }
        .allergen-tag {
            background: #ffebee;
            color: #c62828;
            padding: 0.3rem 0.6rem;
            font-size: 0.75rem;
            font-weight: 600;
            border: 1px solid #ffcdd2;
            display: inline-block;
            margin: 0.1rem 0.3rem 0.1rem 0;
        }
        .cost-list {
            list-style: none;
            padding: 0;
            margin: 0.8rem 0 0 0;
        }
        .cost-list li {
            padding: 0.4rem 0;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .cost-list li:last-child {
            border-bottom: none;
            font-weight: 600;
            color: #2E7D32;
            font-size: 1rem;
        }
        .cost-label {
            color: #666;
            font-weight: 500;
            font-size: 0.8rem;
        }
        .cost-value {
            font-weight: 600;
            color: #2E7D32;
        }
        .alert-warning {
            margin-top: 0.8rem;
            color: #d32f2f;
            font-size: 0.8rem;
            font-weight: 500;
            padding: 0.6rem;
            background: #ffebee;
            border: 1px solid #ffcdd2;
        }
        .alert-success {
            color: #2E7D32;
            font-weight: 500;
            margin-top: 0.8rem;
            padding: 0.6rem;
            background: #e8f5e9;
            border: 1px solid #c8e6c9;
        }
        
        @media print {
            .card-section:has(.cost-list) {
                display: none !important;
            }
            
            .cost-list {
                display: none !important;
            }
            
            .cost-label, .cost-value {
                display: none !important;
            }
            
            body {
                margin: 0;
                padding: 20px;
                font-size: 12pt;
                line-height: 1.4;
            }
            
            .card-section {
                page-break-inside: avoid;
                margin-bottom: 20px;
            }
            
            table {
                page-break-inside: avoid;
            }
        }
        .footer-idoni {
            text-align: center;
            color: #666;
            font-size: 0.75rem;
            margin: 1.5rem 0 1rem 0;
            padding-top: 1rem;
            border-top: 1px solid #e0e0e0;
        }
        .footer-idoni .idoni-text {
            font-family: 'Address Sans Pro', Arial, sans-serif;
            font-size: 1rem;
            font-weight: bold;
            color: #ed1566;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-right: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="header-idoni">
        <div class="idoni-logo-text">IDONI</div>
        <div class="header-idoni-content">
            <div class="info">Avinguda Mistral, 20 L'Eixample, 08015 Barcelona</div>
            <div class="info">comercial@solucionssocials.org | +34 625 53 47 55</div>
            <div class="info">Horario: Lunes a Viernes 10-16h, Sábados 10-15h</div>
        </div>
        <div class="header-idoni-img">
            ${recipe.image ? `<img src="${recipe.image}" alt="Foto del plato">` : `<span class="no-image">Sin foto disponible</span>`}
        </div>
    </div>
    
    <div class="main-content">
        <div class="plato-title">${recipe.name}</div>
        
        <div class="card-section">
            <div class="section-title">Ingredientes</div>
            <table>
                <thead>
                    <tr>
                        <th>Ingrediente</th>
                        <th>Peso (g)</th>
                        <th>Coste (€)</th>
                        <th>Gastos (€)</th>
                    </tr>
                </thead>
                <tbody>
                    ${recipe.ingredients.map(ing => `
                        <tr>
                            <td>${ing.name}</td>
                            <td>${ing.weight.toFixed(1)}</td>
                            <td>${ing.cost.toFixed(2)}</td>
                            <td>${ing.expenses.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="card-section">
            <div class="section-title">Alérgenos</div>
            ${recipe.allergens.length > 0 ? `
                <div>
                    ${recipe.allergens.map(allergen => `<span class="allergen-tag">${allergen}</span>`).join('')}
                </div>
                <div class="alert-warning">
                    Recuerda informar a los clientes sobre la presencia de estos alérgenos antes del servicio.
                </div>
            ` : `
                <div class="alert-success">Este plato no contiene alérgenos identificados en los ingredientes especificados.</div>
            `}
        </div>
        
        <div class="card-section">
            <div class="section-title">Resumen de Costes</div>
            <ul class="cost-list">
                <li>
                    <span class="cost-label">Peso Total</span>
                    <span class="cost-value">${recipe.totalWeight.toFixed(1)} g</span>
                </li>
                <li>
                    <span class="cost-label">Coste Total</span>
                    <span class="cost-value">${recipe.totalCost.toFixed(2)} €</span>
                </li>
                <li>
                    <span class="cost-label">Gastos Total</span>
                    <span class="cost-value">${recipe.totalExpenses.toFixed(2)} €</span>
                </li>
                <li>
                    <span class="cost-label">Coste Final</span>
                    <span class="cost-value">${recipe.grandTotal.toFixed(2)} €</span>
                </li>
            </ul>
        </div>
        
        <div class="footer-idoni">
            <span class="idoni-text">IDONI</span>
            Ficha Técnica generada el ${new Date().toLocaleDateString('es-ES')} | IDONI
        </div>
    </div>
</body>
</html>
    `;
}

// ==================== HISTORIAL ====================
function initializeHistory() {
    const historySearch = document.getElementById('history-search');
    const duplicateBtn = document.getElementById('duplicate-recipe');
    
    if (historySearch) {
        historySearch.addEventListener('input', filterHistory);
    }
    
    if (duplicateBtn) {
        duplicateBtn.addEventListener('click', duplicateSelectedRecipe);
    }
    
    updateHistoryTable();
}

function updateHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (savedRecipes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: #666; font-style: italic; padding: 2rem;">
                    No hay fichas técnicas guardadas
                </td>
            </tr>
        `;
        return;
    }
    
    savedRecipes.forEach((recipe, index) => {
        const row = document.createElement('tr');
        row.setAttribute('data-index', index);
        row.addEventListener('click', () => selectHistoryRecipe(index));
        
        const date = new Date(recipe.timestamp).toLocaleDateString('es-ES');
        
        row.innerHTML = `
            <td><strong>${recipe.name}</strong></td>
            <td>${recipe.ingredients.length} ingredientes</td>
            <td><strong>${recipe.grandTotal.toFixed(2)} €</strong></td>
            <td>${date}</td>
            <td>
                <div class="history-actions">
                    <button class="btn-edit" onclick="editRecipe(${index}); event.stopPropagation();"><i data-feather='edit-2'></i> Editar</button>
                    <button class="btn-export" onclick="exportRecipeFromHistory(${index}); event.stopPropagation();"><i data-feather='file-text'></i> Exportar</button>
                    <button class="btn-delete" onclick="deleteRecipe(${index}); event.stopPropagation();"><i data-feather='trash-2'></i> Eliminar</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

function selectHistoryRecipe(index) {
    const prevSelected = document.querySelector('.history-table tbody tr.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
    }
    
    const row = document.querySelector(`.history-table tbody tr[data-index="${index}"]`);
    if (row) {
        row.classList.add('selected');
        selectedHistoryRecipe = index;
        
        const duplicateBtn = document.getElementById('duplicate-recipe');
        if (duplicateBtn) {
            duplicateBtn.disabled = false;
        }
    }
}

function filterHistory() {
    const searchTerm = document.getElementById('history-search').value.toLowerCase();
    const rows = document.querySelectorAll('.history-table tbody tr');
    
    rows.forEach(row => {
        const name = row.querySelector('td:first-child').textContent.toLowerCase();
        const ingredients = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        
        if (name.includes(searchTerm) || ingredients.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function editRecipe(index) {
    const recipe = savedRecipes[index];
    if (!recipe) return;
    
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-allergens').value = recipe.allergens.join(', ');
    
    if (recipe.image) {
        currentRecipeImage = recipe.image;
        updateImagePreview();
    } else {
        currentRecipeImage = null;
        updateImagePreview();
    }
    
    clearIngredientRows();
    recipe.ingredients.forEach(ing => {
        addIngredientRow();
        const lastRow = document.querySelector('.ingredient-row:last-child');
        if (lastRow) {
            lastRow.querySelector('.ingredient-name').value = ing.name;
            lastRow.querySelector('.ingredient-weight').value = ing.weight;
            lastRow.querySelector('.ingredient-cost').value = ing.cost;
            lastRow.querySelector('.ingredient-expenses').value = ing.expenses;
        }
    });
    
    currentRecipe = recipe;
    
    updateCalculations();
    updateAllergens();
    enableRecipeButtons(true);
    
    clearAutoSave();
    
    showNotification('Ficha cargada para edición', 'info');
}

function duplicateSelectedRecipe() {
    if (selectedHistoryRecipe === null) return;
    
    const recipe = savedRecipes[selectedHistoryRecipe];
    if (!recipe) return;
    
    const duplicatedRecipe = {
        ...recipe,
        name: `${recipe.name} (Copia)`,
        timestamp: new Date().toISOString()
    };
    
    document.getElementById('recipe-name').value = duplicatedRecipe.name;
    document.getElementById('recipe-allergens').value = duplicatedRecipe.allergens.join(', ');
    
    if (duplicatedRecipe.image) {
        currentRecipeImage = duplicatedRecipe.image;
        updateImagePreview();
    } else {
        currentRecipeImage = null;
        updateImagePreview();
    }
    
    clearIngredientRows();
    duplicatedRecipe.ingredients.forEach(ing => {
        addIngredientRow();
        const lastRow = document.querySelector('.ingredient-row:last-child');
        if (lastRow) {
            lastRow.querySelector('.ingredient-name').value = ing.name;
            lastRow.querySelector('.ingredient-weight').value = ing.weight;
            lastRow.querySelector('.ingredient-cost').value = ing.cost;
            lastRow.querySelector('.ingredient-expenses').value = ing.expenses;
        }
    });
    
    currentRecipe = null;
    
    updateCalculations();
    updateAllergens();
    enableRecipeButtons(false);
    
    clearAutoSave();
    
    updateSidebarStats();
    
    showNotification('📋 Ficha duplicada lista para guardar', 'success');
}

function deleteRecipe(index) {
    const recipe = savedRecipes[index];
    if (!recipe) return;
    
    if (confirm(`¿Estás seguro de que quieres eliminar la ficha "${recipe.name}"?`)) {
        savedRecipes.splice(index, 1);
        saveRecipesLocally();
        updateHistoryTable();
        updateSidebarStats();
        if (currentRecipe && currentRecipe.timestamp === recipe.timestamp) {
            createNewRecipe();
        }
        showNotification('🗑️ Ficha eliminada', 'success');
    }
}

function exportRecipeFromHistory(index) {
    const recipe = savedRecipes[index];
    if (!recipe) return;
    
    const originalCurrent = currentRecipe;
    currentRecipe = recipe;
    
    exportRecipe();
    
    currentRecipe = originalCurrent;
}

// ==================== AUTOGUARDADO ====================
function startAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    autoSaveInterval = setInterval(() => {
        const nameInput = document.getElementById('recipe-name');
        const hasData = nameInput && nameInput.value.trim() !== '';
        
        if (hasData) {
            const recipeData = getRecipeData();
            if (recipeData.name.trim() && recipeData.ingredients.length > 0) {
                localStorage.setItem('idoni-temp-recipe', JSON.stringify(recipeData));
            }
        }
    }, 30000);
}

function clearAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
    localStorage.removeItem('idoni-temp-recipe');
}

// ==================== ALMACENAMIENTO LOCAL ====================
function saveRecipesLocally() {
    localStorage.setItem('idoni-recipes', JSON.stringify(savedRecipes));
}

function loadSavedData() {
    try {
        const savedRecipesData = localStorage.getItem('idoni-recipes');
        if (savedRecipesData) {
            savedRecipes = JSON.parse(savedRecipesData);
            updateHistoryTable();
            updateSidebarStats();
        }
        
        const tempRecipe = localStorage.getItem('idoni-temp-recipe');
        if (tempRecipe) {
            const recipeData = JSON.parse(tempRecipe);
            const nameInput = document.getElementById('recipe-name');
            if (nameInput && recipeData.name) {
                nameInput.value = recipeData.name;
                
                const allergensInput = document.getElementById('recipe-allergens');
                if (allergensInput && recipeData.allergens) {
                    allergensInput.value = recipeData.allergens.join(', ');
                }
                
                if (recipeData.image) {
                    currentRecipeImage = recipeData.image;
                    updateImagePreview();
                } else {
                    currentRecipeImage = null;
                    updateImagePreview();
                }
                
                if (recipeData.ingredients && recipeData.ingredients.length > 0) {
                    clearIngredientRows();
                    recipeData.ingredients.forEach(ing => {
                        addIngredientRow();
                        const lastRow = document.querySelector('.ingredient-row:last-child');
                        if (lastRow) {
                            lastRow.querySelector('.ingredient-name').value = ing.name;
                            lastRow.querySelector('.ingredient-weight').value = ing.weight;
                            lastRow.querySelector('.ingredient-cost').value = ing.cost;
                            lastRow.querySelector('.ingredient-expenses').value = ing.expenses;
                        }
                    });
                }
                
                updateCalculations();
                updateAllergens();
                
                showNotification('📝 Recuperada ficha temporal guardada automáticamente', 'info');
            }
        }
        
    } catch (error) {
        console.error('Error al cargar datos guardados:', error);
    }
}

// ==================== FUNCIONES AUXILIARES ====================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 4000);
}

// Exponer funciones globalmente para el historial
window.editRecipe = editRecipe;
window.exportRecipeFromHistory = exportRecipeFromHistory;
window.deleteRecipe = deleteRecipe;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initializeRecipeCards();
    loadSavedData();
    
    // Inicializar botón Guardar y Nueva
    const saveAndNewBtn = document.getElementById('save-and-new');
    if (saveAndNewBtn) {
        saveAndNewBtn.addEventListener('click', function() {
            if (saveRecipeInternal()) {
                showNotification('Ficha guardada y formulario listo para nueva ficha', 'success');
                createNewRecipe();
            }
        });
    }

    // Inicializar botón limpiar imagen
    const clearImageBtn = document.getElementById('clear-image');
    if (clearImageBtn) {
        clearImageBtn.addEventListener('click', function() {
            currentRecipeImage = null;
            const imageInput = document.getElementById('recipe-image');
            if (imageInput) imageInput.value = '';
            updateImagePreview();
            showNotification('🧹 Imagen limpiada', 'info');
        });
    }
    
    // Renderizar iconos Feather
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
});

function updateSidebarStats() {
    // Fichas guardadas
    const recipeCount = savedRecipes.length;
    // Ingredientes totales
    let ingredientsCount = 0;
    // Coste promedio
    let totalCost = 0;
    // Última modificación
    let lastModified = '-';
    let lastTimestamp = null;

    savedRecipes.forEach(recipe => {
        if (Array.isArray(recipe.ingredients)) {
            ingredientsCount += recipe.ingredients.length;
        }
        if (typeof recipe.grandTotal === 'number') {
            totalCost += recipe.grandTotal;
        }
        if (recipe.timestamp && (!lastTimestamp || recipe.timestamp > lastTimestamp)) {
            lastTimestamp = recipe.timestamp;
        }
    });

    const avgCost = recipeCount > 0 ? (totalCost / recipeCount) : 0;
    if (lastTimestamp) {
        const date = new Date(lastTimestamp);
        lastModified = date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    }

    const recipeCountEl = document.getElementById('recipe-count');
    const ingredientsCountEl = document.getElementById('ingredients-count');
    const avgCostEl = document.getElementById('avg-cost');
    const lastModifiedEl = document.getElementById('last-modified');
    if (recipeCountEl) recipeCountEl.textContent = recipeCount;
    if (ingredientsCountEl) ingredientsCountEl.textContent = ingredientsCount;
    if (avgCostEl) avgCostEl.textContent = avgCost.toFixed(2) + ' €';
    if (lastModifiedEl) lastModifiedEl.textContent = lastModified;
} 