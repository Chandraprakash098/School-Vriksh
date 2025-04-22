
console.log('Loading models/index.js');

const models = {
  User: require('../models/User'),
  Class: require('../models/Class'),
  Fee: require('../models/Fee'),
  Payment: require('../models/Payment'),
  Subject: require('../models/Subject'),
  Syllabus: require('../models/Syllabus'),
  TeacherAssignment: require('../models/TeacherAssignment'),
  Timetable: require('../models/Timetable'),
  Attendance: require('../models/Attendance'),
  Certificate: require('../models/Certificate'),
  Leave: require('../models/Leave'),
  Exam: require('../models/Exam'),
  Result: require('../models/Results'),
  Announcement: require('../models/Announcement'),
  Meeting: require('../models/Meeting'),
  SubjectMarks: require('../models/SubjectMarks'),
  ClassResult: require('../models/ClassResult'),
  School: require('../models/School'),
  StudyMaterial:require('../models/StudyMaterial'),
  ProgressReport:require('../models/ProgressReport'),
  DailyWork: require('../models/DailyWork'),
  // AuditLog : require("../models/AuditLog"),
  // Discount : require("../models/Discount")
};

console.log('Loaded models:', Object.keys(models).map(name => ({
  name,
  type: typeof models[name],
  isFunction: typeof models[name] === 'function',
  hasModelFunction: typeof models[name]?.model === 'function',
})));



// Normalize model factories
const normalizedModels = {};
Object.keys(models).forEach(name => {
  if (typeof models[name] === 'function') {
    // Direct factory function (e.g., User, Class, etc.)
    normalizedModels[name] = models[name];
  } else if (typeof models[name]?.model === 'function') {
    // Object with a model factory (e.g., School)
    normalizedModels[name] = models[name].model;
  } else {
    console.error(`Error: ${name} is not a valid model factory, got type: ${typeof models[name]}`);
  }
});


const getModel = (name, connection) => {
  console.log('getModel called with:', { name, connectionName: connection.name });
  if (!normalizedModels[name]) {
    throw new Error(`Model ${name} not found or not a valid factory`);
  }
  const model = normalizedModels[name](connection);
  console.log(`Returning model for ${name}`);
  return model;
};

module.exports = getModel;

