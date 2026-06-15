const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['portrait', 'landscape', 'abstract', 'pet-portrait', 'custom', 'reproduction']
  },
  style: {
    type: String,
    required: true,
    enum: ['realism', 'impressionism', 'expressionism', 'abstract', 'pop-art', 'minimalism']
  },
  medium: {
    type: String,
    required: true,
    enum: ['oil', 'acrylic', 'watercolor', 'digital', 'mixed-media', 'pencil', 'charcoal']
  },
  size: {
    type: String,
    required: true,
    enum: ['small', 'medium', 'large', 'extra-large', 'custom']
  },
  customDimensions: {
    width: { type: Number },
    height: { type: Number },
    unit: { type: String, enum: ['cm', 'inch', 'ft'], default: 'cm' }
  },
  referenceImages: [{
    url: { type: String },
    description: { type: String, default: '' }
  }],
  budget: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    currency: { type: String, default: 'USD' }
  },
  timeline: {
    type: String,
    required: true,
    enum: ['1-2 weeks', '3-4 weeks', '1-2 months', '2-3 months', 'flexible']
  },
  specificRequirements: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'quoted', 'accepted', 'in-progress', 'completed', 'delivered', 'cancelled'],
    default: 'pending'
  },
  quote: {
    amount: { type: Number },
    currency: { type: String, default: 'USD' },
    deliveryTime: { type: String },
    validUntil: { type: Date },
    notes: { type: String, default: '' }
  },
  payment: {
    totalAmount: { type: Number },
    currency: { type: String, default: 'USD' },
    paymentSchedule: {
      type: String,
      enum: ['full-upfront', '50-50', 'milestone-based'],
      default: '50-50'
    },
    milestonePayments: [{
      amount: { type: Number },
      description: { type: String },
      dueDate: { type: Date },
      status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
      paidAt: { type: Date, default: null }
    }]
  },
  progress: [{
    stage: { type: String, required: true },
    description: { type: String, required: true },
    images: [{ type: String }],
    percentage: { type: Number, min: 0, max: 100 },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    approved: { type: Boolean, default: false },
    approvedAt: { type: Date, default: null },
    feedback: { type: String, default: '' }
  }],
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    images: [{ type: String }],
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
  }],
  revisions: [{
    stage: { type: String, required: true },
    requestedChanges: { type: String, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null }
  }],
  finalArtwork: {
    images: [{ type: String }],
    deliveryMethod: { type: String, enum: ['digital', 'physical', 'both'], default: 'both' },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    trackingNumber: { type: String, default: '' },
    deliveredAt: { type: Date, default: null }
  },
  satisfaction: {
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String, default: '' },
    wouldRecommend: { type: Boolean, default: false }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual for commission progress percentage
commissionSchema.virtual('progressPercentage').get(function() {
  if (this.progress.length === 0) return 0;
  const completedStages = this.progress.filter(stage => stage.completed).length;
  return Math.round((completedStages / this.progress.length) * 100);
});

// Virtual for days remaining
commissionSchema.virtual('daysRemaining').get(function() {
  if (!this.quote || !this.quote.validUntil) return null;
  const remaining = this.quote.validUntil.getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
});

// Method to add progress update
commissionSchema.methods.addProgress = function(stage, description, images, percentage) {
  this.progress.push({
    stage: stage,
    description: description,
    images: images || [],
    percentage: percentage || 0
  });
  return this.save();
};

// Method to send message
commissionSchema.methods.sendMessage = function(senderId, message, images) {
  this.messages.push({
    sender: senderId,
    message: message,
    images: images || []
  });
  return this.save();
};

// Method to approve stage
commissionSchema.methods.approveStage = function(stageIndex, feedback) {
  if (this.progress[stageIndex]) {
    this.progress[stageIndex].approved = true;
    this.progress[stageIndex].approvedAt = new Date();
    this.progress[stageIndex].feedback = feedback || '';
  }
  return this.save();
};

module.exports = mongoose.model('Commission', commissionSchema);