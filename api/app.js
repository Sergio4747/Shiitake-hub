// Serverless function para Vercel
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { method, url } = req;
    
    // Health check
    if (url === '/health' || url === '/api/health') {
      return res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        method,
        url,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          hasMP: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
          hasEmail: !!process.env.EMAIL_USER,
          hasAdmin: !!process.env.ADMIN_USERNAME
        }
      });
    }
    
    // Productos
    if (url === '/api/products' && method === 'GET') {
      try {
        const productsPath = path.join(process.cwd(), 'products.json');
        const data = fs.readFileSync(productsPath, 'utf8');
        const products = JSON.parse(data);
        return res.status(200).json(products);
      } catch (error) {
        return res.status(200).json({});
      }
    }
    
    // Test endpoint
    if (url === '/api/test') {
      return res.status(200).json({
        message: "¡Hola desde Vercel!",
        timestamp: new Date().toISOString(),
        method,
        url
      });
    }
    
    // Página principal
    if (url === '/' || url === '/index.html') {
      try {
        const indexPath = path.join(process.cwd(), 'index.html');
        const html = fs.readFileSync(indexPath, 'utf8');
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      } catch (error) {
        return res.status(404).json({ error: 'Page not found' });
      }
    }
    
    // Admin panel
    if (url === '/admin.html') {
      try {
        const adminPath = path.join(process.cwd(), 'admin.html');
        const html = fs.readFileSync(adminPath, 'utf8');
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      } catch (error) {
        return res.status(404).json({ error: 'Admin page not found' });
      }
    }
    
    // Default response
    return res.status(404).json({ 
      error: 'Not found',
      method,
      url,
      message: 'Endpoint no encontrado'
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};
