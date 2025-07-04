const { ipcRenderer } = require('electron');
const XLSX = require('xlsx');
const fs = require('fs');

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

// Variables globales
let excelData = [];
let filteredData = [];
let currentRecipe = null;
let savedRecipes = [];
let currentRecipeImage = null; // Imagen base64 temporal
let autoSaveInterval = null; // Intervalo de autoguardado
let selectedHistoryRecipe = null; // Ficha seleccionada en el historial

// Variables para virtualización
let visibleRows = [];
let currentPage = 0;
let rowsPerPage = 50; // Mostrar solo 50 filas a la vez
let totalPages = 0;
let isLoading = false;

// ==================== FUNCIONES DE INDICADOR DE CARGA ====================
// Función para mostrar indicador de carga
function showLoadingIndicator() {
    isLoading = true;
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.innerHTML = `
        <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.9);
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            text-align: center;
        ">
            <div style="
                width: 40px;
                height: 40px;
                border: 4px solid #e1efd6;
                border-top: 4px solid #ed1566;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            "></div>
            <div style="color: #405e47; font-weight: 600;">Cargando datos...</div>
        </div>
    `;
    
    const tableContainer = document.querySelector('.table-wrapper');
    if (tableContainer) {
        tableContainer.style.position = 'relative';
        tableContainer.appendChild(loadingDiv);
    }
}

// Función para ocultar indicador de carga
function hideLoadingIndicator() {
    isLoading = false;
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
    
    // Limpiar elementos que bloquean la interacción después de ocultar el indicador
    setTimeout(() => {
        clearInteractionBlockers();
    }, 100);
}

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
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');

// Excel Manager Elements
const loadExcelBtn = document.getElementById('load-excel');
const saveDataBtn = document.getElementById('save-data');
const clearDataBtn = document.getElementById('clear-data');
const toggleViewBtn = document.getElementById('toggle-view');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-column');
const idoniFilterControls = document.getElementById('idoni-filter-controls');
const priceFilterControls = document.getElementById('price-filter-controls');
const applyFiltersBtn = document.getElementById('apply-filters');
const clearFiltersBtn = document.getElementById('clear-filters');
const activeFiltersCount = document.getElementById('active-filters-count');
const statsDisplay = document.getElementById('stats-display');
const tableHeader = document.getElementById('table-header');
const tableBody = document.getElementById('table-body');
const dropZone = document.getElementById('drop-zone');

// Recipe Card Elements
const newRecipeBtn = document.getElementById('new-recipe');
const exportRecipeBtn = document.getElementById('export-recipe');
const printRecipeBtn = document.getElementById('print-recipe');
const recipeForm = document.getElementById('recipe-form');
const addIngredientBtn = document.getElementById('add-ingredient');
const recipePreview = document.getElementById('recipe-preview');
const previewContent = document.getElementById('preview-content');

// Variables de estado
let isSimplifiedView = false;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Splash screen saludo dinámico
    const greetingSpan = document.getElementById('splash-greeting');
    const hour = new Date().getHours();
    let saludo = 'Bienvenida Cristina';
    if (hour < 14) saludo = 'Buenos días, Cristina';
    else if (hour < 20) saludo = 'Buenas tardes, Cristina';
    else saludo = 'Buenas noches, Cristina';
    if (greetingSpan) greetingSpan.textContent = saludo;

    setTimeout(() => {
        document.getElementById('splash-screen').style.opacity = 0;
        setTimeout(() => {
            document.getElementById('splash-screen').style.display = 'none';
            document.querySelector('.app-container').style.display = '';
        }, 600);
    }, 2500);

    initializeTabs();
    initializeExcelManager();
    initializeRecipeCards();
    initializeDragAndDrop();
    loadSavedData();
    loadCustomizedColumns();
    
    // Añadir event listener adicional para el foco en la pestaña de fichas técnicas
    const recipeCardsTab = document.querySelector('[data-tab="recipe-cards"]');
    if (recipeCardsTab) {
        recipeCardsTab.addEventListener('click', () => {
            // Asegurar que el foco funcione después de un pequeño delay
            setTimeout(() => {
                const nameInput = document.getElementById('recipe-name');
                if (nameInput) {
                    nameInput.focus();
                    nameInput.readOnly = false;
                    nameInput.disabled = false;
                }
            }, 500);
        });
    }
    
    // Añadir event listeners específicos para el input de nombre
    const nameInput = document.getElementById('recipe-name');
    if (nameInput) {
        // Event listener para clic en el input
        nameInput.addEventListener('click', function(e) {
            console.log('Input clickeado');
            
            // Forzar el foco de manera más agresiva
            e.preventDefault();
            e.stopPropagation();
            
            // Remover foco de cualquier otro elemento
            if (document.activeElement && document.activeElement !== this) {
                document.activeElement.blur();
            }
            
            // Forzar el foco en el input
            this.focus();
            this.select();
            
            // Verificar el foco después de un pequeño delay
            setTimeout(() => {
                console.log('Elemento activo después del clic:', document.activeElement);
                console.log('¿Es el input activo?', document.activeElement === this);
                console.log('¿El input tiene foco?', this === document.activeElement);
                
                // Si aún no tiene foco, intentar de nuevo
                if (document.activeElement !== this) {
                    console.log('Reintentando foco...');
                    this.focus();
                    this.select();
                }
            }, 100);
        });
        
        // Event listener para foco en el input
        nameInput.addEventListener('focus', function(e) {
            console.log('Input enfocado');
        });
        
        // Event listener para cuando se pierde el foco
        nameInput.addEventListener('blur', function(e) {
            console.log('Input perdió el foco');
            console.log('Nuevo elemento activo:', document.activeElement);
        });
        
        // Event listener para cuando se intenta escribir
        nameInput.addEventListener('input', function(e) {
            console.log('Input recibiendo input:', e.target.value);
        });
        
        // Event listener para keydown
        nameInput.addEventListener('keydown', function(e) {
            console.log('Keydown en input:', e.key);
        });
        
        // Event listener para mousedown
        nameInput.addEventListener('mousedown', function(e) {
            console.log('Mousedown en input');
        });
    }
    
    // Función de debug para identificar elementos que bloquean la interacción
    function debugInteractionBlocking() {
        console.log('=== DEBUG INTERACTION ===');
        
        // Verificar todos los inputs del formulario
        const allInputs = document.querySelectorAll('#recipe-cards input, #recipe-cards textarea, #recipe-cards select');
        console.log('Total inputs en el formulario:', allInputs.length);
        
        allInputs.forEach((input, index) => {
            console.log(`--- Input ${index + 1}: ${input.id || input.className || input.type} ---`);
            console.log('Elemento:', input);
            console.log('Visible:', input.offsetParent !== null);
            console.log('Disabled:', input.disabled);
            console.log('ReadOnly:', input.readOnly);
            console.log('Z-index:', window.getComputedStyle(input).zIndex);
            console.log('Pointer-events:', window.getComputedStyle(input).pointerEvents);
            console.log('Position:', window.getComputedStyle(input).position);
            console.log('Opacity:', window.getComputedStyle(input).opacity);
            console.log('Visibility:', window.getComputedStyle(input).visibility);
            
            // Verificar elementos superpuestos de manera más robusta
            const rect = input.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                try {
                    const elementsAtPoint = document.elementsFromPoint(
                        rect.left + rect.width / 2,
                        rect.top + rect.height / 2
                    );
                    console.log('Elementos en el punto del input:', elementsAtPoint);
                    
                    // Verificar si el input está siendo bloqueado
                    if (elementsAtPoint.length > 0 && elementsAtPoint[0] !== input) {
                        console.log('⚠️ INPUT BLOQUEADO por:', elementsAtPoint[0]);
                        console.log('Bloqueador tagName:', elementsAtPoint[0].tagName);
                        console.log('Bloqueador className:', elementsAtPoint[0].className);
                        console.log('Bloqueador id:', elementsAtPoint[0].id);
                        console.log('Bloqueador pointer-events:', window.getComputedStyle(elementsAtPoint[0]).pointerEvents);
                    }
                } catch (error) {
                    console.log('Error al verificar elementos en punto:', error);
                }
            } else {
                console.log('⚠️ Input no tiene dimensiones válidas');
            }
        });
        
        // Verificar elementos que cubren todo el formulario
        const recipeForm = document.getElementById('recipe-form');
        if (recipeForm) {
            const formRect = recipeForm.getBoundingClientRect();
            console.log('=== VERIFICANDO ELEMENTOS SOBRE EL FORMULARIO ===');
            console.log('Formulario rect:', formRect);
            
            // Verificar elementos en varios puntos del formulario
            const testPoints = [
                { x: formRect.left + 50, y: formRect.top + 50 },
                { x: formRect.left + formRect.width / 2, y: formRect.top + formRect.height / 2 },
                { x: formRect.right - 50, y: formRect.bottom - 50 }
            ];
            
            testPoints.forEach((point, index) => {
                try {
                    const elementsAtPoint = document.elementsFromPoint(point.x, point.y);
                    console.log(`Punto ${index + 1} (${point.x}, ${point.y}):`, elementsAtPoint[0]);
                    if (elementsAtPoint[0]) {
                        console.log(`  - TagName: ${elementsAtPoint[0].tagName}`);
                        console.log(`  - ClassName: ${elementsAtPoint[0].className}`);
                        console.log(`  - ID: ${elementsAtPoint[0].id}`);
                        console.log(`  - Pointer-events: ${window.getComputedStyle(elementsAtPoint[0]).pointerEvents}`);
                    }
                } catch (error) {
                    console.log(`Error en punto ${index + 1}:`, error);
                }
            });
        }
        
        // Verificar elementos con pointer-events: none
        const allElements = document.querySelectorAll('*');
        const blockingElements = [];
        allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.pointerEvents === 'none' && 
                el.offsetParent !== null && 
                el.getBoundingClientRect().width > 0 && 
                el.getBoundingClientRect().height > 0) {
                blockingElements.push({
                    element: el,
                    tagName: el.tagName,
                    className: el.className,
                    id: el.id,
                    rect: el.getBoundingClientRect()
                });
            }
        });
        console.log('Elementos con pointer-events: none:', blockingElements);
        
        // Verificar elementos con position: fixed que puedan estar bloqueando
        const fixedElements = [];
        allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' && 
                el.id !== 'splash-screen' &&
                !el.classList.contains('notification')) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    fixedElements.push({
                        element: el,
                        tagName: el.tagName,
                        className: el.className,
                        id: el.id,
                        rect: rect,
                        pointerEvents: style.pointerEvents
                    });
                }
            }
        });
        console.log('Elementos con position: fixed:', fixedElements);
    }
    
    // Exponer función de debug globalmente
    window.debugInteraction = debugInteractionBlocking;
    
    // Función para limpiar elementos que bloquean la interacción
    function clearInteractionBlockers() {
        console.log('Limpiando elementos bloqueadores...');
        
        // Remover indicador de carga si existe
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        // Asegurar que la tabla no esté en estado de carga
        const dataTable = document.querySelector('.data-table');
        if (dataTable) {
            dataTable.classList.remove('loading');
        }
        
        // LIMPIEZA AGRESIVA: Remover todos los elementos que puedan estar bloqueando
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            
            // Restaurar pointer-events en elementos con none
            if (style.pointerEvents === 'none' && 
                el.offsetParent !== null && 
                el.getBoundingClientRect().width > 0 && 
                el.getBoundingClientRect().height > 0 &&
                el.id !== 'splash-screen') {
                el.style.pointerEvents = 'auto';
                console.log('Restaurando pointer-events en:', el);
            }
            
            // Remover cualquier z-index muy alto que pueda estar interfiriendo
            if (style.zIndex !== 'auto' && parseInt(style.zIndex) > 10000) {
                el.style.zIndex = 'auto';
                console.log('Restaurando z-index en:', el);
            }
            
            // Asegurar que elementos con position: fixed no estén bloqueando
            if (style.position === 'fixed' && 
                el.id !== 'splash-screen' &&
                !el.classList.contains('notification')) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    el.style.pointerEvents = 'auto';
                    console.log('Habilitando elemento fixed:', el);
                }
            }
        });
        
        // LIMPIEZA ESPECÍFICA DEL FORMULARIO
        const recipeCardsPanel = document.getElementById('recipe-cards');
        if (recipeCardsPanel) {
            // Asegurar que el panel esté completamente visible y accesible
            recipeCardsPanel.style.pointerEvents = 'auto';
            recipeCardsPanel.style.zIndex = 'auto';
            recipeCardsPanel.style.position = 'relative';
            
            // Limpiar todos los elementos hijos del panel
            const childElements = recipeCardsPanel.querySelectorAll('*');
            childElements.forEach(el => {
                const style = window.getComputedStyle(el);
                
                // Restaurar pointer-events
                if (style.pointerEvents === 'none') {
                    el.style.pointerEvents = 'auto';
                    console.log('Restaurando pointer-events en hijo del panel:', el);
                }
                
                // Asegurar que inputs sean interactivos
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                    el.style.pointerEvents = 'auto';
                    el.style.zIndex = '9999';
                    el.disabled = false;
                    el.readOnly = false;
                    console.log('Habilitando input específico:', el.id || el.className || el.type);
                }
            });
        }
        
        // LIMPIEZA DE ELEMENTOS TEMPORALES
        // Remover cualquier elemento temporal que pueda estar bloqueando
        const tempElements = document.querySelectorAll('[style*="position: absolute"][style*="left: -9999px"]');
        tempElements.forEach(el => {
            el.remove();
            console.log('Removido elemento temporal:', el);
        });
        
        // Asegurar que todos los inputs del formulario sean interactivos
        const allInputs = document.querySelectorAll('#recipe-cards input, #recipe-cards textarea, #recipe-cards select');
        allInputs.forEach(input => {
            input.style.pointerEvents = 'auto';
            input.style.zIndex = '9999';
            input.disabled = false;
            input.readOnly = false;
            input.style.position = 'static';
            input.style.opacity = '1';
            input.style.visibility = 'visible';
            console.log('Habilitando input final:', input.id || input.className || input.type);
        });
        
        // Forzar un reflow del DOM
        document.body.offsetHeight;
    }
    
    // Exponer función de limpieza globalmente
    window.clearBlockers = clearInteractionBlockers;
    
    // Función para simular interacción externa y activar el foco
    function simulateExternalInteraction() {
        console.log('Simulando interacción externa...');
        
        // Crear un elemento temporal y enfocarlo
        const tempElement = document.createElement('input');
        tempElement.type = 'text';
        tempElement.style.position = 'absolute';
        tempElement.style.left = '-9999px';
        tempElement.style.top = '-9999px';
        document.body.appendChild(tempElement);
        
        // Enfocar el elemento temporal
        tempElement.focus();
        
        // Después de un pequeño delay, enfocar el input real
        setTimeout(() => {
            const nameInput = document.getElementById('recipe-name');
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
            }
            
            // Remover el elemento temporal
            document.body.removeChild(tempElement);
        }, 50);
    }
    
    // Función para forzar el foco de manera agresiva
    function forceFocusAggressively() {
        console.log('Forzando foco de manera agresiva...');
        
        const nameInput = document.getElementById('recipe-name');
        if (!nameInput) {
            console.log('No se encontró el input recipe-name');
            return;
        }
        
        // Método 1: Enfoque directo
        try {
            nameInput.focus();
            console.log('Foco directo aplicado');
        } catch (e) {
            console.log('Error en foco directo:', e);
        }
        
        // Método 2: Click + focus
        setTimeout(() => {
            try {
                nameInput.click();
                nameInput.focus();
                console.log('Click + focus aplicado');
            } catch (e) {
                console.log('Error en click + focus:', e);
            }
        }, 100);
        
        // Método 3: Simular eventos de teclado
        setTimeout(() => {
            try {
                const focusEvent = new Event('focus', { bubbles: true });
                const clickEvent = new Event('click', { bubbles: true });
                nameInput.dispatchEvent(focusEvent);
                nameInput.dispatchEvent(clickEvent);
                console.log('Eventos simulados aplicados');
            } catch (e) {
                console.log('Error en eventos simulados:', e);
            }
        }, 200);
        
        // Método 4: Forzar mediante tabindex
        setTimeout(() => {
            try {
                nameInput.tabIndex = 1;
                nameInput.focus();
                console.log('Tabindex + focus aplicado');
            } catch (e) {
                console.log('Error en tabindex + focus:', e);
            }
        }, 300);
        
        // Método 5: Verificar si el foco se estableció
        setTimeout(() => {
            console.log('Elemento activo final:', document.activeElement);
            console.log('¿Es el input activo?', document.activeElement === nameInput);
            if (document.activeElement !== nameInput) {
                console.log('⚠️ El foco no se estableció correctamente');
            } else {
                console.log('✅ Foco establecido correctamente');
            }
        }, 400);
    }
    
    // Exponer funciones globalmente
    window.simulateExternal = simulateExternalInteraction;
    window.forceFocusAggressively = forceFocusAggressively;
    
    // Función para verificar elementos invisibles que bloquean
    function checkInvisibleBlockers() {
        console.log('=== VERIFICANDO ELEMENTOS INVISIBLES ===');
        
        const recipeCardsPanel = document.getElementById('recipe-cards');
        if (!recipeCardsPanel) return;
        
        const panelRect = recipeCardsPanel.getBoundingClientRect();
        console.log('Panel recipe-cards:', panelRect);
        
        // Verificar elementos en varios puntos del panel
        const testPoints = [
            { x: panelRect.left + 100, y: panelRect.top + 100 },
            { x: panelRect.left + panelRect.width / 2, y: panelRect.top + panelRect.height / 2 },
            { x: panelRect.right - 100, y: panelRect.bottom - 100 }
        ];
        
        testPoints.forEach((point, index) => {
            const elementsAtPoint = document.elementsFromPoint(point.x, point.y);
            console.log(`Punto ${index + 1} (${point.x}, ${point.y}):`, elementsAtPoint[0]);
            
            // Si el primer elemento no es el panel o un hijo del panel, hay un problema
            if (!recipeCardsPanel.contains(elementsAtPoint[0]) && elementsAtPoint[0] !== recipeCardsPanel) {
                console.log('⚠️ ELEMENTO EXTERNO BLOQUEANDO en punto', index + 1, ':', elementsAtPoint[0]);
            }
        });
        
        // Buscar elementos con position: fixed o absolute que puedan estar bloqueando
        const allElements = document.querySelectorAll('*');
        const potentialBlockers = [];
        allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            if ((style.position === 'fixed' || style.position === 'absolute') &&
                el.offsetParent !== null &&
                el.getBoundingClientRect().width > 0 &&
                el.getBoundingClientRect().height > 0) {
                
                const rect = el.getBoundingClientRect();
                // Verificar si este elemento se superpone con el panel
                if (rect.left < panelRect.right && rect.right > panelRect.left &&
                    rect.top < panelRect.bottom && rect.bottom > panelRect.top) {
                    potentialBlockers.push({
                        element: el,
                        rect: rect,
                        zIndex: style.zIndex,
                        pointerEvents: style.pointerEvents
                    });
                }
            }
        });
        
        console.log('Elementos potencialmente bloqueadores:', potentialBlockers);
    }
    
    // Exponer función globalmente
    window.checkInvisibleBlockers = checkInvisibleBlockers;
    
    // Event listener global para detectar eventos cancelados
    document.addEventListener('click', function(e) {
        if (e.target.id === 'recipe-name') {
            console.log('Click global detectado en recipe-name');
        }
        
        // Detectar clics en cualquier input del formulario
        if (e.target.matches('#recipe-cards input, #recipe-cards textarea, #recipe-cards select')) {
            console.log('Click global detectado en input del formulario:', e.target.id || e.target.className || e.target.type);
        }
    }, true);
    
    document.addEventListener('mousedown', function(e) {
        if (e.target.id === 'recipe-name') {
            console.log('Mousedown global detectado en recipe-name');
        }
        
        // Detectar mousedown en cualquier input del formulario
        if (e.target.matches('#recipe-cards input, #recipe-cards textarea, #recipe-cards select')) {
            console.log('Mousedown global detectado en input del formulario:', e.target.id || e.target.className || e.target.type);
        }
    }, true);
    
    // Detectar si algún elemento está capturando todos los clics
    document.addEventListener('click', function(e) {
        // Si el clic no es en un input pero estamos en la pestaña de fichas técnicas
        if (!e.target.matches('#recipe-cards input, #recipe-cards textarea, #recipe-cards select, #recipe-cards button') &&
            document.querySelector('#recipe-cards.active')) {
            console.log('Click detectado fuera de inputs en formulario:', e.target);
        }
    }, true);
    
    // Detectar si algún evento se está cancelando
    const originalPreventDefault = Event.prototype.preventDefault;
    Event.prototype.preventDefault = function() {
        if (this.target && this.target.id === 'recipe-name') {
            console.log('Evento preventDefault detectado en recipe-name:', this.type);
        }
        return originalPreventDefault.call(this);
    };
    
    // Event listener para cuando la ventana gana el foco
    window.addEventListener('focus', function() {
        console.log('Ventana ganó el foco');
        // Si estamos en la pestaña de fichas técnicas, enfocar el input
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'recipe-cards') {
            setTimeout(() => {
                const nameInput = document.getElementById('recipe-name');
                if (nameInput) {
                    nameInput.focus();
                }
            }, 100);
        }
    });
    
    // Event listener para cuando la ventana pierde el foco
    window.addEventListener('blur', function() {
        console.log('Ventana perdió el foco');
    });
    
    // Añadir botón de debug temporal (solo en desarrollo)
    const debugButton = document.createElement('button');
    debugButton.textContent = '🐛 Debug';
    debugButton.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 10000;
        padding: 5px 10px;
        background: #ff6b6b;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;
    debugButton.onclick = () => {
        debugInteractionBlocking();
        checkInvisibleBlockers();
        clearInteractionBlockers();
        simulateExternalInteraction();
        forceFocusAggressively();
        recreateFormCompletely();
        console.log('Debug completo ejecutado. Revisa la consola.');
    };
    document.body.appendChild(debugButton);
    
    // Añadir botón para activar foco
    const focusButton = document.createElement('button');
    focusButton.textContent = '🎯 Activar Foco';
    focusButton.style.cssText = `
        position: fixed;
        top: 40px;
        left: 10px;
        z-index: 10000;
        padding: 5px 10px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;
    focusButton.onclick = () => {
        simulateExternalInteraction();
        forceFocusAggressively();
        console.log('Foco activado manualmente.');
    };
    document.body.appendChild(focusButton);
    
    // Añadir botón para forzar foco agresivamente
    const aggressiveFocusButton = document.createElement('button');
    aggressiveFocusButton.textContent = '⚡ Foco Agresivo';
    aggressiveFocusButton.style.cssText = `
        position: fixed;
        top: 70px;
        left: 10px;
        z-index: 10000;
        padding: 5px 10px;
        background: #FF5722;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;
    aggressiveFocusButton.onclick = () => {
        clearInteractionBlockers();
        forceFocusAggressively();
        console.log('Foco agresivo aplicado.');
    };
    document.body.appendChild(aggressiveFocusButton);
    
    // Añadir botón para recrear formulario completamente
    const recreateFormButton = document.createElement('button');
    recreateFormButton.textContent = '🔄 Recrear Formulario';
    recreateFormButton.style.cssText = `
        position: fixed;
        top: 100px;
        left: 10px;
        z-index: 10000;
        padding: 5px 10px;
        background: #9C27B0;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;
    recreateFormButton.onclick = () => {
        recreateFormCompletely();
        console.log('Formulario recreado completamente.');
    };
    document.body.appendChild(recreateFormButton);

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

    // Inicializar atajos de teclado
    initializeKeyboardShortcuts();
});

// Función para inicializar atajos de teclado
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Solo activar si no estamos en un input o textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        // Ctrl+S: Guardar ficha
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (currentRecipe || document.getElementById('recipe-name').value.trim()) {
                if (saveRecipeInternal()) {
                    showNotification('Ficha técnica guardada exitosamente.', 'success');
                }
            }
        }

        // Ctrl+N: Nueva ficha
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            createNewRecipe();
            showNotification('Nueva ficha técnica creada', 'info');
        }

        // Ctrl+D: Duplicar ficha seleccionada del historial
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            if (selectedHistoryRecipe !== null) {
                duplicateSelectedRecipe();
            } else {
                showNotification('ℹ️ Selecciona una ficha del historial para duplicar', 'info');
            }
        }

        // Escape: Limpiar selección del historial
        if (e.key === 'Escape') {
            const selectedRow = document.querySelector('.history-table tbody tr.selected');
            if (selectedRow) {
                selectedRow.classList.remove('selected');
                selectedHistoryRecipe = null;
                const duplicateBtn = document.getElementById('duplicate-recipe');
                if (duplicateBtn) {
                    duplicateBtn.disabled = true;
                }
            }
        }
    });
}

// Cargar columnas personalizadas
function loadCustomizedColumns() {
    try {
        // Limpiar localStorage para resetear configuración
        localStorage.removeItem('idoni-simplified-columns');
        
        // Usar las columnas por defecto definidas en SIMPLIFIED_COLUMNS
        console.log('Columnas simplificadas reseteadas a configuración por defecto');
    } catch (error) {
        console.error('Error al cargar columnas personalizadas:', error);
    }
}

// ==================== GESTIÓN DE PESTAÑAS ====================
function initializeTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
}

function switchTab(tabName) {
    // Remover clase active y animaciones de todas las pestañas
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabPanels.forEach(panel => {
        panel.classList.remove('active', 'tab-panel-anim-in', 'tab-panel-anim-out');
    });

    // Animar el panel actual (fade out)
    const currentPanel = document.querySelector('.tab-panel.active');
    if (currentPanel) {
        currentPanel.classList.add('tab-panel-anim-out');
        setTimeout(() => {
            currentPanel.classList.remove('tab-panel-anim-out', 'active');
        }, 400);
    }

    // Activar pestaña seleccionada y animar (fade in)
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    const newPanel = document.getElementById(tabName);
    newPanel.classList.add('active', 'tab-panel-anim-in');
    
    // Manejar el foco inmediatamente y después de la animación
    if (tabName === 'recipe-cards') {
        // Limpiar elementos que bloquean la interacción
        clearInteractionBlockers();
        
        // Forzar el foco de múltiples maneras
        const forceFocus = () => {
            const nameInput = document.getElementById('recipe-name');
            if (nameInput) {
                // Remover cualquier evento que pueda estar interfiriendo
                nameInput.blur();
                
                // Asegurar que el input sea editable
                nameInput.readOnly = false;
                nameInput.disabled = false;
                nameInput.style.pointerEvents = 'auto';
                nameInput.style.zIndex = '9999';
                nameInput.style.position = 'static';
                nameInput.style.opacity = '1';
                nameInput.style.visibility = 'visible';
                
                // Intentar múltiples métodos de foco
                try {
                    nameInput.focus();
                    nameInput.click();
                    nameInput.select();
                } catch (e) {
                    console.log('Error al enfocar input:', e);
                }
                
                // Hacer scroll al input
                nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Verificar si el foco se estableció
                setTimeout(() => {
                    if (document.activeElement !== nameInput) {
                        console.log('Foco no se estableció, intentando de nuevo...');
                        nameInput.focus();
                        nameInput.click();
                    }
                }, 50);
            }
        };
        
        // Intentar enfocar inmediatamente
        setTimeout(forceFocus, 100);
        
        // Intentar enfocar después de la animación
        setTimeout(forceFocus, 450);
        
        // Intentar enfocar una vez más después de un delay más largo
        setTimeout(forceFocus, 1000);
        
        // Usar la función agresiva de foco como respaldo
        setTimeout(() => {
            forceFocusAggressively();
        }, 1500);
    }
    
    setTimeout(() => {
        newPanel.classList.remove('tab-panel-anim-in');
    }, 400);

    // --- CONTROL DE VISIBILIDAD DE DROPZONE ---
    if (typeof dropZone !== 'undefined' && dropZone) {
        if (tabName === 'excel-manager') {
            // Solo mostrar si NO hay datos cargados
            if (excelData.length === 0) {
                dropZone.style.display = 'block';
                dropZone.style.pointerEvents = 'auto';
                dropZone.style.zIndex = '1';
            } else {
                dropZone.style.display = 'none';
                dropZone.style.pointerEvents = 'none';
                dropZone.style.zIndex = '-1';
            }
        } else {
            // Ocultar siempre en otras pestañas
            dropZone.style.display = 'none';
            dropZone.style.pointerEvents = 'none';
            dropZone.style.zIndex = '-1';
        }
    }
}

// ==================== ARRASTRAR Y SOLTAR ====================
function initializeDragAndDrop() {
    // Prevenir comportamiento por defecto del navegador
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Efectos visuales durante el arrastre
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    // Manejar el archivo soltado
    dropZone.addEventListener('drop', handleDrop, false);
    
    // Click en el área de drop
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
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
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
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
            showNotification('❌ El archivo Excel debe tener al menos una fila de encabezados y una fila de datos.', 'error');
            return;
        }

        // Procesar datos
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
        
        // Actualizar interfaz
        updateTableHeaders(headers);
        updateTableData();
        updateFilterControls(headers);
        initializeFilterTabs(); // <-- Añadir esto tras actualizar los controles de filtros
        updateStats();
        enableExcelButtons();
        
        // Guardar datos localmente
        saveDataLocally();
        
        // Ocultar área de drop si hay datos
        if (excelData.length > 0) {
            dropZone.style.display = 'none';
            dropZone.style.pointerEvents = 'none';
            dropZone.style.zIndex = '-1';
        }
        
        // Asegurar que el foco funcione correctamente si estamos en la pestaña de fichas técnicas
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'recipe-cards') {
            setTimeout(() => {
                const nameInput = document.getElementById('recipe-name');
                if (nameInput) {
                    nameInput.focus();
                    nameInput.readOnly = false;
                    nameInput.disabled = false;
                }
            }, 100);
        }
        
        // Notificación personalizada
        // showExcelLoadSuccess(excelData.length, file.name || '');
        
    } catch (error) {
        console.error('Error al procesar archivo Excel:', error);
        showNotification('Error al procesar el archivo Excel. Verifica que sea un archivo válido.', 'error');
    }
}

// ==================== GESTOR DE EXCEL ====================
function initializeExcelManager() {
    loadExcelBtn.addEventListener('click', loadExcelFile);
    saveDataBtn.addEventListener('click', saveExcelData);
    clearDataBtn.addEventListener('click', clearExcelData);
    toggleViewBtn.addEventListener('click', toggleTableView);
    searchInput.addEventListener('input', filterData);
    sortSelect.addEventListener('change', sortData);
    applyFiltersBtn.addEventListener('click', applyFilters);
    clearFiltersBtn.addEventListener('click', clearAllFilters);
}

async function loadExcelFile() {
    try {
        const filePath = await ipcRenderer.invoke('select-file');
        if (!filePath) return;

        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
            showNotification('❌ El archivo Excel debe tener al menos una fila de encabezados y una fila de datos.', 'error');
            return;
        }

        // Procesar datos
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
        
        // Actualizar interfaz
        updateTableHeaders(headers);
        updateTableData();
        updateFilterControls(headers);
        initializeFilterTabs(); // <-- Añadir esto tras actualizar los controles de filtros
        updateStats();
        enableExcelButtons();
        
        // Guardar datos localmente
        saveDataLocally();
        
        // Ocultar área de drop si hay datos
        if (excelData.length > 0) {
            dropZone.style.display = 'none';
            dropZone.style.pointerEvents = 'none';
            dropZone.style.zIndex = '-1';
        }
        
        // Asegurar que el foco funcione correctamente si estamos en la pestaña de fichas técnicas
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'recipe-cards') {
            setTimeout(() => {
                const nameInput = document.getElementById('recipe-name');
                if (nameInput) {
                    nameInput.focus();
                    nameInput.readOnly = false;
                    nameInput.disabled = false;
                }
            }, 100);
        }
        
        alert(`✅ Archivo cargado exitosamente. ${excelData.length} productos encontrados.`);
        
    } catch (error) {
        console.error('Error al cargar archivo Excel:', error);
        showNotification('Error al cargar el archivo Excel. Verifica que sea un archivo válido.', 'error');
    }
}

function updateTableHeaders(headers) {
    if (isSimplifiedView) {
        // En vista simplificada, mostrar solo las columnas disponibles
        const availableSimplifiedColumns = SIMPLIFIED_COLUMNS.filter(col => headers.includes(col));
        tableHeader.innerHTML = `
            <tr>
                ${availableSimplifiedColumns.map(header => `<th>${header}</th>`).join('')}
            </tr>
        `;
        
        // Actualizar opciones de ordenamiento
        sortSelect.innerHTML = '<option value="">Ordenar por...</option>';
        availableSimplifiedColumns.forEach(header => {
            sortSelect.innerHTML += `<option value="${header}">${header}</option>`;
        });
    } else {
        // Vista completa
        tableHeader.innerHTML = `
            <tr>
                ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
        `;
        
        // Actualizar opciones de ordenamiento
        sortSelect.innerHTML = '<option value="">Ordenar por...</option>';
        headers.forEach(header => {
            sortSelect.innerHTML += `<option value="${header}">${header}</option>`;
        });
    }
}

function updateTableData() {
    if (!excelData.length) return;
    
    // Mostrar indicador de carga
    showLoadingIndicator();
    
    // Usar setTimeout para permitir que el navegador respire
    setTimeout(() => {
        const allHeaders = Object.keys(excelData[0]).filter(key => key !== 'id');
        
        // Calcular paginación
        totalPages = Math.ceil(filteredData.length / rowsPerPage);
        // currentPage = 0; // <-- ELIMINADA para que la paginación funcione
        
        // Obtener solo las filas visibles
        const startIndex = currentPage * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        visibleRows = filteredData.slice(startIndex, endIndex);
        
        if (isSimplifiedView) {
            // En vista simplificada, mostrar solo las columnas disponibles
            const availableSimplifiedColumns = SIMPLIFIED_COLUMNS.filter(col => allHeaders.includes(col));
            
            // Renderizar filas en lotes para mejor rendimiento
            renderTableRowsOptimized(visibleRows, availableSimplifiedColumns);
        } else {
            // Vista completa
            renderTableRowsOptimized(visibleRows, allHeaders);
        }
        
        // Ocultar indicador de carga
        hideLoadingIndicator();
        
        // Actualizar controles de paginación
        updatePaginationControls();
        
    }, 10); // Pequeño delay para permitir que la UI se actualice
}

// Función optimizada para renderizar filas de tabla
function renderTableRowsOptimized(rows, headers) {
    // Crear fragmento para mejor rendimiento
    const fragment = document.createDocumentFragment();
    
    // Procesar filas en lotes
    const batchSize = 10;
    let currentBatch = 0;
    
    function processBatch() {
        const start = currentBatch * batchSize;
        const end = Math.min(start + batchSize, rows.length);
        
        for (let i = start; i < end; i++) {
            const row = rows[i];
            const tr = document.createElement('tr');
            
            // Datos de la fila (sin ID)
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
            // Procesar siguiente lote
            requestAnimationFrame(processBatch);
        } else {
            // Finalizar renderizado
            tableBody.innerHTML = '';
            tableBody.appendChild(fragment);
        }
    }
    
    // Iniciar procesamiento por lotes
    processBatch();
}

// Función optimizada para formatear contenido de celdas
function formatTableCellContent(value, columnName) {
    // Asegurar que el valor sea una cadena y manejar valores null/undefined
    const cellValue = value !== null && value !== undefined ? String(value) : '';
    
    // Detectar si es un valor numérico (precios, costes, etc.)
    if (isNumericColumn(columnName)) {
        const numericValue = parseFloat(cellValue);
        if (!isNaN(numericValue)) {
            return `<span data-numeric="true" title="${cellValue}">${formatNumber(numericValue)}</span>`;
        }
    }
    
    // Detectar estados específicos
    if (isStatusColumn(columnName)) {
        const status = getStatusValue(cellValue, columnName);
        if (status) {
            return `<span data-status="${status.type}" title="${cellValue}">${status.display}</span>`;
        }
    }
    
    // Detectar códigos
    if (isCodeColumn(columnName)) {
        return `<span data-type="code" title="${cellValue}">${cellValue}</span>`;
    }
    
    // Detectar descripciones
    if (isDescriptionColumn(columnName)) {
        return `<span data-type="description" title="${cellValue}">${truncateText(cellValue, 40)}</span>`;
    }
    
    // Texto normal con truncamiento
    return `<span title="${cellValue}">${truncateText(cellValue, 25)}</span>`;
}

// Función para detectar columnas numéricas
function isNumericColumn(columnName) {
    const numericColumns = [
        'PVP Det.', 'PVP Maj.', 'Preu Cost', 'Ult.Pr.Cost', 'Cost+IVA',
        'Marge Det.', 'Marge Maj.', 'Estoc Mín.', 'IVA'
    ];
    return numericColumns.includes(columnName);
}

// Función para detectar columnas de estado
function isStatusColumn(columnName) {
    const statusColumns = ['Bloquejat', 'Internet', 'Destacat'];
    return statusColumns.includes(columnName);
}

// Función para detectar columnas de códigos
function isCodeColumn(columnName) {
    const codeColumns = ['Codi', 'C.Prov.', 'C.Fam.'];
    return codeColumns.includes(columnName);
}

// Función para detectar columnas de descripciones
function isDescriptionColumn(columnName) {
    const descriptionColumns = ['Descripció', 'Nom Família', 'Grup'];
    return descriptionColumns.includes(columnName);
}

// Función para obtener el valor de estado formateado
function getStatusValue(value, columnName) {
    // Asegurar que el valor sea una cadena
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

// Función para formatear números
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

// Función para truncar texto largo
function truncateText(text, maxLength) {
    // Convertir a string y manejar valores null/undefined
    const textStr = String(text || '');
    if (textStr.length <= maxLength) return textStr;
    return textStr.substring(0, maxLength) + '...';
}

function updateFilterControls(headers) {
    // Filtros rápidos IDONI
    let idoniFilters = '';
    // Categoría
    if (headers.includes(IDONI_COLUMNS.CATEGORIA)) {
        const categorias = [...new Set(excelData.map(row => row[IDONI_COLUMNS.CATEGORIA]).filter(Boolean))];
        idoniFilters += `<div class="filter-control"><label>${IDONI_COLUMNS.CATEGORIA}:</label><select data-column="${IDONI_COLUMNS.CATEGORIA}"><option value="">Todas las categorías</option>${categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('')}</select></div>`;
    }
    // Proveedor
    if (headers.includes(IDONI_COLUMNS.PROVEEDOR)) {
        const proveedores = [...new Set(excelData.map(row => row[IDONI_COLUMNS.PROVEEDOR]).filter(Boolean))];
        idoniFilters += `<div class="filter-control"><label>${IDONI_COLUMNS.PROVEEDOR}:</label><select data-column="${IDONI_COLUMNS.PROVEEDOR}"><option value="">Todos los proveedores</option>${proveedores.map(prov => `<option value="${prov}">${prov}</option>`).join('')}</select></div>`;
    }
    // Familia
    if (headers.includes(IDONI_COLUMNS.FAMILIA)) {
        const familias = [...new Set(excelData.map(row => row[IDONI_COLUMNS.FAMILIA]).filter(Boolean))];
        idoniFilters += `<div class="filter-control"><label>${IDONI_COLUMNS.FAMILIA}:</label><select data-column="${IDONI_COLUMNS.FAMILIA}"><option value="">Todas las familias</option>${familias.map(fam => `<option value="${fam}">${fam}</option>`).join('')}</select></div>`;
    }
    // Estado (Bloqueado)
    if (headers.includes(IDONI_COLUMNS.BLOQUEADO)) {
        idoniFilters += `<div class="filter-control"><label>Estado:</label><select data-column="${IDONI_COLUMNS.BLOQUEADO}"><option value="">Todos los estados</option><option value="S">Bloqueados</option><option value="N">Activos</option></select></div>`;
    }
    // Internet
    if (headers.includes(IDONI_COLUMNS.INTERNET)) {
        idoniFilters += `<div class="filter-control"><label>Internet:</label><select data-column="${IDONI_COLUMNS.INTERNET}"><option value="">Todos</option><option value="S">Disponible en Internet</option><option value="N">No disponible en Internet</option></select></div>`;
    }
    // Destacado
    if (headers.includes(IDONI_COLUMNS.DESTACADO)) {
        idoniFilters += `<div class="filter-control"><label>Destacado:</label><select data-column="${IDONI_COLUMNS.DESTACADO}"><option value="">Todos</option><option value="S">Solo destacados</option></select></div>`;
    }
    
    idoniFilterControls.innerHTML = idoniFilters;
    
    
    // Filtros de precios
    let priceFilters = '';
    if (headers.includes(IDONI_COLUMNS.PVP_DET)) {
        priceFilters += `<div class="filter-control"><label>Rango PVP Det.:</label><div class="price-range"><input type="text" placeholder="Mínimo" data-column="${IDONI_COLUMNS.PVP_DET}_min"><span>-</span><input type="text" placeholder="Máximo" data-column="${IDONI_COLUMNS.PVP_DET}_max"></div></div>`;
    }
    if (headers.includes(IDONI_COLUMNS.PVP_MAJ)) {
        priceFilters += `<div class="filter-control"><label>Rango PVP Maj.:</label><div class="price-range"><input type="text" placeholder="Mínimo" data-column="${IDONI_COLUMNS.PVP_MAJ}_min"><span>-</span><input type="text" placeholder="Máximo" data-column="${IDONI_COLUMNS.PVP_MAJ}_max"></div></div>`;
    }
    if (headers.includes(IDONI_COLUMNS.COSTO)) {
        priceFilters += `<div class="filter-control"><label>Rango Preu Cost:</label><div class="price-range"><input type="text" placeholder="Mínimo" data-column="${IDONI_COLUMNS.COSTO}_min"><span>-</span><input type="text" placeholder="Máximo" data-column="${IDONI_COLUMNS.COSTO}_max"></div></div>`;
    }
    if (headers.includes(IDONI_COLUMNS.COSTO_ULTIMO)) {
        priceFilters += `<div class="filter-control"><label>Rango Ult.Pr.Cost:</label><div class="price-range"><input type="text" placeholder="Mínimo" data-column="${IDONI_COLUMNS.COSTO_ULTIMO}_min"><span>-</span><input type="text" placeholder="Máximo" data-column="${IDONI_COLUMNS.COSTO_ULTIMO}_max"></div></div>`;
    }
    
    priceFilterControls.innerHTML = priceFilters;
    
    // Inicializar validación de inputs
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
                    
                    // Si solo hay valor mínimo
                    if (value && !maxValue) {
                        return rowValue >= minValue;
                    }
                    // Si solo hay valor máximo
                    if (!value && maxValue) {
                        return rowValue <= maxVal;
                    }
                    // Si hay ambos valores
                    return rowValue >= minValue && rowValue <= maxVal;
                });
            } else if (column.includes('_max')) {
                // Ya se procesó en _min, no hacer nada aquí
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
    
    // Resetear a la primera página cuando se aplican filtros
    currentPage = 0;
    
    updateTableData();
    updateStats();
    updateActiveFiltersCount(activeFilters);
    
    // Mostrar mensaje de resultados
    if (activeFilters > 0) {
        const originalCount = excelData.length;
        const filteredCount = filteredData.length;
        const percentage = ((filteredCount / originalCount) * 100).toFixed(1);
        
        // Crear notificación temporal
        showNotification(`Filtros aplicados: ${filteredCount} de ${originalCount} productos (${percentage}%)`, 'success');
    }
}

function clearAllFilters() {
    const filterInputs = document.querySelectorAll('.filter-control input, .filter-control select');
    filterInputs.forEach(input => {
        input.value = '';
    });
    
    filteredData = [...excelData];
    
    // Resetear a la primera página cuando se limpian filtros
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
    
    // Actualizar indicadores visuales de filtros activos
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

function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Remover automáticamente después de 4 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 4000);
}

// Función especial para mostrar notificaciones de éxito de carga de Excel
function showExcelLoadSuccess(productCount, fileName = '') {
    const notification = document.createElement('div');
    notification.className = 'notification notification-excel-success';
    
    const stats = calculateIdoniStats();
    const fileNameDisplay = fileName ? `<div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">📄 ${fileName}</div>` : '';
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-header">
                <span class="notification-icon">📊</span>
                <span class="notification-title">Excel Cargado Exitosamente</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="notification-body">
                ${fileNameDisplay}
                <div class="notification-main-message">
                    <strong>${productCount.toLocaleString('es-ES')}</strong> productos encontrados
                </div>
                <div class="notification-stats">
                    <div class="stat-item">
                        <span class="stat-label">📈 Activos:</span>
                        <span class="stat-value active">${stats.activos}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">🔒 Bloqueados:</span>
                        <span class="stat-value blocked">${stats.bloqueados}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">🌐 Internet:</span>
                        <span class="stat-value internet">${stats.internet}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">⭐ Destacados:</span>
                        <span class="stat-value featured">${stats.destacados}</span>
                    </div>
                </div>
                <div class="notification-footer">
                    <span class="notification-time">${new Date().toLocaleTimeString('es-ES')}</span>
                </div>
            </div>
        </div>
    `;
    
    // Estilos especiales para notificación de Excel
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        padding: 0;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(76, 175, 80, 0.3);
        z-index: 10000;
        max-width: 450px;
        animation: slideInRight 0.4s ease;
        border: 2px solid rgba(255, 255, 255, 0.1);
    `;
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Remover automáticamente después de 6 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 6000);
}

// Agregar estilos CSS para la animación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.3s ease;
    }
    
    .notification-close:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    /* Estilos para notificación especial de Excel */
    .notification-excel-success .notification-content {
        display: block;
        padding: 1.5rem;
    }
    
    .notification-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .notification-icon {
        font-size: 1.5rem;
        margin-right: 0.5rem;
    }
    
    .notification-title {
        font-size: 1.1rem;
        font-weight: bold;
        flex: 1;
    }
    
    .notification-body {
        margin-bottom: 1rem;
    }
    
    .notification-main-message {
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: 1rem;
        text-align: center;
        padding: 0.5rem;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
    }
    
    .notification-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }
    
    .stat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        font-size: 0.9rem;
    }
    
    .stat-label {
        opacity: 0.9;
    }
    
    .stat-value {
        font-weight: bold;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.85rem;
    }
    
    .stat-value.active {
        background: rgba(76, 175, 80, 0.3);
        color: #4CAF50;
    }
    
    .stat-value.blocked {
        background: rgba(244, 67, 54, 0.3);
        color: #f44336;
    }
    
    .stat-value.internet {
        background: rgba(33, 150, 243, 0.3);
        color: #2196F3;
    }
    
    .stat-value.featured {
        background: rgba(255, 152, 0, 0.3);
        color: #FF9800;
    }
    
    .notification-footer {
        text-align: center;
        padding-top: 0.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .notification-time {
        font-size: 0.8rem;
        opacity: 0.8;
    }
`;
document.head.appendChild(style);

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
    
    // Resetear a la primera página cuando se busca
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
            
            // Si son números, ordenar numéricamente
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
            
            return aVal.localeCompare(bVal);
        });
    }
    
    // Resetear a la primera página cuando se ordena
    currentPage = 0;
    
    updateTableData();
}

function updateStats() {
    const totalRecords = excelData.length;
    const filteredRecords = filteredData.length;
    
    // Actualizar elementos en la interfaz
    const totalRecordsElement = document.getElementById('total-records');
    const filteredRecordsElement = document.getElementById('filtered-records');
    
    if (totalRecordsElement) totalRecordsElement.textContent = totalRecords;
    if (filteredRecordsElement) filteredRecordsElement.textContent = filteredRecords;
    
    // Estadísticas IDONI
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
        
        // Estadísticas de precios
        const precio = parseFloat(row[IDONI_COLUMNS.PVP_DET]) || 0;
        if (precio > 0) {
            totalPrecio += precio;
            conPrecio++;
            stats.precioMin = Math.min(stats.precioMin, precio);
            stats.precioMax = Math.max(stats.precioMax, precio);
        }
        
        // Estadísticas de costes
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
}

async function saveExcelData() {
    try {
        const dataToSave = {
            headers: Object.keys(excelData[0]).filter(key => key !== 'id'),
            data: excelData,
            timestamp: new Date().toISOString(),
            stats: calculateIdoniStats()
        };
        
        const filePath = await ipcRenderer.invoke('save-file', dataToSave);
        if (filePath) {
            alert(`✅ Datos guardados exitosamente en: ${filePath}`);
        }
    } catch (error) {
        console.error('Error al guardar datos:', error);
        alert('❌ Error al guardar los datos.');
    }
}

function clearExcelData() {
    if (confirm('¿Estás seguro de que quieres limpiar todos los datos?')) {
        excelData = [];
        filteredData = [];
        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';
        idoniFilterControls.innerHTML = '';
        priceFilterControls.innerHTML = '';
        searchInput.value = '';
        sortSelect.innerHTML = '<option value="">Ordenar por...</option>';
        updateStats();
        updateActiveFiltersCount(0);
        saveDataBtn.disabled = true;
        clearDataBtn.disabled = true;
        saveDataLocally();
        
        // Resetear vista a completa
        isSimplifiedView = false;
        toggleViewBtn.innerHTML = '📊 Vista Simplificada';
        toggleViewBtn.classList.remove('btn-warning');
        toggleViewBtn.classList.add('btn-info');
        // Vista simplificada usa los mismos estilos que la vista completa
        
        // Mostrar área de drop nuevamente SOLO si la pestaña activa es Excel
        if (typeof dropZone !== 'undefined' && dropZone) {
            const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
            if (activeTab === 'excel-manager') {
                dropZone.style.display = 'block';
                dropZone.style.pointerEvents = 'auto';
                dropZone.style.zIndex = '1';
            } else {
                dropZone.style.display = 'none';
                dropZone.style.pointerEvents = 'none';
                dropZone.style.zIndex = '-1';
            }
        }
        
        showNotification('🗑️ Todos los datos han sido limpiados', 'info');
    }
}

// ==================== FICHAS TÉCNICAS ====================
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

// Función para inicializar el historial
function initializeHistory() {
    const historySearch = document.getElementById('history-search');
    const duplicateBtn = document.getElementById('duplicate-recipe');
    
    if (historySearch) {
        historySearch.addEventListener('input', filterHistory);
    }
    
    if (duplicateBtn) {
        duplicateBtn.addEventListener('click', duplicateSelectedRecipe);
    }
    
    // Cargar historial
    updateHistoryTable();
}

// Función para actualizar la tabla del historial
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
    
    // Renderizar iconos Feather en los botones dinámicos
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

// Función para seleccionar una ficha del historial
function selectHistoryRecipe(index) {
    // Remover selección anterior
    const prevSelected = document.querySelector('.history-table tbody tr.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
    }
    
    // Seleccionar nueva fila
    const row = document.querySelector(`.history-table tbody tr[data-index="${index}"]`);
    if (row) {
        row.classList.add('selected');
        selectedHistoryRecipe = index;
        
        // Habilitar botón de duplicar
        const duplicateBtn = document.getElementById('duplicate-recipe');
        if (duplicateBtn) {
            duplicateBtn.disabled = false;
        }
    }
}

// Función para filtrar el historial
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

// Función para editar una ficha del historial
function editRecipe(index) {
    const recipe = savedRecipes[index];
    if (!recipe) return;
    
    // Cargar datos en el formulario
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-allergens').value = recipe.allergens.join(', ');
    
    // Cargar imagen
    if (recipe.image) {
        currentRecipeImage = recipe.image;
        updateImagePreview();
    } else {
        currentRecipeImage = null;
        updateImagePreview();
    }
    
    // Cargar ingredientes
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
    
    // Establecer como receta actual
    currentRecipe = recipe;
    
    updateCalculations();
    updateAllergens();
    enableRecipeButtons(true);
    
    // Limpiar autoguardado
    clearAutoSave();
    
            showNotification('Ficha cargada para edición', 'info');
}

// Función para duplicar una ficha seleccionada
function duplicateSelectedRecipe() {
    if (selectedHistoryRecipe === null) return;
    
    const recipe = savedRecipes[selectedHistoryRecipe];
    if (!recipe) return;
    
    // Crear copia con nuevo timestamp
    const duplicatedRecipe = {
        ...recipe,
        name: `${recipe.name} (Copia)`,
        timestamp: new Date().toISOString()
    };
    
    // Cargar en el formulario
    document.getElementById('recipe-name').value = duplicatedRecipe.name;
    document.getElementById('recipe-allergens').value = duplicatedRecipe.allergens.join(', ');
    
    // Cargar imagen
    if (duplicatedRecipe.image) {
        currentRecipeImage = duplicatedRecipe.image;
        updateImagePreview();
    } else {
        currentRecipeImage = null;
        updateImagePreview();
    }
    
    // Cargar ingredientes
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
    
    // Limpiar receta actual
    currentRecipe = null;
    
    updateCalculations();
    updateAllergens();
    enableRecipeButtons(false);
    
    // Limpiar autoguardado
    clearAutoSave();
    
    showNotification('📋 Ficha duplicada lista para guardar', 'success');
}

// Función para eliminar una ficha del historial
function deleteRecipe(index) {
    const recipe = savedRecipes[index];
    if (!recipe) return;
    
    if (confirm(`¿Estás seguro de que quieres eliminar la ficha "${recipe.name}"?`)) {
        savedRecipes.splice(index, 1);
        saveRecipesLocally();
        updateHistoryTable();
        
        // Si era la receta actual, limpiar formulario
        if (currentRecipe && currentRecipe.timestamp === recipe.timestamp) {
            createNewRecipe();
        }
        
        showNotification('🗑️ Ficha eliminada', 'success');
    }
}

// Función para exportar una ficha del historial
function exportRecipeFromHistory(index) {
    const recipe = savedRecipes[index];
    if (!recipe) return;
    
    // Establecer como receta actual temporalmente
    const originalCurrent = currentRecipe;
    currentRecipe = recipe;
    
    // Exportar
    exportRecipe();
    
    // Restaurar receta actual
    currentRecipe = originalCurrent;
}

// Modificar saveRecipeInternal para actualizar el historial
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
    // Guardar receta
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
    clearAutoSave(); // Limpiar autoguardado al guardar definitivamente
    
    // Actualizar historial
    updateHistoryTable();
    
    return true;
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) {
        currentRecipeImage = null;
        updateImagePreview();
        return;
    }
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecciona un archivo de imagen válido', 'error');
        return;
    }
    
    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('La imagen es demasiado grande. Máximo 5MB', 'error');
        return;
    }
    
    // Redimensionar y convertir a base64
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // Redimensionar a máx 400px ancho
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
    
    if (!preview) return;
    
    preview.innerHTML = '';
    
    if (currentRecipeImage) {
        const img = document.createElement('img');
        img.src = currentRecipeImage;
        img.alt = 'Foto del plato';
        img.style.maxWidth = '180px';
        img.style.maxHeight = '120px';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        preview.appendChild(img);
        
        // Habilitar botón de limpiar
        if (clearImageBtn) {
            clearImageBtn.disabled = false;
        }
    } else {
        const span = document.createElement('span');
        span.textContent = 'Sin foto seleccionada';
        span.style.color = '#bbb';
        span.style.fontStyle = 'italic';
        preview.appendChild(span);
        
        // Deshabilitar botón de limpiar
        if (clearImageBtn) {
            clearImageBtn.disabled = true;
        }
    }
}

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
        // Dividir por comas y limpiar espacios
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
    } else {
        allergensList.innerHTML = '<p style="color: #666; font-style: italic;">No se han especificado alérgenos</p>';
    }
}

function getRecipeData() {
    const rows = document.querySelectorAll('.ingredient-row');
    const ingredients = Array.from(rows).map(row => ({
        name: row.querySelector('.ingredient-name').value,
        weight: parseFloat(row.querySelector('.ingredient-weight').value) || 0,
        cost: parseFloat(row.querySelector('.ingredient-cost').value) || 0,
        expenses: parseFloat(row.querySelector('.ingredient-expenses').value) || 0
    })).filter(ing => ing.name.trim());
    // Obtener alérgenos del campo independiente
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
        image: currentRecipeImage, // Guardar imagen base64
        timestamp: new Date().toISOString()
    };
}

function enableRecipeButtons(enabled) {
    exportRecipeBtn.disabled = !enabled;
    printRecipeBtn.disabled = !enabled;
}

async function exportRecipe() {
    if (!currentRecipe) {
        alert('No hay una ficha técnica para exportar.');
        return;
    }
    // Generar nombre seguro
    const safeName = currentRecipe.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_');
    const fileName = `Ficha_Tecnica_${safeName}.html`;
    const htmlContent = generatePDFHTML(currentRecipe);
    const filePath = await ipcRenderer.invoke('export-table', htmlContent, fileName);
    if (filePath) {
        alert(`✅ Ficha técnica exportada exitosamente a: ${filePath}`);
    }
}

function printRecipe() {
    if (!currentRecipe) {
        alert('No hay una ficha técnica para imprimir.');
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

async function exportRecipeToExcel() {
    if (!currentRecipe) {
        alert('No hay una ficha técnica para exportar a PDF.');
        return;
    }
    
    if (!jsPDF) {
        alert('❌ Error: La librería PDF no está disponible. Por favor, reinicia la aplicación.');
        return;
    }
    
    try {
        // Mostrar vista previa del PDF
        showPDFPreview();
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        alert('❌ Error al generar el PDF de la ficha técnica: ' + error.message);
    }
}

function showPDFPreview() {
    // Crear ventana de vista previa
    const previewWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
    
    const pdfContent = generatePDFHTML(currentRecipe);
    
    previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Vista Previa PDF - ${currentRecipe.name}</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    margin: 20px; 
                    background: #f5f5f5;
                }
                .preview-container {
                    background: white;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    border-radius: 8px;
                }
                .preview-header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #4CAF50;
                }
                .company-logo {
                    font-size: 2.5rem;
                    font-weight: bold;
                    color: #4CAF50;
                    margin-bottom: 10px;
                }
                .company-info {
                    font-size: 0.9rem;
                    color: #666;
                    margin-bottom: 5px;
                }
                .recipe-title {
                    font-size: 2.5rem;
                    font-weight: bold;
                    color: #2E7D32;
                    text-align: center;
                    margin: 30px 0;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }
                .recipe-meta {
                    display: flex;
                    justify-content: space-between;
                    margin: 20px 0;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 1px solid #e9ecef;
                }
                .meta-item {
                    text-align: center;
                }
                .meta-label {
                    font-size: 0.8rem;
                    color: #666;
                    text-transform: uppercase;
                    font-weight: 600;
                    margin-bottom: 5px;
                }
                .meta-value {
                    font-size: 1.1rem;
                    font-weight: bold;
                    color: #4CAF50;
                }
                .section {
                    margin: 30px 0;
                }
                .section-title {
                    font-size: 1.3rem;
                    font-weight: bold;
                    color: #2E7D32;
                    margin-bottom: 15px;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #4CAF50;
                }
                .ingredients-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .ingredients-table th {
                    background: linear-gradient(135deg, #4CAF50, #2E7D32);
                    color: white;
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .ingredients-table td {
                    padding: 10px 8px;
                    border-bottom: 1px solid #e9ecef;
                    font-size: 0.9rem;
                }
                .ingredients-table tbody tr:nth-child(even) {
                    background: #f8f9fa;
                }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .allergens-section {
                    background: #fff3e0;
                    padding: 20px;
                    border-radius: 8px;
                    border: 2px solid #ff9800;
                    margin-top: 20px;
                }
                .allergen-tag {
                    background: #ffebee;
                    color: #c62828;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    border: 1px solid #ffcdd2;
                    display: inline-block;
                    margin: 4px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                .cost-summary {
                    background: linear-gradient(135deg, #4CAF50, #2E7D32);
                    color: white;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .cost-summary h3 {
                    margin: 0 0 15px 0;
                    text-align: center;
                    font-size: 1.2rem;
                }
                .cost-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                }
                .cost-item {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 15px;
                    border-radius: 6px;
                    text-align: center;
                }
                .cost-label {
                    font-size: 0.8rem;
                    opacity: 0.9;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .cost-value {
                    font-size: 1.3rem;
                    font-weight: bold;
                }
                .export-buttons {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e9ecef;
                }
                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    margin: 0 10px;
                    font-size: 1rem;
                    transition: all 0.3s ease;
                }
                .btn-primary {
                    background: #4CAF50;
                    color: white;
                }
                .btn-primary:hover {
                    background: #388E3C;
                    transform: translateY(-2px);
                }
                .btn-secondary {
                    background: #757575;
                    color: white;
                }
                .btn-secondary:hover {
                    background: #616161;
                }
                .signature-section {
                    margin-top: 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: end;
                }
                .signature-box {
                    width: 200px;
                    text-align: center;
                }
                .signature-line {
                    border-bottom: 2px solid #333;
                    height: 40px;
                    margin-bottom: 10px;
                }
                .signature-label {
                    font-size: 0.8rem;
                    color: #666;
                    text-transform: uppercase;
                }
            </style>
        </head>
        <body>
            <div class="preview-container">
                ${pdfContent}
                <div class="export-buttons">
                    <button class="btn btn-primary" onclick="exportPDF()">📄 Exportar PDF</button>
                    <button class="btn btn-secondary" onclick="window.close()">❌ Cerrar</button>
                </div>
            </div>
            
            <script>
                function exportPDF() {
                    // Enviar mensaje al proceso principal para generar PDF
                    window.opener.postMessage({ type: 'exportPDF', recipe: ${JSON.stringify(currentRecipe)} }, '*');
                }
            </script>
        </body>
        </html>
    `);
    
    previewWindow.document.close();
}

function generatePDFHTML(recipe) {
    // Información real de IDONI
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ficha Técnica - ${recipe.name} | IDONI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* Fuente Address Sans Pro local */
        @font-face {
            font-family: 'Address Sans Pro';
            src: url('fonts/address-sans-pro-bold.otf') format('opentype');
            font-weight: bold;
            font-style: normal;
        }
        
        /* Fuente Fredoka local */
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
        .header-idoni .info:not(:last-child)::after {
            content: "";
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
        @media (max-width: 700px) {
            .header-idoni { flex-direction: column; gap: 1rem; align-items: stretch; }
            .header-idoni-img { margin-left: 0; margin-top: 1rem; }
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
        
        /* Ocultar resumen de costes al imprimir */
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
            
            /* Mejorar legibilidad en impresión */
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

// Función para generar el PDF real
async function generatePDF(recipe) {
    if (!jsPDF) {
        throw new Error('jsPDF no está disponible');
    }
    
    try {
        const doc = new jsPDF();
        
        // Configuración de página
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        let yPosition = margin;
        
        // Función para añadir texto con salto de línea automático
        const addText = (text, x, y, maxWidth = pageWidth - 2 * margin) => {
            const lines = doc.splitTextToSize(text, maxWidth);
            doc.text(lines, x, y);
            return lines.length * 7; // Altura aproximada de línea
        };
        
        // Función para añadir título
        const addTitle = (text, y) => {
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(46, 125, 50); // Verde IDONI
            const height = addText(text, margin, y);
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            return height + 10;
        };
        
        // Encabezado
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(237, 21, 102); // Rosa IDONI
        addText('IDONI', pageWidth / 2, yPosition, pageWidth - 2 * margin);
        yPosition += 15;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(102, 102, 102);
        addText('Restaurante y Catering Profesional', pageWidth / 2, yPosition, pageWidth - 2 * margin);
        yPosition += 8;
        addText('Especialistas en Gastronomía Mediterránea', pageWidth / 2, yPosition, pageWidth - 2 * margin);
        yPosition += 8;
        addText('Tel: +34 XXX XXX XXX | Email: info@idoni.com', pageWidth / 2, yPosition, pageWidth - 2 * margin);
        yPosition += 20;
        
        // Línea separadora
        doc.setDrawColor(76, 175, 80);
        doc.setLineWidth(2);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 20;
        
        // Título del plato
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(46, 125, 50);
        addText(recipe.name.toUpperCase(), pageWidth / 2, yPosition, pageWidth - 2 * margin);
        yPosition += 25;
        
        // Información de la ficha
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        const currentDate = new Date().toLocaleDateString('es-ES');
        addText(`Fecha: ${currentDate}`, margin, yPosition);
        addText(`Código: FT-${Date.now().toString().slice(-6)}`, pageWidth - margin - 50, yPosition);
        yPosition += 15;
        addText(`Ingredientes: ${recipe.ingredients.length}`, margin, yPosition);
        addText(`Alérgenos: ${recipe.allergens.length}`, pageWidth - margin - 50, yPosition);
        yPosition += 20;
        
        // Resumen de costes
        yPosition += addTitle('📊 Resumen de Costes', yPosition);
        
        const costData = [
            ['Peso Total', `${recipe.totalWeight.toFixed(1)} g`],
            ['Coste Total', `${recipe.totalCost.toFixed(2)} €`],
            ['Gastos Total', `${recipe.totalExpenses.toFixed(2)} €`],
            ['Coste Final', `${recipe.grandTotal.toFixed(2)} €`]
        ];
        
        doc.autoTable({
            startY: yPosition,
            head: [['Concepto', 'Valor']],
            body: costData,
            theme: 'grid',
            headStyles: {
                fillColor: [76, 175, 80],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 10
            },
            columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'right' }
            }
        });
        
        yPosition = doc.lastAutoTable.finalY + 15;
        
        // Verificar si necesitamos nueva página
        if (yPosition > pageHeight - 100) {
            doc.addPage();
            yPosition = margin;
        }
        
        // Ingredientes
        yPosition += addTitle('🥘 Ingredientes y Especificaciones', yPosition);
        
        const ingredientsData = recipe.ingredients.map(ing => [
            ing.name,
            `${ing.weight.toFixed(1)}`,
            `${ing.cost.toFixed(2)}`,
            `${ing.expenses.toFixed(2)}`
        ]);
        
        doc.autoTable({
            startY: yPosition,
            head: [['Ingrediente', 'Peso (g)', 'Coste (€)', 'Gastos (€)']],
            body: ingredientsData,
            theme: 'grid',
            headStyles: {
                fillColor: [76, 175, 80],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 9
            },
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' }
            }
        });
        
        yPosition = doc.lastAutoTable.finalY + 15;
        
        // Verificar si necesitamos nueva página
        if (yPosition > pageHeight - 100) {
            doc.addPage();
            yPosition = margin;
        }
        
        // Alérgenos
        if (recipe.allergens.length > 0) {
            yPosition += addTitle('⚠️ Alérgenos del Plato', yPosition);
            
            const allergensText = recipe.allergens.join(', ');
            yPosition += addText(`Este plato contiene: ${allergensText}`, margin, yPosition);
            yPosition += 10;
            yPosition += addText('⚠️ IMPORTANTE: Informar a los clientes sobre la presencia de estos alérgenos antes del servicio.', margin, yPosition);
        } else {
            yPosition += addTitle('✅ Información de Alérgenos', yPosition);
            yPosition += addText('✅ Este plato no contiene alérgenos identificados en los ingredientes especificados.', margin, yPosition);
        }
        
        yPosition += 20;
        
        // Firmas
        if (yPosition > pageHeight - 80) {
            doc.addPage();
            yPosition = margin;
        }
        
        yPosition += addTitle('Firmas', yPosition);
        
        // Líneas de firma
        doc.line(margin, yPosition, margin + 80, yPosition);
        doc.line(pageWidth - margin - 80, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;
        
        doc.setFontSize(8);
        doc.setTextColor(102, 102, 102);
        addText('Chef Responsable', margin, yPosition);
        addText('Fecha de Aprobación', pageWidth - margin - 80, yPosition);
        
        // Pie de página
        doc.setFontSize(8);
        doc.setTextColor(102, 102, 102);
        addText('IDONI - Ficha Técnica de Cocina', pageWidth / 2, pageHeight - 10, pageWidth - 2 * margin);
        
        return doc;
    } catch (error) {
        console.error('Error en generatePDF:', error);
        throw new Error(`Error al generar PDF: ${error.message}`);
    }
}

// Escuchar mensajes de la ventana de vista previa
window.addEventListener('message', async (event) => {
    if (event.data.type === 'exportPDF') {
        try {
            const doc = await generatePDF(event.data.recipe);
            // Nombre predeterminado: Ficha_Tecnica_(Nombre del Plato).pdf
            const safeName = event.data.recipe.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_');
            const fileName = `Ficha_Tecnica_(${safeName}).pdf`;
            const pdfData = doc.output('arraybuffer');
            const buffer = Buffer.from(pdfData);
            const filePath = await ipcRenderer.invoke('export-pdf', buffer, fileName);
            
            if (filePath) {
                alert(`✅ Ficha técnica exportada a PDF exitosamente:\n${filePath}`);
            }
        } catch (error) {
            console.error('Error al exportar PDF:', error);
            alert('❌ Error al exportar la ficha técnica a PDF.');
        }
    }
});

// ==================== ALMACENAMIENTO LOCAL ====================
function saveDataLocally() {
    const data = {
        excelData,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('idoni-excel-data', JSON.stringify(data));
}

function saveRecipesLocally() {
    localStorage.setItem('idoni-recipes', JSON.stringify(savedRecipes));
}

// Inicializar pestañas de filtros
function initializeFilterTabs() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    const filterTabContents = document.querySelectorAll('.filter-tab-content');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            // Remover clase active de todas las pestañas y contenidos
            filterTabs.forEach(t => t.classList.remove('active'));
            filterTabContents.forEach(content => content.classList.remove('active'));
            
            // Activar pestaña seleccionada
            tab.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
    
    // Agregar validación para inputs de precios
    setTimeout(() => {
        const priceInputs = document.querySelectorAll('.price-range input');
        priceInputs.forEach(input => {
            input.addEventListener('input', function(e) {
                // Permitir solo números, comas y puntos
                let value = this.value;
                value = value.replace(/[^0-9,.-]/g, '');
                
                // Asegurar que solo haya un punto o coma decimal
                const parts = value.split(/[,.]/);
                if (parts.length > 2) {
                    value = parts[0] + '.' + parts.slice(1).join('');
                }
                
                this.value = value;
                
                // Actualizar indicadores visuales
                updateActiveFiltersCount(0); // Se actualizará correctamente en applyFilters
            });
            
            // Permitir Enter para aplicar filtros
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        });
        
        // Agregar event listeners para inputs de texto generales
        const textInputs = document.querySelectorAll('.filter-control input[type="text"]');
        textInputs.forEach(input => {
            input.addEventListener('input', function() {
                // Actualizar indicadores visuales
                updateActiveFiltersCount(0); // Se actualizará correctamente en applyFilters
            });
            
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        });
        
        // Agregar event listeners para selects
        const selectInputs = document.querySelectorAll('.filter-control select');
        selectInputs.forEach(select => {
            select.addEventListener('change', function() {
                // Actualizar indicadores visuales
                updateActiveFiltersCount(0); // Se actualizará correctamente en applyFilters
            });
        });
    }, 100);
}

function toggleTableView() {
    const tableWrapper = document.querySelector('.table-wrapper');
    const dataTable = document.querySelector('.data-table');
    
    // Agregar animación de transición
    tableWrapper.classList.add('view-changing');
    
    setTimeout(() => {
        isSimplifiedView = !isSimplifiedView;
        
        if (isSimplifiedView) {
            toggleViewBtn.innerHTML = '📋 Vista Completa';
            toggleViewBtn.classList.remove('btn-info');
            toggleViewBtn.classList.add('btn-warning');
            // Vista simplificada usa los mismos estilos que la vista completa
            showSimplifiedView();
        } else {
            toggleViewBtn.innerHTML = '📊 Vista Simplificada';
            toggleViewBtn.classList.remove('btn-warning');
            toggleViewBtn.classList.add('btn-info');
            // Vista simplificada usa los mismos estilos que la vista completa
            showFullView();
        }
        
        // Remover animación de transición
        tableWrapper.classList.remove('view-changing');
        
        // Mostrar notificación
        const viewType = isSimplifiedView ? 'simplificada' : 'completa';
        showNotification(`📊 Vista ${viewType} activada`, 'success');
    }, 150);
}

function showSimplifiedView() {
    if (!excelData.length) return;
    
    // Obtener todas las columnas disponibles
    const allHeaders = Object.keys(excelData[0]).filter(key => key !== 'id');
    
    // Filtrar solo las columnas simplificadas que existen en los datos
    const availableSimplifiedColumns = SIMPLIFIED_COLUMNS.filter(col => allHeaders.includes(col));
    
    // Actualizar headers de la tabla
    tableHeader.innerHTML = `
        <tr>
            ${availableSimplifiedColumns.map(header => `<th>${header}</th>`).join('')}
        </tr>
    `;
    
    // Resetear a la primera página
    currentPage = 0;
    
    // Actualizar datos de la tabla usando la función optimizada
    updateTableData();
    
    // Actualizar opciones de ordenamiento
    sortSelect.innerHTML = '<option value="">Ordenar por...</option>';
    availableSimplifiedColumns.forEach(header => {
        sortSelect.innerHTML += `<option value="${header}">${header}</option>`;
    });
}

function showFullView() {
    if (!excelData.length) return;
    
    // Obtener todas las columnas
    const allHeaders = Object.keys(excelData[0]).filter(key => key !== 'id');
    
    // Actualizar headers de la tabla
    tableHeader.innerHTML = `
        <tr>
            ${allHeaders.map(header => `<th>${header}</th>`).join('')}
        </tr>
    `;
    
    // Resetear a la primera página
    currentPage = 0;
    
    // Actualizar datos de la tabla usando la función optimizada
    updateTableData();
    
    // Actualizar opciones de ordenamiento
    sortSelect.innerHTML = '<option value="">Ordenar por...</option>';
    allHeaders.forEach(header => {
        sortSelect.innerHTML += `<option value="${header}">${header}</option>`;
    });
}

// Función para mostrar información de columnas disponibles
function showColumnInfo() {
    if (!excelData.length) return;
    
    const allHeaders = Object.keys(excelData[0]).filter(key => key !== 'id');
    const availableSimplifiedColumns = SIMPLIFIED_COLUMNS.filter(col => allHeaders.includes(col));
    const missingColumns = SIMPLIFIED_COLUMNS.filter(col => !allHeaders.includes(col));
    
    // Crear modal con información y opciones
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 12px;
        max-width: 700px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    modalContent.innerHTML = `
        <h3 style="color: #ed1566; margin-bottom: 1rem;">📋 Información de Columnas</h3>
        
        <div style="margin-bottom: 1.5rem;">
            <h4 style="color: #405e47; margin-bottom: 0.5rem;">📊 Resumen:</h4>
            <p>• <strong>Total columnas en Excel:</strong> ${allHeaders.length}</p>
            <p>• <strong>Columnas en vista simplificada:</strong> ${availableSimplifiedColumns.length} de ${SIMPLIFIED_COLUMNS.length}</p>
            ${missingColumns.length > 0 ? `<p>• <strong>Columnas faltantes:</strong> ${missingColumns.join(', ')}</p>` : ''}
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <h4 style="color: #405e47; margin-bottom: 0.5rem;">✅ Columnas simplificadas encontradas:</h4>
            <div style="background: #f0f7ed; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                ${availableSimplifiedColumns.length > 0 ? 
                    availableSimplifiedColumns.map(col => `<div>✅ ${col}</div>`).join('') : 
                    '<div style="color: #666; font-style: italic;">Ninguna columna encontrada</div>'
                }
            </div>
        </div>
        
        ${missingColumns.length > 0 ? `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: #405e47; margin-bottom: 0.5rem;">❌ Columnas simplificadas NO encontradas:</h4>
                <div style="background: #ffebee; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                    ${missingColumns.map(col => `<div>❌ ${col}</div>`).join('')}
                </div>
            </div>
        ` : ''}
        
        <div style="margin-bottom: 1.5rem;">
            <h4 style="color: #405e47; margin-bottom: 0.5rem;">📋 Todas las columnas disponibles:</h4>
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 6px; max-height: 200px; overflow-y: auto;">
                ${allHeaders.map((header, index) => `<div>${index + 1}. ${header}</div>`).join('')}
            </div>
        </div>
        
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="customize-columns" style="padding: 0.5rem 1rem; background: #ed1566; color: white; border: none; border-radius: 6px; cursor: pointer;">🔧 Personalizar</button>
            <button id="close-info" style="padding: 0.5rem 1rem; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer;">❌ Cerrar</button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('customize-columns').addEventListener('click', () => {
        document.body.removeChild(modal);
        customizeSimplifiedColumns();
    });
    
    document.getElementById('close-info').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Mostrar en consola para debugging
    console.log('=== INFORMACIÓN DE COLUMNAS ===');
    console.log('Todas las columnas:', allHeaders);
    console.log('Columnas simplificadas encontradas:', availableSimplifiedColumns);
    console.log('Columnas simplificadas faltantes:', missingColumns);
}

// Función para mostrar todas las columnas disponibles con nombres exactos
function showAllColumns() {
    if (!excelData.length) return;
    
    const allHeaders = Object.keys(excelData[0]).filter(key => key !== 'id');
    
    console.log('=== TODAS LAS COLUMNAS DISPONIBLES ===');
    allHeaders.forEach((header, index) => {
        console.log(`${index + 1}. ${header}`);
    });
    
    // Mostrar en una notificación
    showNotification(`📋 ${allHeaders.length} columnas disponibles. Revisa la consola para ver la lista completa.`, 'info');
}

// Función para actualizar controles de paginación
function updatePaginationControls() {
    // Crear o actualizar controles de paginación
    let paginationContainer = document.getElementById('pagination-controls');
    
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination-controls';
        paginationContainer.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: #f8fbf5;
            border-top: 1px solid #e1efd6;
            margin-top: 1rem;
        `;
        
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.appendChild(paginationContainer);
        }
    }
    
    const startRecord = currentPage * rowsPerPage + 1;
    const endRecord = Math.min((currentPage + 1) * rowsPerPage, filteredData.length);
    
    paginationContainer.innerHTML = `
        <div style="color: #405e47; font-weight: 600;">
            Mostrando ${startRecord}-${endRecord} de ${filteredData.length} registros
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button id="prev-page" class="btn btn-secondary" ${currentPage === 0 ? 'disabled' : ''}>
                ⬅️ Anterior
            </button>
            <span style="color: #405e47; font-weight: 600;">
                Página ${currentPage + 1} de ${totalPages}
            </span>
            <button id="next-page" class="btn btn-secondary" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>
                Siguiente ➡️
            </button>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
            <label style="color: #405e47; font-weight: 600;">Filas por página:</label>
            <select id="rows-per-page" style="padding: 0.25rem; border: 1px solid #e1efd6; border-radius: 4px;">
                <option value="25" ${rowsPerPage === 25 ? 'selected' : ''}>25</option>
                <option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${rowsPerPage === 100 ? 'selected' : ''}>100</option>
                <option value="200" ${rowsPerPage === 200 ? 'selected' : ''}>200</option>
            </select>
        </div>
    `;
    
    // Event listeners para paginación
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
    
    document.getElementById('rows-per-page')?.addEventListener('change', (e) => {
        rowsPerPage = parseInt(e.target.value);
        currentPage = 0;
        updateTableData();
    });
}

// Función para ir a una página específica
function goToPage(pageNumber) {
    if (pageNumber >= 0 && pageNumber < totalPages) {
        currentPage = pageNumber;
        updateTableData();
    }
}

// Función para inicializar inputs de filtros
function initializeFilterInputs() {
    // Inputs de rango de precios
    const priceInputs = document.querySelectorAll('.price-range input');
    priceInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            // Permitir solo números, comas y puntos
            let value = this.value;
            value = value.replace(/[^0-9,.-]/g, '');
            // Asegurar que solo haya un punto o coma decimal
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
    
    // Inputs de texto generales
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
    
    // Selects
    const selectInputs = document.querySelectorAll('.filter-control select');
    selectInputs.forEach(select => {
        select.addEventListener('change', function() {
            updateActiveFiltersCount(0);
        });
    });
}

// ==================== FUNCIONES FALTANTES ====================

// Función para guardar receta (maneja el submit del formulario)
function saveRecipe(e) {
    e.preventDefault();
    if (saveRecipeInternal()) {
        showNotification('Ficha técnica guardada exitosamente.', 'success');
    }
}

// Función para crear nueva ficha
function createNewRecipe() {
    // Limpiar formulario
    recipeForm.reset();
    
    // Limpiar imagen
    currentRecipeImage = null;
    updateImagePreview();
    
    // Limpiar ingredientes
    clearIngredientRows();
    addIngredientRow(); // Añadir una fila vacía
    
    // Limpiar receta actual
    currentRecipe = null;
    
    // Actualizar cálculos
    updateCalculations();
    updateAllergens();
    
    // Deshabilitar botones de exportación
    enableRecipeButtons(false);
    
    // Limpiar autoguardado
    clearAutoSave();
    
    // Limpiar selección del historial
    const selectedRow = document.querySelector('.history-table tbody tr.selected');
    if (selectedRow) {
        selectedRow.classList.remove('selected');
        selectedHistoryRecipe = null;
        const duplicateBtn = document.getElementById('duplicate-recipe');
        if (duplicateBtn) {
            duplicateBtn.disabled = true;
        }
    }
    
    // Enfocar en el nombre del plato
    const nameInput = document.getElementById('recipe-name');
    if (nameInput) {
        nameInput.focus();
    }
    
            showNotification('Nueva ficha técnica creada', 'info');
}

// Función para iniciar autoguardado
function startAutoSave() {
    // Limpiar intervalo anterior si existe
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    // Configurar autoguardado cada 30 segundos
    autoSaveInterval = setInterval(() => {
        const nameInput = document.getElementById('recipe-name');
        const hasData = nameInput && nameInput.value.trim() !== '';
        
        if (hasData) {
            // Guardar temporalmente sin mostrar notificación
            const recipeData = getRecipeData();
            if (recipeData.name.trim() && recipeData.ingredients.length > 0) {
                localStorage.setItem('idoni-temp-recipe', JSON.stringify(recipeData));
            }
        }
    }, 30000); // 30 segundos
}

// Función para limpiar autoguardado
function clearAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
    localStorage.removeItem('idoni-temp-recipe');
}

// Función para cargar datos guardados
function loadSavedData() {
    try {
        // Cargar datos de Excel
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
                
                // Ocultar área de drop SOLO si la pestaña activa es Excel
                if (typeof dropZone !== 'undefined' && dropZone) {
                    const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
                    if (activeTab === 'excel-manager') {
                        dropZone.style.display = 'none';
                        dropZone.style.pointerEvents = 'none';
                        dropZone.style.zIndex = '-1';
                    } else {
                        dropZone.style.display = 'none';
                        dropZone.style.pointerEvents = 'none';
                        dropZone.style.zIndex = '-1';
                    }
                }
            }
        }
        
        // Cargar fichas técnicas
        const savedRecipesData = localStorage.getItem('idoni-recipes');
        if (savedRecipesData) {
            savedRecipes = JSON.parse(savedRecipesData);
            updateHistoryTable();
        }
        
        // Cargar receta temporal si existe
        const tempRecipe = localStorage.getItem('idoni-temp-recipe');
        if (tempRecipe) {
            const recipeData = JSON.parse(tempRecipe);
            const nameInput = document.getElementById('recipe-name');
            if (nameInput && recipeData.name) {
                nameInput.value = recipeData.name;
                
                // Cargar alérgenos
                const allergensInput = document.getElementById('recipe-allergens');
                if (allergensInput && recipeData.allergens) {
                    allergensInput.value = recipeData.allergens.join(', ');
                }
                
                // Cargar imagen
                if (recipeData.image) {
                    currentRecipeImage = recipeData.image;
                    updateImagePreview();
                } else {
                    currentRecipeImage = null;
                    updateImagePreview();
                }
                
                // Cargar ingredientes
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

// Función para personalizar columnas simplificadas
function customizeSimplifiedColumns() {
    if (!excelData.length) {
        showNotification('Primero debes cargar datos de Excel', 'error');
        return;
    }
    
    const allHeaders = Object.keys(excelData[0]).filter(key => key !== 'id');
    
    // Crear modal de personalización
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 12px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    modalContent.innerHTML = `
        <h3 style="color: #ed1566; margin-bottom: 1rem;">🔧 Personalizar Columnas Simplificadas</h3>
        
        <p style="color: #666; margin-bottom: 1.5rem;">
            Selecciona las columnas que quieres mostrar en la vista simplificada:
        </p>
        
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e1efd6; border-radius: 6px; padding: 1rem;">
            ${allHeaders.map(header => `
                <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; cursor: pointer;">
                    <input type="checkbox" value="${header}" ${SIMPLIFIED_COLUMNS.includes(header) ? 'checked' : ''}>
                    <span>${header}</span>
                </label>
            `).join('')}
        </div>
        
        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
            <button id="save-columns" style="padding: 0.5rem 1rem; background: #ed1566; color: white; border: none; border-radius: 6px; cursor: pointer;">💾 Guardar</button>
            <button id="cancel-columns" style="padding: 0.5rem 1rem; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer;">❌ Cancelar</button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('save-columns').addEventListener('click', () => {
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
        const selectedColumns = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedColumns.length === 0) {
            showNotification('Debes seleccionar al menos una columna', 'error');
            return;
        }
        
        // Actualizar columnas simplificadas
        SIMPLIFIED_COLUMNS.length = 0;
        SIMPLIFIED_COLUMNS.push(...selectedColumns);
        
        // Guardar en localStorage
        localStorage.setItem('idoni-simplified-columns', JSON.stringify(selectedColumns));
        
        // Actualizar vista si está en modo simplificado
        if (isSimplifiedView) {
            showSimplifiedView();
        }
        
        document.body.removeChild(modal);
        showNotification('Columnas simplificadas actualizadas', 'success');
    });
    
    document.getElementById('cancel-columns').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Función para recrear completamente el formulario y evitar bloqueos
function recreateFormCompletely() {
    console.log('🔄 RECREANDO FORMULARIO COMPLETAMENTE...');
    
    const recipeForm = document.getElementById('recipe-form');
    if (!recipeForm) {
        console.log('No se encontró el formulario');
        return;
    }
    
    // Guardar valores actuales
    const currentValues = {};
    const inputs = recipeForm.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        if (input.id) {
            currentValues[input.id] = input.value;
        } else if (input.className) {
            currentValues[input.className] = input.value;
        }
    });
    
    // Guardar imagen actual
    const currentImage = currentRecipeImage;
    
    // Guardar ingredientes actuales
    const currentIngredients = [];
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    ingredientRows.forEach(row => {
        const name = row.querySelector('.ingredient-name')?.value || '';
        const weight = row.querySelector('.ingredient-weight')?.value || '';
        const cost = row.querySelector('.ingredient-cost')?.value || '';
        const expenses = row.querySelector('.ingredient-expenses')?.value || '';
        if (name) {
            currentIngredients.push({ name, weight, cost, expenses });
        }
    });
    
    // Crear nuevo formulario limpio
    const newForm = document.createElement('form');
    newForm.id = 'recipe-form';
    newForm.className = 'recipe-form';
    newForm.innerHTML = `
        <div class="form-section">
            <h3>Información del Plato</h3>
            <div class="form-row">
                <div class="form-group">
                    <label for="recipe-name-new">Nombre del Plato:</label>
                    <input type="text" id="recipe-name-new" required placeholder="Ej: Ensalada Mediterránea" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;">
                </div>
            </div>
        </div>

        <div class="form-section">
            <h3>Foto del Plato (opcional)</h3>
            <div class="form-row">
                <div class="form-group">
                    <label for="recipe-image-new">Imagen del plato:</label>
                    <input type="file" id="recipe-image-new" accept="image/*" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;">
                    <div id="image-preview-new" style="margin-top: 0.5rem;"></div>
                    <button type="button" id="clear-image-new" class="btn btn-secondary" style="margin-top:0.5rem;"><i data-feather="x-circle"></i> Limpiar Imagen</button>
                </div>
            </div>
        </div>

        <div class="form-section">
            <h3>Ingredientes y Costes</h3>
            <div class="ingredients-table-container">
                <table class="ingredients-table">
                    <thead>
                        <tr>
                            <th>Ingrediente</th>
                            <th>Peso (g)</th>
                            <th>Coste (€)</th>
                            <th>Gastos (€)</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="ingredients-table-body-new">
                        <tr class="ingredient-row">
                            <td><input type="text" placeholder="Nombre del ingrediente" class="ingredient-name" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;"></td>
                            <td><input type="number" placeholder="0" class="ingredient-weight" step="0.1" min="0" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;"></td>
                            <td><input type="number" placeholder="0.00" class="ingredient-cost" step="0.01" min="0" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;"></td>
                            <td><input type="number" placeholder="0.00" class="ingredient-expenses" step="0.01" min="0" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;"></td>
                            <td><button type="button" class="btn btn-danger remove-ingredient">Eliminar</button></td>
                        </tr>
                    </tbody>
                </table>
                <button type="button" id="add-ingredient-new" class="btn btn-secondary">
                    <i data-feather="plus"></i> Añadir Ingrediente
                </button>
            </div>
        </div>

        <div class="form-section">
            <h3>Alérgenos del Plato</h3>
            <div class="form-row">
                <div class="form-group">
                    <label for="recipe-allergens-new">Alérgenos (separados por comas):</label>
                    <input type="text" id="recipe-allergens-new" placeholder="Ej: Gluten, Lactosa, Frutos secos, Huevos" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;">
                </div>
            </div>
            <div class="allergens-summary">
                <div id="allergens-list-new">
                    <!-- Los alérgenos se mostrarán dinámicamente -->
                </div>
            </div>
        </div>

        <div class="form-section">
            <h3>Resumen de Costes</h3>
            <div class="cost-summary">
                <div class="summary-item">
                    <label>Total Peso:</label>
                    <span id="total-weight-new">0 g</span>
                </div>
                <div class="summary-item">
                    <label>Total Coste:</label>
                    <span id="total-cost-new">0.00 €</span>
                </div>
                <div class="summary-item">
                    <label>Total Gastos:</label>
                    <span id="total-expenses-new">0.00 €</span>
                </div>
                <div class="summary-item">
                    <label>Coste Total:</label>
                    <span id="grand-total-new">0.00 €</span>
                </div>
            </div>
        </div>

        <div class="form-actions">
            <button type="submit" class="btn btn-primary">
                Guardar Ficha
            </button>
            <button type="button" id="save-and-new-new" class="btn btn-success">
                Guardar y Nueva
            </button>
            <button type="reset" class="btn btn-secondary">
                Limpiar Formulario
            </button>
        </div>
    `;
    
    // Reemplazar el formulario
    recipeForm.parentNode.replaceChild(newForm, recipeForm);
    
    // Restaurar valores
    setTimeout(() => {
        // Restaurar nombre
        const nameInput = document.getElementById('recipe-name-new');
        if (nameInput && currentValues['recipe-name']) {
            nameInput.value = currentValues['recipe-name'];
        }
        
        // Restaurar alérgenos
        const allergensInput = document.getElementById('recipe-allergens-new');
        if (allergensInput && currentValues['recipe-allergens']) {
            allergensInput.value = currentValues['recipe-allergens'];
        }
        
        // Restaurar imagen
        if (currentImage) {
            currentRecipeImage = currentImage;
            updateImagePreviewNew();
        }
        
        // Restaurar ingredientes
        if (currentIngredients.length > 0) {
            clearIngredientRowsNew();
            currentIngredients.forEach(ing => {
                addIngredientRowNew();
                const lastRow = document.querySelector('.ingredient-row:last-child');
                if (lastRow) {
                    lastRow.querySelector('.ingredient-name').value = ing.name;
                    lastRow.querySelector('.ingredient-weight').value = ing.weight;
                    lastRow.querySelector('.ingredient-cost').value = ing.cost;
                    lastRow.querySelector('.ingredient-expenses').value = ing.expenses;
                }
            });
        }
        
        // Reinicializar event listeners
        initializeNewFormEvents();
        
        // Actualizar cálculos
        updateCalculationsNew();
        updateAllergensNew();
        
        console.log('✅ Formulario recreado exitosamente');
        
        // Intentar enfocar el input
        setTimeout(() => {
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
                console.log('🎯 Foco aplicado al nuevo input');
            }
        }, 100);
        
    }, 50);
}

// Función para actualizar vista previa de imagen en el nuevo formulario
function updateImagePreviewNew() {
    const preview = document.getElementById('image-preview-new');
    const clearImageBtn = document.getElementById('clear-image-new');
    
    if (!preview) return;
    
    preview.innerHTML = '';
    
    if (currentRecipeImage) {
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

// Función para limpiar filas de ingredientes en el nuevo formulario
function clearIngredientRowsNew() {
    const tbody = document.getElementById('ingredients-table-body-new');
    if (tbody) {
        tbody.innerHTML = '';
    }
}

// Función para añadir fila de ingrediente en el nuevo formulario
function addIngredientRowNew() {
    const tbody = document.getElementById('ingredients-table-body-new');
    if (!tbody) return;
    
    const newRow = document.createElement('tr');
    newRow.className = 'ingredient-row adding';
    newRow.innerHTML = `
        <td><input type="text" placeholder="Nombre del ingrediente" class="ingredient-name" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;"></td>
        <td><input type="number" placeholder="0" class="ingredient-weight" step="0.1" min="0" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;"></td>
        <td><input type="number" placeholder="0.00" class="ingredient-cost" step="0.01" min="0" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;"></td>
        <td><input type="number" placeholder="0.00" class="ingredient-expenses" step="0.01" min="0" style="pointer-events: auto !important; z-index: 9999 !important; position: static !important; opacity: 1 !important; visibility: visible !important;"></td>
        <td><button type="button" class="btn btn-danger remove-ingredient"><i data-feather="trash-2"></i></button></td>
    `;
    tbody.appendChild(newRow);
    setTimeout(() => newRow.classList.remove('adding'), 400);
    
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

// Función para actualizar cálculos en el nuevo formulario
function updateCalculationsNew() {
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
    
    const totalWeightEl = document.getElementById('total-weight-new');
    const totalCostEl = document.getElementById('total-cost-new');
    const totalExpensesEl = document.getElementById('total-expenses-new');
    const grandTotalEl = document.getElementById('grand-total-new');
    
    if (totalWeightEl) totalWeightEl.textContent = `${totalWeight.toFixed(1)} g`;
    if (totalCostEl) totalCostEl.textContent = `${totalCost.toFixed(2)} €`;
    if (totalExpensesEl) totalExpensesEl.textContent = `${totalExpenses.toFixed(2)} €`;
    if (grandTotalEl) grandTotalEl.textContent = `${grandTotal.toFixed(2)} €`;
}

// Función para actualizar alérgenos en el nuevo formulario
function updateAllergensNew() {
    const allergensInput = document.getElementById('recipe-allergens-new');
    const allergensText = allergensInput ? allergensInput.value : '';
    const allergensSet = new Set();
    
    if (allergensText.trim()) {
        const allergenList = allergensText.split(',').map(a => a.trim()).filter(a => a);
        allergenList.forEach(allergen => allergensSet.add(allergen));
    }
    
    const allergensList = document.getElementById('allergens-list-new');
    if (!allergensList) return;
    
    allergensList.innerHTML = '';
    
    if (allergensSet.size > 0) {
        allergensSet.forEach(allergen => {
            const tag = document.createElement('span');
            tag.className = 'allergen-tag';
            tag.textContent = allergen;
            allergensList.appendChild(tag);
        });
    } else {
        allergensList.innerHTML = '<p style="color: #666; font-style: italic;">No se han especificado alérgenos</p>';
    }
}

// Función para inicializar eventos del nuevo formulario
function initializeNewFormEvents() {
    // Event listener para añadir ingrediente
    const addIngredientBtn = document.getElementById('add-ingredient-new');
    if (addIngredientBtn) {
        addIngredientBtn.addEventListener('click', addIngredientRowNew);
    }
    
    // Event listener para eliminar ingredientes
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-ingredient')) {
            const row = e.target.closest('.ingredient-row');
            if (row) {
                row.classList.add('removing');
                setTimeout(() => {
                    row.remove();
                    updateCalculationsNew();
                }, 300);
            }
        }
    });
    
    // Event listener para actualizar cálculos
    document.addEventListener('input', function(e) {
        if (e.target.matches('.ingredient-weight, .ingredient-cost, .ingredient-expenses')) {
            updateCalculationsNew();
        }
    });
    
    // Event listener para alérgenos
    const allergensInput = document.getElementById('recipe-allergens-new');
    if (allergensInput) {
        allergensInput.addEventListener('input', updateAllergensNew);
    }
    
    // Event listener para imagen
    const imageInput = document.getElementById('recipe-image-new');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageUpload);
    }
    
    // Event listener para limpiar imagen
    const clearImageBtn = document.getElementById('clear-image-new');
    if (clearImageBtn) {
        clearImageBtn.addEventListener('click', function() {
            currentRecipeImage = null;
            const imageInput = document.getElementById('recipe-image-new');
            if (imageInput) imageInput.value = '';
            updateImagePreviewNew();
            showNotification('🧹 Imagen limpiada', 'info');
        });
    }
    
    // Event listener para guardar y nueva
    const saveAndNewBtn = document.getElementById('save-and-new-new');
    if (saveAndNewBtn) {
        saveAndNewBtn.addEventListener('click', function() {
            if (saveRecipeInternalNew()) {
                showNotification('Ficha guardada y formulario listo para nueva ficha', 'success');
                createNewRecipeNew();
            }
        });
    }
    
    // Event listener para submit del formulario
    const newForm = document.getElementById('recipe-form');
    if (newForm) {
        newForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (saveRecipeInternalNew()) {
                showNotification('Ficha técnica guardada exitosamente.', 'success');
            }
        });
    }
}

// Función para guardar receta con el nuevo formulario
function saveRecipeInternalNew() {
    const nameInput = document.getElementById('recipe-name-new');
    const name = nameInput ? nameInput.value.trim() : '';
    
    if (!name) {
        showNotification('Por favor, introduce el nombre del plato.', 'error');
        return false;
    }
    
    const rows = document.querySelectorAll('.ingredient-row');
    const ingredients = Array.from(rows).map(row => ({
        name: row.querySelector('.ingredient-name').value,
        weight: parseFloat(row.querySelector('.ingredient-weight').value) || 0,
        cost: parseFloat(row.querySelector('.ingredient-cost').value) || 0,
        expenses: parseFloat(row.querySelector('.ingredient-expenses').value) || 0
    })).filter(ing => ing.name.trim());
    
    if (ingredients.length === 0) {
        showNotification('Debes añadir al menos un ingrediente.', 'error');
        return false;
    }
    
    const allergensInput = document.getElementById('recipe-allergens-new');
    const allergensText = allergensInput ? allergensInput.value : '';
    const allergens = allergensText.trim() ? 
        allergensText.split(',').map(a => a.trim()).filter(a => a) : [];
    
    const recipeData = {
        name: name,
        ingredients: ingredients,
        totalWeight: parseFloat(document.getElementById('total-weight-new').textContent) || 0,
        totalCost: parseFloat(document.getElementById('total-cost-new').textContent) || 0,
        totalExpenses: parseFloat(document.getElementById('total-expenses-new').textContent) || 0,
        grandTotal: parseFloat(document.getElementById('grand-total-new').textContent) || 0,
        allergens: allergens,
        image: currentRecipeImage,
        timestamp: new Date().toISOString()
    };
    
    // Guardar receta
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
    
    // Actualizar historial
    updateHistoryTable();
    
    return true;
}

// Función para crear nueva receta con el nuevo formulario
function createNewRecipeNew() {
    const newForm = document.getElementById('recipe-form');
    if (newForm) {
        newForm.reset();
    }
    
    currentRecipeImage = null;
    updateImagePreviewNew();
    clearIngredientRowsNew();
    addIngredientRowNew();
    currentRecipe = null;
    updateCalculationsNew();
    updateAllergensNew();
    enableRecipeButtons(false);
    clearAutoSave();
    
    // Limpiar selección del historial
    const selectedRow = document.querySelector('.history-table tbody tr.selected');
    if (selectedRow) {
        selectedRow.classList.remove('selected');
        selectedHistoryRecipe = null;
        const duplicateBtn = document.getElementById('duplicate-recipe');
        if (duplicateBtn) {
            duplicateBtn.disabled = true;
        }
    }
    
    // Enfocar en el nombre del plato
    const nameInput = document.getElementById('recipe-name-new');
    if (nameInput) {
        nameInput.focus();
    }
    
    showNotification('Nueva ficha técnica creada', 'info');
}

// Exponer función de recreación globalmente
window.recreateFormCompletely = recreateFormCompletely;