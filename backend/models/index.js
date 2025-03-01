// const mongoose = require('mongoose');

// const models = {
//     User: require('../models/User'),
//     Class: require('../models/Class'),
//     Subject: require('../models/Subject'),
//     Syllabus: require('../models/Syllabus'),
//     TeacherAssignment: require('../models/TeacherAssignment'),
//     Timetable: require('../models/Timetable'),
//     Attendance: require('../models/Attendance'),
//     Exam: require('../models/Exam'),
//     Result: require('../models/Results'),
//     Announcement: require('../models/Announcement'),
//     Meeting: require('../models/Meeting'),
//     SubjectMarks: require('../models/SubjectMarks'),
//     ClassResult: require('../models/ClassResult'),
//     School: require('../models/School'),
//   };
  
//   const getModel = (name, connection) => models[name](connection);
//   module.exports = getModel;

// models/index.js
console.log('Loading models/index.js');

const models = {
  User: require('../models/User'),
  Class: require('../models/Class'),
  Subject: require('../models/Subject'),
  Syllabus: require('../models/Syllabus'),
  TeacherAssignment: require('../models/TeacherAssignment'),
  Timetable: require('../models/Timetable'),
  Attendance: require('../models/Attendance'),
  Exam: require('../models/Exam'),
  Result: require('../models/Results'),
  Announcement: require('../models/Announcement'),
  Meeting: require('../models/Meeting'),
  SubjectMarks: require('../models/SubjectMarks'),
  ClassResult: require('../models/ClassResult'),
  School: require('../models/School'),
};

console.log('Loaded models:', Object.keys(models).map(name => ({
  name,
  type: typeof models[name],
  isFunction: typeof models[name] === 'function',
})));

// Ensure all models are functions
Object.keys(models).forEach(name => {
  if (typeof models[name] !== 'function') {
    console.error(`Error: ${name} is not a factory function, got type: ${typeof models[name]}`);
  }
});

const getModel = (name, connection) => {
  console.log('getModel called with:', { name, connectionName: connection.name });
  if (!models[name]) {
    throw new Error(`Model ${name} not found`);
  }
  if (typeof models[name] !== 'function') {
    throw new Error(`Model ${name} is not a function, got: ${typeof models[name]}`);
  }
  const model = models[name](connection);
  console.log(`Returning model for ${name}`);
  return model;
};

module.exports = getModel;