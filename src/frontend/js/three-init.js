/**
 * Three.js - Splash Screen 3D Animado
 */

let splashScene, splashCamera, splashRenderer, splashCube, splashTorus;

function initSplashScreen() {
    const container = document.getElementById('threejsContainer');
    if (!container) return;

    // Crear escena
    splashScene = new THREE.Scene();
    splashScene.background = new THREE.Color(0x0d1117);

    // Cámara
    splashCamera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    splashCamera.position.z = 5;

    // Renderer
    splashRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    splashRenderer.setSize(window.innerWidth, window.innerHeight);
    splashRenderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(splashRenderer.domElement);

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    splashScene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x00d9ff, 1);
    pointLight1.position.set(5, 5, 5);
    splashScene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff00d9, 1);
    pointLight2.position.set(-5, -5, -5);
    splashScene.add(pointLight2);

    // Cubo central con gradiente
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshPhongMaterial({
        color: 0x00d9ff,
        emissive: 0x0066ff,
        specular: 0xffffff,
        shininess: 100,
        transparent: true,
        opacity: 0.9
    });
    splashCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    splashScene.add(splashCube);

    // Torus giratorio
    const torusGeometry = new THREE.TorusGeometry(2.5, 0.3, 16, 100);
    const torusMaterial = new THREE.MeshPhongMaterial({
        color: 0xff00d9,
        emissive: 0x990066,
        specular: 0xffffff,
        shininess: 100,
        transparent: true,
        opacity: 0.7
    });
    splashTorus = new THREE.Mesh(torusGeometry, torusMaterial);
    splashTorus.rotation.x = Math.PI / 4;
    splashScene.add(splashTorus);

    // Partículas de fondo
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 500;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 20;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    splashScene.add(particlesMesh);

    // Animación
    function animateSplash() {
        requestAnimationFrame(animateSplash);

        // Rotar cubo
        splashCube.rotation.x += 0.01;
        splashCube.rotation.y += 0.01;

        // Rotar torus
        splashTorus.rotation.z += 0.005;

        // Pulsar cubo (escala)
        const scale = 1 + Math.sin(Date.now() * 0.002) * 0.1;
        splashCube.scale.set(scale, scale, scale);

        // Rotar partículas
        particlesMesh.rotation.y += 0.0005;

        splashRenderer.render(splashScene, splashCamera);
    }

    animateSplash();

    // Responsive
    window.addEventListener('resize', () => {
        if (!splashRenderer) return;
        splashCamera.aspect = window.innerWidth / window.innerHeight;
        splashCamera.updateProjectionMatrix();
        splashRenderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Ocultar splash screen después de cargar
function hideSplashScreen() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                // Limpiar recursos de Three.js
                if (splashRenderer) {
                    splashRenderer.dispose();
                    const container = document.getElementById('threejsContainer');
                    if (container && container.firstChild) {
                        container.removeChild(container.firstChild);
                    }
                }
            }, 500);
        }, 2000); // Mostrar 2 segundos
    }
}

// Inicializar al cargar la página
if (typeof THREE !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initSplashScreen();
    });
    
    window.addEventListener('load', () => {
        hideSplashScreen();
    });
} else {
    console.warn('Three.js no cargado');
}

