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
    }

  };
  
  module.exports = helpers;