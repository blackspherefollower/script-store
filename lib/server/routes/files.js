const express = require('express');
const AWS = require('aws-sdk');
const crypto = require('crypto');

const router = express.Router();

router.get('/', (req, res, next) => {
  if (!req.user) {
    // must have had user data first
    next('No user set!');
    return;
  }

  const s3 = new AWS.S3({ apiVersion: '2006-03-01' });

  const objPromise = s3.listObjects({ Bucket: 'script-store' }).promise();
  objPromise.then((data) => {
    let str = '<ul>';
    console.log('Success', data);
    data.Contents.forEach((d) => { str += `<li>${d.Key}</li>`; });
    str += '</ul>';

    str += `<form action="/files" method="post" enctype="multipart/form-data">Select image to upload:<input name="_csrf" value="${req.csrfToken()}" type="hidden"><input name="script" type="file"><input value="Upload Image" name="submit" type="submit"></form>`;

    res.send(str);
  }).catch((err) => {
    next(err);
  });
});

router.post('/', (req, res, next) => {
  if (!req.user) {
    // must have had user data first
    next('No user set!');
    return;
  }

  const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

  const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
  const objPromise = s3.listObjects({ Bucket: 'script-store' }).promise();
  objPromise.then((data) => {
    const exists = data.Contents.find(d => d.Key === sha256);

    if (!exists) {
      const upPromise = s3.putObject({ Bucket: 'script-store', Key: sha256, Body: req.file.buffer }).promise();
      upPromise.then(() => {
        // update metadata

        res.send('<p>Success</p>');
      }).catch((err) => {
        next(err);
      });
    } else {
      // update metadata
      res.send('<p>Success</p>');
    }
  }).catch((err) => {
    next(err);
  });
});

module.exports = router;
