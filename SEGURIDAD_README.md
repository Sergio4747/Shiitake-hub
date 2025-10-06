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

## 🚀 Instalación y Configuración

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Variables de Entorno (.env)
Crear archivo `.env` con las siguientes variables:

```env
# MercadoPago (OBLIGATORIO)
MERCADOPAGO_ACCESS_TOKEN=tu_access_token_de_produccion

# Configuración de Producción
NODE_ENV=production
VERCEL_URL=https://tu-app.vercel.app
DOMAIN_URL=https://tu-app.vercel.app
FRONTEND_URL=https://tu-app.vercel.app

# Email (OPCIONAL - para confirmaciones por email)
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password

# WhatsApp (OPCIONAL - para notificaciones al vendedor)
WHATSAPP_NUMBER=5491234567890

# Administración
ADMIN_USERNAME=tu_usuario_admin
ADMIN_PASSWORD=tu_contraseña_segura_aqui
```

### 3. Ejecutar en Desarrollo
```bash
npm run dev
```

### 4. Ejecutar en Producción
```bash
npm start
```

## 📋 Endpoints Disponibles

| Método | Endpoint | Descripción | Seguridad |
|--------|----------|-------------|-----------|
| GET | `/` | Página principal | Pública |
| GET | `/health` | Estado del servidor | Pública |
| GET | `/api/products` | Lista de productos | Pública |
| POST | `/admin/login` | Login de administrador | Rate limited + Validación |
| GET | `/admin/products` | Gestión de productos | Autenticación requerida |
| POST | `/admin/products` | Agregar producto | Autenticación + Validación + File upload seguro |
| DELETE | `/admin/products/:id` | Eliminar producto | Autenticación + Validación |
| POST | `/create_preference` | Crear pago MercadoPago | Rate limited + Validación estricta |
| POST | `/send-whatsapp-notification` | Notificación WhatsApp | Validación de datos |
| POST | `/send-confirmation-email` | Email de confirmación | Validación de datos |

## 🔍 Monitoreo y Logs

### Archivos de Log
- `logs/combined.log` - Todas las actividades
- `logs/error.log` - Solo errores

### Información Logueada
- Dirección IP de todas las peticiones
- User-Agent
- Timestamp
- URLs accedidas
- Errores con stack trace completo
- Intentos de autenticación
- Operaciones de pago
- Subidas de archivos

## 🛡️ Recomendaciones Adicionales

### Para Producción
1. **Configurar HTTPS obligatorio**
2. **Usar environment variables en Vercel/Netlify**
3. **Configurar monitoreo externo** (ej: Sentry, DataDog)
4. **Backup automático de `products.json`**
5. **Configurar firewall** (si usas VPS)

### Seguridad de Datos
1. **Contraseñas fuertes** para admin (mínimo 12 caracteres)
2. **Rotación periódica de tokens** de MercadoPago
3. **Monitoreo de logs** para detectar actividades sospechosas
4. **Actualizaciones regulares** de dependencias

## 🚨 Alertas de Seguridad

El sistema detecta y alerta sobre:
- Intentos de login fallidos múltiples
- Archivos maliciosos subidos
- Precios manipulados en pagos
- Peticiones desde orígenes sospechosos
- Errores internos del servidor

## 📞 Soporte

Para problemas de seguridad o configuración, revisa los logs en `logs/` y contacta al administrador del sistema.

---

**⚠️ IMPORTANTE**: Nunca compartas tus credenciales de MercadoPago ni el archivo `.env` con terceros.
