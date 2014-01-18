const PlurkAPI 	= require('./lib/PlurkAPI.js');
const Responder = require('./lib/Responder.js');
const Robotlist = require('./lib/Robotlist.js');

const PlurkStorage = require('./lib/PlurkStorage.js');

const _ 		= require('underscore');
const express 	= require('express');
const path 		= require('path');


const KarmaPolice = require('./KarmaPolice');



function Hiromi(){
	var self = this;
	this.plurkAPI = new PlurkAPI();
	this.responder = new Responder(this.plurkAPI, this);

	this.plurkAPI.authorize(function(){
		self.whoAmI();
		self.storage = new PlurkStorage(self.plurkAPI);
		self.startWebConsole();
		self.watchTimeline();
		setInterval(function(){
			self.watchTimeline.call(self);
		}, 5000);


		self.storage.fetchUsers(5835365, function(){
			console.log('fetchUsers next');
		})		
		self.storage.fetchResponses();
	});



	this.robotlist = new Robotlist();
}

Hiromi.prototype.start = function(){

}
Hiromi.prototype.whoAmI = function(){
	var self = this;
	this.plurkAPI.api('/APP/Users/me', null, function(error, data){

		self.user_id = data.id;
		console.log("私は ", data.display_name," です");
	})
}

Hiromi.prototype.watchTimeline = function(){
	var self = this;
	self.lastWatchedTime = self.lastWatchedTime ||  new Date(new Date() -86400*1000);

	console.log('read after', self.lastWatchedTime.toISOString());

	self.plurkAPI.api('/APP/Polling/getPlurks', {offset: self.lastWatchedTime.toISOString()},  function(error, data, res){


		self.storage.storeUsers(data.plurk_users);
		self.storage.storePlurks(data.plurks);

		if(data.plurks){
			self.responder.read(data.plurks);

			var newPost;
			if(data.plurks.length && (newPost = _.max(data.plurks, function(plurk){ return plurk.posted_timestamp; }))){
				self.lastWatchedTime = new Date(newPost.posted_timestamp);
			}			
		}


	});
}
Hiromi.prototype.calcFriendsRand = function(user_id, callback){
	var self = this;
	var t = new Date();
	var nin = self.robotlist.ids();
	nin.push(user_id);
	nin.push(self.user_id);

	var before = new Date().setDate(new Date().getDate()-30);

	self.storage.db.collection('plurks').find({owner_id: user_id, posted_timestamp: {$gt: before }}, {posted_timestamp:1, plurk_id: 1}).sort({posted_timestamp: -1}).toArray(function(err, plurks) {
		console.log('Consumed', (new Date() - t)/1000 , '/s');
		var pids = _.pluck(plurks, 'plurk_id');

		self.storage.db.collection('responses').aggregate([
			{$match:  {$and: [{plurk_id: {$in: pids}}, {user_id: {$nin: nin }}]}},
			{$group: {_id: '$user_id', total: {$sum: 1}}}, 
			{$sort: {total: -1}},
			{$limit: 10}
		], function(err, friendsRank) {

			console.log('Consumed', (new Date() - t)/1000 , '/s');
			var uids = _.pluck(friendsRank, '_id');
			self.storage.db.collection('users').find({uid: {$in: uids}}).toArray(function(err, users) {
				var unknow = [];
				var unknowRead = 0;
				friendsRank = _.map(friendsRank, function(fr){
					fr = _.extend(fr, _.findWhere(users, {uid: fr._id}));
					if(! fr.nick_name ) unknow.push(fr._id);
					return fr;
				});

				console.log('Consumed', (new Date() - t)/1000 , '/s');

				if(unknow.length == 0) callback && callback(friendsRank);
				
				_.each(unknow, function(user_id){
					self.storage.getProfile(user_id, function(profile){
						friendsRank = _.map(friendsRank, function(fr){
							if(fr._id == user_id) fr = _.extend(fr, profile.user_info);
							return fr;
						});
						unknowRead++;
						if(unknowRead == unknow.length){
							//response.json(friendsRank);
							callback && callback(friendsRank);
							console.log('Consumed', (new Date() - t)/1000 , '/s');
						}
					})
				});

			});
		});	

	});	
}
Hiromi.prototype.startWebConsole = function(){
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

	webConsole.get('/q/:query', function(request, response){
		self.storage.findPlurk(request.params.query, function(results){
			response.json(results);
		});
	});


	webConsole.get('/friends', function(request, response){
		self.calcFriendsRand(5020913, function(rank){
			rank = _.map(rank, function(r, i){
				return '#' + (i+1) +' http://avatars.plurk.com/'+r.id+'-medium'+r.avatar+'.gif http://www.plurk.com/' + r.nick_name + ' (' +r.display_name +') ';
			})
			response.json(rank)
		})
	});	

	webConsole.get('/stat', function(request, response){

		self.storage.db.collection('plurks').find({}).sort({posted: 1}).limit(5).toArray(function(err, res) {
			response.json(res)

		});

		self.storage.db.collection('plurks').find({}).count(function(e, count){ 
			console.log('++', count + ' plurks')
		});
	});

	webConsole.get('/fetchResponses', function(request, response){

		self.storage.fetchResponses(function(res){
			response.json(res)
		});

	});
	webConsole.listen(7777);
	console.log('webConsole is ready at 7777');
}

function get_permalink($plurk_id)
{
    return "http://www.plurk.com/p/" + base_convert($plurk_id, 10, 36);
}

function base_convert(number, frombase, tobase) {
  return parseInt(number + '', frombase | 0).toString(tobase | 0);
}


new KarmaPolice();
//new Hiromi();