require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const express = require('express');

// Configuración
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET;
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL + '/telegram-webhook';

if (!TOKEN || !ENCRYPTION_KEY) {
  console.error('❌ ERROR: Faltan variables de entorno (TELEGRAM_BOT_TOKEN o ENCRYPTION_SECRET)');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Inicialización del bot con webhook
const bot = new TelegramBot(TOKEN);
bot.setWebHook(WEBHOOK_URL);

// Health Check
app.get('/', (req, res) => {
  res.status(200).send('Bot de Licencias Operativo');
});

// Webhook endpoint
app.post('/telegram-webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Función de desencriptación (igual que antes)
const decryptData = (encryptedData) => {
  const cleanData = encryptedData
    .replace(/\s/g, '')
    .replace(/^.*?(U2FsdGVkX1[^\s]+)/i, '$1');

  try {
    const bytes = CryptoJS.AES.decrypt(cleanData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error('Datos vacíos - Clave incorrecta');
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error(`Fallo en desencriptación: ${error.message}`);
  }
};

// Comandos y mensajes (igual que antes)
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '🔐 *Bot de Gestión de Licencias*\n\nEnvía cualquier mensaje del sistema y extraeré automáticamente los datos de la licencia.',
    { parse_mode: 'Markdown' }
  );
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const fullText = msg.text || '';

  try {
    const encryptedMatch = fullText.match(/(U2FsdGVkX1[^\s]+)/i);
    if (!encryptedMatch) {
      return bot.sendMessage(
        chatId,
        '⚠️ *Formato no reconocido*\n\nPor favor envía el mensaje completo recibido del sistema de licencias.',
        { parse_mode: 'Markdown' }
      );
    }

    const licenseData = decryptData(encryptedMatch[0]);

    if (!licenseData.keyCode || !licenseData.expirationDate) {
      throw new Error('Estructura de licencia inválida');
    }

    const response = [
      '✅ *LICENCIA VERIFICADA*',
      '',
      `👤 *Usuario:* ${licenseData.userName || 'No especificado'}`,
      `📧 *Email:* ${licenseData.userEmail || 'No especificado'}`,
      `🆔 *ID:* \`${licenseData.userId}\``,
      '',
      `🔑 *Código:* \`${licenseData.keyCode}\``,
      `⏳ *Expira:* ${new Date(licenseData.expirationDate).toLocaleString('es-ES')}`,
      `📅 *Generado:* ${new Date(licenseData.generatedAt).toLocaleString('es-ES')}`,
      '',
      `_Sistema: ${licenseData.system || 'TuSistemaApp'}_`
    ].join('\n');

    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error(`Error en chat ${chatId}:`, error);
    bot.sendMessage(
      chatId,
      '❌ *Error al procesar*\n\n' + `_Detalle: ${error.message}_`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
  console.log(`🌍 Webhook configurado en: ${WEBHOOK_URL}`);
});
