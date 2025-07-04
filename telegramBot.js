require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { decryptData } = require('./utils/encryption');

const app = express();
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: false });

// Configuración del Webhook (se ejecuta al iniciar)
const setupWebhook = async () => {
  try {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/webhook`;
    await bot.setWebHook(webhookUrl);
    console.log(`✅ Webhook configurado en: ${webhookUrl}`);
  } catch (error) {
    console.error('❌ Error al configurar webhook:', error.message);
  }
};

// Middleware para parsear JSON
app.use(express.json());

// Ruta del Webhook
app.post('/webhook', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.text) {
      return res.status(200).send();
    }

    const chatId = message.chat.id;
    const text = message.text;

    try {
      // Intentar desencriptar (si es un código de licencia)
      const decrypted = decryptData(text);
      
      const response = [
        '🔐 *LICENCIA VALIDADA* 🔐',
        `👤 Usuario: ${decrypted.userId}`,
        `📧 Email: ${decrypted.userEmail || 'No especificado'}`,
        `🔑 Código: \`${decrypted.keyCode}\``,
        `⏳ Expira: ${decrypted.expirationDate}`,
        '',
        '_Autenticación segura mediante cifrado AES-256_'
      ].join('\n');

      await bot.sendMessage(chatId, response, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Aprobar Licencia', callback_data: `approve_${decrypted.keyCode}` }],
            [{ text: '❌ Rechazar', callback_data: `reject_${decrypted.keyCode}` }]
          ]
        }
      });

    } catch (decryptError) {
      // Mensaje normal (no encriptado)
      if (message.text.startsWith('/start')) {
        await bot.sendMessage(chatId, '🤖 *Bot de Licencias*\nEnvía un código encriptado para validar licencias.', {
          parse_mode: 'Markdown'
        });
      }
    }

    res.status(200).end();
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).send('Server Error');
  }
});

// Manejo de comandos inline (opcional)
bot.on('callback_query', async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const [action, code] = data.split('_');
  
  if (action === 'approve') {
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Licencia ${code} aprobada` });
    await bot.sendMessage(message.chat.id, `✅ Licencia *${code}* aprobada correctamente`, {
      parse_mode: 'Markdown'
    });
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('🤖 Bot de Licencias Activo');
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  await setupWebhook();
});
