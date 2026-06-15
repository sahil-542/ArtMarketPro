const mongoose = require('mongoose');

const artworkSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
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
    enum: ['abstract', 'portrait', 'landscape', 'still-life', 'modern', 'contemporary', 'traditional', 'digital', 'mixed-media', 'sculpture']
  },
  style: {
    type: String,
    required: true,
    enum: ['realism', 'impressionism', 'expressionism', 'surrealism', 'pop-art', 'minimalism', 'abstract', 'figurative']
  },
  medium: {
    type: String,
    required: true,
    enum: ['oil', 'acrylic', 'watercolor', 'ink', 'charcoal', 'pencil', 'mixed-media', 'digital', 'photography', 'sculpture']
  },
  dimensions: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    depth: { type: Number, default: 0 },
    unit: { type: String, enum: ['cm', 'inch', 'ft'], default: 'cm' }
  },
  weight: {
    type: Number,
    default: 0
  },
  images: [{
    url: { type: String, required: true },
    thumbnail: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
    caption: { type: String, default: '' }
  }],
  pricing: {
    originalPrice: { type: Number, required: true },
    salePrice: { type: Number, default: null },
    currency: { type: String, default: 'USD' },
    isOnSale: { type: Boolean, default: false },
    salePercentage: { type: Number, default: 0 }
  },
  availability: {
    type: String,
    enum: ['available', 'sold', 'reserved', 'not-for-sale'],
    default: 'available'
  },
  quantity: {
    type: Number,
    default: 1
  },
  tags: [{
    type: String,
    trim: true
  }],
  colors: [{
    type: String,
    trim: true
  }],
  yearCreated: {
    type: Number,
    required: true,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  certificate: {
    hasCertificate: { type: Boolean, default: false },
    certificateNumber: { type: String, default: '' },
    certificateImage: { type: String, default: '' }
  },
  shipping: {
    isFreeShipping: { type: Boolean, default: false },
    shippingCost: { type: Number, default: 0 },
    processingTime: { type: String, default: '3-5 business days' },
    estimatedDelivery: { type: String, default: '7-14 business days' },
    shippingMethods: [{ type: String }]
  },
  stats: {
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    timesFavorited: { type: Number, default: 0 }
  },
  featured: {
    isFeatured: { type: Boolean, default: false },
    featuredDate: { type: Date, default: null }
  },
  collections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collection'
  }],
  relatedArtworks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork'
  }],
  isActive: { type: Boolean, default: true },
  isApproved: { type: Boolean, default: false },
  rejectionReason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for search and filtering
artworkSchema.index({ title: 'text', description: 'text', tags: 'text' });
artworkSchema.index({ artist: 1, createdAt: -1 });
artworkSchema.index({ category: 1, style: 1, medium: 1 });
artworkSchema.index({ 'pricing.originalPrice': 1 });
artworkSchema.index({ availability: 1 });
artworkSchema.index({ featured: -1, createdAt: -1 });

// Virtual for formatted dimensions
artworkSchema.virtual('formattedDimensions').get(function() {
  const { width, height, depth, unit } = this.dimensions;
  return depth > 0 ? `${width} × ${height} × ${depth} ${unit}` : `${width} × ${height} ${unit}`;
});

// Virtual for current price
artworkSchema.virtual('currentPrice').get(function() {
  return this.pricing.isOnSale && this.pricing.salePrice ? this.pricing.salePrice : this.pricing.originalPrice;
});

// Virtual for discount percentage
artworkSchema.virtual('discountPercentage').get(function() {
  if (!this.pricing.isOnSale || !this.pricing.salePrice) return 0;
  return Math.round(((this.pricing.originalPrice - this.pricing.salePrice) / this.pricing.originalPrice) * 100);
});

// Method to increment views
artworkSchema.methods.incrementViews = function() {
  this.stats.views += 1;
  return this.save();
};

// Method to toggle like
artworkSchema.methods.toggleLike = function(userId) {
  // This would be implemented with a separate Like model
  return Promise.resolve(this);
};

module.exports = mongoose.model('Artwork', artworkSchema);