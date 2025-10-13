// Script de prueba para verificar el servidor antes de desplegar
console.log('🧪 Iniciando pruebas del servidor...\n');

try {
  // Simular entorno de Vercel
  process.env.VERCEL = 'true';
  process.env.NODE_ENV = 'production';
  
  console.log('📦 Cargando servidor...');
  const app = require('./api/server-vercel.js');
  
  console.log('✅ Servidor cargado correctamente');
  console.log('✅ Módulo exportado:', typeof app);
  
  // Verificar que sea una aplicación Express
  if (typeof app === 'function' || (app && typeof app.listen === 'function')) {
    console.log('✅ Aplicación Express válida');
  } else {
    console.error('❌ No es una aplicación Express válida');
    process.exit(1);
  }
  
  console.log('\n✅ Todas las pruebas pasaron!');
  console.log('👉 El servidor debería funcionar en Vercel');
  
} catch (error) {
  console.error('\n❌ Error al cargar el servidor:');
  console.error('Mensaje:', error.message);
  console.error('Stack:', error.stack);
  console.error('\n⚠️ Corrige estos errores antes de desplegar a Vercel');
  process.exit(1);
}
