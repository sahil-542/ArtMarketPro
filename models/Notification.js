const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  type: {
    type: String,
    required: true,
    enum: [
      'new-follower',
      'new-artwork',
      'artwork-sold',
      'order-update',
      'new-review',
      'auction-update',
      'commission-update',
      'message',
      'system',
      'promotion',
      'achievement',
      'payment',
      'shipping',
      'auction-won',
      'auction-outbid',
      'price-drop',
      'back-in-stock',
      'event',
      'newsletter'
    ]
  },
  category: {
    type: String,
    enum: ['social', 'transaction', 'system', 'marketing', 'support'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  data: {
    // Flexible JSON field for additional data
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    artworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artwork' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction' },
    commissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commission' },
    amount: { type: Number },
    url: { type: String },
    image: { type: String },
    action: { type: String },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' }
  },
  channels: {
    inApp: {
      enabled: { type: Boolean, default: true },
      delivered: { type: Boolean, default: false },
      deliveredAt: { type: Date, default: null }
    },
    email: {
      enabled: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      deliveredAt: { type: Date, default: null }
    },
    push: {
      enabled: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      deliveredAt: { type: Date, default: null }
    },
    sms: {
      enabled: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      deliveredAt: { type: Date, default: null }
    }
  },
  read: {
    status: { type: Boolean, default: false },
    readAt: { type: Date, default: null }
  },
  clicked: {
    status: { type: Boolean, default: false },
    clickedAt: { type: Date, default: null },
    clickedUrl: { type: String, default: '' }
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  batchId: {
    type: String,
    default: null
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

// Indexes for efficient querying
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, 'read.status': 1, isActive: 1 });
notificationSchema.index({ type: 1, category: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for notification age
notificationSchema.virtual('age').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
  return `${Math.ceil(diffDays / 365)} years ago`;
});

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.read.status = true;
  this.read.readAt = new Date();
  return this.save();
};

// Method to mark as delivered for a specific channel
notificationSchema.methods.markAsDelivered = function(channel) {
  if (this.channels[channel]) {
    this.channels[channel].delivered = true;
    this.channels[channel].deliveredAt = new Date();
  }
  return this.save();
};

// Method to mark as clicked
notificationSchema.methods.markAsClicked = function(url) {
  this.clicked.status = true;
  this.clicked.clickedAt = new Date();
  this.clicked.clickedUrl = url || '';
  return this.save();
};

// Static method to create bulk notifications
notificationSchema.statics.createBulk = function(notifications) {
  const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  const bulkNotifications = notifications.map(notif => ({
    ...notif,
    batchId: batchId
  }));
  
  return this.insertMany(bulkNotifications);
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    recipient: userId,
    'read.status': false,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

module.exports = mongoose.model('Notification', notificationSchema);