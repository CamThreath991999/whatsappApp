-- Base de datos para el sistema de mensajería masiva
CREATE DATABASE IF NOT EXISTS whatsapp_masivo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE whatsapp_masivo;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100),
    email VARCHAR(100),
    rol ENUM('admin', 'operador') DEFAULT 'operador',
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_conexion TIMESTAMP NULL,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de dispositivos/sesiones WhatsApp
CREATE TABLE IF NOT EXISTS dispositivos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre_dispositivo VARCHAR(100) NOT NULL,
    numero_telefono VARCHAR(20),
    estado ENUM('desconectado', 'esperando_qr', 'conectado', 'error') DEFAULT 'desconectado',
    session_id VARCHAR(100) UNIQUE NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_conexion TIMESTAMP NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    dispositivo_id INT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    color VARCHAR(7) DEFAULT '#007bff',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE SET NULL,
    INDEX idx_usuario (usuario_id),
    INDEX idx_dispositivo (dispositivo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de contactos
CREATE TABLE IF NOT EXISTS contactos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    categoria_id INT,
    nombre VARCHAR(100),
    telefono VARCHAR(20) NOT NULL,
    telefono_formateado VARCHAR(30),
    estado ENUM('pendiente', 'agregado', 'bloqueado', 'invalido') DEFAULT 'pendiente',
    metadata JSON,
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
    INDEX idx_usuario (usuario_id),
    INDEX idx_categoria (categoria_id),
    INDEX idx_telefono (telefono)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de campañas
CREATE TABLE IF NOT EXISTS campanas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    tipo ENUM('manual', 'excel') DEFAULT 'manual',
    estado ENUM('borrador', 'agendada', 'en_proceso', 'completada', 'pausada', 'cancelada') DEFAULT 'borrador',
    fecha_agendada TIMESTAMP NULL,
    fecha_inicio TIMESTAMP NULL,
    fecha_fin TIMESTAMP NULL,
    total_mensajes INT DEFAULT 0,
    mensajes_enviados INT DEFAULT 0,
    mensajes_fallidos INT DEFAULT 0,
    configuracion JSON,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_estado (estado),
    INDEX idx_fecha_agendada (fecha_agendada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS mensajes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campana_id INT NOT NULL,
    contacto_id INT NOT NULL,
    dispositivo_id INT,
    mensaje TEXT NOT NULL,
    estado ENUM('pendiente', 'enviado', 'fallido', 'programado') DEFAULT 'pendiente',
    error_mensaje TEXT,
    observacion VARCHAR(255),
    metadata JSON,
    fecha_programado TIMESTAMP NULL,
    fecha_envio TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campana_id) REFERENCES campanas(id) ON DELETE CASCADE,
    FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE,
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE SET NULL,
    INDEX idx_campana (campana_id),
    INDEX idx_contacto (contacto_id),
    INDEX idx_estado (estado),
    INDEX idx_dispositivo (dispositivo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agregar campos si no existen (para bases de datos existentes)
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS observacion VARCHAR(255) AFTER error_mensaje;
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS metadata JSON AFTER observacion;

-- Tabla de chats (conversaciones)
CREATE TABLE IF NOT EXISTS chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    contacto_id INT NOT NULL,
    dispositivo_id INT,
    ultimo_mensaje TEXT,
    fecha_ultimo_mensaje TIMESTAMP NULL,
    no_leidos INT DEFAULT 0,
    archivado BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE,
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE SET NULL,
    INDEX idx_usuario (usuario_id),
    INDEX idx_contacto (contacto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de historial de comportamiento humano
CREATE TABLE IF NOT EXISTS comportamiento_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dispositivo_id INT NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalles JSON,
    fecha_ejecucion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE,
    INDEX idx_dispositivo (dispositivo_id),
    INDEX idx_fecha (fecha_ejecucion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de logs del sistema
CREATE TABLE IF NOT EXISTS system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nivel ENUM('info', 'warning', 'error', 'debug') DEFAULT 'info',
    modulo VARCHAR(100),
    mensaje TEXT,
    detalles JSON,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_nivel (nivel),
    INDEX idx_fecha (fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuario administrador por defecto (password: admin123)
INSERT INTO usuarios (username, password, nombre_completo, email, rol) 
VALUES ('admin', '$2a$10$xQPXJjKjK8LqXxR9GhGYYOzZhzKZfYHZyHvPJZLvKvDZhYNQDYQWK', 'Administrador', 'admin@sistema.com', 'admin');

