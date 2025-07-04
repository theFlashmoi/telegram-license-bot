const TelegramBot = require('node-telegram-bot-api');
const { decryptData } = require('./encryption');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Configura el bot (usa UNA SOLA instancia)
const token = process.env.TELEGRAM_TOKEN || '7764229533:AAG2nWIHR1qkWJVmkSG7LDptkzaAAQJcDok';
const bot = new TelegramBot(token, { polling: false }); // Webhook, no polling

// Middleware para procesar JSON
app.use(express.json());

// Configura el webhook (ejecutar solo una vez)
bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/webhook`);

// Ruta para el webhook
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Ruta de health check
app.get('/', (req, res) => res.send('Bot activo ✅'));

// Comando /start
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const encryptedData = match[1];

  try {
    const { userId, userName, licenseCode } = decryptData(encryptedData);
    await bot.sendMessage(
      chatId,
      `🔑 *Código de Licencia* 🔑\n\n` +
      `Hola ${userName || 'usuario'}!\n\n` +
      `Tu código es: \`\`\`${licenseCode}\`\`\``,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await bot.sendMessage(chatId, '❌ Error: Datos inválidos.');
  }
});

// Comando /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '🤖 Envía /start seguido del código de la app.',
    { parse_mode: 'Markdown' }
  );
});

// Inicia el servidor
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
