const CryptoJS = require('crypto-js');

// Configuración de encriptación
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
// Función para encriptar
function encryptData(data) {
  try {
    const dataString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(dataString, ENCRYPTION_KEY, {
      keySize: 256,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
  } catch (error) {
    console.error('Error en encriptación:', error);
    throw new Error('Encryption failed');
  }
}

// Función para desencriptar
function decryptData(encryptedText) {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY, {
      keySize: 256,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) {
      throw new Error('Invalid decryption key or data');
    }
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Error en desencriptación:', error);
    throw new Error('Decryption failed');
  }
}

module.exports = { encryptData, decryptData };
