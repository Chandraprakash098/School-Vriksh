// const PDFDocument = require('pdfkit');
// const { uploadToS3, getPublicFileUrl } = require('../config/s3Upload');
// const logger = require('../utils/logger');
// const { getOwnerConnection } = require('../config/database');
// const axios = require('axios');

// const generateFeeSlip = async (student, payment, fees, schoolId, monthYear) => {
//   try {
//     // Get school from owner connection
//     const ownerConnection = getOwnerConnection();
//     if (!ownerConnection) {
//       throw new Error("Owner database connection is not initialized");
//     }
    
//     const School = ownerConnection.model('School', require('../models/School')(ownerConnection).schema);
//     const school = await School.findById(schoolId).lean();
//     if (!school) {
//       throw new Error(`School not found for ID: ${schoolId}`);
//     }
    
//     const schoolName = school.name;
    
//     // Fetch school logo if available
//     let logoImage = null;
//     if (school.logo && school.logo.url) {
//       try {
//         const response = await axios.get(school.logo.url, { responseType: 'arraybuffer' });
//         logoImage = response.data;
//         logger.info(`Successfully fetched school logo from ${school.logo.url}`);
//       } catch (logoError) {
//         logger.warn(`Failed to fetch school logo: ${logoError.message}`);
//       }
//     }
    
//     const doc = new PDFDocument({ size: 'A4', margin: 40 });
//     const buffers = [];
    
//     doc.on('data', buffers.push.bind(buffers));
//     doc.on('end', () => {});

//     // Set custom fonts (assuming fonts are available in the project or system)
//     doc.registerFont('Bold', 'Helvetica-Bold');
//     doc.registerFont('Regular', 'Helvetica');
//     doc.registerFont('Italic', 'Helvetica-Oblique');

//     // Define colors
//     const primaryColor = '#003087'; // Deep blue
//     const accentColor = '#FFD700'; // Gold
//     const textColor = '#333333'; // Dark gray

//     // Header Section with Border
//     const headerY = doc.y;
//     const logoWidth = 80;
//     const logoHeight = 80;
//     const leftMargin = doc.page.margins.left;

//     // Add decorative header background
//     doc.fillColor('#F5F6F5')
//        .rect(0, 0, doc.page.width, 120)
//        .fill();

//     // Add logo
//     if (logoImage) {
//       doc.image(logoImage, leftMargin, headerY + 20, {
//         fit: [logoWidth, logoHeight],
//         align: 'left',
//         valign: 'top'
//       });
//     }

//     // School Name and Title
//     const schoolNameX = leftMargin + (logoImage ? logoWidth + 20 : 0);
//     const availableWidth = doc.page.width - schoolNameX - doc.page.margins.right;
//     doc.font('Bold')
//        .fontSize(24)
//        .fillColor(primaryColor)
//        .text(schoolName, schoolNameX, headerY + 20, { 
//          width: availableWidth,
//          align: logoImage ? 'left' : 'center'
//        });
//     doc.font('Regular')
//        .fontSize(12)
//        .fillColor(textColor)
//        .text('Fee Receipt', schoolNameX, doc.y + 5, { 
//          width: availableWidth,
//          align: logoImage ? 'left' : 'center'
//        });

//     // Move below header
//     doc.y = headerY + 120;
//     doc.moveDown(0.5);

//     // Receipt Info
//     doc.font('Regular')
//        .fontSize(10)
//        .fillColor(textColor)
//        .text(`Receipt Number: ${payment.receiptNumber}`, leftMargin, doc.y)
//        .text(`Date: ${new Date(payment.paymentDate).toLocaleDateString()}`, doc.page.width - doc.page.margins.right - 100, doc.y, { align: 'right' });
//     doc.moveDown(1);

//     // Student Details Section
//     doc.roundedRect(leftMargin, doc.y, doc.page.width - 80, 80, 5)
//        .fill('#E8ECEF');
//     doc.font('Bold')
//        .fontSize(14)
//        .fillColor(primaryColor)
//        .text('Student Details', leftMargin + 10, doc.y + 10);
//     doc.font('Regular')
//        .fontSize(11)
//        .fillColor(textColor)
//        .text(`Name: ${student.name}`, leftMargin + 10, doc.y + 10)
//        .text(`GR Number: ${student.studentDetails.grNumber}`)
//        .text(`Class: ${student.studentDetails.class?.name || 'N/A'} - ${student.studentDetails.class?.division || 'N/A'}`);
//     doc.moveDown(7);

//     // Fee Details Table
//     doc.font('Bold')
//        .fontSize(14)
//        .fillColor(primaryColor)
//        .text('Fee Details', leftMargin, doc.y);
//     doc.moveDown(0.5);

//     // Table Header
//     const tableTop = doc.y;
//     const tableWidth = doc.page.width - 80;
//     const col1Width = tableWidth * 0.6;
//     const col2Width = tableWidth * 0.4;
//     doc.fillColor(accentColor)
//        .rect(leftMargin, tableTop, tableWidth, 25)
//        .fill();
//     doc.font('Bold')
//        .fontSize(11)
//        .fillColor(primaryColor)
//        .text('Description', leftMargin + 10, tableTop + 8)
//        .text('Amount', leftMargin + col1Width + 10, tableTop + 8);

//     // Table Rows
//     let total = 0;
//     fees.forEach((fee, index) => {
//       const amount = fee.amount || fee.paidAmount;
//       total += amount;
//       const rowY = tableTop + 25 + (index * 20);
//       doc.fillColor(index % 2 === 0 ? '#F9F9F9' : '#FFFFFF')
//          .rect(leftMargin, rowY, tableWidth, 20)
//          .fill();
//       doc.font('Regular')
//          .fontSize(10)
//          .fillColor(textColor)
//          .text(`${fee.type.toUpperCase()} Fee (${fee.month}/${fee.year})`, leftMargin + 10, rowY + 5, { width: col1Width - 10 })
//          .text(`₹${amount}`, leftMargin + col1Width + 10, rowY + 5, { width: col2Width - 10, align: 'right' });
//     });

//     // Total Row
//     const totalY = tableTop + 25 + (fees.length * 20);
//     doc.fillColor(accentColor)
//        .rect(leftMargin, totalY, tableWidth, 25)
//        .fill();
//     doc.font('Bold')
//        .fontSize(12)
//        .fillColor(primaryColor)
//        .text('Total', leftMargin + 10, totalY + 8)
//        .text(`₹${total}`, leftMargin + col1Width + 10, totalY + 8, { width: col2Width - 10, align: 'right' });

//     // School Contact Information
//     doc.moveDown(2);
//     if (school.address || school.contact || school.email) {
//       doc.roundedRect(leftMargin, doc.y, tableWidth, 50, 5)
//          .fill('#E8ECEF');
//       doc.font('Regular')
//          .fontSize(10)
//          .fillColor(textColor)
//          .text(`School Address: ${school.address || 'N/A'}`, leftMargin + 10, doc.y + 10, { align: 'center' });
//       doc.text(`Contact: ${school.contact || 'N/A'} | Email: ${school.email || 'N/A'}`, leftMargin + 10, doc.y + 5, { align: 'center' });
//     }

//     // Footer
//     doc.moveDown(2);
//     doc.font('Italic')
//        .fontSize(9)
//        .fillColor(textColor)
//        .text(`Generated by ${schoolName} Management System`, leftMargin, doc.y, { align: 'center' });

//     // Add watermark (optional)
//     doc.font('Regular')
//        .fontSize(40)
//        .fillColor('rgba(0, 0, 0, 0.1)')
//        .text('OFFICIAL RECEIPT', doc.page.width / 2, doc.page.height / 2, { align: 'center', angle: 45 });

//     doc.end();

//     // Convert PDF to buffer
//     const pdfBuffer = await new Promise((resolve) => {
//       const chunks = [];
//       doc.on('data', (chunk) => chunks.push(chunk));
//       doc.on('end', () => resolve(Buffer.concat(chunks)));
//     });

//     // Upload to S3 with public-read ACL
//     const fileKey = `fee_receipts/${schoolId}/receipt_FS-${payment.receiptNumber}.pdf`;
//     await uploadToS3(pdfBuffer, fileKey, 'application/pdf');
    
//     // Generate a direct, permanent URL
//     const pdfUrl = getPublicFileUrl(fileKey);
    
//     logger.info(`Fee slip generated for ${schoolName} - ${monthYear}: ${fileKey}`);
//     return { pdfUrl };
//   } catch (error) {
//     logger.error(`Error generating fee slip: ${error.message}`, error);
//     throw error;
//   }
// };

// module.exports = { generateFeeSlip };

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
    
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 40,
      bufferPages: true
    });
    const buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {});

    // Define professional color scheme
    const colors = {
      primary: '#1e3a8a',      // Professional navy blue
      secondary: '#3b82f6',    // Lighter blue
      accent: '#059669',       // Professional green
      warning: '#f59e0b',      // Amber for highlights
      text: {
        primary: '#1f2937',    // Dark gray
        secondary: '#6b7280',  // Medium gray
        light: '#9ca3af'       // Light gray
      },
      background: {
        light: '#f8fafc',      // Very light gray
        white: '#ffffff',
        accent: '#eff6ff'      // Light blue
      },
      border: '#e5e7eb'        // Light border
    };

    // Page dimensions
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = doc.page.margins.left;
    const contentWidth = pageWidth - (margin * 2);

    // Header Section
    const headerHeight = 80;
    
    // Header background with gradient effect
    doc.save()
       .fillColor(colors.primary)
       .rect(0, 0, pageWidth, headerHeight)
       .fill();
    
    // Add subtle pattern/texture to header
    for (let i = 0; i < pageWidth; i += 20) {
      doc.fillColor('rgba(255, 255, 255, 0.03)')
         .rect(i, 0, 10, headerHeight)
         .fill();
    }
    doc.restore();

    // School Logo and Name Section
    const logoSize = 60;
    const logoX = margin;
    const logoY = 10;
    
    if (logoImage) {
      // Logo background circle
      doc.save()
         .fillColor(colors.background.white)
         .circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 5)
         .fill()
         .restore();
      
      doc.image(logoImage, logoX, logoY, {
        fit: [logoSize, logoSize],
        align: 'center',
        valign: 'center'
      });
    }

    // School name and title
    const textStartX = logoImage ? logoX + logoSize + 20 : margin;
    const availableWidth = pageWidth - textStartX - margin;
    
    doc.font('Helvetica-Bold')
       .fontSize(22)
       .fillColor(colors.background.white)
       .text(schoolName, textStartX, logoY + 8, {
         width: availableWidth,
         align: logoImage ? 'left' : 'center'
       });
    
    // Subtitle
    doc.font('Helvetica')
       .fontSize(12)
       .fillColor(colors.background.light)
       .text('Official Fee Receipt', textStartX, doc.y + 3, {
         width: availableWidth,
         align: logoImage ? 'left' : 'center'
       });

    // Reset position after header
    doc.y = headerHeight + 20;

    // Receipt Information Banner
    const receiptBannerY = doc.y;
    doc.fillColor(colors.background.accent)
       .rect(margin, receiptBannerY, contentWidth, 30)
       .fill();
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor(colors.primary)
       .text(`Receipt No: ${payment.receiptNumber}`, margin + 15, receiptBannerY + 10)
       .text(`Date: ${new Date(payment.paymentDate).toLocaleDateString('en-IN', {
         day: '2-digit',
         month: 'short',
         year: 'numeric'
       })}`, pageWidth - margin - 120, receiptBannerY + 10);
    
    doc.y = receiptBannerY + 40;

    // Student Information Card
    const studentCardY = doc.y;
    const cardHeight = 75;
    
    // Card shadow effect
    doc.fillColor('rgba(0, 0, 0, 0.1)')
       .roundedRect(margin + 2, studentCardY + 2, contentWidth, cardHeight, 8)
       .fill();
    
    // Card background
    doc.fillColor(colors.background.white)
       .roundedRect(margin, studentCardY, contentWidth, cardHeight, 8)
       .fill();
    
    // Card border
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .roundedRect(margin, studentCardY, contentWidth, cardHeight, 8)
       .stroke();

    // Student details header
    doc.fillColor(colors.secondary)
       .rect(margin, studentCardY, contentWidth, 25)
       .fill();
    
    doc.font('Helvetica-Bold')
       .fontSize(12)
       .fillColor(colors.background.white)
       .text('STUDENT INFORMATION', margin + 15, studentCardY + 8);

    // Student details content
    const detailsY = studentCardY + 30;
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor(colors.text.primary);
    
    // Left column
    doc.text(`Student Name:`, margin + 15, detailsY)
       .font('Helvetica-Bold')
       .text(`${student.name}`, margin + 15, doc.y + 1)
       .font('Helvetica')
       .text(`GR Number:`, margin + 15, doc.y + 3)
       .font('Helvetica-Bold')
       .text(`${student.studentDetails.grNumber}`, margin + 15, doc.y + 1);
    
    // Right column
    const rightColumnX = margin + (contentWidth / 2);
    doc.font('Helvetica')
       .text(`Class:`, rightColumnX, detailsY)
       .font('Helvetica-Bold')
       .text(`${student.studentDetails.class?.name || 'N/A'} - ${student.studentDetails.class?.division || 'N/A'}`, rightColumnX, doc.y + 1)
       .font('Helvetica')
       .text(`Academic Year:`, rightColumnX, doc.y + 3)
       .font('Helvetica-Bold')
       .text(`${monthYear}`, rightColumnX, doc.y + 1);

    doc.y = studentCardY + cardHeight + 20;

    // Fee Details Section
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor(colors.primary)
       .text('FEE BREAKDOWN', margin, doc.y);
    
    doc.y += 15;

    // Fee table
    const tableY = doc.y;
    const rowHeight = 30;
    const tableHeaderHeight = 35;
    
    // Table dimensions
    const columns = [
      { header: 'Fee Type', width: contentWidth * 0.35 },
      { header: 'Period', width: contentWidth * 0.25 },
      { header: 'Due Date', width: contentWidth * 0.2 },
      { header: 'Amount (₹)', width: contentWidth * 0.2 }
    ];

    // Table header
    doc.fillColor(colors.primary)
       .rect(margin, tableY, contentWidth, tableHeaderHeight)
       .fill();

    let currentX = margin;
    columns.forEach(col => {
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(colors.background.white)
         .text(col.header, currentX + 10, tableY + 12, {
           width: col.width - 20,
           align: col.header === 'Amount (₹)' ? 'right' : 'left'
         });
      currentX += col.width;
    });

    // Table rows
    let total = 0;
    fees.forEach((fee, index) => {
      const amount = fee.amount || fee.paidAmount;
      total += amount;
      const rowY = tableY + tableHeaderHeight + (index * rowHeight);
      
      // Alternating row colors
      doc.fillColor(index % 2 === 0 ? colors.background.light : colors.background.white)
         .rect(margin, rowY, contentWidth, rowHeight)
         .fill();
      
      // Row border
      doc.strokeColor(colors.border)
         .lineWidth(0.5)
         .moveTo(margin, rowY)
         .lineTo(margin + contentWidth, rowY)
         .stroke();

      // Row content
      currentX = margin;
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(colors.text.primary);
      
      // Fee type
      doc.text(`${fee.type.toUpperCase()} Fee`, currentX + 10, rowY + 10, {
        width: columns[0].width - 20
      });
      currentX += columns[0].width;
      
      // Period
      doc.text(`${fee.month}/${fee.year}`, currentX + 10, rowY + 10, {
        width: columns[1].width - 20
      });
      currentX += columns[1].width;
      
      // Due date (if available)
      const dueDate = fee.dueDate ? new Date(fee.dueDate).toLocaleDateString('en-IN') : 'N/A';
      doc.text(dueDate, currentX + 10, rowY + 10, {
        width: columns[2].width - 20
      });
      currentX += columns[2].width;
      
      // Amount - Fixed rupee symbol
      doc.font('Helvetica-Bold')
         .text(`₹${amount.toLocaleString('en-IN')}`, currentX + 10, rowY + 10, {
           width: columns[3].width - 20,
           align: 'right'
         });
    });

    // Total row
    const totalRowY = tableY + tableHeaderHeight + (fees.length * rowHeight);
    doc.fillColor(colors.accent)
       .rect(margin, totalRowY, contentWidth, rowHeight)
       .fill();

    doc.font('Helvetica-Bold')
       .fontSize(12)
       .fillColor(colors.background.white)
       .text('TOTAL AMOUNT', margin + 10, totalRowY + 10)
       .text(`₹${total.toLocaleString('en-IN')}`, margin + contentWidth - 120, totalRowY + 10, {
         width: 110,
         align: 'right'
       });

    // Payment status badge
    doc.y = totalRowY + rowHeight + 15;
    const statusBadgeWidth = 100;
    const statusBadgeHeight = 20;
    const statusX = pageWidth - margin - statusBadgeWidth;
    
    doc.fillColor(colors.accent)
       .roundedRect(statusX, doc.y, statusBadgeWidth, statusBadgeHeight, 12)
       .fill();
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor(colors.background.white)
       .text('PAID', statusX, doc.y + 6, {
         width: statusBadgeWidth,
         align: 'center'
       });

    doc.y += statusBadgeHeight + 15;

    // Payment method and transaction details
    if (payment.paymentMethod || payment.transactionId) {
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(colors.primary)
         .text('PAYMENT DETAILS', margin, doc.y);
      
      doc.y += 10;
      
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(colors.text.secondary);
      
      if (payment.paymentMethod) {
        doc.text(`Payment Method: ${payment.paymentMethod.toUpperCase()}`, margin, doc.y);
      }
      
      if (payment.transactionId) {
        doc.text(`Transaction ID: ${payment.transactionId}`, margin, doc.y + 1);
      }
      
      doc.y += 15;
    }

    // School information footer
    if (school.address || school.contact || school.email || school.website) {
      const footerY = doc.y;
      
      doc.fillColor(colors.background.light)
         .rect(margin, footerY, contentWidth, 60)
         .fill();
      
      doc.strokeColor(colors.border)
         .lineWidth(1)
         .rect(margin, footerY, contentWidth, 60)
         .stroke();

      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.primary)
         .text('SCHOOL CONTACT INFORMATION', margin + 15, footerY + 8);

      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(colors.text.secondary);

      let contactY = footerY + 20;
      if (school.address) {
        doc.text(`Address: ${school.address}`, margin + 15, contactY);
        contactY += 10;
      }
      
      if (school.contact || school.email) {
        const contactLine = [
          school.contact ? `Phone: ${school.contact}` : '',
          school.email ? `Email: ${school.email}` : ''
        ].filter(Boolean).join(' | ');
        
        doc.text(contactLine, margin + 15, contactY);
        contactY += 10;
      }
      
      if (school.website) {
        doc.text(`Website: ${school.website}`, margin + 15, contactY);
      }
      
      doc.y = footerY + 70;
    }

    // Footer with disclaimer
    doc.strokeColor(colors.border)
       .lineWidth(0.5)
       .moveTo(margin, doc.y)
       .lineTo(pageWidth - margin, doc.y)
       .stroke();

    doc.y += 8;
    doc.font('Helvetica')
       .fontSize(7)
       .fillColor(colors.text.light)
       .text('This is a computer-generated receipt and does not require a signature.', margin, doc.y, {
         align: 'center',
         width: contentWidth
       })
       .text(`Generated on ${new Date().toLocaleDateString('en-IN')} | ${schoolName} Management System`, margin, doc.y + 6, {
         align: 'center',
         width: contentWidth
       });

    // Add security watermark
    doc.save()
       .font('Helvetica-Bold')
       .fontSize(50)
       .fillColor('rgba(30, 58, 138, 0.03)')
       .rotate(-45, { origin: [pageWidth/2, pageHeight/2] })
       .text('OFFICIAL RECEIPT', pageWidth/2 - 120, pageHeight/2 - 25)
       .restore();

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
    
    logger.info(`Professional fee slip generated for ${schoolName} - ${monthYear}: ${fileKey}`);
    return { pdfUrl };
  } catch (error) {
    logger.error(`Error generating professional fee slip: ${error.message}`, error);
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


