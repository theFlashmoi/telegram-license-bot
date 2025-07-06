require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const express = require('express');

// Configuración con tus variables
const TOKEN = process.env.TELEGRAM_TOKEN; // Cambiado a TELEGRAM_TOKEN
const ENCRYPTION_KEY = process.env.SECRET_KEY; // Usando SECRET_KEY
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

// Middleware para verificar el token secreto
app.use((req, res, next) => {
  if (req.path === '/telegram-webhook' && req.method === 'POST') {
    // Telegram verifica el webhook automáticamente
    return next();
  }
  next();
});

// Health Check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'operational',
    service: 'Telegram License Bot',
    version: '1.0.0'
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
    const cleanData = encryptedData.toString().replace(/\s+/g, '');
    const bytes = CryptoJS.AES.decrypt(cleanData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decrypted) throw new Error('Datos vacíos - Verifica tu SECRET_KEY');
    
    const data = JSON.parse(decrypted);
    
    // Validación básica de estructura
    if (!data.keyCode || !data.userId) {
      throw new Error('Estructura de datos inválida');
    }
    
    return data;
  } catch (error) {
    console.error('Error en desencriptación:', error.message);
    throw new Error(`Error procesando licencia: ${error.message}`);
  }
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
    '🔐 *Bot de Validación de Licencias*\n\nEnvíame el mensaje encriptado para verificar la licencia.',
    options
  );
});

// Procesamiento de mensajes
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  
  try {
    // Extraer datos encriptados (soporta múltiples formatos)
    const encryptedData = msg.text.match(/(U2FsdGVkX1[^\s]+)/)?.[0] || msg.text;
    const licenseData = decryptData(encryptedData);
    
    // Formatear respuesta
    const response = [
      '✅ *LICENCIA VALIDADA*',
      '',
      `👤 *Usuario:* ${licenseData.userName || 'No especificado'}`,
      `📧 *Email:* ${licenseData.userEmail || 'No especificado'}`,
      `🆔 *ID:* \`${licenseData.userId}\``,
      '',
      `🔢 *Código:* \`${licenseData.keyCode}\``,
      `📅 *Generado:* ${new Date(licenseData.generatedAt).toLocaleString('es-ES')}`,
      `⏳ *Expira:* ${new Date(licenseData.expirationDate).toLocaleString('es-ES')}`,
      '',
      `_Sistema: ${licenseData.system || 'TuSistemaApp'}_`
    ].join('\n');
    
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error(`Error en chat ${chatId}:`, error);
    await bot.sendMessage(
      chatId,
      `❌ *Error de validación*\n\n${error.message}\n\n` +
      'Por favor envía exactamente el mismo mensaje que recibiste del sistema.',
      { parse_mode: 'Markdown' }
    );
  }
});

// Manejo de errores global
process.on('unhandledRejection', (error) => {
  console.error('⚠️ Error no manejado:', error);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🌍 Webhook: ${WEBHOOK_URL}`);
  console.log(`🤖 Bot configurado con token: ${TOKEN.substring(0, 5)}...`);
});
