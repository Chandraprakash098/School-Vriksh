const crypto = require('crypto');

// Ensure the key is 32 bytes for AES-256-CBC
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY // Must be 32 characters
const IV_LENGTH = 16; // For AES

// // Encrypt function
// function encrypt(text) {
//   const iv = crypto.randomBytes(IV_LENGTH);
//   const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
//   let encrypted = cipher.update(text);
//   encrypted = Buffer.concat([encrypted, cipher.final()]);
//   return iv.toString('hex') + ':' + encrypted.toString('hex');
// }


// Encrypt function
function encrypt(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Encryption input must be a non-empty string');
  }
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}



// Decrypt function
// function decrypt(text) {
//   const [iv, encryptedText] = text.split(':');
//   const ivBuffer = Buffer.from(iv, 'hex');
//   const encryptedBuffer = Buffer.from(encryptedText, 'hex');
//   const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), ivBuffer);
//   let decrypted = decipher.update(encryptedBuffer);
//   decrypted = Buffer.concat([decrypted, decipher.final()]);
//   return decrypted.toString();
// }

// Decrypt function
// Decrypt function
function decrypt(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Decryption input must be a string');
  }
  
  // Check if the text is in the correct format
  if (!text.includes(':')) {
    throw new Error('Decryption input must be a string in the format "iv:encryptedText"');
  }
  
  const parts = text.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encryption format: expected exactly one colon separator');
  }
  
  const [iv, encryptedText] = parts;
  if (!iv || !encryptedText) {
    throw new Error('Invalid decryption format: missing iv or encrypted text');
  }
  
  try {
    const ivBuffer = Buffer.from(iv, 'hex');
    if (ivBuffer.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes`);
    }
    
    const encryptedBuffer = Buffer.from(encryptedText, 'hex');
    if (encryptedBuffer.length === 0) {
      throw new Error('Invalid encrypted text: empty buffer');
    }
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), ivBuffer);
    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    if (error.message.includes('bad decrypt')) {
      throw new Error('Decryption failed: Invalid key or corrupted data');
    }
    throw error;
  }
}

module.exports = { encrypt, decrypt };