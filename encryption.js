const CryptoJS = require('crypto-js');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET;

module.exports = {
  encryptData: (data) => {
    try {
      const dataStr = JSON.stringify(data);
      return CryptoJS.AES.encrypt(dataStr, ENCRYPTION_KEY).toString();
    } catch (error) {
      console.error('Error en encryptData:', error);
      throw new Error('Error al encriptar');
    }
  },

  decryptData: (encryptedStr) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedStr, ENCRYPTION_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error('Invalid decryption');
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Error en decryptData:', error);
      throw new Error('Decryption failed');
    }
  }
};
