const express = require('express');
const app = express();
const PORT = 3000;

app.get('/api/products', (req, res) => {
  const testProducts = {
    "1": {
      "name": "Producto de Prueba",
      "price": 10.99,
      "size": "100g",
      "description": "Producto de prueba",
      "image": "img/test.jpg"
    }
  };
  res.json(testProducts);
});

app.listen(PORT, () => {
  console.log(`Servidor simple corriendo en http://localhost:${PORT}`);
});
