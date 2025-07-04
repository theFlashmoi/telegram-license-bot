const TelegramBot = require('node-telegram-bot-api');
const { databaseOperations } = require('../utils/database');
const { decryptData } = require('../utils/encryption');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

// Manejar solicitudes de licencia
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const encryptedData = match[1];
  
  try {
    // Desencriptar datos
    const decryptedData = decryptData(encryptedData);
    const { userId, userName, userEmail, licenseCode, expirationDate } = decryptedData;
    
    // Registrar en base de datos
    await databaseOperations.logLicenseAction(
      userId, 
      'TELEGRAM_REQUEST', 
      `Solicitud via Telegram: ${licenseCode}`
    );
    
    // Formatear fecha
    const formattedDate = new Date(expirationDate).toLocaleDateString();
    
    // Construir mensaje
    const message = `🔑 *Nueva solicitud de licencia*:\n
👤 *Usuario*: ${userName}
📧 *Email*: ${userEmail}
🆔 *ID*: ${userId}
🔢 *Código*: \`${licenseCode}\`
📅 *Expiración*: ${formattedDate}\n
_Esta clave ya está registrada en el sistema._`;

    // Enviar mensaje con botones
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: 'Activar Manualmente', 
              callback_data: `activate_${licenseCode}`
            },
            {
              text: 'Marcar como Usada',
              callback_data: `mark_used_${licenseCode}`
            }
          ]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error procesando solicitud:', error);
    bot.sendMessage(chatId, '❌ Error: No se pudo procesar la solicitud');
  }
});

// Manejar acciones de botones
bot.on('callback_query', async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const [action, licenseCode] = data.split('_');
  
  try {
    if (action === 'activate') {
      // Lógica para activación manual
      await databaseOperations.logLicenseAction(
        'admin', 
        'MANUAL_ACTIVATION', 
        `Activada manualmente: ${licenseCode}`
      );
      
      bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Licencia activada manualmente'
      });
      
      bot.editMessageText(`✅ Licencia ${licenseCode} ACTIVADA`, {
        chat_id: message.chat.id,
        message_id: message.message_id
      });
      
    } else if (action === 'mark') {
      // Marcar como usada
      await databaseOperations.logLicenseAction(
        'admin', 
        'MARKED_USED', 
        `Marcada como usada: ${licenseCode}`
      );
      
      bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Licencia marcada como usada'
      });
      
      bot.editMessageText(`🏷️ Licencia ${licenseCode} MARCADA COMO USADA`, {
        chat_id: message.chat.id,
        message_id: message.message_id
      });
    }
  } catch (error) {
    console.error('Error procesando callback:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Error procesando la solicitud'
    });
  }
});

// Configurar webhook
const setupWebhook = async (webhookUrl) => {
  try {
    await bot.setWebHook(`${webhookUrl}/bot${token}`);
    console.log('✅ Webhook configurado exitosamente');
  } catch (error) {
    console.error('❌ Error configurando webhook:', error);
  }
};

module.exports = { bot, setupWebhook };
