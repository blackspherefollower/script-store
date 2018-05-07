const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const csrf = require('csurf');
const session = require('express-session');
const DynamoDBStore = require('dynamodb-store');
const index = require('./routes/index');
const files = require('./routes/files');
const auth = require('./routes/auth');
const assets = require('./assets.json');
const passport = require('passport');
const PassportDiscourse = require('passport-discourse').Strategy;
const multer = require('multer');

const app = express();

// trust proxy headers
app.set('trust proxy', true);

// helmet basic setup
app.use(helmet());

// Common session options
let sessionOptions = {
  name: 'aCookie',
  secret: 'eVaRuaCnYvWBKUbNWxJsUBwCgzzKManPgUoRcjQfysfVtZmDSsLHuekcWNniTCwt',
  cookie: {
    sameSite: true,
    secure: true,
  },
  resave: false,
  saveUninitialized: false,
};

// Redundant path to work on both local and cloud environments
app.use('/static', express.static(path.join(__dirname, '../../.dist/client')));

if (app.get('env') === 'development') {
  // local dynamo session store
  sessionOptions = {
    ...sessionOptions,
    store: new DynamoDBStore({
      table: {
        name: 'local-sessions',
        readCapacityUnits: 10,
        writeCapacityUnits: 10,
      },
      dynamoConfig: {
        accessKeyId: 'local',
        secretAccessKey: 'local',
        region: 'eu-west-2',
        endpoint: 'http://localhost:8000',
      },
      ttl: 600000,
    }),
  };
} else {
  // production session store config
  sessionOptions = {
    ...sessionOptions,
    store: new DynamoDBStore({
      table: {
        name: 'new-sessions',
        readCapacityUnits: 10,
        writeCapacityUnits: 10,
      },
      ttl: 600000,
    }),
  };
}

// session middleware
app.use(session(sessionOptions));

// view engine setup
app.set('views', path.join(__dirname, '../server/views'));
app.set('view engine', 'hbs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const scriptFilter = function (req, file, cb) {
  // accept scripts only
  if (!file.originalname.match(/\.(funscript|osc|json|csv)$/)) {
    cb(new Error('Only haptic scripts are allowed!'), false);
    return;
  }
  // validate them?
  // hapticReader.parse(file);
  cb(null, true);
};

const storage = multer.memoryStorage();
const upload = multer({ storage, fileFilter: scriptFilter });
app.use(upload.single('script'));

// csrf protection
app.use(csrf({ cookie: false }));
app.use((req, res, next) => {
  // make the token avaialble to all render calls
  res.locals.csrfToken = req.csrfToken();
  res.locals.assets = assets;
  next();
});

// security
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, done) => {
  done(null, JSON.stringify(user));
});
passport.deserializeUser((id, done) => {
  done(null, JSON.parse(id));
});
passport.use('discourse', new PassportDiscourse({
  secret: '12345678901234567890',
  discourse_url: 'http://192.168.0.10:4080',
}, (accessToken, refreshToken, profile, done) => {
  done(null, profile);
}));

// route
app.use('/', index);
app.use('/files', files);
app.use('/auth', auth);
app.use(express.Router().get(PassportDiscourse.route_callback, passport.authenticate('discourse', {
  successRedirect: '/auth/done',
  failureRedirect: '/auth/login',
}), (req, res) => { res.failureRedirect('/'); }));

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use((err, req, res) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
