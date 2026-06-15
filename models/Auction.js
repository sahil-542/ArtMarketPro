const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  artwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork',
    required: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
    
  },
  description: {
    type: String,
    required: true
  },
  startingBid: {
    type: Number,
    required: true,
    min: 0
  },
  reservePrice: {
    type: Number,
    default: null
  },
  currentBid: {
    type: Number,
    default: 0
  },
  bidIncrement: {
    type: Number,
    default: 5
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in hours
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended', 'cancelled'],
    default: 'scheduled'
  },
  bids: [{
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isAutoBid: {
      type: Boolean,
      default: false
    },
    maxAutoBid: {
      type: Number,
      default: null
    }
  }],
  winningBid: {
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    amount: {
      type: Number,
      default: null
    },
    timestamp: {
      type: Date,
      default: null
    }
  },
  watchers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  autoBidders: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    maxBid: {
      type: Number,
      required: true
    },
    increment: {
      type: Number,
      default: 5
    }
  }],
  settings: {
    autoExtend: {
      type: Boolean,
      default: true
    },
    extendTime: {
      type: Number,
      default: 300 // 5 minutes in seconds
    },
    snipeProtection: {
      type: Boolean,
      default: true
    }
  },
  notifications: {
    bidUpdates: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      type: {
        type: String,
        enum: ['outbid', 'won', 'ended']
      },
      sent: {
        type: Boolean,
        default: false
      }
    }]
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

// Virtual for time remaining
auctionSchema.virtual('timeRemaining').get(function() {
  if (this.status !== 'active') return 0;
  const remaining = this.endTime.getTime() - Date.now();
  return Math.max(0, remaining);
});

// Virtual for total bids
auctionSchema.virtual('totalBids').get(function() {
  return this.bids.length;
});

// Virtual for current bidder
auctionSchema.virtual('currentBidder').get(function() {
  if (this.bids.length === 0) return null;
  return this.bids[this.bids.length - 1].bidder;
});

// Method to place bid
auctionSchema.methods.placeBid = function(bidderId, amount, isAutoBid = false, maxAutoBid = null) {
  return new Promise((resolve, reject) => {
    if (this.status !== 'active') {
      return reject(new Error('Auction is not active'));
    }
    
    if (Date.now() > this.endTime.getTime()) {
      return reject(new Error('Auction has ended'));
    }
    
    if (amount < this.startingBid) {
      return reject(new Error('Bid must be at least the starting bid'));
    }
    
    if (this.bids.length > 0 && amount < this.currentBid + this.bidIncrement) {
      return reject(new Error(`Bid must be at least $${this.currentBid + this.bidIncrement}`));
    }
    
    // Add the bid
    this.bids.push({
      bidder: bidderId,
      amount: amount,
      isAutoBid: isAutoBid,
      maxAutoBid: maxAutoBid
    });
    
    this.currentBid = amount;
    
    // Handle auto-extend if enabled
    if (this.settings.autoExtend && this.settings.snipeProtection) {
      const timeRemaining = this.endTime.getTime() - Date.now();
      if (timeRemaining < this.settings.extendTime * 1000) {
        this.endTime = new Date(Date.now() + this.settings.extendTime * 1000);
      }
    }
    
    resolve(this);
  });
};

// Method to end auction
auctionSchema.methods.endAuction = function() {
  this.status = 'ended';
  this.updatedAt = new Date();
  
  if (this.bids.length > 0) {
    const highestBid = this.bids[this.bids.length - 1];
    this.winningBid = {
      bidder: highestBid.bidder,
      amount: highestBid.amount,
      timestamp: highestBid.timestamp
    };
  }
  
  return this.save();
};

// Static method to find active auctions
auctionSchema.statics.findActive = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    startTime: { $lte: now },
    endTime: { $gt: now }
  }).populate('artwork artist');
};

// Static method to find ending soon auctions
auctionSchema.statics.findEndingSoon = function(minutes = 60) {
  const now = new Date();
  const soon = new Date(now.getTime() + minutes * 60 * 1000);
  
  return this.find({
    status: 'active',
    endTime: { $gt: now, $lte: soon }
  }).populate('artwork artist');
};

module.exports = mongoose.model('Auction', auctionSchema);