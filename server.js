// Dependencies
var path = require('path');
var bodyParser = require('body-parser');

// Initialize Express app
var express = require('express');
var app = express();

// Require handlebars
var exphbs = require('express-handlebars');
// Create `ExpressHandlebars` instance with a default layout.
var hbs = exphbs.create({
  defaultLayout: 'main',
  // Specify helpers which are only registered on this instance.
  helpers: {
    addOne: function(value, options){
      return parseInt(value) + 1;
    }
  }
});
// Set up view engine
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

// Require request and cheerio. This makes the scraping possible
var request = require('request');
var cheerio = require('cheerio');

// Require mongoose and mongodb objectid
var mongoose = require('mongoose');
var ObjectId = require('mongojs').ObjectID;

// Database configuration
mongoose.connect('mongodb://localhost/scraper');
var db = mongoose.connection;

// Show any mongoose errors
db.on('error', function(err) {
  console.log('Database Error:', err);
});

// Require our scrapedData and comment models
var ScrapedData = require('./scrapedDataModel');

// Scrape data when app starts
var options = {
  url: 'https://www.nba.com',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.13) Gecko/20080311 Firefox/2.0.0.13'
  }
};
// Make a request for the news section of bodybuilding.com
request(options, function(error, response, html) {
  // Load the html body from request into cheerio
  var $ = cheerio.load(html);
  // For each element with a "new-content-block" class
  $('div.new-content-block').each(function(i, element) {
    // Save the div and a tag
    var $a = $(this).children('a');
    var $div = $(this).children('div');
    // Save the article url
    var articleURL = $a.attr('href');
    // Save the img url of each element
    var imgURL = $a.children('img').attr('src');
    // Save the title text
    var title = $div.children('h2').text();
    // Save the synopsis text
    var synopsis = $div.children('p').text();
    // Create mongoose model
    var scrapedData = new ScrapedData({
      title: title,
      imgURL: imgURL,
      synopsis: synopsis,
      articleURL: articleURL
    });
    // Save data
    scrapedData.save(function(err) {
      if (err) {
        //console.log(err);
      }
      //console.log('Saved');
    });
  });
});

// Express middleware
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(express.static('public'));

// Main route send main page
app.get('/', function(req, res) {
  ScrapedData
    .findOne()
    .exec(function(err,data) {
      if (err) return console.error(err);
      // If successful render first data
      res.render('index', {
        imgURL: data.imgURL,
        title: data.title,
        synopsis: data.synopsis,
        _id: data._id,
        articleURL: data.articleURL,
        comments: data.comments
      });
    })
});

// Retrieve next data from the db
app.get('/next/:id', function(req, res) {
  ScrapedData
    .find({
      _id: {$gt: req.params.id}
    })
    .sort({_id: 1 })
    .limit(1)
    .exec(function(err,data) {
      if (err) return console.error(err);
      res.json(data);
    })
});

// Retrieve prev data from the db
app.get('/prev/:id', function(req, res) {
  ScrapedData
    .find({
      _id: {$lt: req.params.id}
    })
    .sort({_id: -1 })
    .limit(1)
    .exec(function(err,data) {
      if (err) return console.error(err);
      res.json(data);
    })
});

// Add comment data to the db
app.post('/comment/:id', function(req, res) {
  // Update scraped data with comment
  ScrapedData.findByIdAndUpdate(
    req.params.id,
    {$push: {
      comments: {
        text: req.body.comment
      }
    }},
    {upsert: true, new: true},
    function(err, data) {
      if (err) return console.error(err);
      res.json(data.comments);
    }
  );
});

// Remove comment data from the db
app.post('/remove/:id', function(req, res) {
  // Update scraped data and remove comment
  ScrapedData.findByIdAndUpdate(
    req.params.id,
    {$pull: {
      comments: {
        _id: req.body.id
      }
    }},
    {new: true},
    function(err, data) {
      if (err) return console.error(err);
      res.json(data.comments);
    }
  );
});

// Listen on port 3000
app.listen(3000, function() {
  console.log('App running on port 3000!');
});
