require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const express = require('express');
const fs = require('fs');

// Configuración con tus variables
const TOKEN = process.env.TELEGRAM_TOKEN;
const ENCRYPTION_KEY = process.env.SECRET_KEY;
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL + '/telegram-webhook';

// Validación de variables críticas
if (!TOKEN) {
  console.error('❌ ERROR: TELEGRAM_TOKEN no está configurado');
  process.exit(1);
}

if (!ENCRYPTION_KEY) {
  console.error('❌ ERROR: SECRET_KEY no está configurado');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Configuración del bot
const bot = new TelegramBot(TOKEN);
bot.setWebHook(WEBHOOK_URL)
  .then(() => console.log('✅ Webhook configurado en:', WEBHOOK_URL))
  .catch(err => console.error('❌ Error configurando webhook:', err));

// Middleware para logs
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health Check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'operational',
    service: 'Telegram License Bot',
    version: '1.0.1',
    timestamp: new Date().toISOString()
  });
});

// Endpoint del webhook
app.post('/telegram-webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Función de desencriptación mejorada
const decryptData = (encryptedData) => {
  try {
    // Extraer solo la parte encriptada del mensaje completo
    const base64Data = encryptedData.toString()
      .split('Por favor procese esta solicitud en el sistema administrativo:')[1]
      ?.trim()
      .replace(/\s/g, '');

    if (!base64Data) {
      throw new Error('No se encontraron datos encriptados en el mensaje');
    }

    // Validar formato Base64
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
      throw new Error('Formato de datos encriptados inválido');
    }

    // Desencriptación con formato OpenSSL explícito
    const bytes = CryptoJS.AES.decrypt(
      base64Data,
      ENCRYPTION_KEY,
      {
        format: CryptoJS.format.OpenSSL
      }
    );

    // Conversión a UTF-8
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText) {
      throw new Error('Fallo en desencriptación - Verifica tu SECRET_KEY');
    }

    // Parseo y validación de estructura
    const parsedData = JSON.parse(decryptedText);
    
    const requiredFields = ['userId', 'keyCode', 'expirationDate'];
    const missingFields = requiredFields.filter(field => !parsedData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Faltan campos requeridos: ${missingFields.join(', ')}`);
    }
    
    return parsedData;
  } catch (error) {
    console.error('Error en desencriptación:', {
      error: error.message,
      input: encryptedData?.toString().substring(0, 50) + '...'
    });
    throw new Error(`Error procesando licencia: ${error.message}`);
  }
};

// Función para formatear fechas
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Comando /start
bot.onText(/\/start/, (msg) => {
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [[{ text: 'ℹ️ Ayuda' }]],
      resize_keyboard: true
    }
  };
  
  bot.sendMessage(
    msg.chat.id,
    '🔐 *Bot de Validación de Licencias*\n\nEnvíame el mensaje completo que recibiste del sistema para verificar la licencia.',
    options
  );
});

// Procesamiento de mensajes
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const userInfo = `[Usuario: ${msg.from.username || msg.from.id} | Chat: ${chatId}]`;
  
  console.log(`${userInfo} Mensaje recibido: ${msg.text.substring(0, 30)}...`);

  try {
    const licenseData = decryptData(msg.text);
    
    // Formatear respuesta
    const response = [
      '✅ *LICENCIA VALIDADA*',
      '',
      `👤 *Usuario:* ${licenseData.userName || 'No especificado'}`,
      `📧 *Email:* ${licenseData.userEmail || 'No especificado'}`,
      `🆔 *ID:* \`${licenseData.userId}\``,
      '',
      `🔢 *Código:* \`${licenseData.keyCode}\``,
      `📅 *Generado:* ${formatDate(licenseData.generatedAt)}`,
      `⏳ *Expira:* ${formatDate(licenseData.expirationDate)}`,
      '',
      `_Sistema: ${licenseData.system || 'TuSistemaApp'}_`
    ].join('\n');
    
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    console.log(`${userInfo} Licencia validada para usuario ${licenseData.userId}`);

  } catch (error) {
    console.error(`${userInfo} Error:`, error.message);
    
    await bot.sendMessage(
      chatId,
      '❌ *Error de validación*\n\n' +
      `${error.message}\n\n` +
      'Por favor asegúrate de enviar:\n' +
      '1. El mensaje *completo* recibido del sistema\n' +
      '2. Sin modificaciones o añadidos\n\n' +
      'Ejemplo de formato esperado:\n' +
      '```\n' +
      '🔐 Solicitud de Licencia Encriptada 🔐\n\n' +
      '👤 Usuario: Nombre\n' +
      '📧 Email: email@ejemplo.com\n\n' +
      'Por favor procese esta solicitud...\n' +
      '[datos encriptados]\n' +
      '```',
      { parse_mode: 'Markdown' }
    );
  }
});

// Manejo de errores global
process.on('unhandledRejection', (error) => {
  console.error('⚠️ Error no manejado:', error);
  fs.appendFileSync('errors.log', `[${new Date().toISOString()}] ${error.stack}\n\n`);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🌍 Webhook: ${WEBHOOK_URL}`);
  console.log(`🤖 Bot configurado con token: ${TOKEN.substring(0, 5)}...`);
  console.log('🔒 Clave de encriptación:', ENCRYPTION_KEY ? 'Configurada' : 'No configurada');
});

// Prueba de compatibilidad al iniciar
const testEncryption = () => {
  const testData = {
    userId: "test-123",
    keyCode: "654321",
    userName: "Usuario de Prueba",
    userEmail: "test@example.com",
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    generatedAt: new Date().toISOString(),
    system: "Sistema de Prueba"
  };

  try {
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(testData),
      ENCRYPTION_KEY,
      { format: CryptoJS.format.OpenSSL }
    ).toString();

    console.log('🔧 Prueba de encriptación:');
    console.log('Datos originales:', testData);
    console.log('Encriptados:', encrypted.substring(0, 50) + '...');

    const decrypted = decryptData(`Mensaje de prueba:\n\nPor favor procese esta solicitud en el sistema administrativo:\n\n${encrypted}`);
    console.log('Desencriptados:', decrypted);
    
    if (decrypted.userId === testData.userId) {
      console.log('✅ Prueba exitosa - Encriptación/Desencriptación funciona correctamente');
    } else {
      console.warn('⚠️ Prueba fallida - Los datos no coinciden');
    }
  } catch (error) {
    console.error('❌ Error en prueba de compatibilidad:', error.message);
  }
};

// Ejecutar prueba al iniciar (comentar después de verificar)
testEncryption();
