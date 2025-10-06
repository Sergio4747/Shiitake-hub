require('dotenv').config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

// Configuración básica
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS básico
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ].filter(Boolean);

    if (!origin || allowedOrigins.some(allowed => origin.includes(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '..')));

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

// Rutas básicas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/api/products', (req, res) => {
  const products = readProducts();
  res.json(products);
});

app.get('/admin/products', (req, res) => {
  const products = readProducts();
  res.json(products);
});

app.post('/admin/login', (req, res) => {
  res.json({ success: true, message: "Login exitoso" });
});

// Puerto diferente para evitar conflictos
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🔗 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 Admin: http://localhost:${PORT}/admin.html`);
});

module.exports = app;
