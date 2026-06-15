const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['customer', 'painter', 'admin'],
    default: 'customer'
  },
  profile: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  painterProfile: {
    artistName: { type: String, default: '' },
    specialization: [{ type: String }],
    yearsExperience: { type: Number, default: 0 },
    education: { type: String, default: '' },
    exhibitions: [{ type: String }],
    awards: [{ type: String }],
    website: { type: String, default: '' },
    socialLinks: {
      instagram: String,
      facebook: String,
      twitter: String,
      linkedin: String
    },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    totalSales: { type: Number, default: 0 },
    totalArtworks: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    verificationDocument: { type: String, default: '' }
  },
  preferences: {
    favoriteCategories: [{ type: String }],
    favoriteStyles: [{ type: String }],
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 10000 }
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      newArtworks: { type: Boolean, default: true },
      newFollowers: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false }
    }
  },
  wallet: {
    balance: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 }
  },
  membership: {
    type: { type: String, enum: ['basic', 'premium', 'pro'], default: 'basic' },
    expiresAt: { type: Date, default: null }
  },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  lastLogin: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  const { password, ...publicProfile } = this.toObject();
  return publicProfile;
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Virtual for follower count
userSchema.virtual('followerCount').get(function() {
  return this.painterProfile.followers.length;
});

// Virtual for following count
userSchema.virtual('followingCount').get(function() {
  return this.painterProfile.following.length;
});

module.exports = mongoose.model('User', userSchema);