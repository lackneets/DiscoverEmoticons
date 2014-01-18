const _ = require('underscore');

_.combine = function(arr, n) {
	return _.combine2D(_.map(arr, function(el){ return [el]; }),n)
}
_.combine2D = function(arr, n) {
		var recursive = arguments.callee;
		var i,j,k,elem,l = arr.length,childperm,ret=[];
		if(n == 1) {
			for (var i = 0; i < arr.length; i++) {
				for (var j = 0; j < arr[i].length; j++) {
					ret.push([arr[i][j]]);
				}
			}
			return ret;
		} else {
			for (i = 0; i < l; i++) {
				elem = arr.shift();
				for (j = 0; j < elem.length; j++) {
					childperm = recursive(arr.slice(), n-1);
					for (k = 0; k < childperm.length; k++) {
						ret.push([elem[j]].concat(childperm[k]));
					}
				}
			}
			return ret;
		}
		i=j=k=elem=l=childperm=ret=[]=null;
}

function Apriori(){
	this.itemsets = [];
	this.collections = [];
}

Apriori.prototype.save = function(path){
	var json = JSON.stringify({
		itemsets: this.itemsets,
		collections: this.collections
	});
	var fs = require('fs');
	fs.writeFileSync(path, json);
}
Apriori.prototype.load = function(path){
	var fs = require('fs');
	var json = fs.readFileSync(path);
	var obj = JSON.parse(json);
	this.itemsets = obj.itemsets;
	this.collections = obj.collections;
}
Apriori.prototype.addCollection = function(arr){
	var self = this;
	var nocase = _.map(arr, function(e){ return e.toLowerCase(); });
	this.collections.push(_.uniq(nocase));
}	
Apriori.prototype.getFrequentItemsets = function(){
	return this.itemsets;
}
Apriori.prototype.frequentItemsets = function(minSup, level){
	var collections = this.collections;
	var itemset = {};
	minSup = minSup || 2;
	level = level || 2;

	var itemsets = [[]];

	for(var ln=1; ln <= level ; ln++){
		itemset = {};
		_.each(collections, function(items){
			var comb = _.combine(items, ln);
			//console.log('comb', comb);
			_.each(comb, function(item){
				item.sort();
				var key = item.join('=');
				//item.support = 0;
				itemset[key] = itemset[key] || {list:item, support: 0};
				itemset[key].support++;
			});
		});		


		itemset = _.reject(itemset, function(item){ return item.support<minSup; })

		itemsets[ln] = _.sortBy(itemset, function(item){ return item.support; }).reverse();


		//移除支持度小的item
		collections = _.map(this.collections, function(items){
			//console.log('>>', items, _.pluck(itemset, 'list'));
			return _.intersection(items, _.flatten(_.pluck(itemset, 'list')));
		});
		collections = _.reject(collections, function(items){ return _.size(items) < ln; })

	}

	this.itemsets = itemsets;

	return itemsets;
}

Apriori.prototype.strong = function(target){
	var self = this;
	var t = new Date();
	var rules = [];

	target = target.toLowerCase();

	_.equal = function(a1, a2){ return _.size(_.difference(a1, a2)) == 0 }
	_.each(_.flatten(this.itemsets, true), function(itemset){
		if(itemset.list.length == 1) return;
		if(_.contains(itemset.list, target)){
			var base = _.without(itemset.list, target);
			base = _.find(self.itemsets[base.length], function(i){ return _.equal(i.list, base); })
			//console.log(base, itemset.list)
			//console.log(itemset.list, base.list , '->', target, 'conf:', itemset.support / base.support)
			rules.push({ base: base.list, confidence: itemset.support / base.support});
		}
	});
	return _.sortBy(rules, function(r){ return r.confidence; }).reverse();
	console.log('strong rule found in', (new Date() - t) ,'ms');
}


/*
var apriori = new Apriori();

apriori.addCollection(['A', 'C', 'D']);
apriori.addCollection(['B', 'C', 'E']);
apriori.addCollection(['A', 'B', 'C', 'E']);
apriori.addCollection(['B', 'E']);
f = apriori.frequentItemsets(2, 3);

*/

module.exports = Apriori;