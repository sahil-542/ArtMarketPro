const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    artwork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artwork',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    commission: {
      type: Number,
      default: 0.15 // 15% platform commission
    }
  }],
  payment: {
    method: {
      type: String,
      enum: ['stripe', 'paypal', 'bank-transfer', 'wallet'],
      required: true
    },
    transactionId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    fee: {
      type: Number,
      default: 0
    }
  },
  shipping: {
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true }
    },
    method: {
      type: String,
      required: true
    },
    cost: {
      type: Number,
      default: 0
    },
    trackingNumber: {
      type: String,
      default: ''
    },
    estimatedDelivery: {
      type: Date
    },
    deliveredAt: {
      type: Date,
      default: null
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  notes: {
    customer: { type: String, default: '' },
    admin: { type: String, default: '' }
  },
  timeline: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' }
  }],
  refunds: [{
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null }
  }],
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate order number before saving
orderSchema.pre('save', function(next) {
  if (this.isNew) {
    this.orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  next();
});

// Add status to timeline when status changes
orderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      note: `Order status changed to ${this.status}`
    });
  }
  next();
});

// Virtual for order age
orderSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for total items
orderSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Method to add tracking info
orderSchema.methods.addTracking = function(trackingNumber, estimatedDelivery) {
  this.shipping.trackingNumber = trackingNumber;
  this.shipping.estimatedDelivery = estimatedDelivery;
  this.status = 'shipped';
  return this.save();
};

// Method to mark as delivered
orderSchema.methods.markDelivered = function() {
  this.status = 'delivered';
  this.shipping.deliveredAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Order', orderSchema);