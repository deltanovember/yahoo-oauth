var express = require('express');
var passport = require('passport');
var cookieParser = require('cookie-parser');
var session = require('express-session')
var YahooStrategy = require('passport-yahoo-oauth').Strategy;
//var request = require('request');

var yahooAPIRequestID = 1;
var strategyOptions = {
    consumerKey: 'dj0yJmk9S29XdlRxSkF4eXliJmQ9WVdrOU9VRTRZV3d3TkRnbWNHbzlNQS0tJnM9Y29uc3VtZXJzZWNyZXQmeD1lYw--',
    consumerSecret: '2eea24d2c9e0c510f677ef649303191b15f82e97',
    callbackURL: 'http://diarybuzz.info/auth/yahoo/callback'
};

var app = express();
app.use(cookieParser());
app.use(session({secret: 'keyboard cat'}));
app.use(passport.initialize());
app.use(passport.session());
app.engine('jade', require('jade').__express);


// Override since passport-yahoo-oauth uses http:// URL which is invalid at
// this moment and drops an error, borrow the code from there if it's needed.
YahooStrategy.prototype.userProfile = function(token, tokenSecret, params, done) {
    done(null, {});
};

// Call Yahoo email web-service API (JSON-RPC)
var yahooAPI = function (strategy, token, tokenSecret, method, params, callback, errCallback) {
    strategy._oauth.post('https://mail.yahooapis.com/ws/mail/v1.1/jsonrpc', token, tokenSecret, JSON.stringify({
        method: method,
        params: [params],
        id: yahooAPIRequestID++
    }), 'application/json', function (err, body, res) {
        if (err && errCallback) {
            errCallback(err, body, res);
        } else if (callback) {
            console.log("****", body);
            callback(JSON.parse(body));
        }
    });
};

// Setup Yahoo strategy, the handler will get user data from Yahoo Email API in
// order to get the default user-email, then it will call ListMessages API to
// get the first 10 messages.
passport.use(new YahooStrategy(strategyOptions, function (token, tokenSecret, profile, done) {
    var strategy = this;

    // Get preferred user email for outgoing messages, this is considered the
    // user email address in this code since this value cannot be retreieved
    // unless private profile access is requested.
    yahooAPI(strategy, token, tokenSecret, 'GetUserData', {}, function (body) {
        var email = body['result']['data']['userSendPref']['defaultID'];

        // NOTE:
        //   Get folders info (fid identifies a folder, we can safelly assume
        //   Inbox folder is defined and directly ask for it, but it's a good
        //   example of API call).
        // yahooAPI(strategy, token, tokenSecret, 'ListFolders', {}, function (body) {
        //     console.log("BODY:", JSON.stringify(body));
        // });

        yahooAPI(strategy, token, tokenSecret, 'ListMessages', {fid: 'Inbox', numInfo: 10}, function (body) {
            // done([
            //     '<h1>Emails for: ' + email + '</h1>',
            //     '<pre>' + JSON.stringify({email: email, data: body}, null, 4) + '</pre>'
            // ].join('\n'));
            done(null, {email: email, token: token, tokenSecret: tokenSecret, data: body});
        });
    });
}));

passport.serializeUser(function(user, done)  { done(null, JSON.stringify(user)); });
passport.deserializeUser(function(obj, done) { done(null, JSON.parse(obj)); });

app.get('/', function (req, res) {
    res.render('index.jade');
});

app.get('/error', function (req, res) {
    res.send('Error');
});

app.get('/home', function (req, res) {
    if (req.user) {
        res.render('inbox.jade', {
            email: req.user['email'],
            data: JSON.stringify(req.user['data'], null, 4)
        });
    } else {
        res.redirect('/');
    }
});

app.get('/auth/yahoo', passport.authenticate('yahoo'));

app.get('/auth/yahoo/callback', passport.authenticate('yahoo', {
    successRedirect: '/home',
    failureRedirect: '/error'
}));

app.listen(80, function () { console.log('Listening on port 80'); });
