// Test simple para verificar que Vercel funciona
module.exports = (req, res) => {
  res.status(200).json({
    message: "¡Hola desde Vercel!",
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
};
