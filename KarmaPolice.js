const _ = require('underscore');
const PlurkAPI = require('./lib/PlurkAPI.js');
const PlurkStorage = require('./lib/PlurkStorage.js');
const Responder = require('./lib/Responder.js');
const Robotlist = require('./lib/Robotlist.js');

const path 	= require('path');
const express = require('express');


function findKeywords(plurkData){
	var RegExBrackets = /(\[[^\]]+\])/g ;
	var RegExEmosUrl = /http:\/\/emos\.plurk\.com\/[0-9a-f]{32}_w\d+_h\d+\.\w+/g;
	var RegExEmosHash = /[0-9a-f]{32}/g;

	//去掉直接輸出的emo
	var rawEmoticonUrls = plurkData.content_raw.match(RegExEmosUrl);
	for(var i in rawEmoticonUrls){
		console.log('raw', rawEmoticonUrls[i]);
		plurkData.content_raw = plurkData.content_raw.replace(rawEmoticonUrls[i], '');
		plurkData.content = plurkData.content.replace(rawEmoticonUrls[i], '');
	}

	var emos = plurkData.content.match(RegExEmosUrl);
	var brackets = plurkData.content_raw.match(RegExBrackets);
	var nonConvertedBrackets = plurkData.content.match(RegExBrackets);
	

	var arr = [];

	for(var i in nonConvertedBrackets){
		if(!brackets) break;
		var index = brackets.indexOf(nonConvertedBrackets[i]);
		if(index > -1) brackets.splice(index, 1);
	}
	for(var i in emos){
		if(!brackets) break;
		var hash = emos[i].match(RegExEmosHash)[0];
		//arr[emos[i]] = "emos" && brackets[i] && brackets[i].replace(/^\[/, '').replace(/\]$/, '');
		arr.push({
			hash: hash, 
			url: emos[i], 
			keyword: brackets[i] && brackets[i].replace(/^\[/, '').replace(/\]$/, ''),
			user_id: plurkData.user_id,
			plurk_id: plurkData.plurk_id
		});
	}
	
	return arr;
}


function KarmaPolice(){
	var self = this;
	this.plurkAPI = new PlurkAPI('KarmaPolice');
	this.responder = new Responder(this.plurkAPI, this);

	this.robotlist = new Robotlist();
}

KarmaPolice.prototype.mine = function(){
	var self = this;

	this.plurkAPI.authorize(function(){
		self.whoAmI();
		self.storage = new PlurkStorage(self.plurkAPI);
		//self.startWebConsole();
		self.watchTimeline();
		setInterval(function(){
			self.watchTimeline.call(self);
		}, 500);
	});
}

KarmaPolice.prototype.whoAmI = function(){
	var self = this;
	this.plurkAPI.api('/APP/Users/me', null, function(error, data){
		self.user_id = data.id;
		console.log("私は ", data.display_name," です");
	})
}

KarmaPolice.prototype.watchTimeline = function(){
	var self = this;
	self.lastWatchedTime = self.lastWatchedTime ||  new Date(new Date() -86400*1000);

	//console.log('read after', self.lastWatchedTime.toISOString());

	/*console.log(findKeywords({
		content_raw : 'xxx http://emos.plurk.com/59096175e942541a0bd313ef75b948f2_w48_h15.bmp [測試]xxxx[e01]',
		content: 'xxx http://emos.plurk.com/59096175e942541a0bd313ef75b948f2_w48_h15.bmp [測試]xxxx http://emos.plurk.com/59096175e942541a0bd313ef75b948f2_w48_h15.bmp'
	}))
*/

	self.plurkAPI.api('/APP/Polling/getPlurks', {
		offset: self.lastWatchedTime.toISOString(),
		limit: 30,
	},  function(error, data, res){

		self.storage.storeUsers(data.plurk_users);
		self.storage.storePlurks(data.plurks, null, 'stream');

		if(data.plurks){
			//self.responder.read(data.plurks);
			_.each(data.plurks, function(plurk){
				//console.log(' → ', plurk.content_raw.replace(/[\n\r]+/g, ' '));
				var emoticons = findKeywords(plurk);
				if( Object.keys(emoticons).length ){
					console.log(findKeywords(plurk));

					_.each(emoticons, function(emo){
						self.storage.db.collection('emoticons').update({hash: emo.hash, plurk_id: emo.plurk_id}, emo, {upsert: 1}, function(){
							//self.dbErrorHandler.apply(this, arguments);
						});
					});
				} 
			});

			var newPost;
			if(data.plurks.length && (newPost = _.max(data.plurks, function(plurk){ return plurk.posted_timestamp; }))){
				self.lastWatchedTime = new Date(newPost.posted_timestamp);
			}			
		}
	});

}

KarmaPolice.prototype.startWebConsole = function(){
	var self = this;
	var webConsole = express();
	webConsole.configure(function(){
		webConsole.locals.pretty = true;
		webConsole.use(express.compress());
		webConsole.use(webConsole.router);
		webConsole.set('views', __dirname + '/views');
		webConsole.set('view engine', 'jade');
		webConsole.set('view options', {
			pretty: true
		});
		webConsole.use(express.static(path.join(__dirname, 'public')));
	});

	this.webConsole = webConsole;

	webConsole.get('/e', function(request, response){

		var t = new Date();
		self.storage.db.collection('emoticons').aggregate([
			{$match:  {user_id : {$ne: 5020913 }}},
			//{$key: { url: 1 }},
			{$group: {
				_id: '$hash', 
				url: { $addToSet: "$url" }, 
				keywords: {$push: "$keyword"},
				count: {$sum: 1}
			}}, 
			{$sort: {count: -1}},
			//{$limit: 10}
			], function(err, emoticons) {
				//console.log(emoticons)
				console.log('data loaded in ', (new Date() - t), 'ms');
				response.render('keywords', {emoticons: emoticons})
			});	
	});
	
	

	webConsole.get('/resp', function(request, response){

		doParse2(function(){
			response.end('done!');
		}, response);

	});

	webConsole.get('/more', function(request, response){

		doParse(function(){
			response.end('done!');
		}, response);

	});
	webConsole.get('/q/:query', function(request, response){
		/*self.storage.findPlurk(request.params.query, function(results){
			response.json(results);
		});*/

	});

	var cursorID = 0;
	function doParse(callback, response){
		self.storage.db.collection('plurks').find({plurk_id: {$gt: cursorID }}).sort({plurk_id: 1}).limit(100).toArray(function(err, plurks) {
			cursorID = _.max(plurks, function(p){return p.plurk_id; }).plurk_id;

			var emoticonsTotal = 0;
			_.each(plurks, function(plurk){
				var emoticons = findKeywords(plurk);
				if( Object.keys(emoticons).length ){
					//console.log(findKeywords(plurk));
					_.each(emoticons, function(emo){
						self.storage.db.collection('emoticons').update({hash: emo.hash, plurk_id: emo.plurk_id}, emo, {upsert: 1}, function(){
							emoticonsTotal++;
						});
						emoticonsTotal++;
					});
				} 
			});

			//response.json(plurks);
			if(plurks.length){
				response && response.writeContinue('processing... ('+emoticonsTotal+' emos stored)<br/>')
				console.log('processing... ('+emoticonsTotal+' emos stored)', plurks.length);
				doParse(callback, response);

			}else{
				callback && callback();
			}
		});
	}

	var cursorID2 = 0;
	function doParse2(callback, response){
		self.storage.db.collection('responses').find({id: {$gt: cursorID2 }}).sort({id: 1}).limit(100).toArray(function(err, responses) {
			cursorID2 = _.max(responses, function(p){return p.id; }).id;

			var emoticonsTotal = 0;
			_.each(responses, function(resp){
				var emoticons = findKeywords(resp);
				if( Object.keys(emoticons).length ){
					//console.log(findKeywords(resp));
					_.each(emoticons, function(emo){
						self.storage.db.collection('emoticons').update({hash: emo.hash, plurk_id: emo.plurk_id}, emo, {upsert: 1}, function(){
							emoticonsTotal++;
						});
						emoticonsTotal++;
					});
				} 
			});

			//response.json(plurks);
			if(responses.length){
				response && response.writeContinue('+processing... ('+emoticonsTotal+' emos stored)<br/>')
				console.log('+processing... ('+emoticonsTotal+' emos stored)', responses.length);
				doParse2(callback, response);

			}else{
				callback && callback();
			}
		});
	}

	webConsole.listen(3333);
	console.log('webConsole is ready at 3333');
}

function get_permalink($plurk_id)
{
    return "http://www.plurk.com/p/" + base_convert($plurk_id, 10, 36);
}

function base_convert(number, frombase, tobase) {
  return parseInt(number + '', frombase | 0).toString(tobase | 0);
}


module.exports = KarmaPolice;