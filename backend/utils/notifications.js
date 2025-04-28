// const nodemailer = require('nodemailer');
// const twilio = require('twilio');

// // Email transporter setup
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: process.env.EMAIL_PORT,
//   secure: false, // Use TLS
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// // Twilio client setup
// const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// // Send email notification
// const sendEmail = async (to, subject, text) => {
//   try {
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to,
//       subject,
//       text,
//     };
//     await transporter.sendMail(mailOptions);
//     console.log(`Email sent to ${to}`);
//   } catch (error) {
//     console.error(`Failed to send email to ${to}:`, error);
//     throw new Error('Email notification failed');
//   }
// };

// // Send SMS notification
// const sendSMS = async (to, body) => {
//   try {
//     await twilioClient.messages.create({
//       body,
//       from: process.env.TWILIO_PHONE_NUMBER,
//       to,
//     });
//     console.log(`SMS sent to ${to}`);
//   } catch (error) {
//     console.error(`Failed to send SMS to ${to}:`, error);
//     throw new Error('SMS notification failed');
//   }
// };

// // Combined notification function
// const sendAdmissionNotification = async (studentEmail, studentMobile, studentName, password) => {
//   const subject = 'Admission Confirmed - Login Credentials ';
//   const message = `Dear ${studentName},\n\nYour admission has been confirmed at!\n\nLogin Credentials:\nEmail: ${studentEmail}\nPassword: ${password}\n\nPlease log in to the portal to access your details.\n\nRegards,\nSchool Administration`;

//   try {
//     // Send email
//     await sendEmail(studentEmail, subject, message);

//     // Send SMS (shortened version due to character limits)
//     const smsMessage = `Dear ${studentName}, your admission is confirmed! Login: ${studentEmail}, Password: ${password}`;
//     await sendSMS(studentMobile, smsMessage);

//     return { emailSent: true, smsSent: true };
//   } catch (error) {
//     return { emailSent: false, smsSent: false, error: error.message };
//   }
// };

// module.exports = { sendAdmissionNotification };


const nodemailer = require('nodemailer');
const twilio = require('twilio');
const logger = require("../utils/logger");

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





const sendAdmissionNotification = async (
  email,
  mobile,
  name,
  password,
  schoolName,
  className,
  grNumber = null,
  notificationType = 'Admission'
) => {
  let subject, emailMessage, smsMessage;

  if (notificationType === 'Parent Account Creation') {
    // Parent-specific message
    subject = `Your Child's Admission Confirmed - Login Credentials from ${schoolName}`;
    emailMessage = `Dear ${name},\n\nYour child's admission has been confirmed at ${schoolName}!\n\nThey have been admitted to class: ${className}.\nGR Number: ${grNumber || 'N/A'}\n\nYour Login Credentials:\nEmail: ${email}\nPassword: ${password}\n\nPlease log in to the portal to access your child's details.\n\nRegards,\n${schoolName} Administration`;
    smsMessage = `Dear ${name}, your child's admission at ${schoolName} in ${className} is confirmed! GR: ${grNumber || 'N/A'}, Login: ${email}, Pass: ${password}`;
  } else {
    // Student-specific message (default case)
    subject = `Admission Confirmed - Login Credentials from ${schoolName}`;
    emailMessage = `Dear ${name},\n\nYour admission has been confirmed at ${schoolName}!\n\nYou have been admitted to class: ${className}.\nGR Number: ${grNumber || 'N/A'}\n\nLogin Credentials:\nEmail: ${email}\nPassword: ${password}\n\nPlease log in to the portal to access your details.\n\nRegards,\n${schoolName} Administration`;
    smsMessage = `Dear ${name}, your admission at ${schoolName} in ${className} is confirmed! GR: ${grNumber || 'N/A'}, Login: ${email}, Pass: ${password}`;
  }

  try {
    // Send email (assuming sendEmail is a function you have implemented)
    await sendEmail(email, subject, emailMessage);

    // Send SMS (assuming sendSMS is a function you have implemented)
    await sendSMS(mobile, smsMessage);

    return { emailSent: true, smsSent: true };
  } catch (error) {
    console.error(`Error in sendAdmissionNotification (${notificationType}):`, error);
    return { emailSent: false, smsSent: false, error: error.message };
  }
};


const sendPaymentConfirmation = async (student, payment, receiptUrl) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: student.studentDetails.parentDetails?.email || student.email,
      subject: `Payment Confirmation - Receipt ${payment.receiptNumber}`,
      text: `
        Dear ${student.name},
        
        Your payment of ₹${payment.amount} for fees has been successfully processed.
        
        Details:
        - Receipt Number: ${payment.receiptNumber}
        - Date: ${new Date(payment.paymentDate).toLocaleDateString()}
        - Payment Method: ${payment.paymentMethod}
        - Download Receipt: ${receiptUrl}
        
        Thank you for your payment.
        
        Regards,
        School Management System
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Payment confirmation email sent to ${student.email}`);
  } catch (error) {
    logger.error(`Error sending payment confirmation: ${error.message}`, { error });
  }
};





module.exports = { sendAdmissionNotification,sendPaymentConfirmation };