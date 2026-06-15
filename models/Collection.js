const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  curator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['personal', 'public', 'featured', 'exhibition'],
    default: 'personal'
  },
  artworks: [{
    artwork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artwork'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      default: ''
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  coverImage: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  stats: {
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    followers: { type: Number, default: 0 }
  },
  featured: {
    isFeatured: { type: Boolean, default: false },
    featuredDate: { type: Date, default: null },
    featuredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  exhibition: {
    title: { type: String, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    location: { type: String, default: '' },
    isVirtual: { type: Boolean, default: false },
    virtualTourUrl: { type: String, default: '' }
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

// Virtual for artwork count
collectionSchema.virtual('artworkCount').get(function() {
  return this.artworks.length;
});

// Virtual for follower count
collectionSchema.virtual('followerCount').get(function() {
  return this.followers.length;
});

// Method to add artwork
collectionSchema.methods.addArtwork = function(artworkId, note) {
  const exists = this.artworks.some(item => item.artwork.toString() === artworkId.toString());
  
  if (!exists) {
    this.artworks.push({
      artwork: artworkId,
      note: note || ''
    });
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove artwork
collectionSchema.methods.removeArtwork = function(artworkId) {
  this.artworks = this.artworks.filter(item => item.artwork.toString() !== artworkId.toString());
  return this.save();
};

// Method to toggle follower
collectionSchema.methods.toggleFollower = function(userId) {
  const index = this.followers.indexOf(userId);
  
  if (index > -1) {
    this.followers.splice(index, 1);
    this.stats.followers -= 1;
  } else {
    this.followers.push(userId);
    this.stats.followers += 1;
  }
  
  return this.save();
};

// Static method to find public collections
collectionSchema.statics.findPublic = function() {
  return this.find({ isPublic: true })
    .populate('curator', 'profile.firstName profile.lastName painterProfile.artistName')
    .populate('artworks.artwork', 'title images pricing');
};

// Static method to find featured collections
collectionSchema.statics.findFeatured = function() {
  return this.find({ 
    'featured.isFeatured': true,
    isPublic: true 
  })
    .populate('curator', 'profile.firstName profile.lastName painterProfile.artistName')
    .populate('artworks.artwork', 'title images pricing')
    .sort({ 'featured.featuredDate': -1 });
};

module.exports = mongoose.model('Collection', collectionSchema);