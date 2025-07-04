// utils/encryption.js
import CryptoJS from 'crypto-js';

const SECRET_KEY = '#F*1qYgGk^dSvXLp9b3%$2!wE68&G7@5zf4'; // Cambia esto por una clave segura

export const encryptData = (data) => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
};

export const decryptData = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

// Instalar dependencia necesaria:
// npm install crypto-js