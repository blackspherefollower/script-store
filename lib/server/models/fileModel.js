const dynamoose = require('dynamoose');

dynamoose.AWS.config.update({
  region: 'eu-west-1',
});
dynamoose.local('http://localhost:8000');

const ScriptFile = dynamoose.model('ScriptFile', {
  id: String, // sha256 of file content
  filename: String, // original filename
  name: String, // pretty name
  author: String, // author
  uploader: String, // author
  uploadDate: Date,
  version: Number, // version (starts at 1)
  previous: String, // id for previous version (only uploader may replace a script with a newer version)
});

module.exports = ScriptFile;
