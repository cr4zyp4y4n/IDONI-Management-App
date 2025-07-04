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
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('open-excel-window');
}
function openRecipeWindow() {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('open-recipe-window');
}
function showInfo() {
    alert('IDONI App\n\nGestión de Excel y Fichas Técnicas de Cocina.\n© IDONI 2024. Todos los derechos reservados.');
} 