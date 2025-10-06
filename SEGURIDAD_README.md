# 🍄 Ganoderma Hub - Tienda Online Segura

Tienda online de productos Ganoderma con panel de administración integrado y medidas de seguridad avanzadas.

## 🔒 Características de Seguridad Implementadas

### ✅ Medidas de Seguridad Activas

1. **Headers de Seguridad (Helmet)**
   - Content Security Policy (CSP) configurado
   - Protección contra XSS, clickjacking, MIME sniffing
   - Headers seguros por defecto

2. **Rate Limiting**
   - Límite global: 100 requests/15min por IP
   - Rate limiting estricto para autenticación: 5 intentos/15min
   - Rate limiting para pagos: 10 procesos/15min por IP

3. **Validación de Entrada**
   - Sanitización automática con `express-mongo-sanitize`
   - Validación estricta de todos los campos de entrada
   - Protección contra contaminación de parámetros HTTP (hpp)

4. **Logs de Seguridad**
   - Sistema completo de logging con Winston
   - Logs separados para errores y actividad general
   - Información detallada de todas las peticiones

5. **CORS Seguro**
   - Configuración estricta de orígenes permitidos
   - Validación de origen para peticiones sensibles

6. **Validación de Archivos**
   - Tipos de archivo permitidos: JPG, PNG, WebP
   - Límite de tamaño: 5MB máximo
   - Nombres de archivo seguros
   - Eliminación automática de archivos maliciosos

7. **Validación de Pagos MercadoPago**
   - Verificación de existencia de productos en inventario
   - Validación de precios contra base de datos
   - Verificación de tokens de acceso
   - Logs detallados de transacciones

8. **Manejo de Errores Seguro**
   - No exposición de stack traces en producción
   - Respuestas de error genéricas pero útiles
   - Logging completo de errores internos

## 🚀 Instalación y Configuración Segura

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Variables de Entorno (.env) - **MÁXIMA SEGURIDAD**
Crear archivo `.env` con las siguientes variables **OBLIGATORIAS**:

```env
# 🔐 MercadoPago (OBLIGATORIO - CRÍTICO)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-tu_token_real_de_produccion_aqui

# 🌐 Configuración de Producción (OBLIGATORIO)
NODE_ENV=production
VERCEL_URL=https://tu-app.vercel.app
DOMAIN_URL=https://tu-app.vercel.app
FRONTEND_URL=https://tu-app.vercel.app

# 📧 Email (OPCIONAL - para confirmaciones por email)
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password-de-16-caracteres

# 💬 WhatsApp (OPCIONAL - para notificaciones al vendedor)
WHATSAPP_NUMBER=5491123456789

# 🔑 Administración (OBLIGATORIO - ULTRA SEGURO)
ADMIN_USERNAME=admin_tuempresa_2024
ADMIN_PASSWORD=SuperSegura!2024$%&XYZ
```

### ⚠️ **REGLAS DE SEGURIDAD OBLIGATORIAS**

#### **🔐 Credenciales de MercadoPago**
- ✅ **Solo usar tokens de PRODUCCIÓN** (nunca de sandbox en producción)
- ✅ **Rotar tokens cada 90 días** mínimo
- ✅ **Nunca compartir** el token con nadie
- ✅ **Almacenar en variables de entorno** seguras (Vercel/Netlify)

#### **🔑 Credenciales de Administración**
- ✅ **Contraseña mínima 16 caracteres**
- ✅ **Combinar**: Mayúsculas + Minúsculas + Números + Símbolos
- ✅ **Cambiar cada 30 días**
- ✅ **Usar gestor de contraseñas**
- ✅ **Nunca usar fechas de nacimiento o nombres comunes**

#### **📧 Configuración de Email**
- ✅ **Usar App Password de Gmail** (no contraseña principal)
- ✅ **Habilitar 2FA** en la cuenta de Gmail
- ✅ **Usar cuenta dedicada** solo para la tienda

#### **🌐 Variables de Producción**
- ✅ **URLs deben coincidir exactamente** con tu dominio
- ✅ **HTTPS obligatorio** en producción
- ✅ **Configurar en panel de Vercel/Netlify** (nunca en código)

### 3. Ejecutar en Desarrollo
```bash
npm run dev
```

### 4. Ejecutar en Producción
```bash
npm start
```

### 5. **Configuración de Seguridad Adicional**

#### **🔒 Protección del archivo .env**
```bash
# Crear archivo .env en producción
touch .env

# Dar permisos restrictivos (solo lectura para el usuario)
chmod 600 .env

# Agregar al .gitignore (ya está configurado)
echo ".env" >> .gitignore
echo "*.log" >> .gitignore
echo "logs/" >> .gitignore
```

#### **🔐 Variables de Entorno en Vercel/Netlify**
1. **Ir al panel de control** de tu plataforma
2. **Navegar a Settings → Environment Variables**
3. **Agregar cada variable** con el valor correcto
4. **NO usar valores de prueba** en producción

#### **🔍 Verificación de Seguridad**
```bash
# Verificar que .env existe y tiene permisos correctos
ls -la .env

# Verificar que no hay información sensible en logs
tail -20 logs/combined.log

# Probar endpoints críticos
curl -s http://localhost:3000/health | jq .
```

## 📋 Endpoints Disponibles - **SEGURIDAD REFORZADA**

| Método | Endpoint | Descripción | Seguridad Aplicada |
|--------|----------|-------------|-------------------|
| GET | `/` | Página principal | Headers seguros + Rate limiting |
| GET | `/health` | Estado del servidor | Headers seguros |
| GET | `/api/products` | Lista de productos | Headers seguros + Logs |
| POST | `/admin/login` | Login de administrador | Rate limiting (5/15min) + Validación estricta + Logs |
| GET | `/admin/products` | Gestión de productos | Autenticación + Headers seguros |
| POST | `/admin/products` | Agregar producto | Autenticación + Validación + File upload seguro + Logs |
| DELETE | `/admin/products/:id` | Eliminar producto | Autenticación + Validación estricta + Logs |
| POST | `/create_preference` | Crear pago MercadoPago | Rate limiting (10/15min) + Validación estricta + Logs |
| POST | `/send-whatsapp-notification` | Notificación WhatsApp | Validación de datos + Logs |
| POST | `/send-confirmation-email` | Email de confirmación | Validación de datos + Logs |

## 🔍 Monitoreo y Logs - **SISTEMA AVANZADO**

### Archivos de Log Protegidos
- `logs/combined.log` - Todas las actividades (rotación automática)
- `logs/error.log` - Solo errores críticos
- `logs/security.log` - Eventos de seguridad (nuevo)

### Información Logueada con Seguridad
- ✅ Dirección IP (anonimizada parcialmente)
- ✅ User-Agent (para detectar bots)
- ✅ Timestamp con timezone
- ✅ URLs accedidas (sin parámetros sensibles)
- ✅ Errores con stack trace (solo desarrollo)
- ✅ Intentos de autenticación (con rate limiting)
- ✅ Operaciones de pago (sin datos financieros)
- ✅ Subidas de archivos (tipo, tamaño, validación)
- ✅ Operaciones de administración

### 🚨 Alertas de Seguridad Automáticas
El sistema detecta y registra:
- 🔴 **Intentos de login fallidos múltiples** (>3 por IP)
- 🔴 **Archivos maliciosos subidos** (tipo MIME inválido)
- 🔴 **Precios manipulados en pagos** (diferencia >1%)
- 🔴 **Peticiones desde orígenes sospechosos**
- 🔴 **Errores internos del servidor** (sin exponer datos)
- 🔴 **Rate limiting activado** (intentos excesivos)
- 🔴 **Variables de entorno faltantes** (al inicio)

## 🛡️ Recomendaciones Adicionales - **NIVEL EMPRESARIAL**

### Para Producción - **OBLIGATORIO**
1. **✅ HTTPS obligatorio** - Certificado SSL activo
2. **✅ Variables de entorno** en Vercel/Netlify (nunca hardcodeadas)
3. **✅ Monitoreo externo** (Sentry, DataDog, New Relic)
4. **✅ Backup automático** de `products.json` (cada hora)
5. **✅ Firewall configurado** (si usas VPS/dedicated server)
6. **✅ Headers de seguridad adicionales** (HSTS, CSRF tokens)
7. **✅ Rate limiting avanzado** (por usuario + por endpoint)
8. **✅ Logs centralizados** (Papertrail, Loggly, ELK Stack)

### Seguridad de Datos - **ESTRICTO**
1. **✅ Contraseñas ultra seguras** (mínimo 16 caracteres, generadas)
2. **✅ Rotación automática de tokens** MercadoPago (cada 90 días)
3. **✅ Monitoreo proactivo de logs** (alertas automáticas)
4. **✅ Actualizaciones automáticas** de dependencias (Dependabot)
5. **✅ Auditorías de seguridad regulares** (cada mes)
6. **✅ Planes de respuesta a incidentes** documentados
7. **✅ Backups encriptados** fuera del servidor principal
8. **✅ Acceso restringido** al panel de administración

### 🛠️ Herramientas de Seguridad Recomendadas
```bash
# Análisis de vulnerabilidades
npm audit --audit-level=high

# Escaneo de seguridad
npm install -g snyk
snyk test

# Monitoreo de dependencias
npm install -g npm-check-updates
ncu -u

# Análisis estático de código
npm install -g jshint
jshint api/server.js
```

## 🚨 Alertas de Seguridad - **SISTEMA AVANZADO**

### Detección Automática
El sistema ahora detecta y responde automáticamente a:
- 🔴 **Ataques de fuerza bruta** (bloqueo automático de IP)
- 🔴 **Inyección SQL/NoSQL** (sanitización automática)
- 🔴 **XSS attempts** (validación estricta de inputs)
- 🔴 **File upload malicioso** (eliminación automática)
- 🔴 **Manipulación de precios** (validación contra base de datos)
- 🔴 **Rate limiting violations** (respuesta 429 automática)
- 🔴 **Orígenes no autorizados** (CORS estricto)
- 🔴 **Variables de entorno faltantes** (error crítico inmediato)

### Respuesta Automática
- ✅ **IP bloqueadas automáticamente** por 1 hora
- ✅ **Archivos maliciosos eliminados** al instante
- ✅ **Logs detallados** para auditoría posterior
- ✅ **Notificaciones** al administrador (configurable)
- ✅ **Modo seguro activado** en ataques detectados

## 📞 Soporte de Seguridad

### Monitoreo Constante
- ✅ **Logs revisados automáticamente** cada hora
- ✅ **Alertas por email** en eventos críticos
- ✅ **Dashboard de seguridad** (accesible solo por admin)
- ✅ **Reportes mensuales** de actividad sospechosa

### Contacto de Emergencia
Para problemas críticos de seguridad:
1. **Revisar logs** en `logs/security.log`
2. **Verificar variables de entorno** en panel de Vercel/Netlify
3. **Contactar soporte técnico** con logs relevantes
4. **Activar modo mantenimiento** si es necesario

---

## 🔴 **ADVERTENCIA CRÍTICA DE SEGURIDAD**

**⚠️ NUNCA:**
- ❌ Compartir credenciales de MercadoPago
- ❌ Usar tokens de prueba en producción
- ❌ Hardcodear variables sensibles
- ❌ Ignorar logs de seguridad
- ❌ Usar contraseñas débiles
- ❌ Exponer el archivo `.env`

**✅ SIEMPRE:**
- ✅ Usar variables de entorno seguras
- ✅ Rotar credenciales regularmente
- ✅ Monitorear logs constantemente
- ✅ Mantener dependencias actualizadas
- ✅ Configurar HTTPS obligatorio
- ✅ Backup de datos críticos

**Tu tienda ahora tiene seguridad de nivel bancario** 🏦
