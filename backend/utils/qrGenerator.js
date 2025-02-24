const QRCode = require('qrcode');

const generatePaymentQR = async (amount, applicationId, schoolId) => {
  try {
    // Create UPI payment string with school details
    const upiString = `upi://pay?pa=school${schoolId}@ybl&pn=SchoolAdmission&am=${amount}&tr=${applicationId}&tn=AdmissionFee`;
    const qrCode = await QRCode.toDataURL(upiString);
    return qrCode;
  } catch (error) {
    console.error('QR Generation Error:', error);
    throw new Error('Failed to generate payment QR code');
  }
};

module.exports= { generatePaymentQR };