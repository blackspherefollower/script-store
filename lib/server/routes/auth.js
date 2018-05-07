const express = require('express');
const passport = require('passport');

const router = express.Router();

router.get('/discourse_sso', passport.authenticate('discourse'), (req, res) => { res.failureRedirect('/'); });

router.get('/login', (req, res) => { res.send('<a href="/auth/discourse_sso">Login with discourse</a>'); });
router.get('/done', (req, res) => { res.send('<p>Authed!</p>'); });
module.exports = router;
