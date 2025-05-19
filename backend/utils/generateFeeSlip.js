const PDFDocument = require('pdfkit');
const { uploadToS3, getPublicFileUrl } = require('../config/s3Upload');
const logger = require('../utils/logger');
const { getOwnerConnection } = require('../config/database');
const axios = require('axios');

const generateFeeSlip = async (student, payment, fees, schoolId, monthYear) => {
  try {
    // Get school from owner connection
    const ownerConnection = getOwnerConnection();
    if (!ownerConnection) {
      throw new Error("Owner database connection is not initialized");
    }
    
    const School = ownerConnection.model('School', require('../models/School')(ownerConnection).schema);
    const school = await School.findById(schoolId).lean();
    if (!school) {
      throw new Error(`School not found for ID: ${schoolId}`);
    }
    
    const schoolName = school.name;
    
    // Fetch school logo if available
    let logoImage = null;
    if (school.logo && school.logo.url) {
      try {
        const response = await axios.get(school.logo.url, { responseType: 'arraybuffer' });
        logoImage = response.data;
        logger.info(`Successfully fetched school logo from ${school.logo.url}`);
      } catch (logoError) {
        logger.warn(`Failed to fetch school logo: ${logoError.message}`);
      }
    }
    
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {});

    // Set custom fonts (assuming fonts are available in the project or system)
    doc.registerFont('Bold', 'Helvetica-Bold');
    doc.registerFont('Regular', 'Helvetica');
    doc.registerFont('Italic', 'Helvetica-Oblique');

    // Define colors
    const primaryColor = '#003087'; // Deep blue
    const accentColor = '#FFD700'; // Gold
    const textColor = '#333333'; // Dark gray

    // Header Section with Border
    const headerY = doc.y;
    const logoWidth = 80;
    const logoHeight = 80;
    const leftMargin = doc.page.margins.left;

    // Add decorative header background
    doc.fillColor('#F5F6F5')
       .rect(0, 0, doc.page.width, 120)
       .fill();

    // Add logo
    if (logoImage) {
      doc.image(logoImage, leftMargin, headerY + 20, {
        fit: [logoWidth, logoHeight],
        align: 'left',
        valign: 'top'
      });
    }

    // School Name and Title
    const schoolNameX = leftMargin + (logoImage ? logoWidth + 20 : 0);
    const availableWidth = doc.page.width - schoolNameX - doc.page.margins.right;
    doc.font('Bold')
       .fontSize(24)
       .fillColor(primaryColor)
       .text(schoolName, schoolNameX, headerY + 20, { 
         width: availableWidth,
         align: logoImage ? 'left' : 'center'
       });
    doc.font('Regular')
       .fontSize(12)
       .fillColor(textColor)
       .text('Fee Receipt', schoolNameX, doc.y + 5, { 
         width: availableWidth,
         align: logoImage ? 'left' : 'center'
       });

    // Move below header
    doc.y = headerY + 120;
    doc.moveDown(0.5);

    // Receipt Info
    doc.font('Regular')
       .fontSize(10)
       .fillColor(textColor)
       .text(`Receipt Number: ${payment.receiptNumber}`, leftMargin, doc.y)
       .text(`Date: ${new Date(payment.paymentDate).toLocaleDateString()}`, doc.page.width - doc.page.margins.right - 100, doc.y, { align: 'right' });
    doc.moveDown(1);

    // Student Details Section
    doc.roundedRect(leftMargin, doc.y, doc.page.width - 80, 80, 5)
       .fill('#E8ECEF');
    doc.font('Bold')
       .fontSize(14)
       .fillColor(primaryColor)
       .text('Student Details', leftMargin + 10, doc.y + 10);
    doc.font('Regular')
       .fontSize(11)
       .fillColor(textColor)
       .text(`Name: ${student.name}`, leftMargin + 10, doc.y + 10)
       .text(`GR Number: ${student.studentDetails.grNumber}`)
       .text(`Class: ${student.studentDetails.class?.name || 'N/A'} - ${student.studentDetails.class?.division || 'N/A'}`);
    doc.moveDown(7);

    // Fee Details Table
    doc.font('Bold')
       .fontSize(14)
       .fillColor(primaryColor)
       .text('Fee Details', leftMargin, doc.y);
    doc.moveDown(0.5);

    // Table Header
    const tableTop = doc.y;
    const tableWidth = doc.page.width - 80;
    const col1Width = tableWidth * 0.6;
    const col2Width = tableWidth * 0.4;
    doc.fillColor(accentColor)
       .rect(leftMargin, tableTop, tableWidth, 25)
       .fill();
    doc.font('Bold')
       .fontSize(11)
       .fillColor(primaryColor)
       .text('Description', leftMargin + 10, tableTop + 8)
       .text('Amount', leftMargin + col1Width + 10, tableTop + 8);

    // Table Rows
    let total = 0;
    fees.forEach((fee, index) => {
      const amount = fee.amount || fee.paidAmount;
      total += amount;
      const rowY = tableTop + 25 + (index * 20);
      doc.fillColor(index % 2 === 0 ? '#F9F9F9' : '#FFFFFF')
         .rect(leftMargin, rowY, tableWidth, 20)
         .fill();
      doc.font('Regular')
         .fontSize(10)
         .fillColor(textColor)
         .text(`${fee.type.toUpperCase()} Fee (${fee.month}/${fee.year})`, leftMargin + 10, rowY + 5, { width: col1Width - 10 })
         .text(`₹${amount}`, leftMargin + col1Width + 10, rowY + 5, { width: col2Width - 10, align: 'right' });
    });

    // Total Row
    const totalY = tableTop + 25 + (fees.length * 20);
    doc.fillColor(accentColor)
       .rect(leftMargin, totalY, tableWidth, 25)
       .fill();
    doc.font('Bold')
       .fontSize(12)
       .fillColor(primaryColor)
       .text('Total', leftMargin + 10, totalY + 8)
       .text(`₹${total}`, leftMargin + col1Width + 10, totalY + 8, { width: col2Width - 10, align: 'right' });

    // School Contact Information
    doc.moveDown(2);
    if (school.address || school.contact || school.email) {
      doc.roundedRect(leftMargin, doc.y, tableWidth, 50, 5)
         .fill('#E8ECEF');
      doc.font('Regular')
         .fontSize(10)
         .fillColor(textColor)
         .text(`School Address: ${school.address || 'N/A'}`, leftMargin + 10, doc.y + 10, { align: 'center' });
      doc.text(`Contact: ${school.contact || 'N/A'} | Email: ${school.email || 'N/A'}`, leftMargin + 10, doc.y + 5, { align: 'center' });
    }

    // Footer
    doc.moveDown(2);
    doc.font('Italic')
       .fontSize(9)
       .fillColor(textColor)
       .text(`Generated by ${schoolName} Management System`, leftMargin, doc.y, { align: 'center' });

    // Add watermark (optional)
    doc.font('Regular')
       .fontSize(40)
       .fillColor('rgba(0, 0, 0, 0.1)')
       .text('OFFICIAL RECEIPT', doc.page.width / 2, doc.page.height / 2, { align: 'center', angle: 45 });

    doc.end();

    // Convert PDF to buffer
    const pdfBuffer = await new Promise((resolve) => {
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Upload to S3 with public-read ACL
    const fileKey = `fee_receipts/${schoolId}/receipt_FS-${payment.receiptNumber}.pdf`;
    await uploadToS3(pdfBuffer, fileKey, 'application/pdf');
    
    // Generate a direct, permanent URL
    const pdfUrl = getPublicFileUrl(fileKey);
    
    logger.info(`Fee slip generated for ${schoolName} - ${monthYear}: ${fileKey}`);
    return { pdfUrl };
  } catch (error) {
    logger.error(`Error generating fee slip: ${error.message}`, error);
    throw error;
  }
};

module.exports = { generateFeeSlip };


// const { getPublicFileUrl } = require('../config/s3Upload');
// const logger = require('../utils/logger');
// const { getOwnerConnection } = require('../config/database');

// const generateFeeSlip = async (student, payment, fees, schoolId, monthYear) => {
//   try {
//     // Get school from owner connection
//     const ownerConnection = await getOwnerConnection();
//     if (!ownerConnection) {
//       throw new Error('Owner database connection is not initialized');
//     }

//     const School = ownerConnection.model('School', require('../models/School')(ownerConnection).schema);
//     const school = await School.findById(schoolId).lean();
//     if (!school) {
//       throw new Error(`School not found for ID: ${schoolId}`);
//     }

//     // Prepare logo URL if available
//     let logoUrl = null;
//     if (school.logo && school.logo.url) {
//       logoUrl = school.logo.url; // Or use getPublicFileUrl if S3 signed URL is needed
//       logger.info(`School logo URL: ${logoUrl}`);
//     }

//     // Structure the fee slip data
//     const feeSlipData = {
//       school: {
//         name: school.name,
//         address: school.address || 'N/A',
//         contact: school.contact || 'N/A',
//         email: school.email || 'N/A',
//         logoUrl: logoUrl,
//       },
//       student: {
//         name: student.name,
//         grNumber: student.studentDetails.grNumber,
//         class: {
//           name: student.studentDetails.class?.name || 'N/A',
//           division: student.studentDetails.class?.division || 'N/A',
//         },
//       },
//       payment: {
//         receiptNumber: payment.receiptNumber,
//         paymentDate: new Date(payment.paymentDate).toLocaleDateString(),
//         amount: payment.amount,
//         paymentMethod: payment.paymentMethod,
//       },
//       fees: fees.map((fee) => ({
//         type: fee.type.toUpperCase(),
//         month: fee.month,
//         year: fee.year,
//         amount: fee.amount || fee.paidAmount,
//       })),
//       monthYear,
//       total: fees.reduce((sum, fee) => sum + (fee.amount || fee.paidAmount), 0),
//     };

//     logger.info(`Fee slip data prepared for ${school.name} - ${monthYear}`);
//     return feeSlipData;
//   } catch (error) {
//     logger.error(`Error preparing fee slip data: ${error.message}`, error);
//     throw error;
//   }
// };


// const generateFeeSlip = async (student, payment, fees, schoolId, monthYear) => {
//   try {
//     const ownerConnection = await getOwnerConnection();
//     if (!ownerConnection) {
//       throw new Error('Owner database connection is not initialized');
//     }

//     const School = ownerConnection.model('School', require('../models/School')(ownerConnection).schema);
//     const school = await School.findById(schoolId).lean();
//     if (!school) {
//       throw new Error(`School not found for ID: ${schoolId}`);
//     }

//     let logoUrl = null;
//     if (school.logo && school.logo.url) {
//       logoUrl = school.logo.url;
//       logger.info(`School logo URL: ${logoUrl}`);
//     }

//     const feeSlipData = {
//       school: {
//         name: school.name,
//         address: school.address || 'N/A',
//         contact: school.contact || 'N/A',
//         email: school.email || 'N/A',
//         logoUrl: logoUrl,
//       },
//       student: {
//         name: student.name,
//         grNumber: student.studentDetails.grNumber,
//         class: {
//           name: student.studentDetails.class?.name || 'N/A',
//           division: student.studentDetails.class?.division || 'N/A',
//         },
//       },
//       payment: {
//         receiptNumber: payment.receiptNumber,
//         paymentDate: new Date(payment.paymentDate).toLocaleDateString(),
//         amount: payment.amount,
//         paymentMethod: payment.paymentMethod,
//       },
//       fees: fees.map((fee) => ({
//         type: fee.type.toUpperCase(),
//         month: fee.month,
//         year: fee.year,
//         amount: fee.amount || fee.paidAmount,
//       })),
//       monthYear,
//       total: fees.reduce((sum, fee) => sum + (fee.amount || fee.paidAmount), 0),
//     };

//     logger.info(`Fee slip data prepared for ${school.name} - ${monthYear}`);
//     return feeSlipData;
//   } catch (error) {
//     logger.error(`Error preparing fee slip data: ${error.message}`, error);
//     throw error;
//   }
// };

// module.exports = { generateFeeSlip };


