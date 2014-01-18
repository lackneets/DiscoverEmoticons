const _ 		= require('underscore');
const express 	= require('express');

const path 		= require('path');
const fs 		= require('fs');

try {
    const gc 		= require('gc');
} catch(e) {
    console.log('gc not installed');
}

//const PlurkStorage = require('./lib/PlurkStorage');
const KarmaPolice = require('./KarmaPolice');

const Segment 		= require('node-segment').Segment;
const POSTAG 		= require('node-segment').POSTAG; 

const Apriori 		= require('./lib/Apriori');
const natural 		= require('natural');
const TfIdf 		= natural.TfIdf;


Segment.prototype.destroy = function(){
	for(var i in this) delete this[i];
	if(typeof gc == 'function') gc();
	delete this;
}




console.log('Segmenter ready');
console.log('MemoryUsage: ', _.map(process.memoryUsage(), function(v, k){ return require('filesize')(v) ;}).join(', '));

//segment.destroy();


var karma = new KarmaPolice();

var emoticons = {};
//var popular = {};
//var terms = {};

var association = new Apriori();
var tfidf = new TfIdf();

setInterval(function(){
	console.log('MemoryUsage: ', _.map(process.memoryUsage(), function(v, k){ return require('filesize')(v) ;}).join(', '));
}, 10000)

const PlurkAPI 		= require('./lib/PlurkAPI');
const PlurkStorage 	= require('./lib/PlurkStorage');

const FPTree 		= require('./fptree');

function DiscoverEmoticons(){
	var self = this;
	this.plurkAPI = new PlurkAPI('DiscoverEmoticons');
	this.storage = new PlurkStorage(this.plurkAPI, function(){ // 連線到 DB
		self.parseTerms();
		/*self.preprocess(function(){
			self.startWebConsole();
		});*/
	});

	this.emoticons 		= {};
	this.association 	= new Apriori();
	this.tfidf 			= new TfIdf();
	this.learnedTerms 	= [];

	/*this.plurkAPI.authorize(function(){

	})*/
	
}
/*DiscoverEmoticons.prototype.naturalSegment  = function(str){ 
	if(str.match(/[\s\t\n\r]+/)){
		return 
	}
}*/
DiscoverEmoticons.prototype.parseTerms  = function(callback){ 
	var self = this, t = new Date();

	console.log('parseTerms');
	self.loadEmoticons(function(emoticons){

		var fpTree = new FPTree();
		var file = fs.openSync('parse.txt', 'w+');

		_.each(emoticons, function(emo){

			_.each(emo.keywords, function(keyword){
				if(! _.isString(keyword) ) return; 

				keyword = keyword.replace(/[\_\,]/, ' ');

				fs.writeSync(file, '============ ' + keyword + '==============\n');

				fpTree.insert(keyword, file);

				/*for(var i = 2; i <= keyword.length ; i++){
					//fpTree.insert(keyword.substring(i).split(''));
					//fs.writeSync(file, keyword.substring(i) + '\n');
					var ng = natural.NGrams.ngrams(keyword.split(''), i);
					fs.writeSync(file, JSON.stringify(ng) + '\n');
					_.each(ng, function(g){
						fpTree.insert(g);
					})
					//fpTree.insert(keyword.substring(i).split(''));
					//natural.NGrams.ngrams(keyword, i);
				}*/

			});
		});

		self.learnedTerms = fpTree.prediction(0.1);
		fs.writeFileSync('learnedTerms2.txt', self.learnedTerms.join('\n'));
		fs.writeFileSync('tree.txt', JSON.stringify(fpTree.trace(), null, 1));

		console.log(' - new terms learned in ', (new Date - t), 'ms', '(', self.learnedTerms.length, 'terms)');

		callback && callback();

	}); // end loadEmoticons
}
DiscoverEmoticons.prototype.preprocess  = function(callback){ 
	var self = this, t = new Date();

	console.log('loadEmoticons');
	self.loadEmoticons(function(emoticons){

		
		var fpTree = new FPTree();
		var segmenter = new Segment();

		//segment.useDefault();
		segmenter
			.use('URLTokenizer')            // URL识别
			.use('WildcardTokenizer')       // 通配符，必须在标点符号识别之前
			.use('PunctuationTokenizer')    // 标点符号识别
			.use('ForeignTokenizer')        // 外文字符、数字识别，必须在标点符号识别之后
			// 中文单词识别
			.use('DictTokenizer')           // 词典识别
			.use('ChsNameTokenizer')        // 人名识别，建议在词典识别之后
			// 优化模块
			.use('EmailOptimizer')          // 邮箱地址识别
			.use('ChsNameOptimizer')        // 人名识别优化
			.use('DictOptimizer')           // 词典识别优化
			.use('DatetimeOptimizer')       // 日期时间识别优化
			// 字典文件
			.loadDict('names.txt')          // 常见名词、人名
			.loadDict('wildcard.txt', 'WILDCARD', true)   // 通配符
			// .loadDict('dict.txt')
			// .loadDict('dict2.txt')
			// .loadDict('dict_tw.txt')
			// .loadDict('tw2.txt');

			console.log('MemoryUsage: ', _.map(process.memoryUsage(), function(v, k){ return require('filesize')(v) ;}).join(', '));

		_.each(emoticons, function(emo){

			emo.terms = emo.terms || []; //一個裝所有被拆開的詞彙容器

			_.each(emo.keywords, function(keyword){
				if(! _.isString(keyword) ) return; 

				keyword = keyword.replace(/[\_\,]/, ' ');

				var parsedTerms = _.reject(segmenter.doSegment(keyword), function(term){
					return term.p == POSTAG.D_W || term.p == POSTAG.URL || term.p == POSTAG.D_W || term.p == POSTAG.A_M || term.w == '_' || term.w == ' '|| term.w == '　'|| term.w == 'イモティコン'|| term.w == 'emo'|| term.w == '表'|| term.w == '情';
				});

				for(var i = 0; i < keyword.length ; i++){
					console.log(keyword.substring(i).split(''));
				}



				//插入 FP tree
				fpTree.insert(_.pluck(parsedTerms, 'w'));

			});
		});
		self.learnedTerms = fpTree.prediction(0.3);
		fs.writeFileSync('learnedTerms.txt', self.learnedTerms.join('\n'));


		console.log(' - new terms learned in ', (new Date - t), 'ms', '(', self.learnedTerms.length, 'terms)');
		t = new Date();

	
		_.each(emoticons, function(emo){

			self.emoticons[emo.hash] = emo;

			var emoTerms = [];

			_.each(emo.keywords, function(keyword){
				if(! _.isString(keyword) ) return;

				keyword = keyword.replace(/[_]/, ' ');

				//挑出已知的詞彙
				_.each(self.learnedTerms, function(term){
					if(keyword.match(term)){
						keyword = keyword.replace(term, ' ');
						emoTerms.push(term);
						//console.log('match', term);
					}
				})

				var parsedTerms = segmenter.doSegment(keyword);
				parsedTerms = _.reject(parsedTerms, function(term){
					var blacklist = [ POSTAG.D_W , POSTAG.URL, POSTAG.D_W, POSTAG.A_M, '_', ' ', '　', 'イモティコン', 'emo', '表','情', '符', '表情', '表符', 'Emoticon']
					return _.contains(blacklist, term.w) || term.w.match(/[笑哈哭]|haha|xd/i) || term.w.match(/^[A-Za-z\[\]\\\,\^\/\_\(\)\?\!\$\-\=\<\>\#\@\~\.\*\ˊˋ！～？［］（)《》]{1}$/) || term.w.match(/^\d+$/)
				});

				emoTerms = emoTerms.concat(_.pluck(parsedTerms, 'w'))


			});

			emo.terms = emoTerms;

			self.tfidf.addDocument(emoTerms, emo.hash)
			self.association.addCollection(emoTerms);


		});

		
		segmenter.destroy();

		console.log(' - keyword parsed in', (new Date - t), 'ms');

		if(require('fs').existsSync('association.json')){
			self.association.load('association.json');
			console.log(' - frequentItemsets loaded at', (new Date - t), 'ms');
		}else{
			self.association.frequentItemsets(3, 4);
			self.association.save('association.json');
			console.log(' - frequentItemsets calculated at', (new Date - t), 'ms');
		}

		console.log(' - Preprocess done !');

		callback && callback();

	}); // end loadEmoticons
}
DiscoverEmoticons.prototype.loadEmoticons  = function(callback){ 
	var self = this, t = new Date();
	/*setTimeout(function(){

	}, 100);*/
	self.storage.db.collection('emoticons').aggregate([
	/*	{$match:  {user_id : {$ne: 5020913 }}},
		{$group: {
			//_id: '$hash_$user_id', 
			_id : {hash: '$hash', user_id: '$user_id'},
			url: 		{ $first: "$url" }, 
			hash: 		{ $first: "$hash" }, 
			keyword: 	{ $first: "$keyword"},
			frequent: {$sum: 1}
		}}, */
		{$group: {
			_id : {hash: '$hash'},
			url: 		{ $first: "$url" }, 
			hash: 		{ $first: "$hash" }, 
			frequent: 		{ $first: "$frequent" }, 
			keywords: 		{ $addToSet: "$keyword"},
			count: {$sum: 1}
		}}, 
		{$sort: {count: -1}},
		//{$limit: 10}
	], function(err, emos) {
		if(err){
			console.trace('Error occured while loadEmoticons', err);
		}else{
			console.log(' - loadEmoticons data arrived in ', (new Date - t), 'ms');
			console.log('\t', emos.length, 'emoticons loaded');
			callback && callback(emos);
		}
	})
}
DiscoverEmoticons.prototype.searchEmoticons = function(search){
	var self = this;
	var result = [];

	if(search == '' || search.match && search.match(/^\s+$/)) return [];

	this.tfidf.tfidfs(search, function(i, measure, hash) {
		if(measure > 4 ){
			result.push({
				emo : self.emoticons[hash], 
				measure: measure
			})
		}
	});	

	result = _.pluck(_.sortBy(result, function(e){ return e.measure; }).reverse(), 'emo');
	

	if((result.length == 0) && (typeof search == 'string')){
		_.each(self.emoticons, function(emo){
			if(emo.keywords.join(' ').toUpperCase().match(search.toUpperCase())){
				result.push(emo);
			}
		});
		result = result.splice(0, 200);
	}

	console.log(' + search ', result.length, 'found')

	return result;

}

DiscoverEmoticons.prototype.startWebConsole = function(){ 
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

	webConsole.get('/', function(request, response){

		var hot = self.association.getFrequentItemsets()[1];

		function weight(str){
			if(str.match(/[a-zA-Z0-9]/)){
				return 1;
			}else{
				return str.length;
			}
		}

		hot = _.reject(hot, function(e){ return e.list[0].match(/^(nan|undefined|null)$/i)});
		hot = _.reject(hot, function(e){ return (e.support < 20) });
		hot = _.reject(hot, function(e){ return (e.support * weight(e.list[0])) < 20 });
		hot = _.reject(hot, function(e){ return (e.support < 100 && e.list[0].length == 1) } );
		hot = _.sortBy(hot, function(e){ return (e.support * weight(e.list[0])); }).reverse();
		//hot = hot.slice(0, 50);

		var topSize = hot[0] && (hot[0].support * weight(hot[0].list[0])) || 1;
		var hotTerms = _.map(hot, function(e){ return {
			term: e.list[0].toUpperCase(), 
			support: e.support,
			size: ((e.support * weight(e.list[0]))/topSize)+ 'em'
		}; })

		response.render('index', {
			hotTerms: hotTerms,
			total: _.size(self.emoticons)
		})
	});

	webConsole.get('/related/:hash', function(request, response){

		var theHash = request.params.hash
		var terms 	= self.emoticons[theHash].terms;

		var t = new Date();
		
		response.render('discover', {
			//search: search,
			emoticon: self.emoticons[theHash],
			related: self.searchEmoticons(terms), 
			time: (new Date - t)
		});

	});

	webConsole.get('/discover/:terms', function(request, response){

		var search = request.params.terms;
		var result = self.searchEmoticons(search);

		var t = new Date();

		//計算top相關詞彙
		var termsCount = {};
		_.each(_.flatten(_.pluck(result, 'terms'), true), function(term){
			termsCount[term] = termsCount[term] || {term: term, count: 0};
			termsCount[term].count++;
		});
		termsCount = _.sortBy(termsCount, function(e){ return e.count;}).reverse();
		termsCount = _.filter(termsCount, function(e){ return e.count > 8; });

		relatedRules = self.association.strong(search);
		relatedRules = _.union(relatedRules, _.flatten(_.map(_.pluck(termsCount, 'term'), function(term){ return self.association.strong(term); }), true))
		relatedRules = _.reject(relatedRules, function(e){ return e.confidence < 0.4; });
		relatedRules = _.sortBy(relatedRules, function(e){ return e.confidence; }).reverse();

		var relatedTerms = _.uniq(_.flatten(_.pluck(relatedRules, 'base'), true));

		response.render('discover', {
			search: search,
			emoticons: result,
			related : self.searchEmoticons(relatedTerms), 
			time: (new Date - t)
		});

	});


	webConsole.listen(3333);
	console.log(' - webConsole is ready at 3333');
}

var webService = new DiscoverEmoticons();

