"use Strict";
$(function(){
	
	$('a.hint.bookmarklet').mousedown(function(){
		$(this).text('★94i');
	});

	var userpage = $('.userpage.editable');
	var tools = $('.tools');
	
/*	function autoLayout(){
		$('.bookmarks.masonry').masonry({
			itemSelector: '.bookmark_group',
			columnWidth: 50,
			sisAnimated: !Modernizr.csstransitions
		});			
	}
	setTimeout(autoLayout, 20);*/

});
JustStick = {};
JustStick.Data = {};
JustStick.View = {};

JustStick.Data.Favorite = Backbone.Model.extend({
    url:'/save/',
    initialize: function(){
        alert('Hey, you create me!');
        //初始化時綁定監聽
        this.bind("change",function(){
            var name = this.get("name");
            alert("你改變了name屬性為：" + name);
        });
    },
    defaults: {
		id			: '',
		title     	: '',
		url       	: '',
		group_id  	: '',
		user_id   	: '',
		icon       	: ''
    },
    validate:function(attrs){}
});

JustStick.Data.Group = Backbone.Model.extend({
    url:'/save/',
    initialize: function(attrs){
        this.bind("change:column", function(){
            //alert("column changed" + name);
        });
        this.set(attrs);
       // console.log(this)
    },
    defaults: {
    	column :	1,
    	privacy :	0
    },
    validate:function(attrs){}
});

JustStick.Ajax = {}
JustStick.Ajax.post = function(url, data, success){
	$.ajax({url: url, type: 'POST', cahce: false, data: data,
		success:function(res){
			if(typeof success == 'function') success.call(success, res);
		}
	});
}

JustStick.View.FavoriteGroup = Backbone.View.extend({
	events: {
		'click .site .btn.delete'				: 'confirmDeleteSite',
		'click .site .btn.edit'					: 'editFavoriteTitle',	
			
		'click h3.title .rename'				: 'renameGroup',
		'click .title i.delete'					: 'removeGroup',
		'click .title i.privacy'				: 'setGroupPrivacy',
		'click .nullblock'						: 'createFavorite',
	},		
	initialize: function() {
		var self = this;
		self.$el = $(this.el);
		self.column = self.$el.parent();
		
		var data = self.$el.attr('data') ? JSON.parse(self.$el.attr('data')) : {};
		
		self.model = new JustStick.Data.Group({
			id		: self.$el.attr('group_id'),
			name	: self.$el.find('h3.title .name').text(),
			column 	: self.column.attr('column_id'),
		});
		self.model.set(data);
		self.render();
			
		if(self.options.editable){
			self.assignSortable();
		}else{
			this.events = {};
		}	
			
	},
	confirmDeleteSite: function(e){
		var site = $(e.target).parents('.site');
		if(confirm('確定要移除「' + site.find('.ico-txt').text() + '」嗎?'))  this.removeItems(site, function(){ site.fadeOut(function(){site.remove();}); });
		return false;
	},
	findDuplicate : function(url){
		var self = this;
		var duplicate = false;
		self.$el.find('a').each(function(){
			var href = $(this).attr('href');
			if(url == href){
				duplicate = $(this);
				return false;
			}
		});
		return duplicate;
	},
	editFavoriteTitle: function(e){
		var self 			= this;
		var $site 			= $(e.target).parents('a.site');
		var $site_title 	= $site.find('span.title');
		var site_id			= $site.attr('site_id');
		var site_title		= $site_title.text(); 
		
		var $input = $('<input type="text">').val(site_title);
		var $inputWrapper = $('<div class="site edit"/>').append($input);
		$site.replaceWith($inputWrapper);
		$input.focus().select();
		
		$input.keyup(function(e){
			if(e.keyCode == 13) $input.blur();
			if(e.keyCode == 27) { $input.val(''); $input.blur();}
		});
		
		self.$el.addClass('editing');
		
		$input.blur(function(){
			var changed_name = $(this).val();

			if(changed_name && changed_name!=site_title && !changed_name.match(/^\s+$/)){
				$site_title.text(changed_name);
				JustStick.Ajax.post('/favorite/rename', {
					favorite_id		: site_id,
					favorite_title 	: changed_name
				});
			} 
			$inputWrapper.replaceWith($site);
			self.$el.removeClass('editing');
		});
		return false;
	},		
	createFavorite: function(e){
		var self = this;
		var $nullblock = $(e.target);
		var $input = $('<input type="text">').val('http://');
		var $inputWrapper = $('<div class="site edit"/>').append($input);
		$inputWrapper.insertBefore($nullblock);
		$input.focus().select();
		
		self.$el.addClass('editing');
		
		$input.keyup(function(e){
			if(e.keyCode == 13) $input.blur();
			if(e.keyCode == 27) { $input.val(''); $input.blur();}
		});
		
		$input.blur(function(){
			var url = $(this).val();
			
			var reg_url = /(http|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/i;
			var reg_url_unresolved = /[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/i;
			
			var dup = self.findDuplicate(url);
			if(dup && dup.effect("highlight", {}, 3000)){
				console.log($(window).scrollTop(), $(window).height(), $(dup).offset().top )
				if( $(window).scrollTop() > $(dup).offset().top) {
					
				    $('body').scrollTo(dup, 200);
				}
				$inputWrapper.remove();
			}
			
			if(!url.match(reg_url) && url.match(reg_url_unresolved)){
				url = 'http://' + url;
			}
			
			if(url.match(reg_url) || url.match(reg_url_unresolved)){
				
				var template = $('div.template.favorite_group').html().replace(/^[\s\t]+/, '').replace(/[\s\t]+$/, '')
				var newElement = $(template).find('.site:first');
				newElement.attr('href', url);
				newElement.find('.ico-txt .title').text(url);
				newElement.find('.ico-txt img').attr('src', '/images/loading.gif');
				newElement.addClass('disabled')
				$inputWrapper.replaceWith(newElement);
				
				JustStick.Ajax.post('/favorite/add', {
					url			: url,
					group_name 	: self.model.get('name'),
					sort 		: $nullblock.prevAll().length+1
				}, function(res){
					var site = JSON.parse(res);
					console.log(site)
					newElement.attr('site_id', site.id);
					newElement.find('.ico-txt .title').text(site.title);
					newElement.find('.ico-txt img').bind('error', function(){
						$(this).addClass('nofavicon').attr('src', '/images/icons/bookmark-2-16.png');
					}).attr('src', site.favicon);
					newElement.removeClass('disabled')
				});

			}else{
				$inputWrapper.remove();
			}
			self.$el.removeClass('editing');
		});		
	},
	setGroupPrivacy: function(){
		var self = this;
		var p = this.model.get('privacy');
		this.model.set('privacy', p==0 ? 1 : 0);
		if(this.model.get('id')) JustStick.Ajax.post('/group/privacy', {
			group_id		: self.model.get('id'),
			privacy 		: self.model.get('privacy')
		});
		this.render();
	},
	createThis: function(){
		var self = this;
		if(self.model.get('id') == 0) 
			JustStick.Ajax.post('/group/create', {
				group_name 	: self.model.get('name'),
				column 		: self.model.get('column'),
				sort		: self.$el.prevAll().length+1,
				privacy		: self.model.get('privacy')
			}, function(group_id){
				self.model.set('id', group_id);
				self.$el.attr('group_id', group_id)
			});
	},
	removeThis: function(){
		var self = this;
		this.$el.fadeOut(function(){ self.remove(); });
		return true;
	},
	removeGroup: function(e){
		var self = this;
		
		if(self.model.get('id') == 0) {
			self.removeThis();
			return false;
		}
			
		var conf = confirm('確定要移除「'+self.model.get('name')+'」群組嗎?'); if(!conf) return false;
		
		JustStick.Ajax.post('/group/remove', {
			group_id 	: self.model.get('id'),
		}, function(){
			self.removeThis()
		});
		

	},
	renameGroup: function(e){
		var self = this;
		var group = this.$el;
		var group_id = this.model.get('id');
		var titleTag = group.find('.name');
		var oldName = this.model.get('name');
		var input = $('<input type="text">').val(oldName);
		titleTag.replaceWith(input);
		input.focus().select();
		
		function nameExists(name){
			var exists = false;
			$('.favorite_group .name').each(function(){
				if($(this).text() == name){
					exists = true;
					return false;
				}
			});
			return exists;
		}
		
		input.keyup(function(e){
			if(e.keyCode == 13) input.blur();
			if(e.keyCode == 27) { input.val(''); input.blur(); self.removeThis();}
		});
		
		input.blur(function(){
			var changed_name = $(this).val();
			var exists = false;
			var fixedName = changed_name;
			var fixer = 1;
			
			while(nameExists(fixedName)){
				fixedName = changed_name + '-' + (fixer++)
			}
			var changed_name = fixedName;
			
			if(exists){
				var m = changed_name.match(/\-(\d+)$/);
				if(m && m[1]) changed_name += '-' + (parseInt(m[1]) + 1);
				else changed_name += '-1';
			}
			self.model.set('name', changed_name);
			if(changed_name && changed_name!=oldName && !changed_name.match(/^\s+$/)){
				titleTag.text(changed_name);
				JustStick.Ajax.post('/group/rename', {
					group_id	: group_id,
					group_name 	: changed_name
				});
				self.createThis();
			} 
			input.replaceWith(titleTag);
			
		});
		
		return false;
	},
	removeItems: function (ui, callback){
		var items = {groups:[], favorites:[]};
		ui.find('*').andSelf().filter('[group_id],[site_id]').each(function(){
			if($(this).attr('group_id')) items.groups.push($(this).attr('group_id'));
			if($(this).attr('site_id')) items.favorites.push($(this).attr('site_id'));
		});
		$.ajax({url: '/remove/items', type: 'POST', cahce: false, data: items,  success: function(text){
			if(text == 'ok' && typeof callback == 'function') callback(); 
		}})
	},
	assignSortable: function(){
		this.$el.find('.favorites').sortable({
			scroll: true, scrollSensitivity: 100,
			placeholder: 'site ui-sortable-placeholder',
			connectWith: '.favorites',
			handle: '.btn.sort_handler',
			items: '.site:not(.nullblock)',
			sort: function(){
				$(this).find(' > .nullblock').appendTo(this);
			},
			change: function(){
				$(this).find(' > .nullblock').appendTo(this);
			},
			stop: function(e, ui){
				var parent = ui.item.parent();
				var ids = ui.item.parent().sortable( "toArray", {attribute: "site_id"} );
				var group_id = ui.item.parents('[group_id]').attr('group_id');
				$(parent).find('> .nullblock').appendTo(parent);
				JustStick.Ajax.post('/ajax/favorite/sorts', {
					group_id : group_id,
					site_ids : ids
				});
			}
		});
	},
	render: function(){
		var self = this;
		self.$el.removeClass('is_private');
		if(self.model.get('privacy') == 1)
			self.$el.addClass('is_private');
	}		
});




var Userpage = Backbone.View.extend({
	events: {
		'click .nullblock.favorite_group'	: 'createGroup'
	},		
	initialize: function() {
		var self = this;
		self.$el = $(this.el);
		self.groups = [];
		
		self.columns = self.$el.find('.column');
		self.$el.find('.favorite_group').each(function(){
			/*var json = $(this).attr('data');
			var attr = json && JSON.parse($(this).attr('data'));*/
			self.groups.push(new JustStick.View.FavoriteGroup({el: this, editable: self.options.editable}));
		});
		
		$(document).on('error', 'img.favicon', function(){
			$(this).addClass('nofavicon').attr('src', '/images/icons/bookmark-2-16.png');
		});
		
		$('.ico-txt img').each(function(){
			(function(img){
				setTimeout(function(){
					if(!img.complete){
						console.log('timeout', img.src);
						$(img).trigger('error');
					} 
					
				}, 6000);
			})(this);
		});

		$('img.favicon').bind('error', function(){
			$(this).addClass('nofavicon').attr('src', '/images/icons/bookmark-2-16.png');
		});
		self.$el.addClass(self.options.editable ? 'editable' : 'public')
		
		if(self.options.editable){
			self.assignSortableColumns();
		}else{
			this.events = {};
		}
		
	},
	createGroup: function(e) {
		var nullblock = $(e.target);
		var currentColumn = $(e.target).parent();
		var template = $('div.template.favorite_group').html().replace(/^[\s\t]+/, '').replace(/[\s\t]+$/, '')
		var newGroupElement = $(template).insertBefore(nullblock);
		console.log(newGroupElement);
		console.log(newGroupElement);
		newGroupElement.find('.favorites *:not(.nullblock)').remove()
			
		var newGroupView = new JustStick.View.FavoriteGroup({el: newGroupElement, editable: true });
		this.groups.push(newGroupView);
		newGroupView.renameGroup();
		return false;
	},
	assignSortableColumns: function(){
		var self = this; 
		self.columns.sortable({ //.disableSelection()
			scroll: true, scrollSensitivity: 100,
			connectWith: '.column',
			handle: '.sortable-handle',
			placeholder: 'favorite_group ui-sortable-placeholder',
			items: '.favorite_group:not(.nullblock)',
			sort: function(event, ui){
				var parent = ui.item.parent();
				$(parent).find('> .nullblock').appendTo(parent);
			},
			change: function(){
				$(this).find(' > .nullblock').appendTo(this);
			},	
			start: function(e, ui){
				ui.placeholder.height(ui.item.height());
			},
			stop: function(event, ui){
				var currentColumn = ui.item.parent();
				var column_id = currentColumn.attr('column_id');
				var group_ids = currentColumn.sortable( "toArray", {attribute: "group_id"} );
				console.log(group_ids);
				$(currentColumn).find('> .nullblock').appendTo(currentColumn);
				JustStick.Ajax.post('/group/ajax/sorts', {
					column : column_id,
					group_ids : group_ids
				});
			}
		});
	},
	render: function(){
		
	}
});