require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const express = require('express');
const fs = require('fs');

// Configuración con tus variables
const TOKEN = process.env.TELEGRAM_TOKEN;
const ENCRYPTION_KEY = process.env.SECRET_KEY || 'AF*1qYgGk^dSvXLp9b3%$2!wE68&G7@5zf4';
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL + '/telegram-webhook';

// Validación de variables críticas
if (!TOKEN) {
  console.error('❌ ERROR: TELEGRAM_TOKEN no está configurado');
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

// Función de desencriptación mejorada para el formato específico
const decryptData = (encryptedData) => {
  try {
    // Extraer solo la parte encriptada del mensaje completo
    const messageParts = encryptedData.toString().split('Por favor procese esta solicitud en el sistema administrativo:');
    
    if (messageParts.length < 2) {
      throw new Error('Formato de mensaje incorrecto. Falta la sección de datos encriptados.');
    }

    const base64Data = messageParts[1].trim().replace(/\s/g, '');

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
    
    // Campos requeridos basados en tu estructura de mensaje
    const requiredFields = ['licenseKey', 'userId', 'expirationDate'];
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

// Función para extraer información del usuario del mensaje
const extractUserInfo = (messageText) => {
  const userInfo = {
    full_name: 'No especificado',
    email: 'No especificado',
    plan: 'No especificado' // Añadir campo para el plan
  };

  try {
    const nameMatch = messageText.match(/👤 \*Usuario:\* (.+?)(\n|$)/);
    const emailMatch = messageText.match(/📧 \*Email:\* (.+?)(\n|$)/);
    const planMatch = messageText.match(/📜 \*Plan:\* (.+?)(\n|$)/); // Nueva regex para el plan

    if (nameMatch && nameMatch[1]) userInfo.full_name = nameMatch[1].trim();
    if (emailMatch && emailMatch[1]) userInfo.email = emailMatch[1].trim();
    if (planMatch && planMatch[1]) userInfo.plan = planMatch[1].trim(); // Extraer plan
  } catch (error) {
    console.error('Error extrayendo información del usuario:', error);
  }

  return userInfo;
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
    '🔐 *Bot de Validación de Licencias*\n\nEnvíame el mensaje *completo* que recibiste del sistema para verificar la licencia.\n\n' +
    'El mensaje debe tener el formato:\n' +
    '```\n' +
    '🔐 Solicitud de Licencia Encriptada 🔐\n\n' +
    '👤 Usuario: [nombre]\n' +
    '📧 Email: [email]\n\n' +
    'Por favor procese esta solicitud...\n' +
    '[datos encriptados]\n' +
    '```',
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
    // Extraer información del usuario del mensaje
    const userData = extractUserInfo(msg.text);
    
    // Desencriptar los datos de la licencia
    const licenseData = decryptData(msg.text);
    
    // Formatear respuesta
    const response = [
    '✅ *LICENCIA VALIDADA*',
    '',
    `👤 *Usuario:* ${userData.full_name}`,
    `📧 *Email:* ${userData.email}`,
    `📜 *Plan (mensaje):* ${userData.plan}`,
    `📜 *Plan (verificado):* ${licenseData.planId || 'No especificado'}`, // Plan desencriptado
    `🆔 *ID Usuario:* \`${licenseData.userId}\``,
    '',
    `🔢 *Código de Licencia:* \`${licenseData.licenseKey}\``,
    `📅 *Fecha de Expiración:* ${formatDate(licenseData.expirationDate)}`,
    `⏱️ *Generado el:* ${formatDate(licenseData.timestamp)}`,
    '',
    '_Sistema de Licencias TuApp_'
    ].join('\n');
    
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    console.log(`${userInfo} Licencia validada para usuario ${licenseData.userId}`);

  } catch (error) {
    console.error(`${userInfo} Error:`, error.message);
    
    await bot.sendMessage(
      chatId,
      '❌ *Error de validación*\n\n' +
      `${error.message}\n\n` +
      'ℹ️ *Ayuda:*\n' +
      '1. Asegúrate de enviar el mensaje *completo* que recibiste\n' +
      '2. No modifiques ni añadas texto al mensaje\n' +
      '3. El formato esperado es:\n' +
      '```\n' +
      '🔐 Solicitud de Licencia Encriptada 🔐\n\n' +
      '👤 Usuario: [nombre]\n' +
      '📧 Email: [email]\n\n' +
      'Por favor procese esta solicitud...\n' +
      '[datos encriptados]\n' +
      '```\n\n' +
      'Usa /start para ver instrucciones nuevamente.',
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
  console.log('🔒 Clave de encriptación:', ENCRYPTION_KEY ? 'Configurada' : 'Usando valor por defecto');
});

// Prueba de compatibilidad con tu formato de mensaje
const testWithYourFormat = () => {
  const testData = {
    licenseKey: "123456",
    userId: 2,
    planId: "premium", // Añadir plan en prueba
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    timestamp: new Date().toISOString()
  };

  try {
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(testData),
      ENCRYPTION_KEY,
      { format: CryptoJS.format.OpenSSL }
    ).toString();

    const testMessage = 
      '🔐 Solicitud de Licencia Encriptada 🔐\n\n' +
      '👤 Usuario: Juan Pérez\n' +
      '📧 Email: juan@ejemplo.com\n\n' +
      'Por favor procese esta solicitud en el sistema administrativo:\n\n' +
      encrypted;

    console.log('\n🔧 Probando con tu formato exacto:');
    console.log('Mensaje completo:', testMessage.substring(0, 100) + '...');
    
    const decrypted = decryptData(testMessage);
    console.log('Datos desencriptados:', decrypted);
    
    if (decrypted.licenseKey === testData.licenseKey) {
      console.log('✅ Prueba exitosa - El formato es compatible');
    } else {
      console.warn('⚠️ Prueba fallida - Los datos no coinciden');
    }
  } catch (error) {
    console.error('❌ Error en prueba de formato:', error.message);
  }
};

// Ejecutar prueba al iniciar (comentar en producción)
testWithYourFormat();

