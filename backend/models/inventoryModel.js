const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  itemName: { type: String, required: true },
  serialNumber: { type: String, unique: true, sparse: true },
  assetTag: { type: String, unique: true, required: true }, // Barcode/QR code
  purchaseDate: { type: Date, required: true },
  assignedTo: {
    department: { type: String },
    room: { type: String },
  },
  condition: {
    type: String,
    enum: ['new', 'good', 'fair', 'poor', 'broken'],
    default: 'new',
  },
  warrantyPeriod: {
    startDate: { type: Date },
    endDate: { type: Date },
  },
  maintenanceLogs: [{
    date: { type: Date, required: true },
    description: { type: String, required: true },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cost: { type: Number },
  }],
  category: { type: String, required: true }, // e.g., Electronic, Furniture
  tags: [{ type: String }], // For filtering
  qrCode: { type: String },
  checkInOutLogs: [{
    action: { type: String, enum: ['check-in', 'check-out'], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    location: { type: String },
  }],
  status: {
    type: String,
    enum: ['active', 'retired', 'lost', 'damaged'],
    default: 'active',
  },
}, { timestamps: true });

const stockSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  itemName: { type: String, required: true },
  barcode: { type: String, unique: true, required: true }, // Barcode/QR code
  quantity: { type: Number, required: true, min: 0 },
  minimumStockLevel: { type: Number, required: true, min: 0 },
  category: { type: String, required: true }, // e.g., Consumables
  tags: [{ type: String }],
  qrCode: { type: String },
  usageLogs: [{
    quantity: { type: Number, required: true },
    department: { type: String },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
  }],
  lastRestocked: { type: Date },
}, { timestamps: true });

const procurementSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  requisitionId: { type: String, unique: true, required: true },
  items: [{
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    estimatedCost: { type: Number },
  }],
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'ordered', 'delivered'],
    default: 'pending',
  },
  approval: {
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date },
    comments: { type: String },
  },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  purchaseOrder: {
    poNumber: { type: String, unique: true, sparse: true },
    date: { type: Date },
    totalCost: { type: Number },
  },
  invoice: {
    invoiceNumber: { type: String, unique: true, sparse: true },
    date: { type: Date },
    amount: { type: Number },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'overdue'],
      default: 'pending',
    },
  },
  deliveryStatus: {
    expectedDate: { type: Date },
    actualDate: { type: Date },
    status: { type: String, enum: ['pending', 'in-transit', 'delivered'] },
  },
}, { timestamps: true });

const maintenanceSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  schedule: {
    frequency: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'annually'] },
    nextDue: { type: Date, required: true },
  },
  history: [{
    date: { type: Date, required: true },
    description: { type: String, required: true },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cost: { type: Number },
    status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  }],
  reminders: [{
    date: { type: Date, required: true },
    sent: { type: Boolean, default: false },
    channel: { type: String, enum: ['email', 'sms', 'in-app'] },
  }],
}, { timestamps: true });

const vendorSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true },
  contact: {
    phone: { type: String },
    email: { type: String },
    address: { type: String },
  },
  gstNumber: { type: String },
  rating: { type: Number, min: 1, max: 5 },
  orderHistory: [{
    procurement: { type: mongoose.Schema.Types.ObjectId, ref: 'Procurement' },
    date: { type: Date },
    amount: { type: Number },
  }],
}, { timestamps: true });

const postSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  postName: { type: String, required: true },
  forPost: { type: String, required: true },
  toPost: { type: String, required: true },
  image: {
    key: { type: String }, // S3 key
    url: { type: String }, // Public URL
  },
  issuedMaterials: [{
    item: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'issuedMaterials.itemType',
      required: true,
    },
    itemType: {
      type: String,
      enum: ['Asset', 'Stock'],
      required: true,
    },
    quantity: { type: Number, required: true },
  }],
  fromDepartment: { type: String, required: true },
  toDepartment: { type: String, required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const budgetSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  department: { type: String },
  category: { type: String },
  period: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
  },
  allocatedAmount: { type: Number, required: true },
  spentAmount: { type: Number, default: 0 },
}, { timestamps: true });

const issueSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'itemType',
    required: true,
  },
  itemType: {
    type: String,
    enum: ['Asset', 'Stock'],
    required: true,
  },
  description: { type: String, required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open',
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolution: {
    description: { type: String },
    timestamp: { type: Date },
  },
}, { timestamps: true });

module.exports = (connection) => ({
  Asset: connection.model('Asset', assetSchema),
  Stock: connection.model('Stock', stockSchema),
  Procurement: connection.model('Procurement', procurementSchema),
  Maintenance: connection.model('Maintenance', maintenanceSchema),
  Vendor: connection.model('Vendor', vendorSchema),
  Post: connection.model('Post', postSchema),
  Budget: connection.model('Budget', budgetSchema),
  Issue: connection.model('Issue', issueSchema),
});