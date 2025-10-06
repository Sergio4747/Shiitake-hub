require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const nodemailer = require('nodemailer');
const { MercadoPagoConfig, Preference } = require("mercadopago");

const app = express();

app.use(express.static(path.join(__dirname, '..')));
app.use(cors());
app.use(bodyParser.json());

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

// Configurar multer para subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'img'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

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
    // Simplemente busca el archivo en el directorio actual (__dirname)
    const filePath = path.join(__dirname, 'products.json');
    console.log('📂 Intentando leer archivo de productos en:', filePath);

    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      console.error('❌ El archivo products.json NO existe en la ruta:', filePath);
      return {};
    }

    console.log('✅ Archivo products.json encontrado');
    const data = fs.readFileSync(filePath, 'utf8');
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
    fs.writeFileSync(path.join(__dirname, '..', 'products.json'), JSON.stringify(products, null, 2));
    return true;
  } catch (error) {
    console.error("Error al escribir productos:", error);
    return false;
  }
};

// RUTAS DE PRODUCTOS

// Obtener todos los productos
app.get('/api/products', (req, res) => {
  try {
    const products = readProducts();
    console.log('📤 Enviando productos al cliente:', Object.keys(products).length);
    res.json(products);
  } catch (error) {
    console.error('❌ Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

// RUTAS DE ADMINISTRACIÓN

app.post("/admin/login", authenticateAdmin, (req, res) => {
  res.json({ success: true, message: "Login exitoso" });
});

// Agregar producto
app.post("/admin/products", upload.single('image'), (req, res) => {
  try {
    const { name, price, size, description, username, password } = req.body;

    // Verificar credenciales
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const products = readProducts();
    const newId = String(Math.max(...Object.keys(products).map(Number), 0) + 1);

    const imagePath = req.file ? `img/${req.file.filename}` : '';

    products[newId] = {
      name,
      price: parseFloat(price),
      size,
      description,
      image: imagePath
    };

    if (writeProducts(products)) {
      res.json({ success: true, id: newId, product: products[newId] });
    } else {
      res.status(500).json({ error: "Error al guardar producto" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar producto
app.delete("/admin/products/:id", (req, res) => {
  try {
    const { username, password } = req.body;

    // Verificar credenciales
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const products = readProducts();
    const productId = req.params.id;

    if (products[productId]) {
      // Eliminar imagen si existe
      const imagePath = path.join(__dirname, '..', products[productId].image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      delete products[productId];

      if (writeProducts(products)) {
        res.json({ success: true, message: "Producto eliminado" });
      } else {
        res.status(500).json({ error: "Error al eliminar producto" });
      }
    } else {
      res.status(404).json({ error: "Producto no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener productos para el frontend público
app.get("/api/products", (req, res) => {
  const products = readProducts();
  res.json(products);
});

// Endpoint para enviar notificación por WhatsApp
app.post("/send-whatsapp-notification", (req, res) => {
  try {
    const { buyerData, cartItems, total } = req.body;

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
    const phoneNumber = process.env.WHATSAPP_NUMBER || '5491234567890'; // Tu número
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    // En lugar de enviar automáticamente, devolvemos la URL para que el cliente abra WhatsApp
    res.json({
      success: true,
      whatsappUrl: whatsappUrl,
      message: "Datos preparados para WhatsApp"
    });

  } catch (error) {
    console.error("Error al preparar mensaje de WhatsApp:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para enviar email de confirmación
app.post("/send-confirmation-email", async (req, res) => {
  try {
    if (!transporter) {
      return res.status(500).json({ error: "Email service not configured" });
    }

    const { buyerData, cartItems, total } = req.body;

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
          
          <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">📍 Datos de Envío</h3>
            <p style="margin: 5px 0;"><strong>Dirección:</strong> ${buyerData.address}</p>
            <p style="margin: 5px 0;"><strong>Ciudad:</strong> ${buyerData.city}</p>
            <p style="margin: 5px 0;"><strong>Código Postal:</strong> ${buyerData.zip}</p>
            <p style="margin: 5px 0;"><strong>Teléfono:</strong> ${buyerData.phone}</p>
          </div>
          
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">📞 Próximos Pasos</h3>
            <p style="margin: 5px 0; color: #856404;">• Nos pondremos en contacto contigo para coordinar la entrega</p>
            <p style="margin: 5px 0; color: #856404;">• El tiempo de entrega es de 2-5 días hábiles</p>
            <p style="margin: 5px 0; color: #856404;">• Recibirás actualizaciones por WhatsApp y email</p>
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
    console.error("Error al enviar email:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/create_preference", async (req, res) => {
  try {
    const { items, payer } = req.body;

    const baseUrl = process.env.NODE_ENV === 'production'
      ? process.env.VERCEL_URL || process.env.DOMAIN_URL || 'https://tu-dominio.vercel.app'
      : 'http://localhost:3000';

    const preference = {
      items: items,
      payer: payer,
      back_urls: {
        success: `${baseUrl}/success`,
        failure: `${baseUrl}/failure`,
        pending: `${baseUrl}/pending`,
      },
    };

    const preferenceResponse = await new Preference(client).create({ body: preference });

    res.json({ id: preferenceResponse.id });
  } catch (error) {
    console.error("Error al crear preferencia:", error);
    res.status(500).json({ error: error.message });
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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  console.log('Entorno:', process.env.NODE_ENV || 'development');
  console.log('Ruta de productos:', path.join(__dirname, '..', 'products.json'));
});

// Para Vercel (serverless)
module.exports = app;