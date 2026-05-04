const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data.json');

if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify({ users: [], results: [] }, null, 2));
}

function readData() {
  return JSON.parse(fs.readFileSync(filePath));
}

function writeData(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { readData, writeData };
