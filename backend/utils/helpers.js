const PDFDocument = require('pdfkit');  // Add this import
const cloudinary = require('cloudinary').v2;

const helpers = {
    getCurrentAcademicYear: () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      
      // Academic year starts in June
      return month < 5 ? `${year-1}-${year}` : `${year}-${year+1}`;
    },
  
    isSameDay: (date1, date2) => {
      return date1.getFullYear() === date2.getFullYear() &&
             date1.getMonth() === date2.getMonth() &&
             date1.getDate() === date2.getDate();
    },
  
    calculateGrade: (percentage) => {
      if (percentage >= 90) return 'A+';
      if (percentage >= 80) return 'A';
      if (percentage >= 70) return 'B+';
      if (percentage >= 60) return 'B';
      if (percentage >= 50) return 'C';
      return 'F';
    },
    generateTrackingId: (schoolId) => {
      // Get current year's last 2 digits
      const year = new Date().getFullYear().toString().slice(-2);
      
      // Get current timestamp for uniqueness
      const timestamp = Date.now().toString().slice(-6);
      
      // Get last 4 characters of school ID
      const schoolPrefix = schoolId.toString().slice(-4);
      
      // Generate random 2 digit number for additional uniqueness
      const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      
      // Combine all parts: ADM-YY-SCHOOL-TIMESTAMP-RND
      // Example: ADM-24-5B2D-123456-42
      return `ADM-${year}-${schoolPrefix}-${timestamp}-${random}`;
    },
    // generateFeeSlip : (student, payment, feesPaid, schoolId) => {
    //   const currentDate = new Date();
    //   return {
    //     feeSlipId: `FS-${payment.receiptNumber || `REC${Date.now()}`}`,
    //     schoolId: schoolId,
    //     student: {
    //       id: student._id.toString(),
    //       name: student.name,
    //       grNumber: student.studentDetails.grNumber,
    //       class: student.studentDetails.class,
    //     },
    //     paymentDetails: {
    //       receiptNumber: payment.receiptNumber,
    //       transactionId: payment.transactionId || null,
    //       amount: payment.amount,
    //       paymentMethod: payment.paymentMethod,
    //       paymentDate: payment.paymentDate || currentDate,
    //       status: payment.status,
    //     },
    //     feesBreakdown: feesPaid.map(fee => ({
    //       type: fee.type,
    //       amount: fee.amount,
    //       month: fee.month,
    //       year: fee.year,
    //     })),
    //     issuedDate: currentDate,
    //     totalAmount: payment.amount,
    //   };
    // }


    generateFeeSlip: async (student, payment, feesPaid, schoolId) => {
      const currentDate = new Date();
      const receiptNumber = payment.receiptNumber || `REC${Date.now()}`;
      const feeSlipId = `FS-${receiptNumber}`;
  
      // Basic fee slip data
      const feeSlipData = {
        feeSlipId,
        schoolId,
        student: {
          id: student._id.toString(),
          name: student.name,
          grNumber: student.studentDetails.grNumber,
          class: student.studentDetails.class,
        },
        paymentDetails: {
          receiptNumber,
          transactionId: payment.transactionId || null,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate || currentDate,
          status: payment.status,
        },
        feesBreakdown: feesPaid.map(fee => ({
          type: fee.type,
          amount: fee.amount,
          month: fee.month,
          year: fee.year,
        })),
        issuedDate: currentDate,
        totalAmount: payment.amount,
      };
  
      // Generate PDF
      const doc = new PDFDocument({ size: 'A5', margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      
      // Header
      doc.fontSize(18).text('School Fee Receipt', { align: 'center' });
      doc.fontSize(10).text(`Receipt No: ${receiptNumber}`, { align: 'right' });
      doc.moveDown();
  
      // School Info (you might want to fetch real school details)
      doc.fontSize(12).text('XYZ International School', { align: 'center' });
      doc.fontSize(10).text('123 Education Lane, City, Country', { align: 'center' });
      doc.moveDown(2);
  
      // Student Info
      doc.fontSize(12).text('Student Details:', { underline: true });
      doc.fontSize(10)
        .text(`Name: ${student.name}`)
        .text(`GR Number: ${student.studentDetails.grNumber}`)
        .text(`Class: ${student.studentDetails.class}`);
      doc.moveDown();
  
      // Payment Details
      doc.fontSize(12).text('Payment Details:', { underline: true });
      doc.fontSize(10)
        .text(`Payment Date: ${payment.paymentDate.toLocaleDateString()}`)
        .text(`Method: ${payment.paymentMethod}`)
        .text(`Transaction ID: ${payment.transactionId || 'N/A'}`);
      doc.moveDown();
  
      // Fee Breakdown Table
      doc.fontSize(12).text('Fee Breakdown:', { underline: true });
      doc.moveDown(0.5);
      
      // Table Header
      doc.fontSize(10);
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 200;
      const col3 = 300;
      const col4 = 400;
      
      doc.text('Type', col1, tableTop)
        .text('Month', col2, tableTop)
        .text('Year', col3, tableTop)
        .text('Amount', col4, tableTop);
      doc.moveTo(col1, tableTop + 15).lineTo(500, tableTop + 15).stroke();
  
      // Table Rows
      let y = tableTop + 20;
      feesPaid.forEach(fee => {
        doc.text(fee.type, col1, y)
          .text(fee.month.toString(), col2, y)
          .text(fee.year.toString(), col3, y)
          .text(`₹${fee.amount.toFixed(2)}`, col4, y);
        y += 20;
      });
  
      // Total
      doc.moveTo(col1, y).lineTo(500, y).stroke();
      doc.text('Total', col1, y + 5)
        .text(`₹${payment.amount.toFixed(2)}`, col4, y + 5);
  
      // Footer
      doc.moveDown(2);
      doc.fontSize(8).text('Note: This is a computer-generated receipt and does not require a signature.', { align: 'center' });
  
      doc.end();
  
      // Convert to buffer
      const pdfBuffer = await new Promise(resolve => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
      });
  
      // Upload to Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'fee_receipts',
            public_id: `receipt_${feeSlipId}`,
            resource_type: 'raw',
            format: 'pdf',
          },
          (error, result) => error ? reject(error) : resolve(result)
        );
        uploadStream.end(pdfBuffer);
      });
  
      return {
        ...feeSlipData,
        pdfUrl: uploadResult.secure_url,
      };
    },
  };
  
  module.exports = helpers;