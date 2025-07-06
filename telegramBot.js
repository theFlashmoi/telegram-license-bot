require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');

// Configuración
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET;
const bot = new TelegramBot(TOKEN, { polling: true });

// Función para desencriptar
const decryptData = (encryptedData) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error('Error al desencriptar: ' + error.message);
  }
};

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    '🔑 *Bot de Licencias*\n\nEnvíame el mensaje encriptado para obtener el código de licencia.',
    { parse_mode: 'Markdown' }
  );
});

// Procesar mensajes encriptados
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ignorar comandos como /start
  if (text.startsWith('/')) return;

  try {
    // Extraer datos encriptados (elimina posibles prefijos)
    const encryptedData = text.replace('🔐 *Solicitud de Licencia Encriptada* 🔐', '').trim();
    
    // Desencriptar
    const licenseData = decryptData(encryptedData);

    // Respuesta formateada
    const response = `✅ *Licencia Desencriptada*:\n\n` +
      `👤 *Usuario*: ${licenseData.userName}\n` +
      `📧 *Email*: ${licenseData.userEmail}\n` +
      `🆔 *ID*: ${licenseData.userId}\n\n` +
      `🔢 *Código*: \`${licenseData.keyCode}\`\n` +
      `📅 *Expira*: ${new Date(licenseData.expirationDate).toLocaleDateString('es-ES')}\n\n` +
      `_Este código ya fue registrado en la base de datos._`;

    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });

  } catch (error) {
    bot.sendMessage(
      chatId,
      '❌ *Error*: No pude desencriptar el mensaje. Asegúrate de enviar el texto encriptado completo.\n\n' +
      `Detalle: ${error.message}`,
      { parse_mode: 'Markdown' }
    );
  }
});

console.log('Bot iniciado...');
