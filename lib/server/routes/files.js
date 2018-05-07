const express = require('express');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const ScriptFile = require('../models/fileModel');

const router = express.Router();

function PersistData(req, sha256, isNew, next, complete)
{
  if (isNew) {
    // Check this isn't a duplicate
  }
  ScriptFile.create({
    id: sha256,
    filename: req.file.originalname,
    uploader: req.user.email,
  },
  (err, saved) => {
    if (err) {
      next(err);
      return;
    }
    complete(saved);
  });
}

router.get('/', (req, res, next) => {
  ScriptFile.scan().exec().then((files) => {
    res.write('<html><body>');
    res.write('<ul>');
    files.forEach((f) => {
      res.write(`<li><a href="/files/${f.id}">${f.filename}</a></li>`);
    });
    res.write('</ul>');
    if (req.user) {
      res.write(`<form action="/files" method="post" enctype="multipart/form-data">Select image to upload:<input name="_csrf" value="${req.csrfToken()}" type="hidden"><input name="script" type="file"><input value="Upload Image" name="submit" type="submit"></form>`);
    }
    res.write('</body></html>');
    res.end();
  }).catch((err) => {
    next(err);
  });
});


router.get('/:file', (req, res, next) => {
  const fileId = req.params.file;
  ScriptFile.get({id: fileId}, (err, fileData) => {
    if (err) {
      next(err);
      return;
    }

    if(!fileData.filename) {
      next('Filedata is incomplete!');
      return;
    }

    const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
    const objPromise = s3.getObject({ Bucket: 'script-store', Key: fileId }).promise();
    objPromise.then((data) => {
      res.setHeader('Content-disposition', `attachment; filename=${fileData.filename}`);
      res.setHeader('Content-type', 'text/plain');

      res.send(data.Body);
    }).catch((s3err) => {
      next(s3err);
    });
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
        PersistData(req, sha256, false, next, () => {
          res.send('<p>Success (new script)</p>');
        });
      }).catch((err) => {
        next(err);
      });
    } else {
      // update metadata
      PersistData(req, sha256, false, next, () => {
        res.send('<p>Success (existing script)</p>');
      });
    }
  }).catch((err) => {
    next(err);
  });
});

module.exports = router;
