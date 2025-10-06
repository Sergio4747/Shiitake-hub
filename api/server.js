require('dotenv').config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult, param } = require("express-validator");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const winston = require("winston");
const csurf = require("csurf");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const nodemailer = require('nodemailer');
const { MercadoPagoConfig, Preference } = require("mercadopago");

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Directorio de logs creado');
}

// Configurar logger de seguridad
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ganoderma-hub' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Configurar headers de seguridad con Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://sdk.mercadopago.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.mercadopago.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["https://www.mercadopago.com.ar"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Configurar rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por ventana por IP
  message: {
    error: 'Demasiadas peticiones desde esta IP, intenta nuevamente más tarde.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit excedido', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Demasiadas peticiones desde esta IP, intenta nuevamente más tarde.',
      retryAfter: '15 minutos'
    });
  }
});

app.use(limiter);

// Rate limiting más estricto para rutas sensibles
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Solo 5 intentos de login por 15 minutos
  message: {
    error: 'Demasiados intentos de autenticación, intenta nuevamente más tarde.'
  }
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Máximo 10 procesos de pago por 15 minutos por IP
  message: {
    error: 'Demasiados procesos de pago, intenta nuevamente más tarde.'
  }
});

// Middleware de seguridad básico
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize()); // Prevenir NoSQL injection
app.use(hpp()); // Prevenir contaminación de parámetros HTTP

// Configurar CORS de manera segura
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origen (como apps móviles) y dominios específicos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL,
      process.env.VERCEL_URL,
    ].filter(Boolean);

    if (!origin || allowedOrigins.some(allowed => origin.includes(allowed))) {
      callback(null, true);
    } else {
      logger.warn('Origen CORS bloqueado', { origin });
      callback(new Error('Origen no permitido por política CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Middleware para validar y sanitizar datos de entrada
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Errores de validación de entrada', {
      ip: req.ip,
      url: req.url,
      errors: errors.array()
    });
    return res.status(400).json({
      error: 'Datos de entrada inválidos',
      details: errors.array()
    });
  }
  next();
};

// Middleware para loguear todas las peticiones
app.use((req, res, next) => {
  logger.info('Petición recibida', {
    ip: req.ip,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Middleware personalizado para validar origen de peticiones sensibles
const validateOrigin = (req, res, next) => {
  const origin = req.get('origin');
  const referer = req.get('referer');

  // Validar que la petición venga de nuestro dominio o sea directa
  if (req.method === 'POST' &&
      (origin && !origin.includes(process.env.VERCEL_URL || 'localhost') &&
       referer && !referer.includes(process.env.VERCEL_URL || 'localhost'))) {
    logger.warn('Petición sospechosa bloqueada', {
      ip: req.ip,
      origin,
      referer,
      url: req.url
    });
    return res.status(403).json({ error: 'Origen no autorizado' });
  }
  next();
};

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(path.join(__dirname, '..')));

// Middleware para servir index.html en la raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Endpoint de salud para debugging
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

// Configurar multer con seguridad mejorada
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'img');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Crear nombre de archivo seguro
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    const basename = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9]/g, '-');
    cb(null, `${basename}-${uniqueSuffix}${extension}`);
  }
});

// Middleware personalizado para validar archivos
const validateFile = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  // Validaciones adicionales de seguridad para archivos
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(req.file.mimetype)) {
    logger.warn('Tipo de archivo no permitido en upload', {
      mimetype: req.file.mimetype,
      filename: req.file.filename,
      ip: req.ip
    });
    fs.unlinkSync(req.file.path); // Eliminar archivo malicioso
    return res.status(400).json({
      error: 'Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG y WebP.'
    });
  }

  if (req.file.size > maxSize) {
    logger.warn('Archivo demasiado grande rechazado', {
      size: req.file.size,
      maxSize: maxSize,
      filename: req.file.filename,
      ip: req.ip
    });
    fs.unlinkSync(req.file.path); // Eliminar archivo demasiado grande
    return res.status(400).json({
      error: 'Archivo demasiado grande. El tamaño máximo permitido es 5MB.'
    });
  }

  next();
};

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      logger.warn('Archivo rechazado por tipo MIME', {
        mimetype: file.mimetype,
        filename: file.originalname,
        ip: req.ip
      });
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
    files: 1 // Solo un archivo por vez
  }
});

// Verificar variables de entorno críticas
if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  console.error('❌ MERCADOPAGO_ACCESS_TOKEN no configurado');
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-TOKEN'
});

// Configurar nodemailer para serverless

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
  console.warn('⚠️  Variables de entorno para email no encontradas. El envío de emails estará deshabilitado.');
}

// Middleware de autenticación para admin
const authenticateAdmin = (req, res, next) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: "Credenciales incorrectas" });
  }
};

// Función para leer productos
const readProducts = () => {
  try {
    // Buscar el archivo products.json en la misma carpeta que el servidor
    const filePath = path.join(__dirname, 'products.json');

    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      console.error('❌ El archivo products.json NO existe en la ruta:', filePath);
      console.log('📂 Archivos disponibles en api/:', fs.readdirSync(path.join(__dirname)));
      return {};
    }

    console.log('✅ Archivo products.json encontrado');
    const data = fs.readFileSync(filePath, 'utf8');
    console.log('📦 Datos leídos, longitud:', data.length);
    const products = JSON.parse(data);
    console.log(`📦 Productos cargados correctamente: ${Object.keys(products).length} productos`);
    return products;
  } catch (error) {
    console.error("❌ Error al leer productos:", error);
    return {};
  }
};

// Función para escribir productos
const writeProducts = (products) => {
  try {
    // Guardar en la carpeta api donde está el archivo actualmente
    fs.writeFileSync(path.join(__dirname, 'products.json'), JSON.stringify(products, null, 2));
    return true;
  } catch (error) {
    console.error("Error al escribir productos:", error);
    return false;
  }
};

// RUTAS DE ADMINISTRACIÓN

// Validaciones para login
const loginValidations = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Nombre de usuario inválido'),
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('Contraseña debe tener entre 6 y 100 caracteres')
];

app.post("/admin/login", authLimiter, validateOrigin, loginValidations, validateInput, authenticateAdmin, (req, res) => {
  logger.info('Login exitoso de administrador', {
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  res.json({ success: true, message: "Login exitoso" });
});

// Validaciones para agregar producto
const productValidations = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .matches(/^[^<>\"'&]*$/)
    .withMessage('Nombre del producto contiene caracteres inválidos'),
  body('price')
    .isFloat({ min: 0.01, max: 999999.99 })
    .withMessage('Precio debe ser un número positivo válido'),
  body('size')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Tamaño inválido'),
  body('description')
    .trim()
    .isIn(['cafe', 'proteine', 'capsula', 'te'])
    .withMessage('Categoría inválida')
];

// Agregar producto con validaciones mejoradas
app.post("/admin/products", productValidations, validateInput, upload.single('image'), validateFile, (req, res) => {
  try {
    const { name, price, size, description, username, password } = req.body;

    // Validar archivo de imagen
    if (!req.file) {
      logger.warn('Intento de agregar producto sin imagen', {
        ip: req.ip,
        productName: name
      });
      return res.status(400).json({ error: "Imagen del producto es requerida" });
    }

    // Validar tamaño de archivo (máximo 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      logger.warn('Archivo de imagen demasiado grande', {
        ip: req.ip,
        fileSize: req.file.size,
        productName: name
      });
      return res.status(400).json({ error: "Imagen debe ser menor a 5MB" });
    }

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      logger.warn('Tipo de archivo no permitido', {
        ip: req.ip,
        mimeType: req.file.mimetype,
        productName: name
      });
      return res.status(400).json({ error: "Solo se permiten imágenes JPG, PNG o WebP" });
    }

    // Verificar credenciales
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      logger.warn('Intento de agregar producto con credenciales inválidas', {
        ip: req.ip,
        providedUsername: username
      });
      return res.status(401).json({ error: "Credenciales incorrectas" });
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
      logger.info('Producto agregado exitosamente', {
        productId: newId,
        productName: name,
        ip: req.ip
      });
      res.json({ success: true, id: newId, product: products[newId] });
    } else {
      logger.error('Error al guardar producto en archivo', {
        productId: newId,
        productName: name,
        ip: req.ip
      });
      res.status(500).json({ error: "Error al guardar producto" });
    }
  } catch (error) {
    logger.error('Error interno al agregar producto', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({ error: error.message });
  }
});

// Validaciones para eliminar producto
const deleteProductValidations = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID de producto inválido'),
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Nombre de usuario inválido'),
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('Contraseña inválida')
];

// Eliminar producto con validaciones mejoradas
app.delete("/admin/products/:id", deleteProductValidations, validateInput, (req, res) => {
  try {
    const { username, password } = req.body;

    // Verificar credenciales
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      logger.warn('Intento de eliminar producto con credenciales inválidas', {
        ip: req.ip,
        productId: req.params.id,
        providedUsername: username
      });
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const products = readProducts();
    const productId = req.params.id;

    if (products[productId]) {
      const productName = products[productId].name;

      // Eliminar imagen si existe
      const imagePath = path.join(__dirname, '..', products[productId].image);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
          logger.info('Imagen de producto eliminada', {
            productId,
            imagePath,
            ip: req.ip
          });
        } catch (fileError) {
          logger.error('Error al eliminar archivo de imagen', {
            productId,
            imagePath,
            error: fileError.message,
            ip: req.ip
          });
        }
      }

      delete products[productId];

      if (writeProducts(products)) {
        logger.info('Producto eliminado exitosamente', {
          productId,
          productName,
          ip: req.ip
        });
        res.json({ success: true, message: "Producto eliminado" });
      } else {
        logger.error('Error al eliminar producto del archivo', {
          productId,
          productName,
          ip: req.ip
        });
        res.status(500).json({ error: "Error al eliminar producto" });
      }
    } else {
      logger.warn('Intento de eliminar producto inexistente', {
        productId,
        ip: req.ip
      });
      res.status(404).json({ error: "Producto no encontrado" });
    }
  } catch (error) {
    logger.error('Error interno al eliminar producto', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      productId: req.params.id
    });
    res.status(500).json({ error: error.message });
  }
});

// Obtener productos para el panel de administración
app.get("/admin/products", (req, res) => {
  try {
    const products = readProducts();
    logger.info('Productos solicitados para administración', {
      productsCount: Object.keys(products).length,
      ip: req.ip
    });
    res.json(products);
  } catch (error) {
    logger.error('Error al obtener productos para administración', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

// Obtener productos para el frontend público
app.get("/api/products", (req, res) => {
  try {
    const products = readProducts();
    logger.info('Productos solicitados públicamente', {
      productsCount: Object.keys(products).length,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.json(products);
  } catch (error) {
    logger.error('Error al obtener productos públicos', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

// Validaciones para datos de WhatsApp
const whatsappValidations = [
  body('buyerData')
    .exists()
    .withMessage('Datos del comprador requeridos'),
  body('buyerData.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z\sáéíóúÁÉÍÓÚñÑ]+$/)
    .withMessage('Nombre inválido'),
  body('buyerData.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('buyerData.phone')
    .matches(/^\d{10,15}$/)
    .withMessage('Número de teléfono inválido'),
  body('buyerData.address')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Dirección inválida'),
  body('buyerData.city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z\sáéíóúÁÉÍÓÚñÑ]+$/)
    .withMessage('Ciudad inválida'),
  body('buyerData.zip')
    .matches(/^\d{4,8}$/)
    .withMessage('Código postal inválido'),
  body('cartItems')
    .isArray({ min: 1, max: 50 })
    .withMessage('Productos del carrito requeridos'),
  body('total')
    .isFloat({ min: 0.01 })
    .withMessage('Total inválido')
];

app.post("/send-whatsapp-notification", whatsappValidations, validateInput, (req, res) => {
  try {
    const { buyerData, cartItems, total } = req.body;

    // Validar número de WhatsApp configurado
    if (!process.env.WHATSAPP_NUMBER) {
      logger.error('Número de WhatsApp no configurado', { ip: req.ip });
      return res.status(500).json({ error: 'Servicio de WhatsApp no configurado' });
    }

    // Validar que el número tenga formato correcto
    const phoneRegex = /^54\d{10}$/;
    if (!phoneRegex.test(process.env.WHATSAPP_NUMBER)) {
      logger.error('Número de WhatsApp con formato inválido', {
        whatsappNumber: process.env.WHATSAPP_NUMBER,
        ip: req.ip
      });
      return res.status(500).json({ error: 'Configuración de WhatsApp inválida' });
    }

    logger.info('Enviando notificación de WhatsApp', {
      buyerName: buyerData.name,
      buyerEmail: buyerData.email,
      itemsCount: cartItems.length,
      total: total,
      ip: req.ip
    });

    // Formatear mensaje para WhatsApp
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

    // Crear URL de WhatsApp
    const phoneNumber = process.env.WHATSAPP_NUMBER;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    logger.info('URL de WhatsApp generada exitosamente', {
      whatsappUrl: whatsappUrl.substring(0, 100) + '...',
      ip: req.ip
    });

    res.json({
      success: true,
      whatsappUrl: whatsappUrl,
      message: "Datos preparados para WhatsApp"
    });

  } catch (error) {
    logger.error('Error al preparar mensaje de WhatsApp', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({ error: error.message });
  }
});

// Validaciones para email
const emailValidations = [
  body('buyerData')
    .exists()
    .withMessage('Datos del comprador requeridos'),
  body('buyerData.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('cartItems')
    .isArray({ min: 1 })
    .withMessage('Productos requeridos'),
  body('total')
    .isFloat({ min: 0.01 })
    .withMessage('Total inválido')
];

// Endpoint para enviar email de confirmación con validaciones mejoradas
app.post("/send-confirmation-email", emailValidations, validateInput, async (req, res) => {
  try {
    // Verificar que el servicio de email esté configurado
    if (!transporter) {
      logger.error('Servicio de email no configurado', { ip: req.ip });
      return res.status(500).json({ error: "Servicio de email no configurado" });
    }

    const { buyerData, cartItems, total } = req.body;

    logger.info('Enviando email de confirmación', {
      recipientEmail: buyerData.email,
      buyerName: buyerData.name,
      itemsCount: cartItems.length,
      total: total,
      ip: req.ip
    });

    // Crear HTML del email
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

    logger.info('Email de confirmación enviado exitosamente', {
      recipientEmail: buyerData.email,
      messageId: 'email-sent',
      ip: req.ip
    });

    res.json({
      success: true,
      message: "Email de confirmación enviado exitosamente"
    });

  } catch (error) {
    logger.error('Error al enviar email de confirmación', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      recipientEmail: req.body.buyerData?.email
    });
    res.status(500).json({ error: 'Error al enviar el email' });
  }
});

// Validaciones para datos de pago
const paymentValidations = [
  body('items')
    .isArray({ min: 1, max: 50 })
    .withMessage('Debe haber al menos 1 producto y máximo 50'),
  body('items.*.id')
    .isInt({ min: 1 })
    .withMessage('ID de producto inválido'),
  body('items.*.title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .matches(/^[^<>\"'&]*$/)
    .withMessage('Nombre del producto contiene caracteres inválidos'),
  body('items.*.unit_price')
    .isFloat({ min: 0.01, max: 999999.99 })
    .withMessage('Precio unitario inválido'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Cantidad debe ser entre 1 y 100'),
  body('items.*.currency_id')
    .equals('ARS')
    .withMessage('Solo se acepta moneda ARS'),
  body('payer')
    .exists()
    .withMessage('Datos del comprador requeridos'),
  body('payer.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z\sáéíóúÁÉÍÓÚñÑ]+$/)
    .withMessage('Nombre inválido'),
  body('payer.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('payer.phone.number')
    .matches(/^\d{10,15}$/)
    .withMessage('Número de teléfono inválido'),
  body('payer.address.street_name')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Dirección inválida'),
  body('payer.address.zip_code')
    .matches(/^\d{4,8}$/)
    .withMessage('Código postal inválido'),
  body('payer.address.city_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z\sáéíóúÁÉÍÓÚñÑ]+$/)
    .withMessage('Ciudad inválida')
];

app.post("/create_preference", paymentLimiter, validateOrigin, paymentValidations, validateInput, async (req, res) => {
  try {
    const { items, payer } = req.body;

    // Validar que el access token de MercadoPago esté configurado
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN === 'TEST-TOKEN') {
      logger.error('Token de MercadoPago no configurado correctamente', {
        ip: req.ip,
        hasToken: !!process.env.MERCADOPAGO_ACCESS_TOKEN
      });
      return res.status(500).json({
        error: 'Sistema de pagos no configurado correctamente'
      });
    }

    // Validar estructura de datos
    if (!items || !Array.isArray(items) || items.length === 0) {
      logger.warn('Datos de pago inválidos', {
        ip: req.ip,
        itemsCount: items ? items.length : 0
      });
      return res.status(400).json({ error: 'Datos de productos inválidos' });
    }

    // Validar que todos los productos existan en nuestra base
    const products = readProducts();
    for (const item of items) {
      if (!products[item.id]) {
        logger.warn('Producto en pago no existe en inventario', {
          ip: req.ip,
          productId: item.id,
          requestedTitle: item.title
        });
        return res.status(400).json({
          error: `Producto ${item.title} no disponible`
        });
      }

      // Validar que el precio coincida
      if (Math.abs(products[item.id].price - item.unit_price) > 0.01) {
        logger.warn('Precio del producto no coincide', {
          ip: req.ip,
          productId: item.id,
          expectedPrice: products[item.id].price,
          receivedPrice: item.unit_price
        });
        return res.status(400).json({
          error: 'Precio del producto no válido'
        });
      }
    }

    const baseUrl = process.env.NODE_ENV === 'production'
      ? process.env.VERCEL_URL || process.env.DOMAIN_URL || 'https://tu-dominio.vercel.app'
      : 'http://localhost:3000';

    // Validar que la URL de retorno sea válida
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      logger.error('URL de retorno inválida', {
        baseUrl,
        ip: req.ip
      });
      return res.status(500).json({ error: 'Configuración de URLs inválida' });
    }

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
      notification_url: process.env.NODE_ENV === 'production'
        ? `${baseUrl}/webhook/mercadopago`
        : null,
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Creando preferencia de pago', {
      itemsCount: items.length,
      totalAmount: items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0),
      ip: req.ip,
      payerEmail: payer.email
    });

    const preferenceResponse = await new Preference(client).create({ body: preference });

    logger.info('Preferencia de pago creada exitosamente', {
      preferenceId: preferenceResponse.id,
      ip: req.ip
    });

    res.json({ id: preferenceResponse.id });
  } catch (error) {
    logger.error('Error al crear preferencia de pago', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get("/success", (req, res) => {
  res.redirect("/?status=success");
});

app.get("/failure", (req, res) => {
  res.redirect("/?status=failure");
});

app.get("/pending", (req, res) => {
  res.redirect("/?status=pending");
});

// Middleware para manejar errores no controlados
app.use((error, req, res, next) => {
  logger.error('Error no controlado', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // No exponer detalles internos del error en producción
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(500).json({
    error: isDevelopment ? error.message : 'Error interno del servidor',
    ...(isDevelopment && { stack: error.stack })
  });
});

// Middleware para manejar rutas no encontradas
app.use('*', (req, res) => {
  logger.warn('Ruta no encontrada', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

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

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🔒 Modo de seguridad: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Logs disponibles en: ${path.join(__dirname, 'logs')}`);
  console.log('🔗 URLs disponibles:');
  console.log(`   • Frontend: http://localhost:${PORT}`);
  console.log(`   • Health check: http://localhost:${PORT}/health`);
  console.log(`   • API productos: http://localhost:${PORT}/api/products`);
});

// Configurar graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Señal SIGTERM recibida, cerrando servidor...');
  server.close(() => {
    logger.info('Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Señal SIGINT recibida, cerrando servidor...');
  server.close(() => {
    logger.info('Servidor cerrado correctamente');
    process.exit(0);
  });
});

// Para Vercel (serverless)
module.exports = app;