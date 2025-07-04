const TelegramBot = require('node-telegram-bot-api');
const { decryptData } = require('./encryption');
const bot = new TelegramBot('7764229533:AAG2nWIHR1qkWJVmkSG7LDptkzaAAQJcDok', { polling: true });

// Comando /start
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const encryptedData = match[1]; // Datos encriptados desde la app

  try {
    // 1. Desencriptar datos
    const { userId, userName, licenseCode } = decryptData(encryptedData);

    // 2. Responder al usuario con el código
    await bot.sendMessage(
      chatId,
      `🔑 *Código de Licencia* 🔑\n\n` +
      `Hola ${userName || 'usuario'}!\n\n` +
      `Tu código para activar la licencia es:\n` +
      `\`\`\`${licenseCode}\`\`\`\n\n` +
      `Cópialo y pégalo en la aplicación.`,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    await bot.sendMessage(chatId, '❌ Error: Datos de licencia inválidos.');
  }
});

// Opcional: Comando /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '🤖 *Bot de Licencias*\n\nEnvía /start seguido del código proporcionado por la app para obtener tu licencia.',
    { parse_mode: 'Markdown' }
  );
});