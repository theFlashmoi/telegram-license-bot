require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { decryptData } = require('./utils/encryption');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Validaciones críticas
if (!process.env.TELEGRAM_TOKEN) {
  console.error('ERROR: TELEGRAM_TOKEN no configurado en .env');
  process.exit(1);
}

if (!process.env.RENDER_EXTERNAL_URL) {
  console.error('ERROR: RENDER_EXTERNAL_URL no configurado en .env');
  process.exit(1);
}

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

// Middleware
app.use(express.json());

// Configurar webhook
const setupWebhook = async () => {
  try {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/webhook`;
    await bot.setWebHook(webhookUrl);
    console.log(`Webhook configurado correctamente en: ${webhookUrl}`);
  } catch (error) {
    console.error('Error configurando webhook:', error.message);
    process.exit(1);
  }
};

// Rutas
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => res.send('Bot activo ✅'));

// Comandos
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
    console.error('Error desencriptando:', error);
    await bot.sendMessage(chatId, '❌ Error: Datos inválidos o expirados.');
  }
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '🤖 *Ayuda*\n\n' +
    '/start [codigo] - Verificar tu licencia\n' +
    '/help - Mostrar esta ayuda',
    { parse_mode: 'Markdown' }
  );
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
  await setupWebhook();
});
