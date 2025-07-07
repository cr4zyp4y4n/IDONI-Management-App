// Variables globales para Excel
let excelData = [];
let filteredData = [];
let isSimplifiedView = false;

// Variables para virtualización
let visibleRows = [];
let currentPage = 0;
let rowsPerPage = 50;
let totalPages = 0;
let isLoading = false;

// Columnas específicas de IDONI para filtros rápidos
const IDONI_COLUMNS = {
    DESCRIPCION: 'Descripció',
    CATEGORIA: 'Categoria',
    PROVEEDOR: 'Proveïdor',
    FAMILIA: 'Nom Família',
    GRUPO: 'Grup',
    PVP_DET: 'PVP Det.',
    PVP_MAJ: 'PVP Maj.',
    STOCK: 'Estoc Mín.',
    BLOQUEADO: 'Bloquejat',
    INTERNET: 'Internet',
    DESTACADO: 'Destacat',
    IVA: 'IVA',
    COSTO: 'Preu Cost',
    MARGEN: 'Marge Det.',
    COSTO_ULTIMO: 'Ult.Pr.Cost',
    COSTO_IVA: 'Cost+IVA',
    CODIGO: 'Codi',
    CODIGO_PROVEEDOR: 'C.Prov.',
    CODIGO_FAMILIA: 'C.Fam.'
};

// Columnas para vista simplificada
const SIMPLIFIED_COLUMNS = [
    'Codi',
    'Descripció',
    'C.Prov.',
    'Proveïdor',
    'C.Fam.',
    'Nom Família',
    'IVA',
    'Preu Cost',
    'Ult.Pr.Cost',
    'Cost+IVA'
];

// Elementos del DOM
const loadExcelBtn = document.getElementById('load-excel');
const saveDataBtn = document.getElementById('save-data');
const clearDataBtn = document.getElementById('clear-data');
const toggleViewBtn = document.getElementById('toggle-view');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-column');
const idoniFilterControls = document.getElementById('idoni-filter-controls');
const applyFiltersBtn = document.getElementById('apply-filters');
const clearFiltersBtn = document.getElementById('clear-filters');
const activeFiltersCount = document.getElementById('active-filters-count');
const statsDisplay = document.getElementById('stats-display');
const tableHeader = document.getElementById('table-header');
const tableBody = document.getElementById('table-body');
const dropZone = document.getElementById('drop-zone');

// ==================== FUNCIONES DE INDICADOR DE CARGA ====================
function showLoadingIndicator() {
    isLoading = true;
    // Elimina cualquier overlay/spinner previo
    const prevOverlay = document.getElementById('loading-indicator-overlay');
    if (prevOverlay && prevOverlay.parentElement) prevOverlay.parentElement.removeChild(prevOverlay);
    const overlay = document.createElement('div');
    overlay.id = 'loading-indicator-overlay';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1000';
    overlay.style.pointerEvents = 'none';
    // Spinner
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.className = 'loading-fade-in';
    loadingDiv.style.background = 'rgba(255, 255, 255, 0.9)';
    loadingDiv.style.padding = '2rem';
    loadingDiv.style.borderRadius = '12px';
    loadingDiv.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
    loadingDiv.style.textAlign = 'center';
    loadingDiv.innerHTML = `
        <div style="width: 40px; height: 40px; border: 4px solid #e1efd6; border-top: 4px solid #ed1566; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
        <div style="color: #405e47; font-weight: 600;">Cargando datos...</div>
    `;
    overlay.appendChild(loadingDiv);
    const dataContent = document.querySelector('.data-content');
    if (dataContent) {
        dataContent.style.position = 'relative';
        dataContent.appendChild(overlay);
    }
}

function hideLoadingIndicator() {
    isLoading = false;
    const overlay = document.getElementById('loading-indicator-overlay');
    if (overlay && overlay.parentElement) {
        const loadingDiv = overlay.querySelector('#loading-indicator');
        if (loadingDiv) {
            loadingDiv.classList.remove('loading-fade-in');
            loadingDiv.classList.add('loading-fade-out');
            setTimeout(() => {
                if (overlay.parentElement) {
                    overlay.parentElement.removeChild(overlay);
                }
            }, 350);
        } else {
            overlay.parentElement.removeChild(overlay);
        }
    }
}

// ==================== ARRASTRAR Y SOLTAR ====================
function initializeDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => {
        loadExcelBtn.click();
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    dropZone.classList.add('dragover');
}

function unhighlight(e) {
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        const file = files[0];
        if (isValidExcelFile(file)) {
            processExcelFile(file);
        } else {
            showNotification('Por favor, selecciona un archivo Excel válido (.xlsx o .xls)', 'error');
        }
    }
}

function isValidExcelFile(file) {
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/excel',
        'application/x-excel',
        'application/x-msexcel'
    ];
    
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    
    return validTypes.includes(file.type) || 
           validExtensions.some(ext => fileName.endsWith(ext));
}

async function processExcelFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Convertir el archivo a una ruta temporal o usar una API alternativa
        // Por ahora, vamos a usar la misma lógica que loadExcelFile
        const filePath = await window.electronAPI.selectFile();
        if (!filePath) return;

        const result = await window.electronAPI.readExcelFile(filePath);
        if (!result.success) {
            showNotification('Error al leer el archivo Excel. Verifica que sea un archivo válido.', 'error');
            return;
        }

        const jsonData = result.data;
        
        if (jsonData.length < 2) {
            showNotification('❌ El archivo Excel debe tener al menos una fila de encabezados y una fila de datos.', 'error');
            return;
        }

        const headers = jsonData[0];
        const rows = jsonData.slice(1);
        
        excelData = rows.map((row, index) => {
            const obj = { id: index + 1 };
            headers.forEach((header, colIndex) => {
                obj[header] = row[colIndex] || '';
            });
            return obj;
        });

        filteredData = [...excelData];
        
        updateTableHeaders(headers);
        updateTableData();
        updateFilterControls(headers);
        initializeFilterTabs();
        updateStats();
        enableExcelButtons();
        saveDataLocally();
        
        if (excelData.length > 0) {
            dropZone.style.display = 'none';
            dropZone.style.pointerEvents = 'none';
            dropZone.style.zIndex = '-1';
            // Mostrar la tabla y el panel de filtros
            const tableContainer = document.getElementById('table-container');
            const filtersPanel = document.getElementById('filters-panel');
            const tableControls = document.getElementById('table-controls');
            if (tableContainer) tableContainer.style.display = 'block';
            if (filtersPanel) filtersPanel.style.display = 'block';
            if (tableControls) tableControls.style.display = 'flex';
        }
        
        showNotification(`✅ Archivo cargado exitosamente. ${excelData.length} productos encontrados.`, 'success');
        
    } catch (error) {
        console.error('Error al procesar archivo Excel:', error);
        showNotification('Error al procesar el archivo Excel. Verifica que sea un archivo válido.', 'error');
    }
}

// ==================== GESTOR DE EXCEL ====================
function initializeExcelManager() {
    console.log('Registrando event listeners...');
    
    try {
        loadExcelBtn.addEventListener('click', (e) => {
            console.log('Botón Cargar Excel clickeado');
            loadExcelFile();
        });
        console.log('Event listener para loadExcelBtn registrado');
        
        saveDataBtn.addEventListener('click', (e) => {
            console.log('Botón Guardar Datos clickeado');
            saveExcelData();
        });
        console.log('Event listener para saveDataBtn registrado');
        
        clearDataBtn.addEventListener('click', (e) => {
            console.log('Botón Limpiar Datos clickeado');
            clearExcelData();
        });
        console.log('Event listener para clearDataBtn registrado');
        
        toggleViewBtn.addEventListener('click', (e) => {
            console.log('Botón Toggle View clickeado');
            toggleTableView();
        });
        console.log('Event listener para toggleViewBtn registrado');
        
        searchInput.addEventListener('input', (e) => {
            console.log('Input de búsqueda cambiado:', e.target.value);
            filterData();
        });
        console.log('Event listener para searchInput registrado');
        
        sortSelect.addEventListener('change', (e) => {
            console.log('Select de ordenamiento cambiado:', e.target.value);
            sortData();
        });
        console.log('Event listener para sortSelect registrado');
        
        applyFiltersBtn.addEventListener('click', (e) => {
            console.log('Botón Aplicar Filtros clickeado');
            applyFilters();
        });
        console.log('Event listener para applyFiltersBtn registrado');
        
        clearFiltersBtn.addEventListener('click', (e) => {
            console.log('Botón Limpiar Filtros clickeado');
            clearAllFilters();
        });
        console.log('Event listener para clearFiltersBtn registrado');
        
        console.log('Todos los event listeners registrados correctamente');
    } catch (error) {
        console.error('Error al registrar event listeners:', error);
    }
}

async function loadExcelFile() {
    console.log('Función loadExcelFile iniciada');
    try {
        console.log('Solicitando selección de archivo...');
        const filePath = await window.electronAPI.selectFile();
        console.log('Archivo seleccionado:', filePath);
        
        if (!filePath) {
            console.log('No se seleccionó ningún archivo');
            return;
        }

        console.log('Leyendo archivo Excel...');
        // Usar la API de Electron para leer el archivo
        const result = await window.electronAPI.readExcelFile(filePath);
        console.log('Resultado de lectura:', result);
        
        if (!result.success) {
            console.error('Error al leer archivo Excel:', result.error);
            showNotification('Error al leer el archivo Excel. Verifica que sea un archivo válido.', 'error');
            return;
        }

        const jsonData = result.data;
        console.log('Datos JSON obtenidos:', jsonData.length, 'filas');
        
        if (jsonData.length < 2) {
            showNotification('❌ El archivo Excel debe tener al menos una fila de encabezados y una fila de datos.', 'error');
            return;
        }

        const headers = jsonData[0];
        const rows = jsonData.slice(1);
        
        excelData = rows.map((row, index) => {
            const obj = { id: index + 1 };
            headers.forEach((header, colIndex) => {
                obj[header] = row[colIndex] || '';
            });
            return obj;
        });

        filteredData = [...excelData];
        
        updateTableHeaders(headers);
        updateTableData();
        updateFilterControls(headers);
        initializeFilterTabs();
        updateStats();
        enableExcelButtons();
        saveDataLocally();
        
        if (excelData.length > 0) {
            dropZone.style.display = 'none';
            dropZone.style.pointerEvents = 'none';
            dropZone.style.zIndex = '-1';
            // Mostrar la tabla y el panel de filtros
            const tableContainer = document.getElementById('table-container');
            const filtersPanel = document.getElementById('filters-panel');
            const tableControls = document.getElementById('table-controls');
            if (tableContainer) tableContainer.style.display = 'block';
            if (filtersPanel) filtersPanel.style.display = 'block';
            if (tableControls) tableControls.style.display = 'flex';
        }
        
        showNotification(`✅ Archivo cargado exitosamente. ${excelData.length} productos encontrados.`, 'success');
        
    } catch (error) {
        console.error('Error al cargar archivo Excel:', error);
        showNotification('Error al cargar el archivo Excel. Verifica que sea un archivo válido.', 'error');
    }
}

function updateTableHeaders(headers) {
    if (isSimplifiedView) {
        const availableSimplifiedColumns = SIMPLIFIED_COLUMNS.filter(col => headers.includes(col));
        tableHeader.innerHTML = `
            <tr>
                ${availableSimplifiedColumns.map(header => `<th>${header}</th>`).join('')}
            </tr>
        `;
        
        sortSelect.innerHTML = '<option value="">Ordenar por...</option>';
        availableSimplifiedColumns.forEach(header => {
            sortSelect.innerHTML += `<option value="${header}">${header}</option>`;
        });
    } else {
        tableHeader.innerHTML = `
            <tr>
                ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
        `;
        
        sortSelect.innerHTML = '<option value="">Ordenar por...</option>';
        headers.forEach(header => {
            sortSelect.innerHTML += `<option value="${header}">${header}</option>`;
        });
    }
}

function updateTableData() {
    if (!excelData.length) return;
    showLoadingIndicator();
    setTimeout(() => {
        const allHeaders = Object.keys(excelData[0]).filter(key => key !== 'id');
        totalPages = Math.ceil(filteredData.length / rowsPerPage);
        const startIndex = currentPage * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        visibleRows = filteredData.slice(startIndex, endIndex);
        if (isSimplifiedView) {
            const availableSimplifiedColumns = SIMPLIFIED_COLUMNS.filter(col => allHeaders.includes(col));
            renderTableRowsOptimized(visibleRows, availableSimplifiedColumns);
        } else {
            renderTableRowsOptimized(visibleRows, allHeaders);
        }
        updatePaginationControls();
    }, 10);
}

function renderTableRowsOptimized(rows, headers) {
    const fragment = document.createDocumentFragment();
    const batchSize = 10;
    let currentBatch = 0;
    function processBatch() {
        const start = currentBatch * batchSize;
        const end = Math.min(start + batchSize, rows.length);
        for (let i = start; i < end; i++) {
            const row = rows[i];
            const tr = document.createElement('tr');
            headers.forEach(header => {
                const td = document.createElement('td');
                const cellContent = formatTableCellContent(row[header], header);
                td.innerHTML = cellContent;
                tr.appendChild(td);
            });
            fragment.appendChild(tr);
        }
        currentBatch++;
        if (end < rows.length) {
            requestAnimationFrame(processBatch);
        } else {
            tableBody.innerHTML = '';
            tableBody.appendChild(fragment);
            hideLoadingIndicator();
        }
    }
    processBatch();
}

function formatTableCellContent(value, columnName) {
    const cellValue = value !== null && value !== undefined ? String(value) : '';
    
    if (isNumericColumn(columnName)) {
        const numericValue = parseFloat(cellValue);
        if (!isNaN(numericValue)) {
            return `<span data-numeric="true" title="${cellValue}">${formatNumber(numericValue)}</span>`;
        }
    }
    
    if (isStatusColumn(columnName)) {
        const status = getStatusValue(cellValue, columnName);
        if (status) {
            return `<span data-status="${status.type}" title="${cellValue}">${status.display}</span>`;
        }
    }
    
    if (isCodeColumn(columnName)) {
        return `<span data-type="code" title="${cellValue}">${cellValue}</span>`;
    }
    
    if (isDescriptionColumn(columnName)) {
        return `<span data-type="description" title="${cellValue}">${truncateText(cellValue, 40)}</span>`;
    }
    
    return `<span title="${cellValue}">${truncateText(cellValue, 25)}</span>`;
}

function isNumericColumn(columnName) {
    const numericColumns = [
        'PVP Det.', 'PVP Maj.', 'Preu Cost', 'Ult.Pr.Cost', 'Cost+IVA',
        'Marge Det.', 'Marge Maj.', 'Estoc Mín.', 'IVA'
    ];
    return numericColumns.includes(columnName);
}

function isStatusColumn(columnName) {
    const statusColumns = ['Bloquejat', 'Internet', 'Destacat'];
    return statusColumns.includes(columnName);
}

function isCodeColumn(columnName) {
    const codeColumns = ['Codi', 'C.Prov.', 'C.Fam.'];
    return codeColumns.includes(columnName);
}

function isDescriptionColumn(columnName) {
    const descriptionColumns = ['Descripció', 'Nom Família', 'Grup'];
    return descriptionColumns.includes(columnName);
}

function getStatusValue(value, columnName) {
    const upperValue = String(value || '').toUpperCase();
    
    switch (columnName) {
        case 'Bloquejat':
            if (upperValue === 'S') {
                return { type: 'blocked', display: '🔒 Bloqueado' };
            } else if (upperValue === 'N') {
                return { type: 'active', display: '✅ Activo' };
            }
            break;
        case 'Internet':
            if (upperValue === 'S') {
                return { type: 'internet', display: '🌐 Disponible' };
            } else if (upperValue === 'N') {
                return { type: 'blocked', display: '❌ No disponible' };
            }
            break;
        case 'Destacat':
            if (upperValue === 'S') {
                return { type: 'featured', display: '⭐ Destacado' };
            }
            break;
    }
    
    return null;
}

function formatNumber(num) {
    if (Number.isInteger(num)) {
        return num.toLocaleString('es-ES');
    } else {
        return num.toLocaleString('es-ES', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    }
}

function truncateText(text, maxLength) {
    const textStr = String(text || '');
    if (textStr.length <= maxLength) return textStr;
    return textStr.substring(0, maxLength) + '...';
}

function updateFilterControls(headers) {
    let idoniFilters = '';
    
    if (headers.includes(IDONI_COLUMNS.CATEGORIA)) {
        const categorias = [...new Set(excelData.map(row => row[IDONI_COLUMNS.CATEGORIA]).filter(Boolean))];
        idoniFilters += `<div class="filter-control"><label>${IDONI_COLUMNS.CATEGORIA}:</label><select data-column="${IDONI_COLUMNS.CATEGORIA}"><option value="">Todas las categorías</option>${categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('')}</select></div>`;
    }
    
    if (headers.includes(IDONI_COLUMNS.PROVEEDOR)) {
        const proveedores = [...new Set(excelData.map(row => row[IDONI_COLUMNS.PROVEEDOR]).filter(Boolean))];
        idoniFilters += `<div class="filter-control"><label>${IDONI_COLUMNS.PROVEEDOR}:</label><select data-column="${IDONI_COLUMNS.PROVEEDOR}"><option value="">Todos los proveedores</option>${proveedores.map(prov => `<option value="${prov}">${prov}</option>`).join('')}</select></div>`;
    }
    
    if (headers.includes(IDONI_COLUMNS.FAMILIA)) {
        const familias = [...new Set(excelData.map(row => row[IDONI_COLUMNS.FAMILIA]).filter(Boolean))];
        idoniFilters += `<div class="filter-control"><label>${IDONI_COLUMNS.FAMILIA}:</label><select data-column="${IDONI_COLUMNS.FAMILIA}"><option value="">Todas las familias</option>${familias.map(fam => `<option value="${fam}">${fam}</option>`).join('')}</select></div>`;
    }
    
    if (headers.includes(IDONI_COLUMNS.BLOQUEADO)) {
        idoniFilters += `<div class="filter-control"><label>Estado:</label><select data-column="${IDONI_COLUMNS.BLOQUEADO}"><option value="">Todos los estados</option><option value="S">Bloqueados</option><option value="N">Activos</option></select></div>`;
    }
    
    if (headers.includes(IDONI_COLUMNS.INTERNET)) {
        idoniFilters += `<div class="filter-control"><label>Internet:</label><select data-column="${IDONI_COLUMNS.INTERNET}"><option value="">Todos</option><option value="S">Disponible en Internet</option><option value="N">No disponible en Internet</option></select></div>`;
    }
    
    if (headers.includes(IDONI_COLUMNS.DESTACADO)) {
        idoniFilters += `<div class="filter-control"><label>Destacado:</label><select data-column="${IDONI_COLUMNS.DESTACADO}"><option value="">Todos</option><option value="S">Solo destacados</option></select></div>`;
    }
    
    idoniFilterControls.innerHTML = idoniFilters;
    
    initializeFilterInputs();
}

function applyFilters() {
    const filterInputs = document.querySelectorAll('.filter-control input, .filter-control select');
    let filtered = [...excelData];
    let activeFilters = 0;
    
    filterInputs.forEach(input => {
        const column = input.getAttribute('data-column');
        const value = input.value.trim();
        
        if (value) {
            activeFilters++;
            
            if (column.includes('_min')) {
                const baseColumn = column.replace('_min', '');
                const maxValue = document.querySelector(`[data-column="${baseColumn}_max"]`)?.value.trim();
                
                filtered = filtered.filter(row => {
                    const rowValue = parseFloat(String(row[baseColumn] || '').replace(',', '.')) || 0;
                    const minValue = parseFloat(value.replace(',', '.')) || 0;
                    const maxVal = parseFloat(maxValue.replace(',', '.')) || Infinity;
                    
                    if (value && !maxValue) {
                        return rowValue >= minValue;
                    }
                    if (!value && maxValue) {
                        return rowValue <= maxVal;
                    }
                    return rowValue >= minValue && rowValue <= maxVal;
                });
            } else if (column.includes('_max')) {
                return;
            } else {
                filtered = filtered.filter(row => {
                    const cellValue = String(row[column] || '').toLowerCase();
                    const searchValue = value.toLowerCase();
                    return cellValue.includes(searchValue);
                });
            }
        }
    });
    
    filteredData = filtered;
    currentPage = 0;
    
    updateTableData();
    updateStats();
    updateActiveFiltersCount(activeFilters);
    
    if (activeFilters > 0) {
        const originalCount = excelData.length;
        const filteredCount = filteredData.length;
        const percentage = ((filteredCount / originalCount) * 100).toFixed(1);
        showNotification(`Filtros aplicados: ${filteredCount} de ${originalCount} productos (${percentage}%)`, 'success');
    }
}

function clearAllFilters() {
    const filterInputs = document.querySelectorAll('.filter-control input, .filter-control select');
    filterInputs.forEach(input => {
        input.value = '';
    });
    
    filteredData = [...excelData];
    currentPage = 0;
    
    updateTableData();
    updateStats();
    updateActiveFiltersCount(0);
    
    showNotification('🔄 Todos los filtros han sido limpiados', 'info');
}

function updateActiveFiltersCount(count) {
    if (count > 0) {
        activeFiltersCount.textContent = count;
        activeFiltersCount.style.display = 'flex';
    } else {
        activeFiltersCount.style.display = 'none';
    }
    
    const filterControls = document.querySelectorAll('.filter-control');
    filterControls.forEach(control => {
        const inputs = control.querySelectorAll('input, select');
        const hasValue = Array.from(inputs).some(input => input.value.trim() !== '');
        
        if (hasValue) {
            control.classList.add('has-value');
        } else {
            control.classList.remove('has-value');
        }
    });
}

function filterData() {
    const searchTerm = searchInput.value.toLowerCase();
    
    if (!searchTerm) {
        filteredData = [...excelData];
    } else {
        filteredData = excelData.filter(row => 
            Object.values(row).some(value => 
                String(value).toLowerCase().includes(searchTerm)
            )
        );
    }
    
    currentPage = 0;
    
    updateTableData();
    updateStats();
}

function sortData() {
    const sortColumn = sortSelect.value;
    
    if (!sortColumn) {
        filteredData = [...excelData];
    } else {
        filteredData.sort((a, b) => {
            const aVal = String(a[sortColumn] || '');
            const bVal = String(b[sortColumn] || '');
            
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
            
            return aVal.localeCompare(bVal);
        });
    }
    
    currentPage = 0;
    
    updateTableData();
}

function updateStats() {
    const totalRecords = excelData.length;
    const filteredRecords = filteredData.length;
    
    const totalRecordsElement = document.getElementById('total-records');
    const filteredRecordsElement = document.getElementById('filtered-records');
    const totalRecordsHeader = document.getElementById('total-records-header');
    const filteredRecordsHeader = document.getElementById('filtered-records-header');
    
    if (totalRecordsElement) totalRecordsElement.textContent = totalRecords;
    if (filteredRecordsElement) filteredRecordsElement.textContent = filteredRecords;
    if (totalRecordsHeader) totalRecordsHeader.textContent = totalRecords;
    if (filteredRecordsHeader) filteredRecordsHeader.textContent = filteredRecords;
    
    if (excelData.length > 0) {
        const stats = calculateIdoniStats();
        updateAdvancedStats(stats);
    }
}

function calculateIdoniStats() {
    const stats = {
        total: excelData.length,
        activos: 0,
        bloqueados: 0,
        internet: 0,
        destacados: 0,
        categorias: new Set(),
        proveedores: new Set(),
        precioProm: 0,
        precioMin: Infinity,
        precioMax: 0,
        costeProm: 0,
        costeMin: Infinity,
        costeMax: 0
    };
    let totalPrecio = 0;
    let conPrecio = 0;
    let totalCoste = 0;
    let conCoste = 0;
    
    excelData.forEach(row => {
        if (row[IDONI_COLUMNS.BLOQUEADO] === 'S') stats.bloqueados++;
        else stats.activos++;
        if (row[IDONI_COLUMNS.INTERNET] === 'S') stats.internet++;
        if (row[IDONI_COLUMNS.DESTACADO] === 'S') stats.destacados++;
        if (row[IDONI_COLUMNS.CATEGORIA]) stats.categorias.add(row[IDONI_COLUMNS.CATEGORIA]);
        if (row[IDONI_COLUMNS.PROVEEDOR]) stats.proveedores.add(row[IDONI_COLUMNS.PROVEEDOR]);
        
        const precio = parseFloat(row[IDONI_COLUMNS.PVP_DET]) || 0;
        if (precio > 0) {
            totalPrecio += precio;
            conPrecio++;
            stats.precioMin = Math.min(stats.precioMin, precio);
            stats.precioMax = Math.max(stats.precioMax, precio);
        }
        
        const coste = parseFloat(row[IDONI_COLUMNS.COSTO]) || 0;
        if (coste > 0) {
            totalCoste += coste;
            conCoste++;
            stats.costeMin = Math.min(stats.costeMin, coste);
            stats.costeMax = Math.max(stats.costeMax, coste);
        }
    });
    
    stats.precioProm = conPrecio > 0 ? totalPrecio / conPrecio : 0;
    stats.costeProm = conCoste > 0 ? totalCoste / conCoste : 0;
    stats.categorias = stats.categorias.size;
    stats.proveedores = stats.proveedores.size;
    return stats;
}

function updateAdvancedStats(stats) {
    const statsContainer = document.getElementById('stats-display');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <p>Total de productos: <span id="total-records">${stats.total}</span></p>
            <p>Productos filtrados: <span id="filtered-records">${filteredData.length}</span></p>
            <p>Activos: <span style="color: #4CAF50;">${stats.activos}</span> | Bloqueados: <span style="color: #f44336;">${stats.bloqueados}</span></p>
            <p>Internet: <span style="color: #2196F3;">${stats.internet}</span> | Destacados: <span style="color: #FF9800;">${stats.destacados}</span></p>
            <p>Categorías: <span style="color: #9C27B0;">${stats.categorias}</span> | Proveedores: <span style="color: #607D8B;">${stats.proveedores}</span></p>
            <p>Precio promedio: <span style="color: #4CAF50;">€${stats.precioProm.toFixed(2)}</span></p>
            <p>Rango de precios: <span style="color: #4CAF50;">€${stats.precioMin.toFixed(2)} - €${stats.precioMax.toFixed(2)}</span></p>
            <p>Coste promedio: <span style="color: #4CAF50;">€${stats.costeProm.toFixed(2)}</span></p>
            <p>Rango de costes: <span style="color: #4CAF50;">€${stats.costeMin.toFixed(2)} - €${stats.costeMax.toFixed(2)}</span></p>
        `;
    }
}

function enableExcelButtons() {
    saveDataBtn.disabled = false;
    clearDataBtn.disabled = false;
    if (toggleViewBtn) toggleViewBtn.disabled = false;
}

async function saveExcelData() {
    try {
        const dataToSave = {
            headers: Object.keys(excelData[0]).filter(key => key !== 'id'),
            data: excelData,
            timestamp: new Date().toISOString(),
            stats: calculateIdoniStats()
        };
        const filePath = await window.electronAPI.saveFile(dataToSave);
        if (filePath) {
            showNotification(`✅ Datos guardados exitosamente en: ${filePath}`, 'success');
        }
    } catch (error) {
        console.error('Error al guardar datos:', error);
        showNotification('❌ Error al guardar los datos.', 'error');
    }
}

function clearExcelData() {
    if (confirm('¿Estás seguro de que quieres limpiar todos los datos?')) {
        excelData = [];
        filteredData = [];
        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';
        idoniFilterControls.innerHTML = '';
        searchInput.value = '';
        sortSelect.innerHTML = '<option value="">Ordenar por...</option>';
        updateStats();
        updateActiveFiltersCount(0);
        saveDataBtn.disabled = true;
        clearDataBtn.disabled = true;
        saveDataLocally();
        
        isSimplifiedView = false;
        toggleViewBtn.innerHTML = '<i data-feather="list"></i> Vista Completa';
        toggleViewBtn.classList.remove('btn-warning');
        toggleViewBtn.classList.add('btn-info');
        // Vista simplificada usa los mismos estilos que la vista completa
        
        if (typeof dropZone !== 'undefined' && dropZone) {
            dropZone.style.display = 'block';
            dropZone.style.pointerEvents = 'auto';
            dropZone.style.zIndex = '1';
        }
        
        // Ocultar controles de tabla
        const tableControls = document.getElementById('table-controls');
        if (tableControls) {
            tableControls.style.display = 'none';
        }
        
        showNotification('🗑️ Todos los datos han sido limpiados', 'info');
    }
}

function toggleTableView() {
    const tableWrapper = document.querySelector('.table-wrapper');
    const dataTable = document.querySelector('.data-table');
    tableWrapper.classList.add('view-changing');
    setTimeout(() => {
        isSimplifiedView = !isSimplifiedView;
        if (isSimplifiedView) {
            toggleViewBtn.innerHTML = '<i data-feather="list"></i> Vista Completa';
            toggleViewBtn.classList.remove('btn-info');
            toggleViewBtn.classList.add('btn-warning');
            showSimplifiedView();
        } else {
            toggleViewBtn.innerHTML = '<i data-feather="grid"></i> Vista Simplificada';
            toggleViewBtn.classList.remove('btn-warning');
            toggleViewBtn.classList.add('btn-info');
            showFullView();
        }
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
        tableWrapper.classList.remove('view-changing');
        const viewType = isSimplifiedView ? 'simplificada' : 'completa';
        showNotification(`📊 Vista ${viewType} activada`, 'success');
    }, 150);
}

function showSimplifiedView() {
    if (!excelData.length) return;
    
    const allHeaders = Object.keys(excelData[0]).filter(key => key !== 'id');
    const availableSimplifiedColumns = SIMPLIFIED_COLUMNS.filter(col => allHeaders.includes(col));
    
    tableHeader.innerHTML = `
        <tr>
            ${availableSimplifiedColumns.map(header => `<th>${header}</th>`).join('')}
        </tr>
    `;
    
    currentPage = 0;
    updateTableData();
    
    sortSelect.innerHTML = '<option value="">Ordenar por...</option>';
    availableSimplifiedColumns.forEach(header => {
        sortSelect.innerHTML += `<option value="${header}">${header}</option>`;
    });
}

function showFullView() {
    if (!excelData.length) return;
    
    const allHeaders = Object.keys(excelData[0]).filter(key => key !== 'id');
    
    tableHeader.innerHTML = `
        <tr>
            ${allHeaders.map(header => `<th>${header}</th>`).join('')}
        </tr>
    `;
    
    currentPage = 0;
    updateTableData();
    
    sortSelect.innerHTML = '<option value="">Ordenar por...</option>';
    allHeaders.forEach(header => {
        sortSelect.innerHTML += `<option value="${header}">${header}</option>`;
    });
}

function updatePaginationControls() {
    let paginationContainer = document.getElementById('pagination-controls');
    const dataContent = document.querySelector('.data-content');

    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination-controls';
        paginationContainer.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: var(--background-light);
            border-top: 1px solid #e1efd6;
            margin-top: 0;
        `;
        if (dataContent) {
            dataContent.appendChild(paginationContainer);
        }
    } else {
        // Si ya existe, asegúrate de que esté al final de data-content
        if (dataContent && paginationContainer.parentElement !== dataContent) {
            dataContent.appendChild(paginationContainer);
        } else if (dataContent && dataContent.lastElementChild !== paginationContainer) {
            dataContent.appendChild(paginationContainer);
        }
    }

    const startRecord = currentPage * rowsPerPage + 1;
    const endRecord = Math.min((currentPage + 1) * rowsPerPage, filteredData.length);

    // Lógica para los números de página (máximo 5)
    let pageNumbersHtml = '';
    if (totalPages > 1) {
        let startPage = Math.max(0, currentPage - 2);
        let endPage = Math.min(totalPages - 1, currentPage + 2);
        if (currentPage <= 1) {
            endPage = Math.min(4, totalPages - 1);
        }
        if (currentPage >= totalPages - 2) {
            startPage = Math.max(0, totalPages - 5);
        }
        for (let i = startPage; i <= endPage; i++) {
            pageNumbersHtml += `<button class="page-number${i === currentPage ? ' active' : ''}" data-page="${i}">${i + 1}</button>`;
        }
    }

    // Eliminar color inline y usar solo clases
    paginationContainer.innerHTML = `
        <div class="pagination-info">
            Mostrando ${startRecord}-${endRecord} de ${filteredData.length} registros
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button id="prev-page" class="pagination-btn" ${currentPage === 0 ? 'disabled' : ''}>
                <i data-feather="chevron-left"></i> Anterior
            </button>
            <div class="page-numbers">${pageNumbersHtml}</div>
            <button id="next-page" class="pagination-btn" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>
                Siguiente <i data-feather="chevron-right"></i>
            </button>
        </div>
    `;

    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            updateTableData();
        }
    });

    document.getElementById('next-page')?.addEventListener('click', () => {
        if (currentPage < totalPages - 1) {
            currentPage++;
            updateTableData();
        }
    });

    // Números de página clicables
    paginationContainer.querySelectorAll('.page-number').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = parseInt(this.getAttribute('data-page'));
            if (!isNaN(page) && page !== currentPage) {
                currentPage = page;
                updateTableData();
            }
        });
    });

    // Renderizar iconos Feather
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

function initializeFilterTabs() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    const filterTabContents = document.querySelectorAll('.filter-tab-content');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            filterTabs.forEach(t => t.classList.remove('active'));
            filterTabContents.forEach(content => content.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
    
    setTimeout(() => {
        const priceInputs = document.querySelectorAll('.price-range input');
        priceInputs.forEach(input => {
            input.addEventListener('input', function(e) {
                let value = this.value;
                value = value.replace(/[^0-9,.-]/g, '');
                
                const parts = value.split(/[,.]/);
                if (parts.length > 2) {
                    value = parts[0] + '.' + parts.slice(1).join('');
                }
                
                this.value = value;
                updateActiveFiltersCount(0);
            });
            
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        });
        
        const textInputs = document.querySelectorAll('.filter-control input[type="text"]');
        textInputs.forEach(input => {
            input.addEventListener('input', function() {
                updateActiveFiltersCount(0);
            });
            
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        });
        
        const selectInputs = document.querySelectorAll('.filter-control select');
        selectInputs.forEach(select => {
            select.addEventListener('change', function() {
                updateActiveFiltersCount(0);
            });
        });
    }, 100);
}

function initializeFilterInputs() {
    const priceInputs = document.querySelectorAll('.price-range input');
    priceInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            let value = this.value;
            value = value.replace(/[^0-9,.-]/g, '');
            const parts = value.split(/[,.]/);
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            this.value = value;
            updateActiveFiltersCount(0);
        });
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
    });
    
    const textInputs = document.querySelectorAll('.filter-control input[type="text"]');
    textInputs.forEach(input => {
        input.addEventListener('input', function() {
            updateActiveFiltersCount(0);
        });
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
    });
    
    const selectInputs = document.querySelectorAll('.filter-control select');
    selectInputs.forEach(select => {
        select.addEventListener('change', function() {
            updateActiveFiltersCount(0);
        });
    });
}

function saveDataLocally() {
    const data = {
        excelData,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('idoni-excel-data', JSON.stringify(data));
}

function loadSavedData() {
    try {
        const savedExcelData = localStorage.getItem('idoni-excel-data');
        if (savedExcelData) {
            const data = JSON.parse(savedExcelData);
            excelData = data.excelData || [];
            filteredData = [...excelData];
            
            if (excelData.length > 0) {
                const headers = Object.keys(excelData[0]).filter(key => key !== 'id');
                updateTableHeaders(headers);
                updateTableData();
                updateFilterControls(headers);
                initializeFilterTabs();
                updateStats();
                enableExcelButtons();
                
                if (typeof dropZone !== 'undefined' && dropZone) {
                    dropZone.style.display = 'none';
                    dropZone.style.pointerEvents = 'none';
                    dropZone.style.zIndex = '-1';
                }
            }
        }
    } catch (error) {
        console.error('Error al cargar datos guardados:', error);
    }
}

function goBackToMainMenu() {
    window.close();
}

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

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando Excel Manager...');
    
    // Verificar que los elementos del DOM existen
    if (!loadExcelBtn) {
        console.error('Error: loadExcelBtn no encontrado');
        return;
    }
    
    if (!saveDataBtn) {
        console.error('Error: saveDataBtn no encontrado');
        return;
    }
    
    if (!clearDataBtn) {
        console.error('Error: clearDataBtn no encontrado');
        return;
    }
    
    if (!toggleViewBtn) {
        console.error('Error: toggleViewBtn no encontrado');
        return;
    }
    
    if (!searchInput) {
        console.error('Error: searchInput no encontrado');
        return;
    }
    
    if (!sortSelect) {
        console.error('Error: sortSelect no encontrado');
        return;
    }
    
    if (!applyFiltersBtn) {
        console.error('Error: applyFiltersBtn no encontrado');
        return;
    }
    
    if (!clearFiltersBtn) {
        console.error('Error: clearFiltersBtn no encontrado');
        return;
    }
    
    console.log('Todos los elementos del DOM encontrados, inicializando...');
    
    initializeExcelManager();
    initializeDragAndDrop();
    loadSavedData();
    
    // Renderizar iconos Feather
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    // Listener para el selector de filas por página del header
    const rowsPerPageSelect = document.getElementById('rows-per-page');
    if (rowsPerPageSelect) {
        rowsPerPageSelect.addEventListener('change', (e) => {
            let value = e.target.value;
            if (value === 'all') {
                rowsPerPage = filteredData.length > 0 ? filteredData.length : 1000000;
            } else {
                rowsPerPage = parseInt(value);
            }
            currentPage = 0;
            showLoadingIndicator();
            updateTableData();
        });
    }
    
    console.log('Excel Manager inicializado correctamente');
}); 