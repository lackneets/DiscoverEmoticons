const http 		= require('http');
const redis 	= require('redis')
const oauth 	= require('oauth')
const fs 		= require('node-fs');

function AuthStorage(bin){
	bin = bin || '';
	this.path = this.path + bin;
	if(fs.existsSync(this.path) && fs.statSync(this.path).isDirectory()){
		this.token 	= fs.existsSync(this.path + 'oauth_access_token.txt') && fs.readFileSync(this.path + 'oauth_access_token.txt', 'utf8');
		this.secret = fs.existsSync(this.path + 'oauth_access_secret.txt') && fs.readFileSync(this.path + 'oauth_access_secret.txt', 'utf8');
	}else{
		fs.mkdirSync(this.path, 0777, true);
	}
}
AuthStorage.prototype.path = './auth_storage/';
AuthStorage.prototype.setToken = function(token){
	this.token = token;
	fs.writeFileSync(this.path + 'oauth_access_token.txt', token, 'utf8');
}
AuthStorage.prototype.setSecret = function(secret){
	this.secret = secret;
	fs.writeFileSync(this.path + 'oauth_access_secret.txt', secret, 'utf8');
}

function PlurkAPI(bin){

	this.bin = bin;
	this.url = 'http://www.plurk.com/';
	this.init();

}
PlurkAPI.prototype.init = function(){

	this.auth = new AuthStorage(this.bin);
	this.oauth  = new oauth.OAuth(
		'http://www.plurk.com/OAuth/request_token',
		'http://www.plurk.com/OAuth/access_token',
		'zWnvjjvGU7T3',
		'mB4TkDToyqvlnWtQ08SfDr7Z9sw4AVCK',
		/*'67UutfobbJVV',
		'HvGlRn0yDAJ5KEpOxNurpABEzuunpKjU',*/
		'1.0',
		null,
		'HMAC-SHA1');
}
PlurkAPI.prototype.boostOAuth = function(){
	var oa  = new oauth.OAuth(
		'http://www.plurk.com/OAuth/request_token',
		'http://www.plurk.com/OAuth/access_token',
		'zWnvjjvGU7T3',
		'mB4TkDToyqvlnWtQ08SfDr7Z9sw4AVCK',
		/*'67UutfobbJVV',
		'HvGlRn0yDAJ5KEpOxNurpABEzuunpKjU',*/
		'1.0',
		null,
		'HMAC-SHA1');
	return oa;
}
PlurkAPI.prototype.request = function(path, params, callback) {
	var self = this;
	if(!self.auth.token) {
		console.log('Please authorize first');
		return false;
	}
	self.oauth.post('http://www.plurk.com' + path,
		self.auth.token,
		self.auth.secret,
		params,
		'application/json',
		function(error, data, response){
			if(error){
				try{
					error.data = JSON.parse(error.data);
				}catch(e){
					error.data = {};
				}
			}
			try{
				data = JSON.parse(data);
			}catch(e){
				data = {};
			}
			callback && callback.apply(this, [error, data, response]);
		}
	);	
}
PlurkAPI.prototype.authorize = function(callback) {
	var self = this;
	
	if(! self.auth.token ){
		self.oauth.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
			if(error) console.log(error);

			require('open')('https://www.plurk.com/OAuth/authorize?oauth_token=' + oauth_token);
			console.log('https://www.plurk.com/OAuth/authorize?oauth_token=' + oauth_token);

			askCommandLine('Please enter the verification code: ', /[\w\d]+/, function(verifier) {
				self.oauth.getOAuthAccessToken(oauth_token, oauth_token_secret, verifier, function(error, access_token, access_token_secret, results){
					if(error){
						console.log(error);
					}else{
						self.auth.setToken(access_token);
						self.auth.setSecret(access_token_secret);
						//request();
						callback && callback();
					}
				});

			});
		});
	}else{
		callback && callback();
		//request();
	}
}

PlurkAPI.prototype.api = function(path, params, callback) {
	//console.log('calling ' + path);
	this.request(path, params, callback);
}

var askCommandLine = function (question, format, callback) {
    var stdin = process.stdin;
    var stdout = process.stdout;

    stdin.resume();
    stdout.write(question);

    stdin.once('data', function(data) {
      data = data.toString().trim();

      if (format.test(data)) {
        callback(data);
      } else {
        stdout.write("It should match: "+ format +"\n");
        this(question, format, callback);
      }
    });
};

module.exports = PlurkAPI;