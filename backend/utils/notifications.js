const nodemailer = require('nodemailer');
const config = require('../config/config');

const transporter = nodemailer.createTransport(config.emailConfig);

const notifications = {
  // Send email notification
  sendEmail: async (to, subject, html) => {
    try {
      await transporter.sendMail({
        from: config.emailConfig.auth.user,
        to,
        subject,
        html
      });
    } catch (error) {
      console.error('Email notification error:', error);
    }
  },

  // Notify absent students' parents
  notifyAbsentStudents: async (absentRecords) => {
    try {
      for (const record of absentRecords) {
        const student = await User.findById(record.user)
          .populate('profile.parentId', 'email');

        await notifications.sendEmail(
          student.profile.parentId.email,
          'Student Absence Notification',
          `Your ward ${student.name} was marked absent today.`
        );
      }
    } catch (error) {
      console.error('Absent notification error:', error);
    }
  },

  // Notify homework assigned
  notifyHomeworkAssigned: async (homework) => {
    try {
      const students = await User.find({
        'profile.class': homework.class,
        role: 'student'
      })
      .populate('profile.parentId', 'email');

      const notifications = students.map(student => 
        notifications.sendEmail(
          student.profile.parentId.email,
          'New Homework Assigned',
          `New homework assigned for ${homework.subject}: ${homework.title}`
        )
      );

      await Promise.all(notifications);
    } catch (error) {
      console.error('Homework notification error:', error);
    }
  }
};

module.exports = notifications;