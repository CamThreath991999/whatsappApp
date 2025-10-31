# 🚀 NUEVAS FUNCIONALIDADES IMPLEMENTADAS

## ✅ 1. Límite de Dispositivos Aumentado de 5 a 20

### **Cambios:**

**Archivo:** `src/backend/routes/deviceRoutes.js`

**Antes:**
```javascript
if (devices[0].total >= 5) {
    return res.status(400).json({
        error: true,
        message: 'Has alcanzado el límite máximo de 5 dispositivos'
    });
}
```

**Ahora:**
```javascript
if (devices[0].total >= 20) {
    return res.status(400).json({
        error: true,
        message: 'Has alcanzado el límite máximo de 20 dispositivos'
    });
}
```

### **Beneficios:**
- ✅ Hasta **20 dispositivos** conectados simultáneamente
- ✅ Mejor distribución de carga para campañas masivas
- ✅ Menos probabilidad de bloqueo por SPAM
- ✅ Ideal para organizaciones con múltiples departamentos

---

## ✅ 2. Sistema de Asignación de Dispositivos a Categorías

### **¿Qué hace?**

Cuando importas un Excel con diferentes categorías, el sistema te permite **asignar un dispositivo responsable** a cada categoría. Los mensajes de esa categoría se enviarán preferentemente desde ese dispositivo.

### **Flujo de Trabajo:**

#### **Paso 1: Crear Campaña e Importar Excel**

1. Usuario crea una nueva campaña
2. Selecciona tipo "Excel"
3. Sube archivo con columnas: `categoria | telefono | nombre | mensaje`

Ejemplo de Excel:
```
categoria | telefono      | nombre | mensaje
----------|---------------|--------|----------
BCP       | 51999888777   | Juan   | Hola Juan
Interbank | 51988777666   | María  | Hola María
BBVA      | 51977666555   | Pedro  | Hola Pedro
BCP       | 51966555444   | Ana    | Hola Ana
```

#### **Paso 2: Sistema Detecta Categorías Sin Dispositivo**

Después de importar, el sistema:
- ✅ Extrae categorías únicas: `BCP`, `Interbank`, `BBVA`
- ✅ Verifica cuáles tienen dispositivo asignado en BD
- ✅ Si hay categorías nuevas/sin asignar → Muestra modal

#### **Paso 3: Modal de Asignación**

![Modal Asignación](docs/screenshots/modal-asignacion.png)

El usuario ve:
```
⚠️ Categorías sin Dispositivo Asignado

📌 Importante: Las siguientes categorías del Excel no tienen un dispositivo responsable asignado.

Selecciona un dispositivo para cada categoría. Los mensajes de esa categoría se enviarán 
preferentemente desde ese dispositivo.

┌─────────────────────────────────────────┐
│ 📁 BCP                                  │
│ ┌────────────────────────────────────┐  │
│ │ 📱 Dispositivo BCP (51999123456)   │  │
│ │ 📱 Dispositivo Interbank (...234)  │  │
│ │ 📱 Dispositivo BBVA (51977234...)  │  │
│ └────────────────────────────────────┘  │
│ Si no seleccionas nada, se usará        │
│ rotación automática.                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📁 Interbank                            │
│ ┌────────────────────────────────────┐  │
│ │ 📱 Dispositivo BCP (51999123456)   │  │
│ │ 📱 Dispositivo Interbank (...234)  │  │
│ │ 📱 Dispositivo BBVA (51977234...)  │  │
│ └────────────────────────────────────┘  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📁 BBVA                                 │
│ ┌────────────────────────────────────┐  │
│ │ 📱 Dispositivo BCP (51999123456)   │  │
│ │ 📱 Dispositivo Interbank (...234)  │  │
│ │ 📱 Dispositivo BBVA (51977234...)  │  │
│ └────────────────────────────────────┘  │
└─────────────────────────────────────────┘

[Omitir (usar rotación)]  [✅ Asignar Dispositivos]
```

#### **Paso 4: Usuario Asigna Dispositivos**

**Ejemplo de asignación:**
- `BCP` → Dispositivo BCP
- `Interbank` → Dispositivo Interbank
- `BBVA` → Dispositivo BBVA

Click en "✅ Asignar Dispositivos"

#### **Paso 5: Sistema Guarda Asignaciones**

```javascript
// Se actualiza en BD:
UPDATE categorias 
SET dispositivo_id = 1 
WHERE nombre = 'BCP';

UPDATE categorias 
SET dispositivo_id = 2 
WHERE nombre = 'Interbank';

UPDATE categorias 
SET dispositivo_id = 3 
WHERE nombre = 'BBVA';
```

---

### **¿Cómo Funciona Internamente?**

#### **Archivo: `src/backend/routes/uploadRoutes.js`**

**Línea 141-164: Extracción de Categoría y Dispositivo Asignado**

```javascript
// Buscar o crear categoría por nombre
let categoriaId = null;
let categoriaDeviceId = null;

if (categoria) {
    // Buscar categoría por nombre
    const [categorias] = await pool.execute(
        'SELECT id, dispositivo_id FROM categorias WHERE nombre = ? AND usuario_id = ?',
        [categoria, req.user.id]
    );

    if (categorias.length > 0) {
        categoriaId = categorias[0].id;
        categoriaDeviceId = categorias[0].dispositivo_id; // ← NUEVO
    } else {
        // Crear nueva categoría
        const [resultCat] = await pool.execute(
            'INSERT INTO categorias (nombre, usuario_id) VALUES (?, ?)',
            [categoria, req.user.id]
        );
        categoriaId = resultCat.insertId;
        console.log(`   ✅ Categoría "${categoria}" creada con ID ${categoriaId}`);
    }
}
```

**Línea 193-213: Asignación Inteligente de Dispositivos**

```javascript
// **ASIGNACIÓN INTELIGENTE DE DISPOSITIVOS**
let deviceId;

// Prioridad 1: Si la categoría tiene un dispositivo asignado, usar ese
if (categoriaDeviceId && devices.some(d => d.id === categoriaDeviceId)) {
    deviceId = categoriaDeviceId;
    console.log(`   📌 Usando dispositivo asignado a categoría: ${deviceId}`);
} else if (useRotation) {
    // Prioridad 2: MÚLTIPLES DISPOSITIVOS - Rotación aleatoria o secuencial
    if (Math.random() < 0.7) {
        // 70% rotación secuencial (más predecible, menos sospechoso)
        deviceId = devices[deviceRotationIndex].id;
        deviceRotationIndex = (deviceRotationIndex + 1) % devices.length;
    } else {
        // 30% selección aleatoria (más impredecible)
        deviceId = devices[Math.floor(Math.random() * devices.length)].id;
    }
} else {
    // Prioridad 3: UN SOLO DISPOSITIVO
    deviceId = singleDeviceId;
}
```

#### **Archivo: `src/backend/routes/categoryDeviceRoutes.js` (NUEVO)**

**Endpoints:**

1. **POST `/api/category-devices/assign`**
   - Asigna dispositivos a categorías
   - Body: `{ assignments: [{categoryId, deviceId}] }`

2. **GET `/api/category-devices/unassigned`**
   - Obtiene categorías sin dispositivo asignado
   - Returns: `{ categories: [{id, nombre, color}] }`

---

### **Frontend**

#### **Archivo: `src/frontend/js/app.js`**

**Función: `checkUnassignedCategories()`** (Línea 2134)
- Verifica si hay categorías sin dispositivo
- Si las hay, muestra el modal de asignación

**Función: `showCategoryDeviceAssignmentModal()`** (Línea 2149)
- Muestra el modal con la lista de categorías
- Permite seleccionar dispositivo para cada una
- Opciones: Omitir (rotación automática) o Asignar

**Función: `saveCategoryAssignments()`** (Línea 2206)
- Guarda las asignaciones seleccionadas
- Llama al endpoint `/api/category-devices/assign`

---

## 📊 Lógica de Prioridades

### **¿Qué dispositivo se usa para enviar un mensaje?**

```
┌──────────────────────────────────────────┐
│ Mensaje de categoría "BCP"              │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│ ¿La categoría tiene dispositivo asignado?│
└──────────────────────────────────────────┘
         SÍ ↓               ↓ NO
┌─────────────────┐   ┌─────────────────────┐
│ Usar ese        │   │ ¿Hay múltiples      │
│ dispositivo     │   │ dispositivos?       │
└─────────────────┘   └─────────────────────┘
                           SÍ ↓         ↓ NO
                    ┌──────────────┐  ┌──────┐
                    │ Rotación     │  │ Usar │
                    │ automática   │  │ único│
                    └──────────────┘  └──────┘
```

### **Ejemplo Práctico:**

**Escenario:** Tienes 3 dispositivos conectados:
- Dispositivo 1 (BCP)
- Dispositivo 2 (Interbank)
- Dispositivo 3 (BBVA)

**Asignaciones:**
- Categoría "BCP" → Dispositivo 1
- Categoría "Interbank" → Dispositivo 2
- Categoría "BBVA" → (Sin asignar)

**Importas Excel con:**
- 100 mensajes de "BCP" → Todos desde Dispositivo 1
- 100 mensajes de "Interbank" → Todos desde Dispositivo 2
- 100 mensajes de "BBVA" → Rotación: Dispositivo 1, 2, 3
- 100 mensajes sin categoría → Rotación: Dispositivo 1, 2, 3

---

## 🎯 Casos de Uso

### **Caso 1: Banco Multi-Producto**

**Contexto:** Un banco tiene 3 productos: Tarjetas, Préstamos, Seguros

**Setup:**
1. Conectar 3 dispositivos WhatsApp
2. Crear categorías:
   - "Tarjetas"
   - "Prestamos"
   - "Seguros"
3. Al importar Excel con estas categorías, asignar:
   - "Tarjetas" → Dispositivo 1
   - "Prestamos" → Dispositivo 2
   - "Seguros" → Dispositivo 3

**Beneficio:**
- ✅ Cada producto tiene su número dedicado
- ✅ Los clientes siempre hablan con el mismo número
- ✅ Mejor organización y seguimiento
- ✅ Reduce confusión en respuestas

---

### **Caso 2: Empresa Multi-Departamento**

**Contexto:** Una empresa con: Ventas, Soporte, Cobranzas

**Setup:**
1. Conectar 3 dispositivos
2. Asignar:
   - "Ventas" → Dispositivo Ventas
   - "Soporte" → Dispositivo Soporte
   - "Cobranzas" → Dispositivo Cobranzas

**Beneficio:**
- ✅ Cada departamento gestiona sus propios contactos
- ✅ Historial de conversaciones por departamento
- ✅ Facilita el trabajo en equipo

---

### **Caso 3: Mix de Asignación + Rotación**

**Contexto:** Algunos productos importantes con número dedicado, otros con rotación

**Setup:**
- "VIP" → Dispositivo Premium
- "Clientes Antiguos" → Dispositivo Principal
- "Prospectos" → (Sin asignar, rotación automática)

**Beneficio:**
- ✅ VIPs siempre atendidos por el mismo número
- ✅ Clientes antiguos también
- ✅ Prospectos nuevos distribuidos para evitar SPAM

---

## 🛠️ Archivos Modificados

### **Backend:**

1. **`src/backend/routes/deviceRoutes.js`**
   - Línea 42-53: Límite aumentado de 5 a 20

2. **`src/backend/routes/uploadRoutes.js`**
   - Línea 141-164: Extracción de `dispositivo_id` de categoría
   - Línea 193-213: Lógica de asignación inteligente

3. **`src/backend/routes/categoryDeviceRoutes.js`** (NUEVO)
   - Endpoint `/api/category-devices/assign`
   - Endpoint `/api/category-devices/unassigned`

4. **`src/backend/server.js`**
   - Línea 20: Import `categoryDeviceRoutes`
   - Línea 62: Route `/api/category-devices`

### **Frontend:**

5. **`src/frontend/js/app.js`**
   - Línea 1218: Llamada a `checkUnassignedCategories()`
   - Línea 2134-2240: Funciones de asignación de categorías

### **Database:**

6. **`database/schema.sql`**
   - Tabla `categorias` ya tiene `dispositivo_id` (existente)

---

## ✅ Checklist de Implementación

- [x] Límite de dispositivos aumentado de 5 a 20
- [x] Backend: Endpoint para asignar dispositivos a categorías
- [x] Backend: Endpoint para obtener categorías sin asignar
- [x] Backend: Lógica de asignación inteligente en uploadRoutes
- [x] Frontend: Modal de asignación de dispositivos
- [x] Frontend: Verificación automática después de importar Excel
- [x] Frontend: Opción de omitir y usar rotación automática
- [x] Documentación completa

---

## 🚀 Cómo Probar

### **Prueba 1: Crear Más de 5 Dispositivos**

```
1. Ir a "Dispositivos"
2. Crear 6+ dispositivos
3. ✅ Debería permitir hasta 20
4. ❌ Error al intentar crear el 21
```

### **Prueba 2: Asignación de Categorías**

```
1. Conectar 2-3 dispositivos
2. Crear campaña tipo "Excel"
3. Importar Excel con columna "categoria" con valores:
   - BCP
   - Interbank
   - BBVA
4. Después de importar:
   ✅ Aparece modal "Categorías sin Dispositivo Asignado"
   ✅ Lista las 3 categorías
   ✅ Permite seleccionar dispositivo para cada una
5. Asignar dispositivos
6. Click "✅ Asignar Dispositivos"
7. ✅ Mensaje: "3 categoría(s) asignada(s) correctamente"
```

### **Prueba 3: Verificar Asignación en Logs**

```
1. Iniciar campaña con categorías asignadas
2. Ver logs del servidor
3. Buscar:
   📌 Usando dispositivo asignado a categoría: X
4. ✅ Confirma que usa el dispositivo correcto
```

### **Prueba 4: Mix de Asignación + Rotación**

```
Excel con:
- 5 mensajes categoría "BCP" (asignada a Dispositivo 1)
- 5 mensajes categoría "Otros" (sin asignar)

Resultado esperado:
- Mensajes "BCP" → Todos desde Dispositivo 1
- Mensajes "Otros" → Rotación entre todos los dispositivos

Logs del servidor:
📌 Usando dispositivo asignado a categoría: 1
📌 Usando dispositivo asignado a categoría: 1
... (5 veces)
🔄 Rotación: Dispositivo 2
🔄 Rotación: Dispositivo 3
🔄 Rotación: Dispositivo 1
... (rotación aleatoria/secuencial)
```

---

## 📝 Notas Técnicas

### **Base de Datos**

La tabla `categorias` ya tiene el campo `dispositivo_id`:

```sql
CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    dispositivo_id INT,  -- ← Aquí se guarda la asignación
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    color VARCHAR(7) DEFAULT '#007bff',
    ...
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE SET NULL
);
```

**Comportamiento:**
- Si `dispositivo_id IS NULL` → Rotación automática
- Si `dispositivo_id = X` → Usar ese dispositivo (si está conectado)
- Si dispositivo asignado está desconectado → Fallback a rotación

---

## 🎉 Beneficios Globales

### **1. Escalabilidad**
- ✅ Hasta 20 dispositivos (antes 5)
- ✅ Soporta organizaciones grandes

### **2. Organización**
- ✅ Cada categoría con su dispositivo
- ✅ Mejor seguimiento de conversaciones
- ✅ Historial limpio por producto/departamento

### **3. Anti-SPAM**
- ✅ Distribución inteligente de carga
- ✅ Menos mensajes por dispositivo
- ✅ Menor probabilidad de bloqueo

### **4. Flexibilidad**
- ✅ Asignación fija para categorías importantes
- ✅ Rotación automática para el resto
- ✅ Opción de omitir y usar solo rotación

### **5. User Experience**
- ✅ Modal automático después de importar
- ✅ Interfaz clara y simple
- ✅ Opción de omitir si no es necesario

---

## 🔜 Mejoras Futuras (Opcional)

1. **Vista de Categorías con Dispositivos Asignados**
   - Ver todas las categorías y sus dispositivos
   - Cambiar asignaciones desde interfaz de Categorías

2. **Dashboard de Distribución**
   - Gráfico: Mensajes por dispositivo
   - Gráfico: Mensajes por categoría
   - Balance de carga visual

3. **Auto-Asignación Inteligente**
   - Sugerir dispositivo menos cargado
   - Balanceo automático basado en carga actual

4. **Asignación por Horario**
   - Dispositivo A: 8am-2pm
   - Dispositivo B: 2pm-8pm

---

## ✅ Resultado Final

Con estas dos funcionalidades implementadas, el sistema ahora puede:

1. ✅ **Conectar hasta 20 dispositivos** (antes 5)
2. ✅ **Asignar dispositivos específicos a categorías** para mejor organización
3. ✅ **Usar rotación inteligente** para categorías sin asignar
4. ✅ **Reducir significativamente el riesgo de SPAM** mediante distribución de carga
5. ✅ **Facilitar el trabajo multi-departamento** en organizaciones

**Listo para desplegar! 🚀**

