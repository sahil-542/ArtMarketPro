const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'document', 'audio', 'video']
    },
    url: { type: String, required: true },
    filename: { type: String },
    size: { type: Number },
    thumbnail: { type: String }
  }],
  metadata: {
    isSystem: { type: Boolean, default: false },
    systemType: { type: String, enum: ['order-update', 'auction-update', 'commission-update', 'follow-notification'] },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    isEncrypted: { type: Boolean, default: false }
  },
  read: {
    status: { type: Boolean, default: false },
    readAt: { type: Date, default: null }
  },
  delivered: {
    status: { type: Boolean, default: false },
    deliveredAt: { type: Date, default: null }
  },
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  edited: {
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    originalContent: { type: String, default: '' }
  },
  deleted: {
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
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

// Conversation Schema
const conversationSchema = new mongoose.Schema({
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    lastReadAt: {
      type: Date,
      default: Date.now
    },
    unreadCount: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  type: {
    type: String,
    enum: ['direct', 'group', 'system', 'support'],
    default: 'direct'
  },
  groupInfo: {
    name: { type: String, default: '' },
    avatar: { type: String, default: '' },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    description: { type: String, default: '' }
  },
  metadata: {
    isSupport: { type: Boolean, default: false },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    category: { type: String, enum: ['general', 'order', 'technical', 'billing', 'artist'] },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tags: [{ type: String }]
  },
  lastMessage: {
    content: { type: String, default: '' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    attachments: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
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

// Indexes for performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, 'read.status': 1 });

conversationSchema.index({ 'participants.user': 1, updatedAt: -1 });
conversationSchema.index({ type: 1, 'metadata.assignedAgent': 1 });

// Virtual for conversation participant count
conversationSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Method to add participant
conversationSchema.methods.addParticipant = function(userId) {
  const exists = this.participants.some(p => p.user.toString() === userId.toString());
  
  if (!exists) {
    this.participants.push({ user: userId });
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove participant
conversationSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(p => p.user.toString() !== userId.toString());
  return this.save();
};

// Method to mark as read
conversationSchema.methods.markAsRead = function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    participant.lastReadAt = new Date();
    participant.unreadCount = 0;
  }
  return this.save();
};

module.exports = {
  Message: mongoose.model('Message', messageSchema),
  Conversation: mongoose.model('Conversation', conversationSchema)
};