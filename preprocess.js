const DiscoverEmoticons = require('./lib/DiscoverEmoticons');

var server = new DiscoverEmoticons(function(){
	this.preprocess();
}, __dirname);