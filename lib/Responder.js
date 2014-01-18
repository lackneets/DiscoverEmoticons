const _ = require('underscore');

function Responder(plurkAPI, owner){
	this.plurkAPI = plurkAPI;
	this.owner = owner;
}
Responder.prototype.read = function(plurk){

	var self = this;

	if(plurk instanceof Array){
		_.each(plurk, function(p){
			self.read(p);
		})
		return;
	}

	console.log('read', plurk.content_raw);

	var matches;
	if(matches = this.match('(.+)を検索して', plurk.content_raw)){
		(function(matches){
			self.owner.storage.getResponses(plurk.plurk_id, function(responses){
				var responded = _.findWhere(responses, {user_id: self.owner.user_id});
				console.log(matches)
				if(! responded ){
					self.owner.storage.findPlurk(matches[1], function(results){
						var res = _.map(results, function(result){
							return get_permalink(result.plurk_id) +' (' + (result.content.replace(/<(?:.|\n)*?>/gm, '')).substr(0, 60) + ')'
						})
						if(res.length > 10) res.length = 15;
						self.addResponses(plurk.plurk_id, res, function(){
							console.log('done++');
						});
					});
				}
			});
		})(matches);
	}

	if(matches = this.match('回噗統計', plurk.content_raw)){
		(function(matches){

			self.owner.storage.getResponses(plurk.plurk_id, function(responses){
				var responded = _.findWhere(responses, {user_id: self.owner.user_id});
				if(! responded ){

					self.addResponses(plurk.plurk_id, ['好的，等我一下~'], function(){
						console.log('done');
					})
					console.log('calc', plurk.user_id, plurk.owner_id);
					self.owner.calcFriendsRand(plurk.owner_id, function(rank){
						rank = _.map(rank, function(r, i){
							return '#' + (i+1) +' http://avatars.plurk.com/'+r.id+'-big'+r.avatar+'.jpg http://www.plurk.com/' + r.nick_name + ' (' +r.display_name +') ';
						})
						//response.json(rank)
						self.addResponses(plurk.plurk_id, rank, function(){
							console.log('done++');
						});
					});

				}
			});

		})(matches);
	}
	
	if(matches = this.match('ひろみ.*笨蛋', plurk.content_raw)){
		//console.log(matches[1]);
		self.owner.storage.getResponses(plurk.plurk_id, function(responses){
			var responded = _.findWhere(responses, {user_id: self.owner.user_id});
			if(! responded ){
				self.addResponses(plurk.plurk_id, ['http://emos.plurk.com/cc1ec911d43e401715710dc7d4214fd7_w48_h48.gif http://emos.plurk.com/cc1ec911d43e401715710dc7d4214fd7_w48_h48.gif http://emos.plurk.com/cc1ec911d43e401715710dc7d4214fd7_w48_h48.gif'], function(){
					console.log('done+++');
				});
			}
		});
	}


	if(matches = this.match('如果(噗主)是', plurk.content_raw)){
		//console.log(matches[1]);
		self.owner.storage.getResponses(plurk.plurk_id, function(responses){
			var responded = _.findWhere(responses, {user_id: self.owner.user_id});
			if(! responded ){
				self.addResponses(plurk.plurk_id, ['博士是豬'], function(){
					console.log('done+');
				});
			}
		});
	}
}

Responder.prototype.addResponses = function(plurk_id, responseArray, callback){

	var self = this;
	var done = 0;

	console.log('addResponses', responseArray);

	_.each(responseArray, function(content, i){
		setTimeout(function(){
			self.plurkAPI.api('/APP/Responses/responseAdd', {plurk_id: plurk_id, content: content, qualifier: 'says'}, function(err, data){
				if(err){
					console.log('responseAdd ERROR', err);
				}
				done++;
				if(done == responseArray.length){
					callback && callback();
				}
			});
		}, i*1200);
	});

}

Responder.prototype.getResponse = function(plurk_id, callback){

	this.plurkAPI.api('/APP/Responses/get', {plurk_id: plurk_id}, function(err, data){

		var responses 		= data.responses;
		var responses_seen 	= data.responses_seen;
		var response_count 	= data.response_count;
		var friends 		= data.friends;

		callback && callback(responses);
	});
}

Responder.prototype.match = function(regStr, content){
	var reg = new RegExp(regStr, 'i');
	var matches = reg.exec(content);
	return matches;
}

module.exports = Responder;