const QRCode = require('qrcode');

// Generate a QR code as a data URL for the given text
const generateQRCode = async (text) => {
  try {
    // Generate QR code as a base64-encoded data URL
    const qrCodeDataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H', // High error correction for reliability
      type: 'image/png',
      margin: 1,
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('QR Code Generation Error:', error.message);
    throw new Error('Failed to generate QR code');
  }
};

module.exports = { generateQRCode };