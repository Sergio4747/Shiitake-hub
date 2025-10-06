require('dotenv').config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const nodemailer = require('nodemailer');
const { MercadoPagoConfig, Preference } = require("mercadopago");

const app = express();

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Directorio de logs creado');
}

// Configuración básica de seguridad
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS básico pero seguro
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL,
      process.env.VERCEL_URL,
    ].filter(Boolean);

    if (!origin || allowedOrigins.some(allowed => origin.includes(allowed))) {
      callback(null, true);
    } else {
      console.warn('Origen CORS bloqueado:', origin);
      callback(new Error('Origen no permitido'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Headers de seguridad básicos
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Logging básico de peticiones
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '..')));

// Middleware para servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasMP: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
      hasEmail: !!process.env.EMAIL_USER,
      hasAdmin: !!process.env.ADMIN_USERNAME
    }
  });
});

// Configurar multer con seguridad básica
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'img');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + extension);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
    files: 1 // Solo un archivo por vez
  }
});

// Configurar MercadoPago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-TOKEN'
});

// Configurar nodemailer
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    console.log('✅ Nodemailer configurado correctamente.');
  } catch (error) {
    console.error('❌ Error al configurar Nodemailer:', error.message);
  }
} else {
  console.warn('⚠️ Variables de entorno para email no encontradas.');
}

// Función para leer productos
const readProducts = () => {
  try {
    const filePath = path.join(__dirname, 'products.json');
    if (!fs.existsSync(filePath)) {
      console.error('❌ El archivo products.json NO existe');
      return {};
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const products = JSON.parse(data);
    console.log(`✅ Productos cargados: ${Object.keys(products).length}`);
    return products;
  } catch (error) {
    console.error("❌ Error al leer productos:", error);
    return {};
  }
};

// Función para escribir productos
const writeProducts = (products) => {
  try {
    fs.writeFileSync(path.join(__dirname, 'products.json'), JSON.stringify(products, null, 2));
    return true;
  } catch (error) {
    console.error("Error al escribir productos:", error);
    return false;
  }
};

// Middleware de autenticación básico
const authenticateAdmin = (req, res, next) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: "Credenciales incorrectas" });
  }
};

// RUTAS DE ADMINISTRACIÓN

app.post("/admin/login", authenticateAdmin, (req, res) => {
  console.log('✅ Login exitoso desde IP:', req.ip);
  res.json({ success: true, message: "Login exitoso" });
});

// Agregar producto con validaciones básicas
app.post("/admin/products", upload.single('image'), (req, res) => {
  try {
    const { name, price, size, description, username, password } = req.body;

    // Validar credenciales
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    // Validar archivo
    if (!req.file) {
      return res.status(400).json({ error: "Imagen del producto es requerida" });
    }

    // Validar tamaño
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "Imagen debe ser menor a 5MB" });
    }

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Solo se permiten imágenes JPG, PNG o WebP" });
    }

    const products = readProducts();
    const newId = String(Math.max(...Object.keys(products).map(Number), 0) + 1);

    const imagePath = req.file ? `img/${req.file.filename}` : '';

    products[newId] = {
      name: name.trim(),
      price: parseFloat(price),
      size: size.trim(),
      description,
      image: imagePath
    };

    if (writeProducts(products)) {
      console.log(`✅ Producto agregado: ${name} - IP: ${req.ip}`);
      res.json({ success: true, id: newId, product: products[newId] });
    } else {
      res.status(500).json({ error: "Error al guardar producto" });
    }
  } catch (error) {
    console.error('Error interno:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar producto
app.delete("/admin/products/:id", (req, res) => {
  try {
    const { username, password } = req.body;

    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const products = readProducts();
    const productId = req.params.id;

    if (products[productId]) {
      const productName = products[productId].name;

      // Eliminar imagen si existe
      const imagePath = path.join(__dirname, '..', products[productId].image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      delete products[productId];

      if (writeProducts(products)) {
        console.log(`✅ Producto eliminado: ${productName} - IP: ${req.ip}`);
        res.json({ success: true, message: "Producto eliminado" });
      } else {
        res.status(500).json({ error: "Error al eliminar producto" });
      }
    } else {
      res.status(404).json({ error: "Producto no encontrado" });
    }
  } catch (error) {
    console.error('Error interno:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Obtener productos para administración
app.get("/admin/products", (req, res) => {
  try {
    const products = readProducts();
    console.log(`📤 Productos enviados al admin: ${Object.keys(products).length} - IP: ${req.ip}`);
    res.json(products);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

// Obtener productos públicos
app.get("/api/products", (req, res) => {
  try {
    const products = readProducts();
    console.log(`📤 Productos enviados al cliente: ${Object.keys(products).length} - IP: ${req.ip}`);
    res.json(products);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

// Notificación WhatsApp
app.post("/send-whatsapp-notification", (req, res) => {
  try {
    const { buyerData, cartItems, total } = req.body;

    if (!process.env.WHATSAPP_NUMBER) {
      return res.status(500).json({ error: 'Servicio de WhatsApp no configurado' });
    }

    console.log(`📱 Notificación WhatsApp enviada - Total: $${total} - IP: ${req.ip}`);

    let message = `🛒 *NUEVA COMPRA - GANODERMA HUB*\n\n`;
    message += `👤 *DATOS DEL CLIENTE:*\n`;
    message += `• Nombre: ${buyerData.name}\n`;
    message += `• Email: ${buyerData.email}\n`;
    message += `• Teléfono: ${buyerData.phone}\n`;
    message += `• Dirección: ${buyerData.address}\n`;
    message += `• Ciudad: ${buyerData.city}\n`;
    message += `• Código Postal: ${buyerData.zip}\n\n`;

    message += `📦 *PRODUCTOS COMPRADOS:*\n`;
    cartItems.forEach((item, index) => {
      message += `${index + 1}. ${item.name}\n`;
      message += `   • Cantidad: ${item.quantity}\n`;
      message += `   • Precio unitario: $${item.price}\n`;
      message += `   • Subtotal: $${(item.price * item.quantity).toFixed(2)}\n\n`;
    });

    message += `💰 *TOTAL: $${total}*\n\n`;
    message += `⏰ Fecha: ${new Date().toLocaleString('es-AR')}\n`;
    message += `🌐 Pedido realizado desde: Ganoderma Hub`;

    const phoneNumber = process.env.WHATSAPP_NUMBER;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    res.json({
      success: true,
      whatsappUrl: whatsappUrl,
      message: "Datos preparados para WhatsApp"
    });

  } catch (error) {
    console.error('Error WhatsApp:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Email de confirmación
app.post("/send-confirmation-email", async (req, res) => {
  try {
    if (!transporter) {
      return res.status(500).json({ error: "Servicio de email no configurado" });
    }

    const { buyerData, cartItems, total } = req.body;

    console.log(`📧 Email enviado a: ${buyerData.email} - Total: $${total} - IP: ${req.ip}`);

    let productsHTML = '';
    cartItems.forEach((item, index) => {
      productsHTML += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 15px; text-align: left;">
            <strong>${item.name}</strong><br>
            <small style="color: #666;">${item.size}</small>
          </td>
          <td style="padding: 15px; text-align: center;">${item.quantity}</td>
          <td style="padding: 15px; text-align: right;">$${item.price}</td>
          <td style="padding: 15px; text-align: right; font-weight: bold;">$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
      `;
    });

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Confirmación de Compra - Ganoderma Hub</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🍄 Ganoderma Hub</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">¡Gracias por tu compra!</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none;">
          <h2 style="color: #333; margin-top: 0;">Confirmación de Pedido</h2>

          <p>Hola <strong>${buyerData.name}</strong>,</p>
          <p>Hemos recibido tu pedido correctamente. A continuación encontrarás el resumen de tu compra:</p>

          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">📦 Productos Comprados</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f0f0f0;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Producto</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Cantidad</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Precio Unit.</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${productsHTML}
              </tbody>
            </table>

            <div style="text-align: right; margin-top: 20px; padding-top: 20px; border-top: 2px solid #333;">
              <h3 style="margin: 0; font-size: 24px; color: #333;">Total: $${total}</h3>
            </div>
          </div>

          <p style="margin-top: 30px;">Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.</p>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; margin: 0;">¡Gracias por elegir Ganoderma Hub!</p>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">
              Fecha del pedido: ${new Date().toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: buyerData.email,
      subject: '✅ Confirmación de Compra - Ganoderma Hub',
      html: emailHTML
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: "Email de confirmación enviado exitosamente"
    });

  } catch (error) {
    console.error('Error email:', error.message);
    res.status(500).json({ error: 'Error al enviar el email' });
  }
});

// Crear preferencia de pago MercadoPago
app.post("/create_preference", async (req, res) => {
  try {
    const { items, payer } = req.body;

    // Validar token
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN === 'TEST-TOKEN') {
      return res.status(500).json({
        error: 'Sistema de pagos no configurado correctamente'
      });
    }

    // Validar productos
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Datos de productos inválidos' });
    }

    const products = readProducts();
    for (const item of items) {
      if (!products[item.id]) {
        return res.status(400).json({
          error: `Producto ${item.title} no disponible`
        });
      }

      if (Math.abs(products[item.id].price - item.unit_price) > 0.01) {
        return res.status(400).json({
          error: 'Precio del producto no válido'
        });
      }
    }

    const baseUrl = process.env.NODE_ENV === 'production'
      ? process.env.VERCEL_URL || process.env.DOMAIN_URL || 'https://tu-dominio.vercel.app'
      : 'http://localhost:3000';

    const preference = {
      items: items,
      payer: payer,
      back_urls: {
        success: `${baseUrl}/?status=success`,
        failure: `${baseUrl}/?status=failure`,
        pending: `${baseUrl}/?status=pending`,
      },
      auto_return: 'approved',
      payment_methods: {
        installments: 12,
        default_installments: 1
      },
      metadata: {
        ip: req.ip,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`💳 Creando preferencia de pago - Items: ${items.length} - Total: $${items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)} - IP: ${req.ip}`);

    const preferenceResponse = await new Preference(client).create({ body: preference });

    console.log(`✅ Preferencia creada: ${preferenceResponse.id} - IP: ${req.ip}`);

    res.json({ id: preferenceResponse.id });
  } catch (error) {
    console.error('Error MercadoPago:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Callbacks de MercadoPago
app.get("/success", (req, res) => {
  res.redirect("/?status=success");
});

app.get("/failure", (req, res) => {
  res.redirect("/?status=failure");
});

app.get("/pending", (req, res) => {
  res.redirect("/?status=pending");
});

// Manejo de errores básico
app.use((error, req, res, next) => {
  console.error('Error no controlado:', error.message);
  res.status(500).json({
    error: 'Error interno del servidor'
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  console.warn('Ruta no encontrada:', req.originalUrl);
  res.status(404).json({
    error: 'Ruta no encontrada',
    availableRoutes: [
      'GET /',
      'GET /health',
      'GET /api/products',
      'POST /admin/login',
      'GET /admin/products',
      'POST /admin/products',
      'DELETE /admin/products/:id',
      'POST /create_preference',
      'POST /send-whatsapp-notification',
      'POST /send-confirmation-email'
    ]
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🔒 Modo de seguridad: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Logs disponibles en: ${path.join(__dirname, 'logs')}`);
  console.log('🔗 URLs disponibles:');
  console.log(`   • Frontend: http://localhost:${PORT}`);
  console.log(`   • Health check: http://localhost:${PORT}/health`);
  console.log(`   • API productos: http://localhost:${PORT}/api/products`);
});

// Para Vercel (serverless)
module.exports = app;
