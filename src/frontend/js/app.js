// Configuración global
const API_BASE = '/api';
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || '{}');
let socket = null;
let currentView = 'devices';

// Verificar autenticación
if (!token) {
    window.location.href = 'index.html';
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    console.log('🚀 Inicializando aplicación...');
    console.log('Usuario:', user);
    
    // Mostrar nombre de usuario
    document.getElementById('userName').textContent = user.nombre_completo || user.username;

    // Conectar Socket.IO
    await connectSocket();

    // Event listeners
    setupEventListeners();

    // Cargar vista inicial
    loadView('devices');
    
    console.log('✅ Aplicación inicializada');
}

// Conectar Socket.IO
function connectSocket() {
    return new Promise((resolve, reject) => {
        console.log('🔌 Conectando Socket.IO...');
        
        socket = io();

        socket.on('connect', () => {
            console.log('✅ Socket.IO conectado - ID:', socket.id);
            resolve();
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket.IO desconectado');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Error de conexión Socket.IO:', error);
            reject(error);
        });

        // Eventos de QR globales
        socket.on('qr-session', (data) => {
            console.log('📱 QR recibido (evento global):', data.sessionId);
        });

        socket.on('ready-session', (data) => {
            console.log('✅ Sesión lista (evento global):', data.sessionId);
            showAlert('Dispositivo conectado correctamente', 'success');
            loadDevices();
        });

        socket.on('disconnected-session', (data) => {
            console.log('⚠️ Sesión desconectada:', data.sessionId);
            showAlert('Dispositivo desconectado', 'warning');
            loadDevices();
        });

        // Eventos de campaña - errores de mensajes
        socket.onAny((eventName, ...args) => {
            if (eventName.startsWith('campaign-error-message-')) {
                const errorData = args[0];
                handleCampaignErrorMessage(errorData);
            } else if (eventName.startsWith('campaign-progress-')) {
                const progressData = args[0];
                handleCampaignProgress(progressData);
            } else if (eventName.startsWith('campaign-paused-')) {
                const pauseData = args[0];
                showAlert(`⏸️ Campaña pausada en paso ${pauseData.currentStep}/${pauseData.totalSteps}`, 'info');
                loadCampaigns();
            } else if (eventName.startsWith('campaign-resumed-')) {
                const resumeData = args[0];
                showAlert(`▶️ Campaña reanudada desde paso ${resumeData.resumingFrom}`, 'success');
                loadCampaigns();
            }
        });

        // Log de TODOS los eventos para debug
        socket.onAny((eventName, ...args) => {
            console.log(`📡 Socket evento: ${eventName}`, args);
        });

        // Timeout de 5 segundos
        setTimeout(() => {
            if (!socket.connected) {
                console.error('⏱️ Timeout: Socket.IO no se conectó');
                reject(new Error('Timeout conectando Socket.IO'));
            }
        }, 5000);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            loadView(view);
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Header action button
    document.getElementById('headerActionBtn').addEventListener('click', handleHeaderAction);

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    });
}

// Cargar vista
async function loadView(viewName) {
    currentView = viewName;

    // Actualizar navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        }
    });

    // Ocultar todas las vistas
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Mostrar vista seleccionada
    const viewElement = document.getElementById(`${viewName}View`);
    if (viewElement) {
        viewElement.classList.add('active');
    }

    // Actualizar título y botón de acción
    const titles = {
        devices: 'Dispositivos',
        categories: 'Categorías',
        contacts: 'Contactos',
        campaigns: 'Campañas',
        manual: 'Envío Manual',
        chats: 'Chats',
        schedule: 'Campañas Agendadas',
        calendar: 'Calendario de Campañas',
        notes: 'Mis Notas'
    };

    const actions = {
        devices: '+ Nuevo Dispositivo',
        categories: '+ Nueva Categoría',
        contacts: '+ Nuevo Contacto',
        campaigns: '+ Nueva Campaña',
        manual: '',
        chats: '',
        schedule: '',
        calendar: '',
        notes: '+ Nueva Nota'
    };

    document.getElementById('viewTitle').textContent = titles[viewName] || viewName;
    const actionBtn = document.getElementById('headerActionBtn');
    actionBtn.textContent = actions[viewName] || '';
    actionBtn.style.display = actions[viewName] ? 'inline-flex' : 'none';

    // Cargar datos de la vista
    switch (viewName) {
        case 'devices':
            await loadDevices();
            break;
        case 'categories':
            await loadCategories();
            break;
        case 'contacts':
            await loadContacts();
            await loadCategoriesForFilter();
            break;
        case 'campaigns':
            await loadCampaigns();
            break;
        case 'manual':
            await loadDevicesForManual();
            break;
        case 'chats':
            await loadChats();
            break;
        case 'schedule':
            await loadScheduledCampaigns();
            break;
        case 'calendar':
            await loadCalendar();
            break;
        case 'notes':
            await loadNotes();
            break;
    }
}

// Handle header action button
function handleHeaderAction() {
    switch (currentView) {
        case 'devices':
            showCreateDeviceModal();
            break;
        case 'categories':
            showCreateCategoryModal();
            break;
        case 'contacts':
            showCreateContactModal();
            break;
        case 'campaigns':
            showCreateCampaignModal();
            break;
        case 'notes':
            showCreateNoteModal();
            break;
    }
}

// API Helper
async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    if (options.headers) {
        finalOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }

    try {
        const response = await fetch(API_BASE + endpoint, finalOptions);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error en la petición');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// DEVICES FUNCTIONS
async function loadDevices() {
    try {
        const data = await apiRequest('/devices');
        const devicesGrid = document.getElementById('devicesGrid');
        devicesGrid.innerHTML = '';

        if (data.devices.length === 0) {
            devicesGrid.innerHTML = '<p class="empty-state">No hay dispositivos. Crea uno para empezar.</p>';
            return;
        }

        data.devices.forEach(device => {
            const card = createDeviceCard(device);
            devicesGrid.appendChild(card);
        });
    } catch (error) {
        showAlert('Error al cargar dispositivos: ' + error.message, 'error');
    }
}

function createDeviceCard(device) {
    const card = document.createElement('div');
    card.className = 'device-card';

    const statusClass = `status-${device.estado}`;
    const statusText = {
        'conectado': 'Conectado',
        'desconectado': 'Desconectado',
        'esperando_qr': 'Esperando QR',
        'error': 'Error'
    }[device.estado] || device.estado;

    card.innerHTML = `
        <div class="device-header">
            <div class="device-name">${device.nombre_dispositivo}</div>
            <span class="device-status ${statusClass}">${statusText}</span>
        </div>
        <div class="device-info">
            ${device.numero_telefono ? `📞 ${device.numero_telefono}` : 'Sin número asociado'}
        </div>
        <div class="device-actions">
            ${device.estado === 'desconectado' ? 
                `<button class="btn btn-primary btn-sm" onclick="connectDevice('${device.session_id}', ${device.id})">Conectar</button>` :
                device.estado === 'conectado' ?
                `<button class="btn btn-danger btn-sm" onclick="disconnectDevice('${device.session_id}')">Desconectar</button>` :
                ''
            }
            <button class="btn btn-danger btn-sm" onclick="deleteDevice(${device.id})">Eliminar</button>
        </div>
    `;

    return card;
}

async function showCreateDeviceModal() {
    const modal = document.getElementById('genericModal');
    document.getElementById('genericModalTitle').textContent = 'Nuevo Dispositivo';
    
    document.getElementById('genericModalBody').innerHTML = `
        <div class="form-group">
            <label>Nombre del dispositivo</label>
            <input type="text" id="deviceName" class="form-control" placeholder="Ej: Dispositivo 1" required>
        </div>
    `;

    document.getElementById('genericModalAction').innerHTML = `
        <button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
        <button class="btn btn-primary" onclick="createDevice()">Crear</button>
    `;

    modal.classList.add('active');
}

async function createDevice() {
    const nombre = document.getElementById('deviceName').value;

    if (!nombre) {
        showAlert('El nombre es requerido', 'error');
        return;
    }

    try {
        const data = await apiRequest('/devices', {
            method: 'POST',
            body: JSON.stringify({ nombre_dispositivo: nombre })
        });

        showAlert('Dispositivo creado correctamente', 'success');
        closeAllModals();
        loadDevices();
    } catch (error) {
        showAlert('Error al crear dispositivo: ' + error.message, 'error');
    }
}

async function connectDevice(sessionId, deviceId) {
    try {
        console.log('\n🔵 === INICIANDO CONEXIÓN DE DISPOSITIVO ===');
        console.log('SessionId:', sessionId);
        console.log('DeviceId:', deviceId);
        console.log('Socket conectado?:', socket && socket.connected);
        console.log('Socket ID:', socket ? socket.id : 'N/A');
        
        if (!socket || !socket.connected) {
            throw new Error('Socket.IO no está conectado. Recarga la página.');
        }
        
        // Mostrar modal de QR
        const qrModal = document.getElementById('qrModal');
        const qrImage = document.getElementById('qrImage');
        const qrStatus = document.getElementById('qrStatus');
        
        if (!qrModal || !qrImage || !qrStatus) {
            throw new Error('Elementos del modal no encontrados');
        }
        
        qrImage.src = '';
        qrImage.alt = 'Generando código QR...';
        qrStatus.innerHTML = '<div class="alert alert-info">⏳ Generando código QR...</div>';
        qrStatus.style.display = 'block';
        qrModal.classList.add('active');
        
        console.log('✅ Modal de QR mostrado');

        // Remover listeners anteriores para evitar duplicados
        socket.off(`qr-${sessionId}`);
        socket.off(`ready-${sessionId}`);
        socket.off(`authenticated-${sessionId}`);
        socket.off(`auth_failure-${sessionId}`);
        socket.off('session-created');
        socket.off('session-error');
        
        console.log('✅ Listeners antiguos removidos');

        // Definir handlers con referencias para poder removerlos luego
        console.log(`🎧 Configurando listener para: qr-${sessionId}`);
        const onQr = (data) => {
            try {
                console.log('🎯 ¡QR RECIBIDO!', data);
                console.log('   QR length:', data.qr ? data.qr.length : 'undefined');

                if (data && data.qr) {
                    qrImage.src = data.qr;
                    qrImage.alt = 'Código QR';
                    qrStatus.innerHTML = '<div class="alert alert-info">📱 Escanea el código con WhatsApp</div>';
                    qrStatus.style.display = 'block';
                    console.log('✅ QR mostrado en la imagen');
                } else {
                    console.error('❌ data.qr está vacío o undefined');
                }
            } catch (err) {
                console.error('Error en onQr handler:', err);
            }
        };

        const onAuthenticated = (data) => {
            console.log('✅ Autenticado:', sessionId, data);
            qrStatus.innerHTML = '<div class="alert alert-success">✓ Autenticado. Conectando...</div>';
        };

        const onReady = (data) => {
            console.log('✅ Dispositivo conectado:', sessionId, data);
            qrStatus.innerHTML = '<div class="alert alert-success">✓ Dispositivo conectado correctamente</div>';
            showAlert('Dispositivo conectado correctamente', 'success');

            setTimeout(() => {
                closeAllModals();
                loadDevices();

                // Limpiar listeners específicos
                socket.off(`qr-${sessionId}`, onQr);
                socket.off(`ready-${sessionId}`, onReady);
                socket.off(`authenticated-${sessionId}`, onAuthenticated);
                socket.off(`auth_failure-${sessionId}`);
                socket.off('session-created');
                socket.off('session-error');
            }, 2000);
        };

        const onAuthFailure = (data) => {
            console.error('❌ Error de autenticación:', data);
            qrStatus.innerHTML = '<div class="alert alert-error">❌ Error de autenticación</div>';
            showAlert('Error de autenticación: ' + (data.error || 'Unknown'), 'error');
        };

        // Escuchar evento de QR específico para esta sesión
        socket.on(`qr-${sessionId}`, onQr);

        // Fallbacks: algunos entornos podrían emitir eventos globales o con otro nombre
        socket.on('qr', (data) => {
            if (data && data.sessionId === sessionId) onQr(data);
        });

        socket.on('qr-session', (data) => {
            if (data && data.sessionId === sessionId) onQr(data);
        });

        // Escuchar evento de autenticación y ready
        socket.on(`authenticated-${sessionId}`, onAuthenticated);
        socket.on(`ready-${sessionId}`, onReady);
        socket.on(`auth_failure-${sessionId}`, onAuthFailure);

        // Escuchar confirmación de creación de sesión por parte del servidor
        const onSessionCreated = (data) => {
            console.log('📨 session-created recibido del servidor:', data);
            if (data && data.sessionId === sessionId) {
                qrStatus.innerHTML = '<div class="alert alert-info">✅ Sesión creada. Esperando QR...</div>';
            }
        };

        const onSessionError = (data) => {
            console.error('📨 session-error recibido del servidor:', data);
            qrStatus.innerHTML = '<div class="alert alert-error">❌ Error creando sesión</div>';
            showAlert('Error creando sesión: ' + (data.message || 'Unknown'), 'error');
        };

        socket.on('session-created', onSessionCreated);
        socket.on('session-error', onSessionError);

        console.log('✅ Todos los listeners configurados');

        // Solicitar creación de sesión
        const sessionData = {
            sessionId,
            userId: user.id,
            deviceId
        };
        
        console.log('📤 Emitiendo evento create-session:', sessionData);
        socket.emit('create-session', sessionData);

        console.log('✅ Solicitud de sesión enviada');
        console.log('🔵 === FIN SETUP CONEXIÓN ===\n');

    } catch (error) {
        console.error('❌ Error al conectar dispositivo:', error);
        showAlert('Error al conectar dispositivo: ' + error.message, 'error');
    }
}

async function disconnectDevice(sessionId) {
    if (!confirm('¿Estás seguro de desconectar este dispositivo?')) return;

    try {
        socket.emit('destroy-session', { sessionId });
        showAlert('Dispositivo desconectado', 'success');
        setTimeout(() => loadDevices(), 1000);
    } catch (error) {
        showAlert('Error al desconectar: ' + error.message, 'error');
    }
}

async function deleteDevice(deviceId) {
    if (!confirm('¿Estás seguro de eliminar este dispositivo?')) return;

    try {
        await apiRequest(`/devices/${deviceId}`, { method: 'DELETE' });
        showAlert('Dispositivo eliminado', 'success');
        loadDevices();
    } catch (error) {
        showAlert('Error al eliminar: ' + error.message, 'error');
    }
}

// CATEGORIES FUNCTIONS
async function loadCategories() {
    try {
        const data = await apiRequest('/categories');
        const grid = document.getElementById('categoriesGrid');
        grid.innerHTML = '';

        if (data.categories.length === 0) {
            grid.innerHTML = '<p class="empty-state">No hay categorías. Crea una para empezar.</p>';
            return;
        }

        data.categories.forEach(cat => {
            const card = createCategoryCard(cat);
            grid.appendChild(card);
        });
    } catch (error) {
        showAlert('Error al cargar categorías: ' + error.message, 'error');
    }
}

function createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.style.borderLeftColor = category.color || '#007bff';

    card.innerHTML = `
        <div class="category-header">
            <div class="category-name">${category.nombre}</div>
        </div>
        <div class="category-description">${category.descripcion || 'Sin descripción'}</div>
        <div class="category-stats">
            <span>📊 ${category.total_contactos} contactos</span>
            ${category.nombre_dispositivo ? `<span>📱 ${category.nombre_dispositivo}</span>` : ''}
        </div>
        <div class="device-actions" style="margin-top: 15px;">
            <button class="btn btn-secondary btn-sm" onclick="editCategory(${category.id})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="deleteCategory(${category.id})">Eliminar</button>
        </div>
    `;

    return card;
}

async function showCreateCategoryModal() {
    const modal = document.getElementById('genericModal');
    document.getElementById('genericModalTitle').textContent = 'Nueva Categoría';
    
    // Cargar dispositivos disponibles
    const devices = await apiRequest('/devices');
    
    document.getElementById('genericModalBody').innerHTML = `
        <div class="form-group">
            <label>Nombre</label>
            <input type="text" id="categoryName" class="form-control" required>
        </div>
        <div class="form-group">
            <label>Descripción</label>
            <textarea id="categoryDescription" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-group">
            <label>Color</label>
            <input type="color" id="categoryColor" class="form-control" value="#007bff">
        </div>
        <div class="form-group">
            <label>Dispositivo responsable (opcional)</label>
            <select id="categoryDevice" class="form-control">
                <option value="">Sin dispositivo asignado</option>
                ${devices.devices.map(device => `<option value="${device.id}">${device.nombre_dispositivo}</option>`).join('')}
            </select>
            <small class="form-text text-muted">Los mensajes de esta categoría se enviarán desde el dispositivo seleccionado</small>
        </div>
    `;

    document.getElementById('genericModalAction').innerHTML = `
        <button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
        <button class="btn btn-primary" onclick="createCategory()">Crear</button>
    `;

    modal.classList.add('active');
}

async function createCategory() {
    const nombre = document.getElementById('categoryName').value;
    const descripcion = document.getElementById('categoryDescription').value;
    const color = document.getElementById('categoryColor').value;
    const dispositivo_id = document.getElementById('categoryDevice').value || null;

    if (!nombre) {
        showAlert('El nombre es requerido', 'error');
        return;
    }

    try {
        await apiRequest('/categories', {
            method: 'POST',
            body: JSON.stringify({ nombre, descripcion, color, dispositivo_id })
        });

        showAlert('Categoría creada correctamente', 'success');
        closeAllModals();
        loadCategories();
    } catch (error) {
        showAlert('Error al crear categoría: ' + error.message, 'error');
    }
}

async function editCategory(id) {
    try {
        const data = await apiRequest('/categories');
        const category = data.categories.find(c => c.id === id);
        
        if (!category) {
            showAlert('Categoría no encontrada', 'error');
            return;
        }

        // Cargar dispositivos disponibles
        const devices = await apiRequest('/devices');

        const modal = document.getElementById('genericModal');
        document.getElementById('genericModalTitle').textContent = 'Editar Categoría';
        
        document.getElementById('genericModalBody').innerHTML = `
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" id="categoryName" class="form-control" value="${category.nombre}" required>
            </div>
            <div class="form-group">
                <label>Descripción</label>
                <textarea id="categoryDescription" class="form-control" rows="3">${category.descripcion || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Color</label>
                <input type="color" id="categoryColor" class="form-control" value="${category.color || '#007bff'}">
            </div>
            <div class="form-group">
                <label>Dispositivo responsable (opcional)</label>
                <select id="categoryDevice" class="form-control">
                    <option value="">Sin dispositivo asignado</option>
                    ${devices.devices.map(device => 
                        `<option value="${device.id}" ${category.dispositivo_id === device.id ? 'selected' : ''}>${device.nombre_dispositivo}</option>`
                    ).join('')}
                </select>
                <small class="form-text text-muted">Los mensajes de esta categoría se enviarán desde el dispositivo seleccionado</small>
            </div>
        `;

        document.getElementById('genericModalAction').innerHTML = `
            <button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
            <button class="btn btn-primary" onclick="updateCategory(${id})">Actualizar</button>
        `;

        modal.classList.add('active');
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

async function updateCategory(id) {
    const nombre = document.getElementById('categoryName').value;
    const descripcion = document.getElementById('categoryDescription').value;
    const color = document.getElementById('categoryColor').value;
    const dispositivo_id = document.getElementById('categoryDevice').value || null;

    if (!nombre) {
        showAlert('El nombre es requerido', 'error');
        return;
    }

    try {
        await apiRequest(`/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ nombre, descripcion, color, dispositivo_id })
        });

        showAlert('Categoría actualizada', 'success');
        closeAllModals();
        loadCategories();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

async function deleteCategory(id) {
    if (!confirm('¿Eliminar esta categoría? Los contactos no se eliminarán.')) return;

    try {
        await apiRequest(`/categories/${id}`, { method: 'DELETE' });
        showAlert('Categoría eliminada', 'success');
        loadCategories();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

// CONTACTS FUNCTIONS
let allContacts = []; // Cache de todos los contactos

async function loadContacts() {
    try {
        const data = await apiRequest('/contacts');
        allContacts = data.contacts; // Guardar en cache
        renderContacts(allContacts);
    } catch (error) {
        showAlert('Error al cargar contactos: ' + error.message, 'error');
    }
}

function renderContacts(contacts) {
        const tbody = document.getElementById('contactsTableBody');
        tbody.innerHTML = '';

    if (contacts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay contactos</td></tr>';
            return;
        }

    contacts.forEach(contact => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${contact.nombre || '-'}</td>
                <td>${contact.telefono}</td>
                <td>${contact.categoria_nombre || 'Sin categoría'}</td>
                <td>${contact.estado}</td>
                <td>${new Date(contact.fecha_agregado).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteContact(${contact.id})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
}

/**
 * Crear avatar (foto o iniciales)
 */
function createAvatar(contact, sizeClass = '') {
    if (contact.foto_perfil) {
        return `<img src="${contact.foto_perfil}" class="avatar ${sizeClass}" alt="${contact.nombre || contact.telefono}">`;
    } else {
        // Generar iniciales
        const nombre = contact.nombre || contact.telefono;
        const iniciales = nombre.substring(0, 2);
        return `<div class="avatar ${sizeClass}">${iniciales}</div>`;
    }
}

// Función fetchProfilePicture removida - fotos solo en chats

function filterContacts() {
    const searchText = document.getElementById('contactSearchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('contactCategoryFilter').value;

    let filtered = allContacts;

    // Filtrar por búsqueda de texto
    if (searchText) {
        filtered = filtered.filter(contact => {
            const nombre = (contact.nombre || '').toLowerCase();
            const telefono = (contact.telefono || '').toLowerCase();
            return nombre.includes(searchText) || telefono.includes(searchText);
        });
    }

    // Filtrar por categoría
    if (categoryFilter) {
        filtered = filtered.filter(contact => {
            return contact.categoria_id && contact.categoria_id.toString() === categoryFilter;
        });
    }

    renderContacts(filtered);
}

async function loadCategoriesForFilter() {
    try {
        const data = await apiRequest('/categories');
        const select = document.getElementById('contactCategoryFilter');
        select.innerHTML = '<option value="">Todas las categorías</option>';
        
        data.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nombre;
            select.appendChild(option);
        });

        // Agregar event listeners para filtrado
        select.addEventListener('change', filterContacts);
        
        const searchInput = document.getElementById('contactSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', filterContacts);
        }
    } catch (error) {
        console.error('Error cargando categorías:', error);
    }
}

function showCreateContactModal() {
    const modal = document.getElementById('genericModal');
    document.getElementById('genericModalTitle').textContent = 'Nuevo Contacto';
    
    apiRequest('/categories').then(categories => {
        document.getElementById('genericModalBody').innerHTML = `
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" id="contactName" class="form-control" placeholder="Nombre del contacto">
            </div>
            <div class="form-group">
                <label>Teléfono *</label>
                <input type="text" id="contactPhone" class="form-control" placeholder="51999888777" required>
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="contactCategory" class="form-control">
                    <option value="">Sin categoría</option>
                    ${categories.categories.map(cat => `<option value="${cat.id}">${cat.nombre}</option>`).join('')}
                </select>
            </div>
        `;

        document.getElementById('genericModalAction').innerHTML = `
            <button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
            <button class="btn btn-primary" onclick="createContact()">Crear</button>
        `;

        modal.classList.add('active');
    });
}

async function createContact() {
    const nombre = document.getElementById('contactName').value;
    const telefono = document.getElementById('contactPhone').value;
    const categoria_id = document.getElementById('contactCategory').value || null;

    if (!telefono) {
        showAlert('El teléfono es requerido', 'error');
        return;
    }

    try {
        await apiRequest('/contacts', {
            method: 'POST',
            body: JSON.stringify({ nombre, telefono, categoria_id })
        });

        showAlert('Contacto creado correctamente', 'success');
        closeAllModals();
        loadContacts();
    } catch (error) {
        showAlert('Error al crear contacto: ' + error.message, 'error');
    }
}

async function deleteContact(id) {
    if (!confirm('¿Eliminar este contacto?')) return;

    try {
        await apiRequest(`/contacts/${id}`, { method: 'DELETE' });
        showAlert('Contacto eliminado', 'success');
        loadContacts();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

// CAMPAIGNS FUNCTIONS
async function loadCampaigns() {
    try {
        const data = await apiRequest('/campaigns');
        const list = document.getElementById('campaignsList');
        list.innerHTML = '';

        if (data.campaigns.length === 0) {
            list.innerHTML = '<p class="empty-state">No hay campañas</p>';
            return;
        }

        data.campaigns.forEach(campaign => {
            const card = createCampaignCard(campaign);
            list.appendChild(card);
        });
    } catch (error) {
        showAlert('Error al cargar campañas: ' + error.message, 'error');
    }
}

function createCampaignCard(campaign) {
    const card = document.createElement('div');
    card.className = 'campaign-card';

    const progress = campaign.total_mensajes > 0 
        ? (campaign.mensajes_enviados / campaign.total_mensajes * 100).toFixed(1)
        : 0;

    card.innerHTML = `
        <div class="campaign-header">
            <div class="campaign-title">${campaign.nombre}</div>
            <span class="device-status status-${campaign.estado}">${campaign.estado}</span>
        </div>
        ${campaign.descripcion ? `<p>${campaign.descripcion}</p>` : ''}
        <div class="campaign-info">
            <div class="campaign-stat">
                <label>Total mensajes</label>
                <value>${campaign.total_mensajes}</value>
            </div>
            <div class="campaign-stat">
                <label>Enviados</label>
                <value>${campaign.mensajes_enviados}</value>
            </div>
            <div class="campaign-stat">
                <label>Fallidos</label>
                <value>${campaign.mensajes_fallidos}</value>
            </div>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="campaign-actions">
            ${campaign.estado === 'borrador' || campaign.estado === 'pausada' ?
                `<button class="btn btn-success btn-sm" onclick="startCampaign(${campaign.id})">Iniciar</button>` : ''}
            ${campaign.estado === 'en_proceso' ?
                `<button class="btn btn-warning btn-sm" onclick="pauseCampaign(${campaign.id})">Pausar</button>` : ''}
            ${campaign.mensajes_fallidos > 0 ?
                `<button class="btn btn-secondary btn-sm" onclick="viewCampaignErrors(${campaign.id})">❌ Ver Errores (${campaign.mensajes_fallidos})</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="cancelCampaign(${campaign.id})">Cancelar</button>
        </div>
    `;

    return card;
}

function showCreateCampaignModal() {
    const modal = document.getElementById('genericModal');
    document.getElementById('genericModalTitle').textContent = 'Nueva Campaña';
    
    document.getElementById('genericModalBody').innerHTML = `
        <div class="form-group">
            <label>Nombre de la campaña *</label>
            <input type="text" id="campaignName" class="form-control" placeholder="Ej: Campaña Navidad 2025" required>
        </div>
        <div class="form-group">
            <label>Descripción</label>
            <textarea id="campaignDescription" class="form-control" rows="3" placeholder="Descripción de la campaña"></textarea>
        </div>
        
        <!-- NUEVA SECCIÓN: Agendamiento -->
        <div class="form-group">
            <label>
                <input type="checkbox" id="scheduleCheckbox" onchange="toggleScheduleFields()"> 
                Agendar para fecha/hora específica
            </label>
        </div>
        <div id="scheduleFields" style="display: none;">
            <div class="form-group">
                <label>Fecha de inicio</label>
                <input type="date" id="scheduledDate" class="form-control">
            </div>
            <div class="form-group">
                <label>Hora de inicio</label>
                <input type="time" id="scheduledTime" class="form-control" value="08:00">
            </div>
        </div>
        
        <!-- NUEVA SECCIÓN: Configuración de horario y límites -->
        <div class="form-group">
            <label>Horario de envío (inicio)</label>
            <input type="time" id="horarioInicio" class="form-control" value="08:00">
        </div>
        <div class="form-group">
            <label>Horario de envío (fin)</label>
            <input type="time" id="horarioFin" class="form-control" value="19:00">
        </div>
        <div class="form-group">
            <label>Máximo mensajes por día</label>
            <select id="maxMensajesDia" class="form-control" onchange="calculateEstimatedTime()">
                <option value="100">100 mensajes/día</option>
                <option value="300" selected>300 mensajes/día</option>
                <option value="500">500 mensajes/día</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Tipo</label>
            <select id="campaignType" class="form-control" onchange="toggleExcelUpload()">
                <option value="manual">Manual</option>
                <option value="excel">Desde Excel</option>
            </select>
        </div>
        <div id="excelUploadSection" style="display: none;">
            <div class="alert alert-info">
                📋 El Excel debe tener las siguientes columnas:<br>
                <strong>categoria | telefono | nombre | mensaje</strong>
            </div>
            <div class="form-group">
                <label>Archivo Excel *</label>
                <input type="file" id="excelFile" class="form-control" accept=".xlsx,.xls" onchange="calculateEstimatedTime()">
            </div>
            <div class="form-group">
                <label>Categoría por defecto (opcional)</label>
                <select id="defaultCategory" class="form-control">
                    <option value="">Sin categoría</option>
                </select>
            </div>
        </div>
        
        <!-- NUEVO: Tiempo estimado -->
        <div id="estimatedTimeSection" style="display: none; margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 6px;">
            <strong>⏱️ Tiempo Estimado:</strong>
            <div id="estimatedTimeText" style="font-size: 16px; margin-top: 10px; color: #1976d2;"></div>
        </div>
    `;

    // Cargar categorías
    apiRequest('/categories').then(response => {
        const select = document.getElementById('defaultCategory');
        if (select && response.categories) {
            response.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.nombre;
                select.appendChild(option);
            });
        }
    }).catch(err => console.error('Error cargando categorías:', err));

    document.getElementById('genericModalAction').innerHTML = `
        <button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
        <button class="btn btn-primary" onclick="createCampaign()">Crear Campaña</button>
    `;

    modal.classList.add('active');
}

// Función para toggle de campos de agendamiento
function toggleScheduleFields() {
    const checkbox = document.getElementById('scheduleCheckbox');
    const fields = document.getElementById('scheduleFields');
    if (fields) {
        fields.style.display = checkbox.checked ? 'block' : 'none';
        
        // Si se activa, poner fecha de mañana por defecto
        if (checkbox.checked) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateInput = document.getElementById('scheduledDate');
            if (dateInput) {
                dateInput.value = tomorrow.toISOString().split('T')[0];
            }
        }
    }
}

// Función para calcular tiempo estimado
async function calculateEstimatedTime() {
    const excelFile = document.getElementById('excelFile');
    const maxMensajes = parseInt(document.getElementById('maxMensajesDia').value);
    const horarioInicio = document.getElementById('horarioInicio').value;
    const horarioFin = document.getElementById('horarioFin').value;
    
    // Calcular horas disponibles
    const [horaIni, minIni] = horarioInicio.split(':').map(Number);
    const [horaFin, minFin] = horarioFin.split(':').map(Number);
    const minutosDisponibles = (horaFin * 60 + minFin) - (horaIni * 60 + minIni);
    const horasDisponibles = minutosDisponibles / 60;
    
    if (!excelFile || !excelFile.files[0]) {
        document.getElementById('estimatedTimeSection').style.display = 'none';
        return;
    }
    
    // Leer Excel para contar mensajes
    const file = excelFile.files[0];
    const reader = new FileReader();
    
    // Por ahora, hacer estimación simple sin leer el Excel (sin prompt molesto)
    // Estimación: 300 mensajes por defecto
    const numMensajes = 300;
    
    // Obtener dispositivos conectados
    apiRequest('/devices').then(devicesData => {
        const connectedDevices = devicesData.devices.filter(d => d.estado === 'conectado').length || 1;
        
        // Cálculo
        const mensajesLimitados = Math.min(numMensajes, maxMensajes);
        const segundosPorMensaje = (horasDisponibles * 3600) / mensajesLimitados;
        const tiempoTotalHoras = (segundosPorMensaje * mensajesLimitados) / 3600;
        
        // Mostrar resultado
        const section = document.getElementById('estimatedTimeSection');
        const text = document.getElementById('estimatedTimeText');
        
        if (section && text) {
            section.style.display = 'block';
            text.innerHTML = `
                📊 Estimado: <strong>${mensajesLimitados}</strong> mensajes<br>
                📱 <strong>${connectedDevices}</strong> dispositivo(s) conectado(s)<br>
                ⏰ Horario: <strong>${horarioInicio} - ${horarioFin}</strong> (${horasDisponibles.toFixed(1)}h)<br>
                🕐 Delay promedio: <strong>${Math.floor(segundosPorMensaje / 60)}m ${Math.floor(segundosPorMensaje % 60)}s</strong> entre mensajes<br>
                ⏱️ Tiempo total estimado: <strong>${Math.floor(tiempoTotalHoras)}h ${Math.floor((tiempoTotalHoras % 1) * 60)}m</strong><br>
                ${mensajesLimitados < numMensajes ? `<br>⚠️ Se enviarán solo ${mensajesLimitados} de ${numMensajes} mensajes (límite diario)` : ''}
                <br><br><small>💡 La cantidad exacta se calculará al importar el Excel</small>
            `;
        }
    }).catch(err => console.error('Error obteniendo dispositivos:', err));
}

function toggleExcelUpload() {
    const tipo = document.getElementById('campaignType').value;
    const excelSection = document.getElementById('excelUploadSection');
    if (excelSection) {
        excelSection.style.display = tipo === 'excel' ? 'block' : 'none';
    }
}

async function createCampaign() {
    const nombre = document.getElementById('campaignName').value;
    const descripcion = document.getElementById('campaignDescription').value;
    const tipo = document.getElementById('campaignType').value;
    
    // NUEVOS CAMPOS
    const scheduleCheckbox = document.getElementById('scheduleCheckbox');
    const isScheduled = scheduleCheckbox ? scheduleCheckbox.checked : false;
    const scheduledDate = document.getElementById('scheduledDate');
    const scheduledTime = document.getElementById('scheduledTime');
    const horarioInicio = document.getElementById('horarioInicio').value;
    const horarioFin = document.getElementById('horarioFin').value;
    const maxMensajesDia = parseInt(document.getElementById('maxMensajesDia').value);

    if (!nombre) {
        showAlert('El nombre es requerido', 'error');
        return;
    }

    try {
        // Preparar fecha agendada si aplica
        let fechaAgendada = null;
        if (isScheduled && scheduledDate && scheduledTime) {
            fechaAgendada = `${scheduledDate.value} ${scheduledTime.value}:00`;
        }
        
        // Crear campaña con nueva configuración
        const campaign = await apiRequest('/campaigns', {
            method: 'POST',
            body: JSON.stringify({ 
                nombre, 
                descripcion, 
                tipo,
                fecha_agendada: fechaAgendada,
                horario_inicio: horarioInicio + ':00',
                horario_fin: horarioFin + ':00',
                max_mensajes_dia: maxMensajesDia,
                distribucion_automatica: true,
                configuracion: {}
            })
        });

        // Si es tipo Excel, subir el archivo
        if (tipo === 'excel') {
            const fileInput = document.getElementById('excelFile');
            const defaultCategory = document.getElementById('defaultCategory').value;
            
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                showAlert('Campaña creada, pero no se seleccionó archivo Excel', 'warning');
                closeAllModals();
                loadCampaigns();
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('campaignId', campaign.campaign.id);
            if (defaultCategory) {
                formData.append('categoryId', defaultCategory);
            }

            console.log('📤 Enviando Excel:', {
                campaignId: campaign.campaign.id,
                fileName: fileInput.files[0].name,
                categoryId: defaultCategory || 'Sin categoría'
            });

            // Subir Excel
            const token = localStorage.getItem('token');
            const response = await fetch('/api/upload/contacts-excel', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMsg = errorData.error || errorData.message || 'Error subiendo archivo Excel';
                throw new Error(errorMsg);
            }

            const result = await response.json();
            
            console.log('✅ Excel importado:', result);
            
            // Verificar si hay categorías sin dispositivo asignado
            await checkUnassignedCategories();
            
            if (fechaAgendada) {
                showAlert(`✅ Campaña agendada para ${fechaAgendada}! ${result.added} contactos importados`, 'success');
            } else {
                showAlert(`✅ Campaña creada! ${result.added} contactos importados`, 'success');
            }
        } else {
            if (fechaAgendada) {
                showAlert(`✅ Campaña agendada para ${fechaAgendada}`, 'success');
            } else {
                showAlert('Campaña creada. Ahora agrega contactos y mensajes.', 'success');
            }
        }

        closeAllModals();
        loadCampaigns();
    } catch (error) {
        showAlert('Error al crear campaña: ' + error.message, 'error');
    }
}

async function startCampaign(id) {
    try {
        await apiRequest(`/campaigns/${id}/start`, { method: 'POST' });
        showAlert('Campaña iniciada', 'success');
        loadCampaigns();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

async function pauseCampaign(id) {
    try {
        await apiRequest(`/campaigns/${id}/pause`, { method: 'POST' });
        showAlert('Campaña pausada', 'success');
        loadCampaigns();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

// Manejar errores de mensajes de campaña (números inválidos, etc.)
function handleCampaignErrorMessage(errorData) {
    const { telefono, observacion, numeroInvalido, error } = errorData;
    
    // Si es número inválido, mostrarlo con un estilo especial
    if (numeroInvalido) {
        console.error(`❌ NÚMERO INVÁLIDO: ${telefono} - ${observacion}`);
        
        // Crear o actualizar contenedor de errores
        let errorContainer = document.getElementById('campaignErrorsLive');
        if (!errorContainer) {
            // Crear contenedor si no existe
            const campaignsView = document.querySelector('#campaignsView');
            if (campaignsView) {
                errorContainer = document.createElement('div');
                errorContainer.id = 'campaignErrorsLive';
                errorContainer.className = 'campaign-errors-live';
                errorContainer.innerHTML = '<h4>⚠️ Errores en Tiempo Real</h4><div id="errorsList"></div>';
                campaignsView.insertBefore(errorContainer, campaignsView.firstChild);
            }
        }
        
        // Agregar error a la lista
        const errorsList = document.getElementById('errorsList');
        if (errorsList) {
            const errorItem = document.createElement('div');
            errorItem.className = 'error-item error-invalid-number';
            errorItem.innerHTML = `
                <span class="error-icon">📵</span>
                <span class="error-number">${telefono}</span>
                <span class="error-reason">${observacion}</span>
                <span class="error-time">${new Date().toLocaleTimeString()}</span>
            `;
            errorsList.insertBefore(errorItem, errorsList.firstChild);
            
            // Limitar a 20 errores
            while (errorsList.children.length > 20) {
                errorsList.removeChild(errorsList.lastChild);
            }
        }
    } else {
        // Error normal (no número inválido)
        console.warn(`⚠️ Error en campaña: ${telefono} - ${observacion}`);
    }
}

// Manejar progreso de campaña
function handleCampaignProgress(progressData) {
    // Recargar campañas para actualizar progreso
    if (currentView === 'campaigns') {
        loadCampaigns();
    }
}

async function cancelCampaign(id) {
    if (!confirm('¿Cancelar esta campaña?')) return;
    
    try {
        await apiRequest(`/campaigns/${id}/cancel`, { method: 'POST' });
        showAlert('Campaña cancelada', 'success');
        loadCampaigns();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

// Ver errores de campaña
async function viewCampaignErrors(campaignId) {
    try {
        const data = await apiRequest(`/campaigns/${campaignId}/errors`);
        
        const errorsSection = document.getElementById('campaignErrorsSection');
        const tableBody = document.getElementById('campaignErrorsTableBody');
        const noErrorsMessage = document.getElementById('noErrorsMessage');
        
        tableBody.innerHTML = '';
        
        if (data.errors.length === 0) {
            noErrorsMessage.style.display = 'block';
            tableBody.closest('.table-container').style.display = 'none';
        } else {
            noErrorsMessage.style.display = 'none';
            tableBody.closest('.table-container').style.display = 'block';
            
            data.errors.forEach((error, index) => {
                const row = document.createElement('tr');
                const fechaFormateada = error.fecha_envio ? 
                    new Date(error.fecha_envio).toLocaleString('es-ES') : 
                    'N/A';
                const mensajeCorto = error.mensaje.length > 30 ? 
                    error.mensaje.substring(0, 30) + '...' : 
                    error.mensaje;
                
                row.innerHTML = `
                    <td>${String(index + 1).padStart(2, '0')}</td>
                    <td>${error.nombre_dispositivo || 'Dispositivo ' + error.dispositivo_id}</td>
                    <td>${error.nombre || error.telefono}</td>
                    <td title="${error.mensaje}">${mensajeCorto}</td>
                    <td><span class="error-badge">${error.observacion || 'Error desconocido'}</span></td>
                    <td>${fechaFormateada}</td>
                `;
                tableBody.appendChild(row);
            });
        }
        
        errorsSection.style.display = 'block';
        
        // Scroll suave a la sección de errores
        errorsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (error) {
        showAlert('Error al cargar errores: ' + error.message, 'error');
    }
}

// Cerrar sección de errores
document.addEventListener('DOMContentLoaded', () => {
    const closeErrorsBtn = document.getElementById('closeErrorsBtn');
    if (closeErrorsBtn) {
        closeErrorsBtn.onclick = () => {
            document.getElementById('campaignErrorsSection').style.display = 'none';
        };
    }
});

// MANUAL SEND
async function loadDevicesForManual() {
    try {
        const data = await apiRequest('/devices');
        const select = document.getElementById('manualDeviceSelect');
        select.innerHTML = '<option value="">Seleccionar dispositivo</option>';

        data.devices.filter(d => d.estado === 'conectado').forEach(device => {
            const option = document.createElement('option');
            option.value = device.session_id;
            option.textContent = device.nombre_dispositivo;
            select.appendChild(option);
        });

        // Event listener para envío manual
        document.getElementById('sendManualBtn').onclick = sendManualMessages;
    } catch (error) {
        console.error('Error:', error);
    }
}

async function sendManualMessages() {
    const sessionId = document.getElementById('manualDeviceSelect').value;
    const phones = document.getElementById('manualPhones').value;
    const message = document.getElementById('manualMessage').value;

    if (!sessionId || !phones || !message) {
        showAlert('Completa todos los campos', 'error');
        return;
    }

    const phoneNumbers = phones.split(',').map(p => p.trim()).filter(p => p);

    try {
        socket.emit('send-manual-message', {
            sessionId,
            phoneNumbers,
            message
        });

        socket.on('manual-message-sent', (data) => {
            showAlert(`Mensajes enviados: ${data.results.filter(r => r.success).length}/${data.results.length}`, 'success');
            document.getElementById('manualPhones').value = '';
            document.getElementById('manualMessage').value = '';
        });

    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

// CHATS
let currentDeviceFilter = '';
let allChatsData = [];
let currentChatSession = null;
let currentChatId = null;

async function loadChats() {
    try {
        // Cargar dispositivos para el filtro
        await loadDevicesForChatFilter();
        
        // Construir endpoint con filtros
        let endpoint = '/chats';
        const params = [];
        
        if (currentDeviceFilter) {
            params.push(`dispositivo_id=${currentDeviceFilter}`);
        }
        
        // Verificar si el filtro de campaña está activo
        const campaignOnlyCheckbox = document.getElementById('campaignOnlyFilter');
        if (campaignOnlyCheckbox && campaignOnlyCheckbox.checked) {
            params.push('campaign_only=true');
        }
        
        if (params.length > 0) {
            endpoint += '?' + params.join('&');
        }
        
        const response = await apiRequest(endpoint);
        const { chats, totalDevices, campaignFilter } = response;

        allChatsData = chats || [];
        const chatsList = document.getElementById('chatsList');

        if (!chats || chats.length === 0) {
            const filterMsg = campaignFilter ? '<p>No hay chats de contactos en campañas</p>' : '<p>📭 No hay chats disponibles</p>';
            chatsList.innerHTML = `
                <div class="empty-state">
                    ${filterMsg}
                    ${totalDevices === 0 && !campaignFilter ? '<p>Conecta un dispositivo primero</p>' : ''}
                </div>
            `;
            return;
        }

        // Renderizar chats con foto de perfil
        chatsList.innerHTML = chats.map(chat => {
            const phoneNumber = chat.name || chat.id.split('@')[0];
            const lastMsg = chat.lastMessage || 'Sin mensajes';
            const time = new Date(chat.lastTimestamp * 1000).toLocaleString('es-PE', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Crear objeto de contacto para avatar
            const contactData = {
                nombre: phoneNumber,
                telefono: phoneNumber,
                foto_perfil: chat.foto_perfil || null
            };

            return `
                <div class="chat-item" data-phone="${phoneNumber}" onclick="loadChatMessages('${chat.sessionId}', '${chat.id}')">
                    ${createAvatar(contactData, 'avatar-lg')}
                    <div class="chat-info">
                        <div class="chat-name">${phoneNumber}</div>
                        <div class="chat-last-message">${lastMsg.substring(0, 50)}</div>
                    </div>
                    <div class="chat-meta">
                        <div class="chat-time">${time}</div>
                        ${chat.unreadCount > 0 ? `<span class="chat-unread">${chat.unreadCount}</span>` : ''}
                        <div class="chat-device">${chat.deviceName || 'Dispositivo'}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Hidratar avatares con fotos reales
        hydrateChatAvatars();

    } catch (error) {
        console.error('Error cargando chats:', error);
        document.getElementById('chatsList').innerHTML = `
            <div class="empty-state">
                <p>❌ Error cargando chats</p>
                <button class="btn btn-secondary" onclick="loadChats()">Reintentar</button>
            </div>
        `;
    }
}

// Cargar foto de perfil para cada chat (si no existe)
async function hydrateChatAvatars() {
    try {
        const items = document.querySelectorAll('.chat-item');
        for (const item of items) {
            const phone = item.getAttribute('data-phone');
            if (!phone) continue;
            const avatarDiv = item.querySelector('.avatar');
            if (!avatarDiv) continue;

            try {
                const data = await apiRequest(`/chats/profile-picture?phone=${encodeURIComponent(phone)}`);
                if (data && data.profilePicture) {
                    const img = document.createElement('img');
                    img.src = data.profilePicture;
                    img.className = avatarDiv.className;
                    img.alt = phone;
                    avatarDiv.replaceWith(img);
                }
            } catch (e) {
                // ignorar errores por contacto sin foto o sin dispositivo
            }
        }
    } catch (error) {
        console.warn('No se pudieron hidratar avatares:', error);
    }
}

// Toggle simple de modo oscuro
function toggleDarkMode() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

// Inicializar tema al cargar
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
});

// Toggle del filtro de campañas
function toggleCampaignFilter() {
    loadChats();
}

// Cargar dispositivos para el filtro
async function loadDevicesForChatFilter() {
    try {
        const data = await apiRequest('/devices');
        const select = document.getElementById('chatDeviceFilter');
        
        if (!select) return;
        
        select.innerHTML = '<option value="">Todos los dispositivos</option>';
        
        data.devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = `${device.nombre_dispositivo} (${device.estado})`;
            if (device.id == currentDeviceFilter) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        // Event listener para cambio de filtro
        select.onchange = (e) => {
            currentDeviceFilter = e.target.value;
            loadChats();
        };
        
    } catch (error) {
        console.error('Error cargando dispositivos para filtro:', error);
    }
}

// Generar color basado en string (para avatares)
function getColorFromString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6610f2', '#e83e8c', '#fd7e14'];
    return colors[Math.abs(hash) % colors.length];
}

// Actualizar badge de archivos adjuntos
function updateFileBadge(files) {
    const fileBadge = document.getElementById('fileBadge');
    const sendMediaBtn = document.getElementById('sendMediaBtn');
    
    if (files && files.length > 0) {
        // Mostrar badge con número de archivos
        if (fileBadge) {
            fileBadge.textContent = files.length > 9 ? '9+' : files.length.toString();
            fileBadge.style.display = 'inline-flex';
        }
        
        // Cambiar color del botón cuando hay archivos
        if (sendMediaBtn) {
            sendMediaBtn.classList.add('has-files');
        }
    } else {
        // Ocultar badge y restaurar color
        if (fileBadge) {
            fileBadge.style.display = 'none';
        }
        if (sendMediaBtn) {
            sendMediaBtn.classList.remove('has-files');
        }
    }
}

// Cargar mensajes de un chat específico
async function loadChatMessages(sessionId, chatId) {
    try {
        currentChatSession = sessionId;
        currentChatId = chatId;
        
        // Limpiar archivos seleccionados al cambiar de chat
        updateFileBadge(null);
        const fileInput = document.getElementById('chatFileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        
        const response = await apiRequest(`/chats/${sessionId}/${encodeURIComponent(chatId)}/messages`);
        const { chat, messages } = response;

        if (!chat) {
            showAlert('Chat no encontrado', 'error');
            return;
        }

        const phoneNumber = chat.name || chat.id.split('@')[0];
        const initials = phoneNumber.substring(0, 2).toUpperCase();
        
        // Actualizar header del chat
        const chatNameElement = document.getElementById('activeChatName');
        if (chatNameElement) {
            chatNameElement.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="chat-avatar" style="background: ${getColorFromString(phoneNumber)}; width: 40px; height: 40px; font-size: 16px;">
                        <span>${initials}</span>
                    </div>
                    <div>
                        <div style="font-weight: bold;">${phoneNumber}</div>
                        <div style="font-size: 12px; color: #666;">Chat de WhatsApp</div>
                    </div>
                </div>
            `;
        }
        
        // Mostrar botón de descarga
        const downloadBtn = document.getElementById('downloadChatBtn');
        if (downloadBtn) {
            downloadBtn.style.display = 'block';
            downloadBtn.onclick = () => downloadChat(sessionId, chatId, phoneNumber);
        }

        // Actualizar contenedor de mensajes
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) {
            console.error('messagesContainer no encontrado');
            return;
        }

        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = '<p class="empty-state">Sin mensajes</p>';
        } else {
            messagesContainer.innerHTML = messages.map(msg => {
                const time = new Date(msg.timestamp * 1000).toLocaleString('es-PE', { hour: '2-digit', minute: '2-digit' });
                const isImage = msg.mediaType && msg.mediaType.startsWith && msg.mediaType.startsWith('image');
                const isPdf = msg.mediaType === 'application/pdf' || (msg.fileName && msg.fileName.toLowerCase().endsWith('.pdf'));
                let mediaHtml = '';
                if (msg.mediaUrl && isImage) {
                    mediaHtml = `<div style=\"margin-top:8px\"><img src=\"${msg.mediaUrl}\" alt=\"imagen\" style=\"max-width:220px; border-radius:8px; border:1px solid #eee\"></div>`;
                } else if (msg.mediaUrl && isPdf) {
                    mediaHtml = `<div style=\"margin-top:8px\"><a href=\"${msg.mediaUrl}\" target=\"_blank\" rel=\"noopener\" class=\"btn btn-sm btn-secondary\">📄 Ver PDF</a></div>`;
                }
                let checks = '';
                if (msg.fromMe) {
                    const isRead = msg.status === 'read';
                    checks = `<span style=\"margin-left:6px; font-size:12px; color:${isRead ? '#34b7f1' : '#9e9e9e'}\">✔✔</span>`;
                }
                return `
                    <div class=\"message ${msg.fromMe ? 'message-sent' : 'message-received'}\">\n                        ${msg.text ? `<div class=\\\"message-text\\\">${escapeHtml(msg.text)}</div>` : ''}\n                        ${mediaHtml}\n                        <div class=\"message-time\">${time}${checks}</div>\n                    </div>
                `;
            }).join('');
            
            // Scroll al final
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Mostrar input de respuesta
        const chatInput = document.querySelector('.chat-input');
        if (chatInput) {
            chatInput.style.display = 'flex';
        }
        
        // Asegurar visibilidad del input (sin redeclarar)
        if (chatInput) chatInput.style.display = 'flex';

        // Configurar botón de envío
        const sendBtn = document.getElementById('sendReplyBtn');
        if (sendBtn) {
            sendBtn.onclick = () => sendReply(sessionId, chatId);
        }

        // Configurar botón de envío de media
        const sendMediaBtn = document.getElementById('sendMediaBtn');
        if (sendMediaBtn) {
            // Abrir selector de archivo
            sendMediaBtn.onclick = () => {
                if (fileInput) fileInput.click();
            };
        }

        // Si el usuario selecciona archivos, actualizar badge
        if (fileInput) {
            fileInput.onchange = () => {
                updateFileBadge(fileInput.files);
            };
        }
        
        // Configurar Enter para enviar (Shift+Enter para nueva línea)
        const replyInput = document.getElementById('replyMessage');
        if (replyInput) {
            replyInput.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendReply(sessionId, chatId);
                }
            };
        }

    } catch (error) {
        console.error('Error cargando mensajes:', error);
        showAlert('Error cargando mensajes: ' + error.message, 'error');
    }
}

// Escape HTML para prevenir XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Enviar respuesta
async function sendReply(sessionId, chatId) {
    const messageInput = document.getElementById('replyMessage');
    const message = messageInput ? messageInput.value.trim() : '';
    const fileInput = document.getElementById('chatFileInput');
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    
    if (!message && !hasFile) {
        showAlert('Escribe un mensaje o adjunta un archivo', 'warning');
        return;
    }

    try {
        // Deshabilitar input mientras se envía
        if (messageInput) messageInput.disabled = true;
        const sendBtn = document.getElementById('sendReplyBtn');
        if (sendBtn) sendBtn.disabled = true;

        // Mostrar indicador de envío
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            const sendingIndicator = document.createElement('div');
            sendingIndicator.id = 'sending-indicator';
            sendingIndicator.className = 'message message-sent';
            sendingIndicator.innerHTML = `
                <div class="message-text">${escapeHtml(message)}</div>
                <div class="message-time">Enviando... ⏳</div>
            `;
            messagesContainer.appendChild(sendingIndicator);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        if (hasFile) {
            // Enviar archivo con caption (mensaje)
            await sendChatMedia(sessionId, chatId);
        } else {
            // Enviar solo texto
            await apiRequest(`/chats/${sessionId}/${encodeURIComponent(chatId)}/reply`, {
                method: 'POST',
                body: JSON.stringify({ message })
            });
        }

        // Limpiar input
        if (messageInput) messageInput.value = '';
        if (fileInput) fileInput.value = '';
        
        // Limpiar badge de archivos
        updateFileBadge(null);
        
        // Eliminar indicador de envío
        const sendingIndicator = document.getElementById('sending-indicator');
        if (sendingIndicator) {
            sendingIndicator.remove();
        }

        // Recargar mensajes para mostrar el mensaje real del servidor
        await loadChatMessages(sessionId, chatId);
        
        showAlert('✅ Mensaje enviado', 'success');

    } catch (error) {
        console.error('Error enviando mensaje:', error);
        showAlert('❌ Error enviando mensaje: ' + (error.message || ''), 'error');
        
        // Eliminar indicador de envío en caso de error
        const sendingIndicator = document.getElementById('sending-indicator');
        if (sendingIndicator) {
            sendingIndicator.remove();
        }
        
        // Recargar para mostrar estado correcto
        await loadChatMessages(sessionId, chatId);
    } finally {
        // Rehabilitar input
        if (messageInput) messageInput.disabled = false;
        const sendBtn = document.getElementById('sendReplyBtn');
        if (sendBtn) sendBtn.disabled = false;
    }
}

// Descargar chat
async function downloadChat(sessionId, chatId, phoneNumber) {
    try {
        showAlert('⏳ Descargando chat...', 'info');
        
        // Llamar a la nueva ruta del backend que guarda en /chats/{numero}/{fecha}.txt
        const response = await apiRequest(`/chats/${sessionId}/${encodeURIComponent(chatId)}/download`);
        
        if (response.success) {
            showAlert(`✅ Chat descargado en /chats/${response.folder}/`, 'success');
        } else {
            showAlert('❌ Error al descargar chat', 'error');
        }
        
    } catch (error) {
        console.error('Error descargando chat:', error);
        showAlert('❌ Error al descargar chat: ' + error.message, 'error');
    }
}

// Descargar todos los chats del dispositivo actual
async function downloadAllChats() {
    try {
        if (!currentDeviceFilter) {
            showAlert('⚠️ Selecciona un dispositivo primero', 'warning');
            return;
        }
        
        if (!confirm('¿Descargar todos los chats de este dispositivo? Esto puede tomar un tiempo.')) {
            return;
        }
        
        showAlert('⏳ Descargando todos los chats...', 'info');
        
        // Obtener el session_id del dispositivo seleccionado
        const devicesData = await apiRequest('/devices');
        const device = devicesData.devices.find(d => d.id == currentDeviceFilter);
        
        if (!device || !device.session_id) {
            showAlert('❌ Dispositivo no encontrado o sin sesión activa', 'error');
            return;
        }
        
        // Llamar a la ruta de descarga masiva
        const response = await apiRequest('/chats/download-all', {
            method: 'POST',
            body: JSON.stringify({
                sessionId: device.session_id
            })
        });
        
        if (response.success) {
            showAlert(`✅ ${response.downloadedChats.length} chats descargados en /chats/`, 'success');
        } else {
            showAlert('❌ Error al descargar chats', 'error');
        }
        
    } catch (error) {
        console.error('Error descargando chats:', error);
        showAlert('❌ Error al descargar chats: ' + error.message, 'error');
    }
}

// Enviar media (imagen/pdf) al chat actual
async function sendChatMedia(sessionId, chatId) {
    try {
        const fileInput = document.getElementById('chatFileInput');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            showAlert('Selecciona un archivo (imagen o PDF) antes de enviar', 'warning');
            return;
        }
        const file = fileInput.files[0];
        const caption = (document.getElementById('replyMessage')?.value || '').trim();

        const formData = new FormData();
        formData.append('file', file);
        formData.append('caption', caption);

        // Deshabilitar botones
        const sendBtn = document.getElementById('sendReplyBtn');
        const sendMediaBtn = document.getElementById('sendMediaBtn');
        if (sendBtn) sendBtn.disabled = true;
        if (sendMediaBtn) sendMediaBtn.disabled = true;

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/chats/${sessionId}/${encodeURIComponent(chatId)}/media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Error enviando archivo');
        }

        // Limpiar input y caption
        fileInput.value = '';
        // No limpiamos el texto por si desea enviar el mismo caption como texto
        
        // Limpiar badge de archivos
        updateFileBadge(null);

        await loadChatMessages(sessionId, chatId);
        showAlert('✅ Archivo enviado', 'success');

    } catch (error) {
        console.error('Error enviando media:', error);
        showAlert('❌ ' + error.message, 'error');
    } finally {
        const sendBtn = document.getElementById('sendReplyBtn');
        const sendMediaBtn = document.getElementById('sendMediaBtn');
        if (sendBtn) sendBtn.disabled = false;
        if (sendMediaBtn) sendMediaBtn.disabled = false;
    }
}

// Agregar event listener para el botón de descargar todos
document.addEventListener('DOMContentLoaded', () => {
    const downloadAllBtn = document.getElementById('downloadAllChatsBtn');
    if (downloadAllBtn) {
        downloadAllBtn.onclick = downloadAllChats;
    }
});

// UTILITIES
function showAlert(message, type = 'info') {
    // Crear alerta temporal
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '9999';
    alert.style.minWidth = '300px';
    alert.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

    document.body.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 4000);
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Scheduled campaigns stub
async function loadScheduledCampaigns() {
    const container = document.getElementById('scheduledCampaigns');
    container.innerHTML = '<p class="empty-state">No hay campañas agendadas</p>';
}

// =============================================
// CALENDARIO DE CAMPAÑAS
// =============================================
let currentCalendarDate = new Date();

async function loadCalendar() {
    try {
        // Cargar campañas para el calendario
        const data = await apiRequest('/campaigns');
        renderCalendar(data.campaigns);
        
        // Configurar botones del calendario
        document.getElementById('calendarTodayBtn').onclick = () => {
            currentCalendarDate = new Date();
            renderCalendar(data.campaigns);
        };
        
        document.getElementById('calendarPrevBtn').onclick = () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar(data.campaigns);
        };
        
        document.getElementById('calendarNextBtn').onclick = () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar(data.campaigns);
        };
        
    } catch (error) {
        showAlert('Error al cargar calendario: ' + error.message, 'error');
    }
}

function renderCalendar(campaigns) {
    const container = document.getElementById('calendarContainer');
    const currentDateSpan = document.getElementById('calendarCurrentDate');
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Actualizar título del mes
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    currentDateSpan.textContent = `${monthNames[month]} ${year}`;
    
    // Calcular días del mes
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Crear HTML del calendario
    let html = '<div class="calendar-grid">';
    
    // Días de la semana
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(day => {
        html += `<div class="calendar-day-name">${day}</div>`;
    });
    
    // Espacios vacíos antes del primer día
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const campaignsOnDay = campaigns.filter(c => {
            const campaignDate = c.fecha_agendada || c.fecha_inicio || c.fecha_creacion;
            return campaignDate && campaignDate.startsWith(dateStr);
        });
        
        const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
        
        html += `<div class="calendar-day ${isToday ? 'today' : ''}">
            <div class="calendar-day-number">${day}</div>`;
        
        if (campaignsOnDay.length > 0) {
            campaignsOnDay.forEach(campaign => {
                const colorMap = {
                    'completada': '#28a745',
                    'agendada': '#ffc107',
                    'en_proceso': '#007bff',
                    'cancelada': '#dc3545',
                    'pausada': '#ff9800'
                };
                const color = colorMap[campaign.estado] || '#6c757d';
                html += `<div class="calendar-event" style="background:${color};" title="${campaign.nombre}">
                    ${campaign.nombre.substring(0, 15)}${campaign.nombre.length > 15 ? '...' : ''}
                </div>`;
            });
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// =============================================
// SISTEMA DE NOTAS
// =============================================
async function loadNotes() {
    try {
        const data = await apiRequest('/notes');
        const grid = document.getElementById('notesGrid');
        grid.innerHTML = '';

        if (data.notas.length === 0) {
            grid.innerHTML = '<p class="empty-state">No hay notas. Crea tu primera nota.</p>';
            return;
        }

        data.notas.forEach(nota => {
            const card = createNoteCard(nota);
            grid.appendChild(card);
        });
    } catch (error) {
        showAlert('Error al cargar notas: ' + error.message, 'error');
    }
}

function createNoteCard(nota) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.style.borderLeft = `4px solid ${nota.color}`;
    
    card.innerHTML = `
        <div class="note-header">
            <h3>${nota.titulo}</h3>
            <div class="note-actions">
                <button class="btn-icon" onclick="editNote(${nota.id})" title="Editar">✏️</button>
                <button class="btn-icon" onclick="deleteNote(${nota.id})" title="Eliminar">🗑️</button>
            </div>
        </div>
        <div class="note-content">${nota.contenido || ''}</div>
        <div class="note-footer">
            <small>Actualizado: ${new Date(nota.fecha_actualizacion).toLocaleString()}</small>
        </div>
    `;
    
    return card;
}

function showCreateNoteModal() {
    const modal = document.getElementById('genericModal');
    document.getElementById('genericModalTitle').textContent = 'Nueva Nota';
    
    document.getElementById('genericModalBody').innerHTML = `
        <div class="form-group">
            <label>Título *</label>
            <input type="text" id="noteTitle" class="form-control" placeholder="Título de la nota" required>
        </div>
        <div class="form-group">
            <label>Contenido</label>
            <textarea id="noteContent" class="form-control" rows="6" placeholder="Escribe aquí..."></textarea>
        </div>
        <div class="form-group">
            <label>Color</label>
            <div style="display: flex; gap: 10px;">
                <input type="color" id="noteColor" value="#ffc107" class="form-control" style="width: 60px;">
                <span id="noteColorPreview" style="flex: 1; display: flex; align-items: center; padding-left: 10px;">
                    Color de la nota
                </span>
            </div>
        </div>
    `;
    
    document.getElementById('genericModalAction').innerHTML = `
        <button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
        <button class="btn btn-primary" onclick="createNote()">Crear Nota</button>
    `;
    
    modal.classList.add('active');
}

async function createNote() {
    try {
        const titulo = document.getElementById('noteTitle').value.trim();
        const contenido = document.getElementById('noteContent').value.trim();
        const color = document.getElementById('noteColor').value;
        
        if (!titulo) {
            showAlert('El título es requerido', 'warning');
            return;
        }
        
        await apiRequest('/notes', {
            method: 'POST',
            body: JSON.stringify({ titulo, contenido, color })
        });
        
        showAlert('✅ Nota creada', 'success');
        closeAllModals();
        loadNotes();
        
    } catch (error) {
        showAlert('❌ Error al crear nota: ' + error.message, 'error');
    }
}

async function editNote(id) {
    try {
        const data = await apiRequest('/notes');
        const nota = data.notas.find(n => n.id === id);
        
        if (!nota) {
            showAlert('Nota no encontrada', 'error');
            return;
        }
        
        const modal = document.getElementById('genericModal');
        document.getElementById('genericModalTitle').textContent = 'Editar Nota';
        
        document.getElementById('genericModalBody').innerHTML = `
            <div class="form-group">
                <label>Título *</label>
                <input type="text" id="noteTitle" class="form-control" value="${nota.titulo}" required>
            </div>
            <div class="form-group">
                <label>Contenido</label>
                <textarea id="noteContent" class="form-control" rows="6">${nota.contenido || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Color</label>
                <input type="color" id="noteColor" value="${nota.color}" class="form-control" style="width: 60px;">
            </div>
        `;
        
        document.getElementById('genericModalAction').innerHTML = `
            <button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
            <button class="btn btn-primary" onclick="updateNote(${id})">Guardar Cambios</button>
        `;
        
        modal.classList.add('active');
        
    } catch (error) {
        showAlert('❌ Error al cargar nota: ' + error.message, 'error');
    }
}

async function updateNote(id) {
    try {
        const titulo = document.getElementById('noteTitle').value.trim();
        const contenido = document.getElementById('noteContent').value.trim();
        const color = document.getElementById('noteColor').value;
        
        if (!titulo) {
            showAlert('El título es requerido', 'warning');
            return;
        }
        
        await apiRequest(`/notes/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ titulo, contenido, color })
        });
        
        showAlert('✅ Nota actualizada', 'success');
        closeAllModals();
        loadNotes();
        
    } catch (error) {
        showAlert('❌ Error al actualizar nota: ' + error.message, 'error');
    }
}

async function deleteNote(id) {
    if (!confirm('¿Eliminar esta nota?')) return;
    
    try {
        await apiRequest(`/notes/${id}`, { method: 'DELETE' });
        showAlert('✅ Nota eliminada', 'success');
        loadNotes();
    } catch (error) {
        showAlert('❌ Error al eliminar nota: ' + error.message, 'error');
    }
}

// ============================================
// ASIGNACIÓN DE DISPOSITIVOS A CATEGORÍAS
// ============================================

async function checkUnassignedCategories() {
    try {
        const unassignedData = await apiRequest('/category-devices/unassigned');
        
        if (unassignedData.categories && unassignedData.categories.length > 0) {
            console.log(`⚠️ ${unassignedData.categories.length} categoría(s) sin dispositivo asignado`);
            await showCategoryDeviceAssignmentModal(unassignedData.categories);
        } else {
            console.log('✅ Todas las categorías tienen dispositivo asignado');
        }
    } catch (error) {
        console.error('Error verificando categorías:', error);
    }
}

async function showCategoryDeviceAssignmentModal(unassignedCategories) {
    const modal = document.getElementById('genericModal');
    document.getElementById('genericModalTitle').textContent = '⚠️ Categorías sin Dispositivo Asignado';
    
    // Obtener dispositivos conectados
    const devicesData = await apiRequest('/devices');
    const connectedDevices = devicesData.devices.filter(d => d.estado === 'conectado');
    
    if (connectedDevices.length === 0) {
        showAlert('⚠️ No hay dispositivos conectados para asignar', 'warning');
        return;
    }
    
    document.getElementById('genericModalBody').innerHTML = `
        <div class="alert alert-warning">
            <strong>📌 Importante:</strong> Las siguientes categorías del Excel no tienen un dispositivo responsable asignado.
            <br><br>
            Selecciona un dispositivo para cada categoría. Los mensajes de esa categoría se enviarán preferentemente desde ese dispositivo.
        </div>
        
        <div id="categoryAssignments">
            ${unassignedCategories.map(cat => `
                <div class="form-group" style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: #f8f9fa;">
                    <label style="font-weight: bold; color: ${cat.color || '#007bff'}; font-size: 16px;">
                        📁 ${cat.nombre}
                    </label>
                    <select id="device_cat_${cat.id}" class="form-control" style="margin-top: 8px;">
                        <option value="">Usar rotación automática</option>
                        ${connectedDevices.map(dev => `
                            <option value="${dev.id}">
                                📱 ${dev.nombre_dispositivo} ${dev.numero_telefono ? '(' + dev.numero_telefono + ')' : ''}
                            </option>
                        `).join('')}
                    </select>
                    <small style="color: #666; display: block; margin-top: 5px;">
                        Si no seleccionas nada, se usará rotación automática entre todos los dispositivos.
                    </small>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('genericModalAction').innerHTML = `
        <button class="btn btn-secondary" onclick="skipCategoryAssignment()">Omitir (usar rotación)</button>
        <button class="btn btn-primary" onclick="saveCategoryAssignments(${JSON.stringify(unassignedCategories.map(c => c.id))})">
            ✅ Asignar Dispositivos
        </button>
    `;
    
    modal.classList.add('active');
}

function skipCategoryAssignment() {
    console.log('⏭️ Asignación de categorías omitida - Se usará rotación automática');
    closeAllModals();
}

async function saveCategoryAssignments(categoryIds) {
    try {
        const assignments = [];
        
        for (const categoryId of categoryIds) {
            const select = document.getElementById(`device_cat_${categoryId}`);
            const deviceId = select ? select.value : null;
            
            if (deviceId) {
                assignments.push({
                    categoryId: categoryId,
                    deviceId: parseInt(deviceId)
                });
            }
        }
        
        if (assignments.length > 0) {
            console.log('📌 Asignando dispositivos a categorías:', assignments);
            
            await apiRequest('/category-devices/assign', {
                method: 'POST',
                body: JSON.stringify({ assignments })
            });
            
            showAlert(`✅ ${assignments.length} categoría(s) asignada(s) correctamente`, 'success');
        } else {
            console.log('⏭️ No se seleccionaron dispositivos - Se usará rotación automática');
        }
        
        closeAllModals();
        
    } catch (error) {
        showAlert('❌ Error al asignar dispositivos: ' + error.message, 'error');
    }
}

