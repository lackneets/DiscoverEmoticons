const _ = require('underscore');


function PlurkStorage(plurkAPI, callback){
	var self  =this;
	var mongodb = require('mongodb');
	var mongodbServer = new mongodb.Server('localhost', 27017, { auto_reconnect: true, poolSize: 10 });
	var db = new mongodb.Db('plurkAI04', mongodbServer, {safe: true});
	this.db = db;
	db.open(function(){
		self.db.collection('emoticons').ensureIndex( {user_id: 1, hash: 1}, {unique: true, dropDups: true, background: true}, self.dbErrorHandler )
		//self.db.collection('emoticons_similar').ensureIndex( { hash1: "hashed", hash2: "hashed", }, {unique: true, dropDups: true, background: true}, self.dbErrorHandler )
		self.db.collection('plurks').ensureIndex({plurk_id: 1}, {unique: true, dropDups: true, background: true}, self.dbErrorHandler);
		self.db.collection('users').ensureIndex({id: 1}, {unique: true, dropDups: true, background: true}, self.dbErrorHandler);
		self.db.collection('profile').ensureIndex({id: 1}, {unique: true, dropDups: true, background: true}, self.dbErrorHandler);
		self.db.collection('responses').ensureIndex({id: 1}, {unique: true, dropDups: true, background: true}, self.dbErrorHandler);
		callback && callback();
	});
	this.plurkAPI = plurkAPI;
}

PlurkStorage.prototype.dbErrorHandler = function(err, res){
	if(err){
		console.log(err);
		console.trace();
	}
}


PlurkStorage.prototype.fetchResponses = function(callback){

	var self = this;
	var done = 0;
	var totalRead = 0;
	var today = new Date().getTime();
	var checkPoint = new Date().setDate(new Date().getDate() - 3); // 3 days ago
	self.db.collection('plurks').find({
		$or: [ {responses_load: {$exists: false }}, {responses_load: { $lt: checkPoint }}]
	}).limit(100).toArray(function(err, res) {

		self.dbErrorHandler.apply(this, arguments);

		var total = res.length;
		_.each(res, function(plurk, i){
			setTimeout(function(){
				self.getResponses(plurk.plurk_id, function(responses){
					totalRead += responses.length;
					done++;
					console.log('stored', done, '/', total, ' || ', responses.length, 'of', totalRead);
					self.db.collection('plurks').update({plurk_id: plurk.plurk_id}, {$set: {responses_load: today}}, {safe: true}, self.dbErrorHandler);
					if(done == total){
						console.log('fetchResponses done');
						self.fetchResponses();
					}
				});
			}, i*1);
		})
	});
}
PlurkStorage.prototype.fetchUsers = function(user_id, callback, offset){
	var self = this;
	offset = offset || new Date();
	console.log('fetchUsers', user_id, ' from: ', offset.toISOString());
	self.plurkAPI.api('/APP/Timeline/getPublicPlurks', {user_id: user_id, offset: offset.toISOString(), limit: 30 },  function(error, data, res){

		if(data.length == 0){
			console.log('fetchUsers -- done');
			callback && callback(data.plurks);
		}

		self.storeUsers(data.plurk_users);
		self.storePlurks(data.plurks, function(lastPlurk){
			self.fetchUsers.call(self, user_id, callback, new Date(Date.parse(lastPlurk.posted)))
		});
	});
}


PlurkStorage.prototype.getResponses = function(plurk_id, callback){
	var self = this;

	this.plurkAPI.api('/APP/Responses/get', {plurk_id: plurk_id}, function(err, data){
		if(err){
			console.log('ERROR: /APP/Responses/get', err);
			self.getResponses.call(self, plurk_id, callback);
		}
		var responses 		= data.responses || [];
		var responses_seen 	= data.responses_seen;
		var response_count 	= data.response_count;
		var friends 		= data.friends || [];
		self.storeUsers(data.friends);

		self.storeResponses(responses, function(){
			callback && callback(responses);
		});
	});
}

PlurkStorage.prototype.getProfile = function(user_id, callback){
	var self = this;
	var now = new Date().getTime();

	console.log('getProfile', user_id);
	
	self.db.collection('profile').findOne({id: user_id}, function(err, result){
		if(result){ // we have a result
			console.log('res');
			callback && callback(result)
		}else{ // we don't
			self.plurkAPI.api('/APP/Profile/getPublicProfile', {user_id: user_id}, function(err, data){
				if(err) {
					if(err.data['error_text'].match(/(banned|disabled)/i)){
						var reason = err.data['error_text'];
						console.log(user_id, reason)
						self.db.collection('profile').update({id: id}, {id: user_id, error: reason}, {upsert: 1, safe: 1}, self.dbErrorHandler);
						self.db.collection('users').update({id: id}, {id: user_id, error: reason}, {upsert: 1, safe: 1}, self.dbErrorHandler);
						callback && callback({id: user_id, error: reason});
						return;
					}
					console.log('getProfile ERROR', err);
					self.getProfile.call(self, user_id, callback)
					return;
				}
				var plurks 		= data.plurks;
				var user_info 	= data.user_info;
				var id 			= user_info.id;
				var profile 	= _.omit(data, 'plurks');
				self.db.collection('profile').update({id: id}, profile, {upsert: 1}, function(){
					self.db.collection('users').update({nick_name: profile.nick_name}, user_info, {upsert: 1}, function(){
						callback && callback(profile);
					});
				});
			});
		}
	});
}

PlurkStorage.prototype.storeResponses = function(responses, callback){
	var self = this;
	var done = 0;
	var total = responses.length;
	if(total == 0){
		callback && callback();
	}
	_.each(responses, function(response){
		response.posted_timestamp = Date.parse(response.posted);
		self.db.collection('responses').update({id: response.id}, response, {upsert: 1}, function(){
			self.dbErrorHandler.apply(this, arguments);
			done++;
			if(done == total){
				callback && callback();
			}
		});
	});
}
PlurkStorage.prototype.storePlurks = function(plurks, callback, colName){

	colName = colName || 'plurks';
	this.db.collection(colName).ensureIndex({plurk_id: 1}, {unique: true, dropDups: true, background: true}, this.dbErrorHandler);

	var self = this;
	var done = 0;
	var lastTimestamp = new Date().getTime();
	var lastPlurk;
	_.each(plurks, function(plurk){
		plurk.posted_timestamp = Date.parse(plurk.posted);
		if(plurk.posted_timestamp < lastTimestamp){
			lastPlurk = plurk;
		}
		self.db.collection(colName).remove({plurk_id: plurk.plurk_id}, function(){
			self.dbErrorHandler.apply(this, arguments);
			self.db.collection(colName).insert(plurk, self.dbErrorHandler);
			done++;
			if(done == plurks.length){
				callback && callback(lastPlurk);
			}
		});
	});
}

PlurkStorage.prototype.storeUsers = function(users, callback){
	var self = this;
	var done = 0;
	_.each(users, function(user){
		self.db.collection('users').update({nick_name: user.nick_name}, user, {upsert: 1}, function(){
			self.dbErrorHandler.apply(this, arguments);
			done++;
			if(done == users.length){
				callback && callback();
			}
		});
	});
}


PlurkStorage.prototype.findPlurk = function(query, callback){
	var self = this;
	self.db.collection('plurks').find({content_raw: new RegExp(query, 'i') }).sort({posted_timestamp: -1}).toArray(function(err, res) {
		self.dbErrorHandler.apply(this, arguments);
		callback && callback(res);
	});
}
PlurkStorage.prototype.findUserPlurk = function(query, user_id, callback){
	var self = this;
	self.db.collection('plurks').find({content_raw: new RegExp(query, 'i'), user_id: user_id }).sort({posted_timestamp: -1}).toArray(function(err, res) {
		self.dbErrorHandler.apply(this, arguments);
		callback && callback(res);
	});
}

module.exports = PlurkStorage;