const {getOwnerConnection}= require("../config/database");
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const exceljs = require('exceljs');
const PDFDocument = require('pdfkit');
const { generateQRCode } = require('../utils/qrCodeUtil'); // Hypothetical QR code utility
const { sendSMS } = require('../utils/smsUtil'); // Hypothetical SMS utility

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const inventoryController = {
  // Asset Management
  async createAsset(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Asset } = require('../models/inventoryModel')(connection);

      const {
        itemName,
        serialNumber,
        purchaseDate,
        category,
        assignedTo,
        warrantyPeriod,
        condition,
        tags,
      } = req.body;
      const assetTag = `ASSET-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const qrCode = await generateQRCode(assetTag);

      const asset = new Asset({
        school: schoolId,
        itemName,
        serialNumber,
        assetTag,
        purchaseDate,
        category,
        assignedTo,
        warrantyPeriod,
        condition,
        tags,
        qrCode,
        createdBy: userId,
      });

      await asset.save();

      // Notify admin
      // await transporter.sendMail({
      //   to: 'admin@example.com',
      //   subject: 'New Asset Added',
      //   text: `Asset ${itemName} (${assetTag}) added by ${req.user.name}.`,
      // });

      res.status(201).json({ message: 'Asset created successfully', asset });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAssets(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Asset } = require('../models/inventoryModel')(connection);

      const { category, department, status, tags } = req.query;
      const query = { school: schoolId };
      if (category) query.category = category;
      if (department) query['assignedTo.department'] = department;
      if (status) query.status = status;
      if (tags) query.tags = { $in: tags.split(',') };

      const assets = await Asset.find(query)
        .populate('checkInOutLogs.user', 'name')
        .populate('maintenanceLogs.technician', 'name');
      res.json(assets);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAssetById(req, res) {
    try {
      // const { schoolId } = req.user;
      // const { id } = req.params;
      // const connection = await getSchoolConnection(schoolId);
      const schoolId = req.school._id.toString();
      const { id } = req.params;
      const connection = req.connection;
      const { Asset } = require('../models/inventoryModel')(connection);

      const asset = await Asset.findOne({ _id: id, school: schoolId })
        .populate('checkInOutLogs.user', 'name')
        .populate('maintenanceLogs.technician', 'name');
      if (!asset) return res.status(404).json({ message: 'Asset not found' });

      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateAsset(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      
      const { Asset } = require('../models/inventoryModel')(connection);

      const updates = req.body;
      const asset = await Asset.findOneAndUpdate(
        { _id: id, school: schoolId },
        { ...updates, updatedBy: userId },
        { new: true }
      );
      if (!asset) return res.status(404).json({ message: 'Asset not found' });

      // Check warranty expiration
      if (asset.warrantyPeriod?.endDate && new Date(asset.warrantyPeriod.endDate) < new Date()) {
        await sendSMS(
          'admin_phone',
          `Warranty expired for asset ${asset.itemName} (${asset.assetTag}).`
        );
      }

      res.json({ message: 'Asset updated successfully', asset });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteAsset(req, res) {
    try {
       const schoolId = req.school._id.toString();
      const { id } = req.params;
      const connection = req.connection;
      const { Asset } = require('../models/inventoryModel')(connection);

      const asset = await Asset.findOneAndDelete({ _id: id, school: schoolId });
      if (!asset) return res.status(404).json({ message: 'Asset not found' });

      res.json({ message: 'Asset deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async checkInOutAsset(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const { id } = req.params;
      const { action, location } = req.body;
      const connection = req.connection;
      const { Asset } = require('../models/inventoryModel')(connection);

      const asset = await Asset.findOne({ _id: id, school: schoolId });
      if (!asset) return res.status(404).json({ message: 'Asset not found' });

      asset.checkInOutLogs.push({
        action,
        user: userId,
        location,
        timestamp: new Date(),
      });
      await asset.save();

      // In-app notification (hypothetical)
      await transporter.sendMail({
        to: 'admin@example.com',
        subject: `Asset ${action}`,
        text: `Asset ${asset.itemName} (${asset.assetTag}) has been ${action} by ${req.user.name} at ${location}.`,
      });

      res.json({ message: `Asset ${action} successfully`, asset });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Stock Management
  async createStock(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Stock } = require('../models/inventoryModel')(connection);

      const { itemName, quantity, minimumStockLevel, category, tags } = req.body;
      const barcode = `STOCK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const qrCode = await generateQRCode(barcode);

      const stock = new Stock({
        school: schoolId,
        itemName,
        barcode,
        quantity,
        minimumStockLevel,
        category,
        tags,
        qrCode,
        createdBy: userId,
      });

      await stock.save();

      // Low stock alert
      if (quantity <= minimumStockLevel) {
        await sendSMS(
          'admin_phone',
          `Low stock alert: ${itemName} has ${quantity} units remaining.`
        );
      }

      res.status(201).json({ message: 'Stock created successfully', stock });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getStocks(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Stock } = require('../models/inventoryModel')(connection);

      const { category, tags } = req.query;
      const query = { school: schoolId };
      if (category) query.category = category;
      if (tags) query.tags = { $in: tags.split(',') };

      const stocks = await Stock.find(query).populate('usageLogs.user', 'name');
      res.json(stocks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getStockById(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      
      const { Stock } = require('../models/inventoryModel')(connection);

      const stock = await Stock.findOne({ _id: id, school: schoolId }).populate('usageLogs.user', 'name');
      if (!stock) return res.status(404).json({ message: 'Stock not found' });

      res.json(stock);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateStock(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
   
      const { Stock } = require('../models/inventoryModel')(connection);

      const updates = req.body;
      const stock = await Stock.findOneAndUpdate(
        { _id: id, school: schoolId },
        { ...updates, updatedBy: userId },
        { new: true }
      );
      if (!stock) return res.status(404).json({ message: 'Stock not found' });

      // Low stock alert
      if (stock.quantity <= stock.minimumStockLevel) {
        await transporter.sendMail({
          to: 'admin@example.com',
          subject: 'Low Stock Alert',
          text: `Stock ${stock.itemName} (${stock.barcode}) has ${stock.quantity} units remaining.`,
        });
      }

      res.json({ message: 'Stock updated successfully', stock });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteStock(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      
      const { Stock } = require('../models/inventoryModel')(connection);

      const stock = await Stock.findOneAndDelete({ _id: id, school: schoolId });
      if (!stock) return res.status(404).json({ message: 'Stock not found' });

      res.json({ message: 'Stock deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async useStock(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      const { quantity, department, classId } = req.body;
      const { Stock } = require('../models/inventoryModel')(connection);

      const stock = await Stock.findOne({ _id: id, school: schoolId });
      if (!stock) return res.status(404).json({ message: 'Stock not found' });

      if (stock.quantity < quantity) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }

      stock.quantity -= quantity;
      stock.usageLogs.push({
        quantity,
        department,
        class: classId,
        user: userId,
        timestamp: new Date(),
      });
      stock.lastRestocked = new Date();

      await stock.save();

      // Low stock alert
      if (stock.quantity <= stock.minimumStockLevel) {
        await transporter.sendMail({
          to: 'admin@example.com',
          subject: 'Low Stock Alert',
          text: `Stock ${stock.itemName} (${stock.barcode}) has ${stock.quantity} units remaining.`,
        });
      }

      res.json({ message: 'Stock used successfully', stock });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Procurement
  async createProcurement(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Procurement, Budget } = require('../models/inventoryModel')(connection);

      const { items, vendorId } = req.body;
      const requisitionId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Check budget
      const totalCost = items.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
      const budget = await Budget.findOne({
        school: schoolId,
        department: req.body.department,
        period: { $gte: new Date() },
      });
      if (budget && budget.spentAmount + totalCost > budget.allocatedAmount) {
        await sendSMS(
          'admin_phone',
          `Budget limit exceeded for department ${req.body.department}.`
        );
        return res.status(400).json({ message: 'Budget limit exceeded' });
      }

      const procurement = new Procurement({
        school: schoolId,
        requisitionId,
        items,
        requestedBy: userId,
        vendor: vendorId,
      });

      await procurement.save();

      // Update budget
      if (budget) {
        budget.spentAmount += totalCost;
        await budget.save();
      }

      res.status(201).json({ message: 'Procurement request created', procurement });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getProcurements(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Procurement } = require('../models/inventoryModel')(connection);

      const { status, vendorId } = req.query;
      const query = { school: schoolId };
      if (status) query.status = status;
      if (vendorId) query.vendor = vendorId;

      const procurements = await Procurement.find(query)
        .populate('requestedBy', 'name')
        .populate('vendor', 'name')
        .populate('approval.approver', 'name');
      res.json(procurements);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getProcurementById(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      
      const { Procurement } = require('../models/inventoryModel')(connection);

      const procurement = await Procurement.findOne({ _id: id, school: schoolId })
        .populate('requestedBy', 'name')
        .populate('vendor', 'name')
        .populate('approval.approver', 'name');
      if (!procurement) return res.status(404).json({ message: 'Procurement not found' });

      res.json(procurement);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async approveProcurement(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      const { status, comments } = req.body;
      
      const { Procurement } = require('../models/inventoryModel')(connection);

      const procurement = await Procurement.findOne({ _id: id, school: schoolId });
      if (!procurement) return res.status(404).json({ message: 'Procurement not found' });

      procurement.status = status;
      procurement.approval = {
        approver: userId,
        timestamp: new Date(),
        comments,
      };
      await procurement.save();

      // Notify requester
      await transporter.sendMail({
        to: procurement.requestedBy.email,
        subject: `Procurement ${status}`,
        text: `Your procurement request (${procurement.requisitionId}) has been ${status}. Comments: ${comments || 'None'}.`,
      });

      res.json({ message: `Procurement ${status}`, procurement });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateProcurementStatus(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      const { status, purchaseOrder, invoice, deliveryStatus } = req.body;
      
      const { Procurement } = require('../models/inventoryModel')(connection);

      const procurement = await Procurement.findOne({ _id: id, school: schoolId });
      if (!procurement) return res.status(404).json({ message: 'Procurement not found' });

      if (status) procurement.status = status;
      if (purchaseOrder) procurement.purchaseOrder = purchaseOrder;
      if (invoice) procurement.invoice = invoice;
      if (deliveryStatus) procurement.deliveryStatus = deliveryStatus;

      await procurement.save();
      res.json({ message: 'Procurement status updated', procurement });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Maintenance
  async createMaintenance(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Maintenance, Asset } = require('../models/inventoryModel')(connection);

      const { assetId, schedule } = req.body;
      const asset = await Asset.findOne({ _id: assetId, school: schoolId });
      if (!asset) return res.status(404).json({ message: 'Asset not found' });

      const maintenance = new Maintenance({
        school: schoolId,
        asset: assetId,
        schedule,
        createdBy: userId,
      });

      await maintenance.save();

      // Schedule reminder
      await transporter.sendMail({
        to: 'admin@example.com',
        subject: 'Maintenance Scheduled',
        text: `Maintenance scheduled for asset ${asset.itemName} on ${schedule.nextDue}.`,
      });

      res.status(201).json({ message: 'Maintenance schedule created', maintenance });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getMaintenances(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Maintenance } = require('../models/inventoryModel')(connection);

      const maintenances = await Maintenance.find({ school: schoolId })
        .populate('asset', 'itemName assetTag')
        .populate('history.technician', 'name');
      res.json(maintenances);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getMaintenanceById(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      
      const { Maintenance } = require('../models/inventoryModel')(connection);

      const maintenance = await Maintenance.findOne({ _id: id, school: schoolId })
        .populate('asset', 'itemName assetTag')
        .populate('history.technician', 'name');
      if (!maintenance) return res.status(404).json({ message: 'Maintenance not found' });

      res.json(maintenance);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateMaintenance(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      const { history, schedule } = req.body;
      
      const { Maintenance } = require('../models/inventoryModel')(connection);

      const maintenance = await Maintenance.findOne({ _id: id, school: schoolId });
      if (!maintenance) return res.status(404).json({ message: 'Maintenance not found' });

      if (history) {
        maintenance.history.push({ ...history, technician: userId, date: new Date() });
      }
      if (schedule) maintenance.schedule = schedule;

      await maintenance.save();
      res.json({ message: 'Maintenance updated successfully', maintenance });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Vendor
  async createVendor(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      
      const { Vendor } = require('../models/inventoryModel')(connection);

      const { name, contact, gstNumber, rating } = req.body;
      const vendor = new Vendor({
        school: schoolId,
        name,
        contact,
        gstNumber,
        rating,
        createdBy: userId,
      });

      await vendor.save();
      res.status(201).json({ message: 'Vendor created successfully', vendor });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getVendors(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Vendor } = require('../models/inventoryModel')(connection);

      const vendors = await Vendor.find({ school: schoolId }).populate('orderHistory.procurement');
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getVendorById(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
     
      const { Vendor } = require('../models/inventoryModel')(connection);

      const vendor = await Vendor.findOne({ _id: id, school: schoolId }).populate('orderHistory.procurement');
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

      res.json(vendor);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateVendor(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      const updates = req.body;
      
      const { Vendor } = require('../models/inventoryModel')(connection);

      const vendor = await Vendor.findOneAndUpdate(
        { _id: id, school: schoolId },
        { ...updates, updatedBy: userId },
        { new: true }
      );
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

      res.json({ message: 'Vendor updated successfully', vendor });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteVendor(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
     
      const { Vendor } = require('../models/inventoryModel')(connection);

      const vendor = await Vendor.findOneAndDelete({ _id: id, school: schoolId });
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

      res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Post Tracking
  async createPost(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Post } = require('../models/inventoryModel')(connection);

      const { postName, forPost, toPost, image, issuedMaterials, fromDepartment, toDepartment } = req.body;
      const post = new Post({
        school: schoolId,
        postName,
        forPost,
        toPost,
        image,
        issuedMaterials,
        fromDepartment,
        toDepartment,
        issuedBy: userId,
      });

      await post.save();
      res.status(201).json({ message: 'Post created successfully', post });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getPosts(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Post } = require('../models/inventoryModel')(connection);

      const posts = await Post.find({ school: schoolId })
        .populate('issuedMaterials.item')
        .populate('issuedBy', 'name');
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getPostById(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      
      const { Post } = require('../models/inventoryModel')(connection);

      const post = await Post.findOne({ _id: id, school: schoolId })
        .populate('issuedMaterials.item')
        .populate('issuedBy', 'name');
      if (!post) return res.status(404).json({ message: 'Post not found' });

      res.json(post);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Budget
  async createBudget(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Budget } = require('../models/inventoryModel')(connection);

      const { department, category, period, allocatedAmount } = req.body;
      const budget = new Budget({
        school: schoolId,
        department,
        category,
        period,
        allocatedAmount,
        createdBy: userId,
      });

      await budget.save();
      res.status(201).json({ message: 'Budget created successfully', budget });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getBudgets(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Budget } = require('../models/inventoryModel')(connection);

      const budgets = await Budget.find({ school: schoolId });
      res.json(budgets);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getBudgetById(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      
      const { Budget } = require('../models/inventoryModel')(connection);

      const budget = await Budget.findOne({ _id: id, school: schoolId });
      if (!budget) return res.status(404).json({ message: 'Budget not found' });

      res.json(budget);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateBudget(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      const updates = req.body;
     
      const { Budget } = require('../models/inventoryModel')(connection);

      const budget = await Budget.findOneAndUpdate(
        { _id: id, school: schoolId },
        { ...updates, updatedBy: userId },
        { new: true }
      );
      if (!budget) return res.status(404).json({ message: 'Budget not found' });

      res.json({ message: 'Budget updated successfully', budget });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Issues
  async createIssue(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Issue } = require('../models/inventoryModel')(connection);

      const { item, itemType, description, assignedTo } = req.body;
      const issue = new Issue({
        school: schoolId,
        item,
        itemType,
        description,
        reportedBy: userId,
        assignedTo,
      });

      await issue.save();

      // Notify assigned user
      if (assignedTo) {
        await transporter.sendMail({
          to: 'technician@example.com',
          subject: 'New Issue Assigned',
          text: `Issue reported for ${itemType}: ${description}. Assigned to you.`,
        });
      }

      res.status(201).json({ message: 'Issue created successfully', issue });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getIssues(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Issue } = require('../models/inventoryModel')(connection);

      const issues = await Issue.find({ school: schoolId })
        .populate('item')
        .populate('reportedBy', 'name')
        .populate('assignedTo', 'name');
      res.json(issues);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getIssueById(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      
      const { Issue } = require('../models/inventoryModel')(connection);

      const issue = await Issue.findOne({ _id: id, school: schoolId })
        .populate('item')
        .populate('reportedBy', 'name')
        .populate('assignedTo', 'name');
      if (!issue) return res.status(404).json({ message: 'Issue not found' });

      res.json(issue);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async resolveIssue(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { id } = req.params;
      const { resolutionDescription } = req.body;
     
      const { Issue } = require('../models/inventoryModel')(connection);

      const issue = await Issue.findOne({ _id: id, school: schoolId });
      if (!issue) return res.status(404).json({ message: 'Issue not found' });

      issue.status = 'resolved';
      issue.resolution = {
        description: resolutionDescription,
        timestamp: new Date(),
      };
      issue.updatedBy = userId;

      await issue.save();

      // Notify reporter
      await transporter.sendMail({
        to: issue.reportedBy.email,
        subject: 'Issue Resolved',
        text: `Issue for ${issue.itemType} has been resolved: ${resolutionDescription}.`,
      });

      res.json({ message: 'Issue resolved successfully', issue });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Reports
  async generateAssetRegisterReport(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      
      const { Asset } = require('../models/inventoryModel')(connection);

      const { format = 'excel' } = req.query;
      const assets = await Asset.find({ school: schoolId }).lean();

      if (format === 'excel') {
        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Asset Register');

        worksheet.columns = [
          { header: 'Item Name', key: 'itemName', width: 20 },
          { header: 'Serial Number', key: 'serialNumber', width: 15 },
          { header: 'Asset Tag', key: 'assetTag', width: 15 },
          { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
          { header: 'Condition', key: 'condition', width: 10 },
          { header: 'Department', key: 'department', width: 15 },
          { header: 'Warranty End', key: 'warrantyEnd', width: 15 },
        ];

        assets.forEach(asset => {
          worksheet.addRow({
            itemName: asset.itemName,
            serialNumber: asset.serialNumber,
            assetTag: asset.assetTag,
            purchaseDate: asset.purchaseDate,
            condition: asset.condition,
            department: asset.assignedTo?.department,
            warrantyEnd: asset.warrantyPeriod?.endDate,
          });
        });

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename=asset_register.xlsx');
        await workbook.xlsx.write(res);
        res.end();
      } else {
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=asset_register.pdf');
        doc.pipe(res);

        doc.fontSize(16).text('Asset Register', { align: 'center' });
        doc.moveDown();
        assets.forEach(asset => {
          doc.fontSize(12).text(`Item: ${asset.itemName}`);
          doc.text(`Serial: ${asset.serialNumber || 'N/A'}`);
          doc.text(`Tag: ${asset.assetTag}`);
          doc.text(`Condition: ${asset.condition}`);
          doc.moveDown();
        });

        doc.end();
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async generateStockUsageReport(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { period = 'monthly' } = req.query;
      
      const { Stock } = require('../models/inventoryModel')(connection);

      const date = new Date();
      let startDate;
      if (period === 'daily') startDate = new Date(date.setHours(0, 0, 0, 0));
      else if (period === 'monthly') startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      else startDate = new Date(date.getFullYear(), 0, 1);

      const stocks = await Stock.find({ school: schoolId }).lean();
      const usageData = stocks.map(stock => ({
        itemName: stock.itemName,
        usage: stock.usageLogs
          .filter(log => new Date(log.timestamp) >= startDate)
          .reduce((sum, log) => sum + log.quantity, 0),
      }));

      const workbook = new exceljs.Workbook();
      const worksheet = workbook.addWorksheet('Stock Usage');

      worksheet.columns = [
        { header: 'Item Name', key: 'itemName', width: 20 },
        { header: 'Usage Quantity', key: 'usage', width: 15 },
      ];

      usageData.forEach(data => worksheet.addRow(data));

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename=stock_usage_${period}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async generateLowStockReport(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Stock } = require('../models/inventoryModel')(connection);

      const lowStocks = await Stock.find({
        school: schoolId,
        quantity: { $lte: mongoose.Types.Decimal128.fromString('minimumStockLevel') },
      }).lean();

      const workbook = new exceljs.Workbook();
      const worksheet = workbook.addWorksheet('Low Stock Report');

      worksheet.columns = [
        { header: 'Item Name', key: 'itemName', width: 20 },
        { header: 'Current Quantity', key: 'quantity', width: 15 },
        { header: 'Minimum Level', key: 'minimumStockLevel', width: 15 },
      ];

      lowStocks.forEach(stock => worksheet.addRow({
        itemName: stock.itemName,
        quantity: stock.quantity,
        minimumStockLevel: stock.minimumStockLevel,
      }));

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', 'attachment; filename=low_stock_report.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async generateMaintenanceDueReport(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Maintenance } = require('../models/inventoryModel')(connection);

      const maintenances = await Maintenance.find({
        school: schoolId,
        'schedule.nextDue': { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // Due within 7 days
      })
        .populate('asset', 'itemName assetTag')
        .lean();

      const workbook = new exceljs.Workbook();
      const worksheet = workbook.addWorksheet('Maintenance Due');

      worksheet.columns = [
        { header: 'Asset Name', key: 'itemName', width: 20 },
        { header: 'Asset Tag', key: 'assetTag', width: 15 },
        { header: 'Next Due', key: 'nextDue', width: 15 },
      ];

      maintenances.forEach(m => worksheet.addRow({
        itemName: m.asset.itemName,
        assetTag: m.asset.assetTag,
        nextDue: m.schedule.nextDue,
      }));

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', 'attachment; filename=maintenance_due_report.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async generateBudgetReport(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { period = 'monthly' } = req.query;
      
      const { Budget } = require('../models/inventoryModel')(connection);

      const date = new Date();
      let startDate, endDate;
      if (period === 'monthly') {
        startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      } else if (period === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3);
        startDate = new Date(date.getFullYear(), quarter * 3, 1);
        endDate = new Date(date.getFullYear(), (quarter + 1) * 3, 0);
      } else {
        startDate = new Date(date.getFullYear(), 0, 1);
        endDate = new Date(date.getFullYear(), 11, 31);
      }

      const budgets = await Budget.find({
        school: schoolId,
        'period.startDate': { $gte: startDate },
        'period.endDate': { $lte: endDate },
      }).lean();

      const workbook = new exceljs.Workbook();
      const worksheet = workbook.addWorksheet('Budget Report');

      worksheet.columns = [
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Allocated', key: 'allocatedAmount', width: 15 },
        { header: 'Spent', key: 'spentAmount', width: 15 },
      ];

      budgets.forEach(budget => worksheet.addRow({
        department: budget.department,
        category: budget.category,
        allocatedAmount: budget.allocatedAmount,
        spentAmount: budget.spentAmount,
      }));

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename=budget_report_${period}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Analytics
  async getDashboardAnalytics(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { Asset, Stock, Procurement, Budget } = require('../models/inventoryModel')(connection);

      const assetCount = await Asset.countDocuments({ school: schoolId });
      // const lowStockCount = await Stock.countDocuments({
      //   school: schoolId,
      //   quantity: { $lte: mongoose.Types.Decimal128.fromString('minimumStockLevel') },
      // });
      const lowStockCount = await Stock.countDocuments({
  school: schoolId,
  
  $expr: { $lte: ['$quantity', '$minimumStockLevel'] }
});

      const pendingProcurements = await Procurement.countDocuments({
        school: schoolId,
        status: 'pending',
      });
      // const budgetUtilization = await Budget.aggregate([
      //   { $match: { school: mongoose.Types.ObjectId(schoolId) } },
      //   {
      //     $group: {
      //       _id: null,
      //       totalAllocated: { $sum: '$allocatedAmount' },
      //       totalSpent: { $sum: '$spentAmount' },
      //     },
      //   },
      // ]);

      const budgetUtilization = await Budget.aggregate([
  { $match: { school: new mongoose.Types.ObjectId(schoolId) } },
  {
    $group: {
      _id: null,
      totalAllocated: { $sum: '$allocatedAmount' },
      totalSpent: { $sum: '$spentAmount' },
    },
  },
]);


      // const stockTrends = await Stock.aggregate([
      //   { $match: { school: mongoose.Types.ObjectId(schoolId) } },
      //   { $unwind: '$usageLogs' },
      //   {
      //     $group: {
      //       _id: '$itemName',
      //       totalUsed: { $sum: '$usageLogs.quantity' },
      //     },
      //   },
      //   { $sort: { totalUsed: -1 } },
      //   { $limit: 5 },
      // ]);

      const stockTrends = await Stock.aggregate([
  { $match: { school: new mongoose.Types.ObjectId(schoolId) } },
  { $unwind: '$usageLogs' },
  {
    $group: {
      _id: '$itemName',
      totalUsed: { $sum: '$usageLogs.quantity' },
    },
  },
  { $sort: { totalUsed: -1 } },
  { $limit: 5 },
]);


      res.json({
        assetCount,
        lowStockCount,
        pendingProcurements,
        budgetUtilization: budgetUtilization[0] || { totalAllocated: 0, totalSpent: 0 },
        topUsedItems: stockTrends,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Barcode/QR Scanning
  async scanItem(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { code } = req.body;
      
      const { Asset, Stock } = require('../models/inventoryModel')(connection);

      let item = await Asset.findOne({ assetTag: code, school: schoolId });
      if (item) return res.json({ type: 'Asset', item });

      item = await Stock.findOne({ barcode: code, school: schoolId });
      if (item) return res.json({ type: 'Stock', item });

      res.status(404).json({ message: 'Item not found' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Offline Mode (Placeholder)
  async syncOfflineData(req, res) {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const connection = req.connection;
      const { actions } = req.body; // Expected: array of offline actions
      
      const models = require('../models/inventoryModel')(connection);

      // Process each action (e.g., create asset, use stock)
      for (const action of actions) {
        const { type, data } = action;
        if (type === 'createAsset') {
          const { Asset } = models;
          const asset = new Asset({ ...data, school: schoolId });
          await asset.save();
        } else if (type === 'useStock') {
          const { Stock } = models;
          const stock = await Stock.findById(data.stockId);
          if (stock) {
            stock.quantity -= data.quantity;
            stock.usageLogs.push(data.usageLog);
            await stock.save();
          }
        }
        // Add more action types as needed
      }

      res.json({ message: 'Offline data synced successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = inventoryController;