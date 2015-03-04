var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session')

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
// app.use(express.cookieParser('S3CRE7'));
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}))

app.get('/', function(req, res) {
  if(util.checkUser(req)){
    res.render('index');
    res.end();
  }
  else
    res.redirect('/login');
});

app.get('/create', function(req, res) {
  if(util.checkUser(req)){
    res.render('index');
  }
  else
    res.redirect('/login');
});

app.get('/links', function(req, res) {
  if(util.checkUser(req)){
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
  }
  else
    res.redirect('/login');
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login', function(req, res){
  if(util.checkUser(req)){
    res.redirect('/');
  }
  else
    res.render('login');
});

app.get('/signup', function(req, res){
  if(util.checkUser(req)){
    res.redirect('/');
  }
  else
    res.render('signup');
});

app.post('/login', function(req, res){
  // If the username and password match, create a session ID and redirect user to index
  new User({ username: req.body.username}).fetch().then(function(found) {
      if (found) {
        util.bCryptCompare(req.body.password, found.attributes.password).then(function(match) {
          if(match){
            console.log('Login for user ' + req.body.username + ' successful');
            req.session.user = found;
            res.redirect('/');
          }
          else
            console.log('Login for user ' + req.body.username + ' failed');
            res.end("Bad username or password")
        });
      } else {
        console.log('User: ' + req.body.username + ' not found!');
        res.redirect('/login');
      }
    });
});

app.post('/signup', function(req, res){
  new User({ username: req.body.username}).fetch().then(function(found) {
      if (found) {
        res.writeHead(404);
        res.end("User Exists");
      } else {
        var user = new User({
          username: req.body.username,
          password: req.body.password,
        });

        user.save().then(function(newUser) {
          Users.add(newUser);
          // Add sessionid to user
          req.session.user = newUser;
          res.redirect('/');
        });
      }
    });
});

app.get('/logout', function(req, res){
  console.log('Logging out')
  req.session.user = null;
  res.redirect('/');
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
