# 🚀 Guía de Despliegue en Vercel - Ganoderma Hub

## Problema Actual
Si ves el error `FUNCTION_INVOCATION_FAILED`, sigue estos pasos:

## ✅ Solución Paso a Paso

### 1. Verificar Variables de Entorno en Vercel
Ve a tu proyecto en Vercel → Settings → Environment Variables y agrega:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=tu_password_seguro
MERCADOPAGO_ACCESS_TOKEN=tu_token_real
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password
WHATSAPP_NUMBER=5491234567890
NODE_ENV=production
```

⚠️ **IMPORTANTE**: Después de agregar las variables, debes hacer un **Redeploy** del proyecto.

### 2. Verificar Archivos Requeridos
Asegúrate de que estos archivos existan:
- ✅ `api/server-vercel.js` (archivo principal)
- ✅ `api/products.json` (base de datos de productos)
- ✅ `vercel.json` (configuración de Vercel)
- ✅ `package.json` (dependencias)

### 3. Verificar vercel.json
Tu archivo `vercel.json` debe apuntar a `api/server-vercel.js`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/server-vercel.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/server-vercel.js"
    }
  ]
}
```

### 4. Comandos para Desplegar

#### Opción A: Desde Vercel Dashboard
1. Ve a https://vercel.com/dashboard
2. Importa tu repositorio de GitHub
3. Vercel detectará automáticamente la configuración
4. Agrega las variables de entorno
5. Haz clic en "Deploy"

#### Opción B: Desde la Terminal
```bash
# Instalar Vercel CLI
npm i -g vercel

# Login en Vercel
vercel login

# Desplegar
vercel --prod
```

### 5. Verificar el Despliegue
Una vez desplegado, visita:
- `https://tu-dominio.vercel.app/health` - Debe mostrar status OK
- `https://tu-dominio.vercel.app/api/products` - Debe mostrar los productos

### 6. Ver Logs en Vercel
Si sigue fallando:
1. Ve a tu proyecto en Vercel
2. Click en la pestaña "Deployments"
3. Click en el último deployment
4. Click en "View Function Logs"
5. Busca mensajes de error en rojo

## 🔧 Problemas Comunes

### Error: "FUNCTION_INVOCATION_FAILED"
**Causa**: Error en el código o falta de variables de entorno
**Solución**: 
- Verifica que todas las variables de entorno estén configuradas
- Revisa los logs de la función en Vercel
- Asegúrate de que `api/products.json` exista

### Error: "Module not found"
**Causa**: Falta alguna dependencia en package.json
**Solución**: 
```bash
npm install
```
Y vuelve a desplegar.

### Error: CORS
**Causa**: El frontend no puede comunicarse con el backend
**Solución**: Ya está configurado para permitir todos los orígenes en Vercel.

## 📝 Notas Importantes

1. **Archivos Estáticos**: Las imágenes en `/img` deben estar en el repositorio
2. **Base de Datos**: `products.json` es de solo lectura en Vercel (filesystem efímero)
3. **Uploads**: Los archivos subidos se guardan en `/tmp` y se borran después de cada ejecución
4. **Variables de Entorno**: Nunca subas el archivo `.env` a GitHub

## 🆘 Si Nada Funciona

Crea un archivo `api/test.js` simple:

```javascript
module.exports = (req, res) => {
  res.status(200).json({
    message: "¡Funciona!",
    timestamp: new Date().toISOString()
  });
};
```

Y actualiza `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/test.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/test.js"
    }
  ]
}
```

Si esto funciona, el problema está en `server-vercel.js`.

## 📞 Soporte
- Documentación Vercel: https://vercel.com/docs
- Logs de la función: Vercel Dashboard → Deployments → Function Logs
