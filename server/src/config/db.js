const mongoose = require('mongoose');

async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log(`[db] connected -> ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = { connectDB };
