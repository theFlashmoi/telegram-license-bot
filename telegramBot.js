require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const express = require('express'); // Nuevo: Para el health check

// Configuración
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET;
const PORT = process.env.PORT || 10000; // Usa 10000 por defecto

// Inicialización
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express(); // Para el health check

// Health Check Endpoint (Requerido por Render)
app.get('/', (req, res) => {
  res.status(200).send('Bot de Licencias Operativo');
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escuchando en puerto ${PORT}`);
});

// Función de desencriptación (mejorada para resiliencia)
const decryptData = (encryptedData) => {
  const cleanData = encryptedData
    .replace(/\s/g, '')
    .replace(/^.*?(U2FsdGVkX1[^\s]+)/i, '$1'); // Extrae solo el payload AES

  try {
    const bytes = CryptoJS.AES.decrypt(cleanData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error('Datos vacíos - Clave incorrecta');
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error(`Fallo en desencriptación: ${error.message}`);
  }
};

// Comandos del Bot
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '🔐 *Bot de Gestión de Licencias*\n\n'
    + 'Envía cualquier mensaje del sistema y extraeré automáticamente:\n'
    + '• Código de licencia\n• Datos de usuario\n• Fechas de expiración',
    { parse_mode: 'Markdown' }
  );
});

// Procesamiento de mensajes
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const fullText = msg.text || '';

  try {
    // Detección robusta del payload
    const encryptedMatch = fullText.match(/(U2FsdGVkX1[^\s]+)/i);
    if (!encryptedMatch) {
      return bot.sendMessage(
        chatId,
        '⚠️ *Formato no reconocido*\n\n'
        + 'Por favor envía el mensaje *completo* recibido del sistema de licencias.',
        { parse_mode: 'Markdown' }
      );
    }

    const licenseData = decryptData(encryptedMatch[0]);

    // Validación de campos esenciales
    if (!licenseData.keyCode || !licenseData.expirationDate) {
      throw new Error('Estructura de licencia inválida');
    }

    // Formateo profesional de respuesta
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
      '❌ *Error al procesar*\n\n'
      + `_Detalle: ${error.message}_\n\n`
      + 'Envía el mensaje original sin modificaciones.',
      { parse_mode: 'Markdown' }
    );
  }
});

// Manejo de errores global
bot.on('polling_error', (error) => {
  console.error('🔴 Error crítico en polling:', error);
  process.exit(1); // Reinicia el bot en Render ante fallos graves
});

console.log(`🤖 Bot iniciado en puerto ${PORT} | Modo: ${process.env.NODE_ENV || 'development'}`);
