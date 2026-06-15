const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  artwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork',
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  images: [{
    url: { type: String },
    caption: { type: String, default: '' }
  }],
  helpful: {
    count: { type: Number, default: 0 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  response: {
    artist: {
      comment: { type: String, default: '' },
      respondedAt: { type: Date, default: null }
    },
    admin: {
      comment: { type: String, default: '' },
      respondedAt: { type: Date, default: null }
    }
  },
  verifiedPurchase: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  flags: [{
    reason: { type: String, enum: ['inappropriate', 'fake', 'spam', 'other'] },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    description: { type: String },
    status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' }
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

// Index for efficient querying
reviewSchema.index({ artwork: 1, createdAt: -1 });
reviewSchema.index({ artist: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, createdAt: -1 });
reviewSchema.index({ rating: 1 });

// Virtual for review age
reviewSchema.virtual('age').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
  return `${Math.ceil(diffDays / 365)} years ago`;
});

// Method to mark as helpful
reviewSchema.methods.markHelpful = function(userId) {
  if (!this.helpful.users.includes(userId)) {
    this.helpful.users.push(userId);
    this.helpful.count += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to add artist response
reviewSchema.methods.addArtistResponse = function(comment) {
  this.response.artist.comment = comment;
  this.response.artist.respondedAt = new Date();
  return this.save();
};

// Static method to get average rating for artwork
reviewSchema.statics.getAverageRating = async function(artworkId) {
  const result = await this.aggregate([
    { $match: { artwork: artworkId, isApproved: true } },
    { $group: { _id: null, averageRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  
  return result.length > 0 ? result[0] : { averageRating: 0, count: 0 };
};

module.exports = mongoose.model('Review', reviewSchema);