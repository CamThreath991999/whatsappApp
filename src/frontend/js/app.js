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
        schedule: 'Campañas Agendadas'
    };

    const actions = {
        devices: '+ Nuevo Dispositivo',
        categories: '+ Nueva Categoría',
        contacts: '+ Nuevo Contacto',
        campaigns: '+ Nueva Campaña',
        manual: '',
        chats: '',
        schedule: ''
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
    
    const categories = await apiRequest('/categories');
    
    document.getElementById('genericModalBody').innerHTML = `
        <div class="form-group">
            <label>Nombre del dispositivo</label>
            <input type="text" id="deviceName" class="form-control" placeholder="Ej: Dispositivo 1" required>
        </div>
        <div class="form-group">
            <label>Categoría (opcional)</label>
            <select id="deviceCategory" class="form-control">
                <option value="">Sin categoría</option>
                ${categories.categories.map(cat => `<option value="${cat.id}">${cat.nombre}</option>`).join('')}
            </select>
        </div>
    `;

    document.getElementById('genericModalFooter').innerHTML = `
        <button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
        <button class="btn btn-primary" onclick="createDevice()">Crear</button>
    `;

    modal.classList.add('active');
}

async function createDevice() {
    const nombre = document.getElementById('deviceName').value;
    const categoria_id = document.getElementById('deviceCategory').value || null;

    if (!nombre) {
        showAlert('El nombre es requerido', 'error');
        return;
    }

    try {
        const data = await apiRequest('/devices', {
            method: 'POST',
            body: JSON.stringify({ nombre_dispositivo: nombre, categoria_id })
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

function showCreateCategoryModal() {
    const modal = document.getElementById('genericModal');
    document.getElementById('genericModalTitle').textContent = 'Nueva Categoría';
    
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
    `;

    document.getElementById('genericModalFooter').innerHTML = `
        <button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
        <button class="btn btn-primary" onclick="createCategory()">Crear</button>
    `;

    modal.classList.add('active');
}

async function createCategory() {
    const nombre = document.getElementById('categoryName').value;
    const descripcion = document.getElementById('categoryDescription').value;
    const color = document.getElementById('categoryColor').value;

    if (!nombre) {
        showAlert('El nombre es requerido', 'error');
        return;
    }

    try {
        await apiRequest('/categories', {
            method: 'POST',
            body: JSON.stringify({ nombre, descripcion, color })
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
        `;

        document.getElementById('genericModalFooter').innerHTML = `
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

    if (!nombre) {
        showAlert('El nombre es requerido', 'error');
        return;
    }

    try {
        await apiRequest(`/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ nombre, descripcion, color })
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
async function loadContacts() {
    try {
        const data = await apiRequest('/contacts');
        const tbody = document.getElementById('contactsTableBody');
        tbody.innerHTML = '';

        if (data.contacts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay contactos</td></tr>';
            return;
        }

        data.contacts.forEach(contact => {
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
    } catch (error) {
        showAlert('Error al cargar contactos: ' + error.message, 'error');
    }
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

        document.getElementById('genericModalFooter').innerHTML = `
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
                <input type="file" id="excelFile" class="form-control" accept=".xlsx,.xls">
            </div>
            <div class="form-group">
                <label>Categoría por defecto (opcional)</label>
                <select id="defaultCategory" class="form-control">
                    <option value="">Sin categoría</option>
                </select>
            </div>
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

    document.getElementById('genericModalFooter').innerHTML = `
        <button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
        <button class="btn btn-primary" onclick="createCampaign()">Crear</button>
    `;

    modal.classList.add('active');
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

    if (!nombre) {
        showAlert('El nombre es requerido', 'error');
        return;
    }

    try {
        // Crear campaña primero
        const campaign = await apiRequest('/campaigns', {
            method: 'POST',
            body: JSON.stringify({ 
                nombre, 
                descripcion, 
                tipo,
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
                throw new Error('Error subiendo archivo Excel');
            }

            const result = await response.json();
            showAlert(`✅ Campaña creada! ${result.added} contactos importados`, 'success');
        } else {
            showAlert('Campaña creada. Ahora agrega contactos y mensajes.', 'success');
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
async function loadChats() {
    try {
        const response = await apiRequest('/chats');
        const { chats, totalDevices } = response;

        const chatsList = document.getElementById('chatsList');

        if (!chats || chats.length === 0) {
            chatsList.innerHTML = `
                <div class="empty-state">
                    <p>📭 No hay chats disponibles</p>
                    ${totalDevices === 0 ? '<p>Conecta un dispositivo primero</p>' : ''}
                </div>
            `;
            return;
        }

        // Renderizar chats
        chatsList.innerHTML = chats.map(chat => {
            const phoneNumber = chat.name || chat.id.split('@')[0];
            const lastMsg = chat.lastMessage || 'Sin mensajes';
            const time = new Date(chat.lastTimestamp * 1000).toLocaleString('es-PE', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="chat-item" onclick="loadChatMessages('${chat.sessionId}', '${chat.id}')">
                    <div class="chat-avatar">
                        <span>${phoneNumber.substring(0, 2).toUpperCase()}</span>
                    </div>
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

// Cargar mensajes de un chat específico
async function loadChatMessages(sessionId, chatId) {
    try {
        const response = await apiRequest(`/chats/${sessionId}/${encodeURIComponent(chatId)}/messages`);
        const { chat, messages } = response;

        if (!chat) {
            showAlert('Chat no encontrado', 'error');
            return;
        }

        const chatMessages = document.getElementById('chatMessages');
        const phoneNumber = chat.name || chat.id.split('@')[0];

        // Actualizar header del chat
        document.querySelector('#chatMessages').innerHTML = `
            <div class="chat-header">
                <h3>💬 ${phoneNumber}</h3>
                <button class="btn btn-secondary btn-sm" onclick="loadChats()">← Volver</button>
            </div>
            <div class="messages-container">
                ${messages && messages.length > 0 ? messages.map(msg => {
                    const time = new Date(msg.timestamp * 1000).toLocaleString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    return `
                        <div class="message ${msg.fromMe ? 'message-sent' : 'message-received'}">
                            <div class="message-text">${msg.text}</div>
                            <div class="message-time">${time}</div>
                        </div>
                    `;
                }).join('') : '<p class="empty-state">Sin mensajes</p>'}
            </div>
            <div class="chat-input">
                <textarea id="replyMessage" placeholder="Escribe un mensaje..." rows="2"></textarea>
                <button class="btn btn-primary" onclick="sendReply('${sessionId}', '${chatId}')">Enviar</button>
            </div>
        `;

    } catch (error) {
        console.error('Error cargando mensajes:', error);
        showAlert('Error cargando mensajes', 'error');
    }
}

// Enviar respuesta
async function sendReply(sessionId, chatId) {
    const message = document.getElementById('replyMessage').value.trim();
    
    if (!message) {
        showAlert('Escribe un mensaje', 'warning');
        return;
    }

    try {
        // Aquí llamarías a sendMessage con la sesión correcta
        showAlert('Función de respuesta en desarrollo', 'info');
        document.getElementById('replyMessage').value = '';
    } catch (error) {
        showAlert('Error enviando mensaje', 'error');
    }
}

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

