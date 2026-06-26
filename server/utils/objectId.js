const mongoose = require('mongoose');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

module.exports = { isValidObjectId };
