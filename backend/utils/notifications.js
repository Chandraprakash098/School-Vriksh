const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // Use TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Twilio client setup
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Send email notification
const sendEmail = async (to, subject, text) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    };
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw new Error('Email notification failed');
  }
};

// Send SMS notification
const sendSMS = async (to, body) => {
  try {
    await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`SMS sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
    throw new Error('SMS notification failed');
  }
};

// Combined notification function
const sendAdmissionNotification = async (studentEmail, studentMobile, studentName, password) => {
  const subject = 'Admission Confirmed - Login Credentials';
  const message = `Dear ${studentName},\n\nYour admission has been confirmed!\n\nLogin Credentials:\nEmail: ${studentEmail}\nPassword: ${password}\n\nPlease log in to the portal to access your details.\n\nRegards,\nSchool Administration`;

  try {
    // Send email
    await sendEmail(studentEmail, subject, message);

    // Send SMS (shortened version due to character limits)
    const smsMessage = `Dear ${studentName}, your admission is confirmed! Login: ${studentEmail}, Password: ${password}`;
    await sendSMS(studentMobile, smsMessage);

    return { emailSent: true, smsSent: true };
  } catch (error) {
    return { emailSent: false, smsSent: false, error: error.message };
  }
};

module.exports = { sendAdmissionNotification };