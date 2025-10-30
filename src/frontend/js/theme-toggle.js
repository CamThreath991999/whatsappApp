/**
 * Toggle de Tema Dark/Light
 */

// Cargar tema guardado
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);

// Función para cambiar tema
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Actualizar icono del botón
    updateThemeButton(newTheme);
    
    // Animación suave
    html.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    setTimeout(() => {
        html.style.transition = '';
    }, 300);
}

// Actualizar icono del botón
function updateThemeButton(theme) {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        const icon = theme === 'light' ? '🌙' : '☀️';
        const text = theme === 'light' ? 'Modo Oscuro' : 'Modo Claro';
        themeBtn.innerHTML = `<i class="bi bi-${theme === 'light' ? 'moon-stars' : 'sun'}"></i> ${text}`;
    }
}

// Inicializar botón al cargar
document.addEventListener('DOMContentLoaded', () => {
    updateThemeButton(currentTheme);
    
    // Agregar listener al botón
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
});

