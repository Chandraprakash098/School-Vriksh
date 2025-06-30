const twilio = require('twilio');

// Initialize Twilio client with credentials from environment variables
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Send SMS to the specified phone number with the given message
const sendSMS = async (phoneNumber, message) => {
  try {
    // Validate phone number format (basic check, adjust as needed)
    if (!phoneNumber || !/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

    // Send SMS using Twilio
    const response = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
      to: phoneNumber,
    });

    console.log(`SMS sent successfully to ${phoneNumber}: ${response.sid}`);
    return response;
  } catch (error) {
    console.error('SMS Sending Error:', error.message);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

module.exports = { sendSMS };