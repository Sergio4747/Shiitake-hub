require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { MercadoPagoConfig, Preference } = require("mercadopago");

const app = express();

app.use(express.static(path.join(__dirname, '..')));
app.use(cors());
app.use(bodyParser.json());

// Verificar variables de entorno críticas
if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  console.error('❌ MERCADOPAGO_ACCESS_TOKEN no configurado');
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-TOKEN'
});

// Configurar nodemailer para serverless
let transporter;
try {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
} catch (error) {
  console.log('Nodemailer not configured:', error.message);
}

// Función para leer productos
const readProducts = () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, '..', 'products.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Error al leer productos:", error);
    return {};
  }
};

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

// Obtener productos para el frontend público
app.get('/api/products', (req, res) => {
  const products = readProducts();
  res.json(products);
});

// Crear preferencia de MercadoPago
app.post("/create_preference", async (req, res) => {
  try {
    const { items, payer } = req.body;

    const baseUrl = process.env.NODE_ENV === 'production'
      ? process.env.VERCEL_URL || 'https://shiitake-hub.vercel.app'
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

// Endpoint para WhatsApp
app.post("/send-whatsapp-notification", (req, res) => {
  try {
    const { buyerData, cartItems, total } = req.body;

    let message = `🛒 *NUEVA COMPRA - SHIITAKE HUB*\n\n`;
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
    message += `🌐 Pedido realizado desde: Shiitake Hub`;

    const phoneNumber = process.env.WHATSAPP_NUMBER || '5491234567890';
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

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

// Servir página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Para Vercel serverless
module.exports = app;
