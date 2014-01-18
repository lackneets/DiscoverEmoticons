const _ 		= require('underscore');
const natural 	= require('natural');

function FPNode(term){
	this.term = term;
	this.count = 1;
	this.level = 0;
	this.children = {};
}

FPNode.prototype.getChild = function(term){
	if(this.children[term] instanceof FPNode){
		return this.children[term];
	}else{
		return null;
	}
}

FPNode.prototype.child = function(term, root){
	/*if(root && root.children[term] instanceof FPNode){
		root.children[term].count++;
		return root.children[term];
	}else*/ if(this.children[term] instanceof FPNode){
		this.children[term].count++;
		return this.children[term];
	}else{
		var node = this.children[term] = new FPNode(term);
		node.level = this.level+1;
		return node;
	}
}
FPNode.prototype.max = function(){
	return _.max(this.children, function(c){ return c.count; })
}

/*FPNode.prototype.flatten = function(node){
	node = node || this;
	return 
}*/


FPNode.prototype.predict = function(threshold, node){
	node = node || this;
	threshold = threshold || 0.5;
	this.branchDegree = this.branchDegree || 0;
	this.depth = this.depth || 0;
	this.branchDegree+= _.size(node.children);
	var next = node.max();
	if(next && next.count/node.count >= threshold ){
		this.depth++;
		return node.term + '' + this.predict(threshold,next);
	}else{
		this.depth++;
		return node.term;
	}
}

function FPTree(){
	this.root = new FPNode();
	this.dict = {};
}
FPTree.FPNode = FPNode;


FPTree.prototype.insert = function(terms, file){
	var self = this;
	var root = self.root
	var current = self.root;
	if(terms instanceof Array){
		_.each(terms, function(term){
			current = current.child(term, root);
		})
		return current;
	}else if(terms.match){

		//Long-term first

		//console.log(terms)

		for(var i = terms.length; i > 1 ; i--){
		//for(var i = 1; i <= terms.length ; i++){
			var ng = natural.NGrams.ngrams(terms.split(''), i);
			require('fs').writeSync(file, JSON.stringify(ng) + '\n');
			var leaf;
			_.each(ng, function(g){
				leaf = self.insert(g);
				//if(leaf.count >= 1) return false;
			});
			//if(leaf.count >= 2) break;
		}
	}
}

FPTree.prototype.trace = function(node, arr, str, weight){
	var self = this;
	var node = node || this.root;
	var arr = arr || [];
	var str = str || '';
	var weight = weight || 0;



	if(_.size(node.children)){

		_.each(node.children, function(fChild){
			arr.push(self.trace(fChild, arr, str + (node.term || ''), (weight) + node.count/(node.level+1)));
		})

		if( node.level == 0 ) return arr;
		else return str + node.term + ' : ' + node.count + ' : ' + weight;

	}else{
		return str + node.term + ' : ' + node.count + ' : ' + weight;
	}
}

FPTree.prototype.prediction = function(){
	var tree = this;
	var predicttion = _.map(_.filter(tree.root.children, function(node){
		return node.count > 3;
	}), function(node){
		return {
			term: node.predict(0.6),
			score : node.count,
			depth: node.depth,
			branchDegree: node.branchDegree,
			branchRate: Math.round(node.branchDegree/node.depth*10000)/100,
			node: node,
		};
	});
	predicttion = _.filter(predicttion, function(p){
		return p.score > 4 && p.term.length > 1 && p.depth > 1 && p.term.length <=6 ;
	});
	predicttion = _.sortBy(predicttion, function(p){ return p.branchRate; }).reverse()
	predicttion = _.sortBy(predicttion, function(p){ return p.score * p.branchDegree; }).reverse()

	return _.pluck(predicttion, 'term');
} 


FPTree.prototype.findGarbage = function(){

}


module.exports = FPTree;
