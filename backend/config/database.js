const mongoose = require('mongoose');
const dns = require('dns');

// Fix for Node.js querySrv ECONNREFUSED when resolving MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Ignore if custom DNS cannot be set
}

const connectDB = async () => {
  try {
    if (process.env.USE_LOCAL_JSON_DB === 'true') {
      throw new Error('Explicitly configured to use Local JSON Database via USE_LOCAL_JSON_DB environment variable.');
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hack-the-exit', {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    global.useLocalJsonDb = false;
  } catch (error) {
    console.warn(`\n[DATABASE WARNING] Could not connect to MongoDB: ${error.message}`);
    console.warn(`[DATABASE INFO] Falling back to LOCAL OFFLINE JSON DATABASE. (Data will be stored in backend/data/)`);
    console.warn(`[DATABASE INFO] Network is NOT required. MongoDB Atlas / Local MongoDB is NOT required.\n`);
    global.useLocalJsonDb = true;
  }
};

module.exports = connectDB;
