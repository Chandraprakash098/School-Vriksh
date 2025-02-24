const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const razorpayService = {
  generatePaymentQR: async (amount, applicationId, schoolId) => {
    try {
      // Create a new payment order
      const order = await razorpay.orders.create({
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        receipt: `admission_${applicationId}`,
        notes: {
          schoolId: schoolId,
          applicationId: applicationId,
          paymentType: 'admission_fee'
        }
      });

      // Generate QR code for the payment
      const qrCode = await razorpay.qrCode.create({
        type: "upi_qr",
        name: "Admission Fee Payment",
        usage: "single_use",
        fixed_amount: true,
        payment_amount: amount * 100,
        description: `Admission Fee for Application ${applicationId}`,
        customer_id: applicationId,
        order_id: order.id,
        notes: {
          schoolId: schoolId,
          applicationId: applicationId
        }
      });

      return {
        qrCode: qrCode.image_url,
        orderId: order.id,
        amount: amount
      };
    } catch (error) {
      console.error('Razorpay QR Generation Error:', error);
      throw new Error('Failed to generate payment QR code');
    }
  },

  verifyPayment: (razorpayOrderId, razorpayPaymentId, signature) => {
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    return generatedSignature === signature;
  },

  getPaymentDetails: async (paymentId) => {
    try {
      const payment = await razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error('Error fetching payment details:', error);
      throw new Error('Failed to fetch payment details');
    }
  }
};

module.exports = razorpayService;