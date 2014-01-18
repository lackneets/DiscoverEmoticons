const _ = require('underscore');

function Robotlist(){
	var fs = require('fs');
	var lines = fs.existsSync('blacklist.txt') && fs.readFileSync('blacklist.txt', 'utf8') || '';
	lines = lines.split(/\r\n/);
	this.list = _.map(lines, function(line){
		var attr = line.split(/\t/);
		return {
			id: parseInt(attr[1]),
			user_id: attr[1],
			nick_name: attr[0],
			display_name: attr[2],
			reason: attr[3],
			type: attr[4],
		}
	});
}
Robotlist.prototype.ids = function(){
	return _.pluck(this.list, 'id');
}
Robotlist.prototype.where = function(where){
	return _.findWhere(this.list, where);
}

module.exports = Robotlist;