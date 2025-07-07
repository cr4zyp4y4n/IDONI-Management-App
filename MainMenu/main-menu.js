document.addEventListener('DOMContentLoaded', () => {
    // Saludo dinámico
    const greeting = document.getElementById('splash-greeting');
    const now = new Date();
    const hour = now.getHours();
    let saludo = '¡Buenos días, Cristina!';
    if (hour >= 20 || hour < 6) saludo = '¡Buenas noches, Cristina!';
    else if (hour >= 14) saludo = '¡Buenas tardes, Cristina!';
    greeting.textContent = saludo;

    // Animar letras de IDONI
    const letters = document.querySelectorAll('.splash-letter');
    letters.forEach(l => l.classList.remove('active'));
    let idx = 0;
    function animateLetters() {
        if (idx < letters.length) {
            letters[idx].classList.add('active');
            idx++;
            setTimeout(animateLetters, 350);
        } else {
            // Cuando terminan las letras, mostrar el saludo
            setTimeout(() => {
                greeting.style.animation = 'greetingEntrance 0.8s ease-out forwards';
            }, 200); // Pequeña pausa antes del saludo
        }
    }
    animateLetters();

    // Transición splash -> menú principal
    setTimeout(() => {
        document.getElementById('splash').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('splash').style.display = 'none';
            const menu = document.getElementById('main-menu');
            menu.style.display = '';
            setTimeout(() => { menu.style.opacity = '1'; }, 10);
        }, 600);
    }, 3500);
});

function openExcelWindow() {
    window.electronAPI.openExcelWindow();
}
function openRecipeWindow() {
    window.electronAPI.openRecipeWindow();
}
function showInfo() {
    const infoContent = `
        <div style="max-width: 500px; line-height: 1.6;">
            <h3 style="color: var(--primary-color); margin-bottom: 1rem;">
                <i data-feather='info'></i> IDONI KRONOS
            </h3>
            <h4 style="color: var(--text-primary); margin: 1rem 0 0.5rem 0;">
                <i data-feather='bar-chart-2'></i> GESTOR DE EXCEL:
            </h4>
            <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                <li>Análisis avanzado de productos</li>
                <li>Filtros inteligentes por categorías</li>
                <li>Vista simplificada y completa</li>
                <li>Exportación de datos filtrados</li>
            </ul>
            <h4 style="color: var(--text-primary); margin: 1rem 0 0.5rem 0;">
                <i data-feather='file-text'></i> FICHAS TÉCNICAS:
            </h4>
            <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                <li>Gestión profesional de recetas</li>
                <li>Cálculo automático de costes</li>
                <li>Detección de alérgenos</li>
                <li>Exportación a HTML y PDF</li>
            </ul>
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <p style="color: var(--text-secondary); font-size: 0.9rem;">
                    <strong>Versión:</strong> 1.0.0<br>
                    <strong>Desarrollado por:</strong> IDONI Project<br>
                    <strong>© 2024</strong> Todos los derechos reservados
                </p>
            </div>
        </div>
    `;
    showModal('Información del Sistema', infoContent);
}

function showHelp() {
    console.log('Entrando en showHelp');
    const helpContent = `
        <div style="max-width: 500px; line-height: 1.6;">
            <h3 style="color: var(--primary-color); margin-bottom: 1rem;">
                <i data-feather='help-circle'></i> CENTRO DE AYUDA
            </h3>
            <h4 style="color: var(--text-primary); margin: 1rem 0 0.5rem 0;">
                <i data-feather='target'></i> CÓMO USAR:
            </h4>
            <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                <li><strong>Gestor de Excel:</strong> Carga archivos Excel y analiza datos</li>
                <li><strong>Fichas Técnicas:</strong> Crea y gestiona recetas profesionales</li>
                <li><strong>Drag & Drop:</strong> Arrastra archivos directamente</li>
                <li><strong>Filtros:</strong> Usa los filtros avanzados para encontrar datos</li>
            </ul>
            <h4 style="color: var(--text-primary); margin: 1rem 0 0.5rem 0;">
                <i data-feather='info'></i> CONSEJOS:
            </h4>
            <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                <li>Los datos se guardan automáticamente</li>
                <li>Usa Ctrl+F para búsqueda rápida</li>
                <li>Exporta tus resultados en múltiples formatos</li>
                <li>Consulta la información del sistema para más detalles</li>
            </ul>
        </div>
    `;
    console.log('Llamando a showModal desde showHelp');
    showModal('Centro de Ayuda', helpContent);
}

function showSettings() {
    const settingsContent = `
        <div style="max-width: 500px; line-height: 1.6;">
            <h3 style="color: var(--primary-color); margin-bottom: 1rem;">
                <i data-feather='settings'></i> CONFIGURACIÓN
            </h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                Las opciones de configuración estarán disponibles en futuras versiones.
            </p>
            <div style="background: var(--background-light); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">
                    <i data-feather='zap'></i> PRÓXIMAMENTE:
                </h4>
                <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary);">
                    <li>Temas de color personalizables</li>
                    <li>Configuración de idioma</li>
                    <li>Preferencias de exportación</li>
                    <li>Atajos de teclado personalizados</li>
                </ul>
            </div>
        </div>
    `;
    showModal('Configuración', settingsContent);
}

window.showModal = function(title, content) {
    try {
        console.log('Entrando en showModal:', title);
        // Crear modal personalizado
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
        `;
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: var(--radius-lg);
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: var(--shadow-xl);
            position: relative;
        `;
        modalContent.innerHTML = `
            <h2 style="color: var(--primary-color); margin-bottom: 1rem; font-size: 1.5rem;">${title}</h2>
            ${content}
        `;
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--text-secondary);
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        `;
        closeBtn.onclick = () => {
            document.body.removeChild(modal);
        };
        modalContent.appendChild(closeBtn);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
        if (typeof feather !== 'undefined') feather.replace();
        console.log('Modal mostrado:', title);
    } catch (err) {
        console.error('Error mostrando modal:', err);
        alert('Error mostrando modal: ' + err.message);
    }
};

window.showHelp = showHelp;
window.showInfo = showInfo;
window.showSettings = showSettings; 