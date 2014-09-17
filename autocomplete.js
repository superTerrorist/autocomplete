/*!
 * 自动提示功能模块
 * dependency jquery 1.8.0
 * version 1.0
 * author david wang
 */
(function(w,$){
	function AutoComplete(ele,options){
		var defaults = {
			appendTo : document.body, //提示内容框父级元素
			containerClass : "js-ui-autocomplete",
			width : "auto",
			maxHeight : 300,
			source : "",
			cache : true,
			paramName : "keyword",
			noDataHint : "未搜到结果",
			filter : AutoComplete.filter, //过滤函数函数
			formateResult : AutoComplete.formateResult, //结果格式化函数
			formateItem : AutoComplete.formatItem,
			always : false,
			//callback
			itemClickCall : function(){},
			selectedCall : function(){},
			ajaxSuccessCall : function(){},
			ajaxErrorCall : function(){}
		};
		this.ele = ele;
		this.options = $.extend(defaults,(options || {}));
		this.suggestions = [];
		this.selectedIndex = -1;
		this.visible = false; //容器是否可见
		this.containerWrapper = null; //容器
		this.cacheStore = {}; // 缓存容器
		this.source = function(){};
		this.currentValue = "";
		this.classes = {
			selected : "autocomplete-selected",
			suggestion : "autocomplete-suggestion",
			hover : "autocomplete-hover",
			noSuggetion : "autocomplete-noSuggestion"
		};
		this.initialize();
	}

	/*
	 * 结果按关键字过滤
	 * @param {string} value 
	 * @param {array} source 
	 */
	AutoComplete.filter = function(value,source){
		return $.grep(source,function(n){
			var str = n.value.toString();//转换成字符串
			if(str.toLowerCase().indexOf(value.toLowerCase()) != -1) return n;
		});
	};
	/*
	 * 格式化请求结果
	 * @param {mix} suggestion
	 * @return {object} temp 结果格式：[{
	 * 		value : {string}, 要匹配的值
	 *		extendData: {mix} 拓展数据
	 * },{...}]
	 */
	AutoComplete.formateResult = function(suggestions){
		var temp = [];
		$.each(suggestions,function(i,suggestion){
			if(typeof suggestion == "string"){
				temp.push({
					value : suggestion
				});
			}else{
				temp.push($.extend(suggestion,{
					value : suggestion.value || "",
					extendData : suggestion.extend || null
				}));
			}
		});
		return temp;
	};
	
	AutoComplete.formatItem = function(suggestion,value){
		var pattern = '(' + JS.utility['escapeRegExChars'](value) + ')';
		return suggestion.value.replace(new RegExp(pattern, 'gi'), '<strong>$1<\/strong>');
	};
	
	$.AutoComplete = AutoComplete;

	AutoComplete.prototype = {
		//初始化
		initialize : function(){
			var options = this.options,
				that = this,
				container = null;
			this.ele.get(0).setAttribute("autocomplete","off");
			container = this.containerWrapper = this.creatWrapper();
			container.css({
				"overflow" : "auto",
				"max-height" : that.options['maxHeight']
			});
			container.appendTo(options['appendTo']);
			this.isOutside = function(event){
				if(that.visible && ($(event.target).closest('.' + that.options['containerClass']).length === 0)){
					that.hideSuggesitons();
				}
			};
			this.fixPosition();
			//初始化资源获取函数
			this.initSource();
			//事件注册
			container.on("mouseover","." + that.classes['suggestion'],function(e){
				$(this).siblings("." + that.classes['hover'])
				 .removeClass(that.classes['hover'])
				 .end()
				 .addClass(that.classes['hover']);
			});
			
			container.on("click","." + that.classes['suggestion'],function(e){
				var _ = $(this);
				_.siblings("." + that.classes['selected'])
				 .removeClass(that.classes['selected'])
				 .end()
				 .addClass(that.classes['selected']);
				that.options['itemClickCall'](_,that);
				that.select($(this).data('index'));
			});
			
			container.on("mouseout",function(event){
				//如果鼠标移出，那么移除对应className
				//this.selectedIndex = -1;
				container.children('.' + that.classes['hover']).removeClass(that.classes['hover']);
				if(!that.options['always']) container.children('.' + that.classes['selected']).removeClass(that.classes['selected']);
			});
			
			if(!options['always']){
				//如果自动填充建议框始终显示的话，则不注册blur、focus事件
				this.ele.on('blur',function(event){that.onBlur(event);});
				this.ele.on('focus',function(event){that.onFocus(event);});
			}else{
				container.css({"display":"block"});
				this.source("",function(data){
					that.response(data);
				});
			}
			this.ele.on('keydown',function(event){that.onKeyDown(event); });
			this.ele.on('keyup',function(event){that.onKeyUp(event);});
			this.ele.on('change',function(event){that.onKeyUp(event);});
		},
		/*
		 * 创建autocomplete容器
		 * return {jquery object}
		 */
		creatWrapper : function(){
			return $("<div>").addClass(this.options['containerClass'])
							 .css({
								"position" : "absolute",
								"display" : "none"
							 });
		},
		/*
		 * 开启提示框总数显示
		 */
		disableAlways : function(){
			var that = this;
			//解绑document事件
			$(document).off("click",that.isOutside);
		},
		/*
		 * 关闭提示框总数显示
		 */
		enableAlways : function(){
			var that = this;
			$(document).on("click",that.isOutside);
		},
		/*
		 * 初始化资源函数
		 */
		initSource : function(){
			var that = this,
				array,url,cacheKey;
			if($.isArray(this.options.source)){
				// 如果是数组
				// 格式化数组
				array = that.options['formateResult'](this.options.source);
				this.source = function(value,request){
					var result  = this.options['filter'](value,array); // 获取匹配的数组
					request(result);
					return that;
				}
			}else if(typeof this.options.source == "string"){
				// 如果是url则利用ajax请求
				url = this.options.source;
				this.source = function(value,response){
					var paramName = that.options['paramName'],
						request = {};
					request[paramName] = value;
					cacheKey = url + $.param(paramName);
					if(that.options['cache']){
						if(typeof that.cacheStore[cacheKey] != "undefined"){
							//如果缓存已经保存
							response(that.cacheStore[cacheKey]);
							return that;
						}
					}
					if(that.xhr){
						that.xhr.abort();
					}
					that.xhr = $.ajax({
						url : url,
						data: request,
						dataType : "json",  
						success : function(data){
							that.xhr = null;
							data = that.transferToJson(data);
							data = that.options['formateResult'](data);
							that.cacheStore[cacheKey] = data;
							response(data);
						},
						error : function(){
							response([]);
						}
					});
				}
			}else{
				if($.isFunction(this.options.source)){
					this.source = this.options.source;
				}else{
					this.source = function(){};
				}
			}
		},
		/*
		 * json转换
		 * @param {string or json对象} result 
		 */
		transferToJson : function(result){
			 return typeof result === 'string' ? $.parseJSON(result) : result;
		},
		response : function(data){
			this.suggestions = (data.length == 0) ? [] : this.sortByBest(data);;
			this.render();
		},
		/*
		 * 失去焦点处理函数
		 */
		onBlur : function(event){
			this.enableAlways();
		},
		/*
		 * 获取焦点处理函数
		 */
		onFocus : function(){
			this.disableAlways();
			if(!this.visible && this.suggestions.length > 0){
				//如果提示框不可见并且有提示内容
				this.containerWrapper.show();
				this.visible = true;
			}
		},
		/*
		 * keyDown时函数处理
		 */
		onKeyDown : function(event){
			if(!this.visible) return;
			switch(event.which){
				case JS.ui.keycode.ENTER:
					//this.select(this.selectedIndex);
					break;
				case JS.ui.keycode.UP :
					this.moveUp();
					break;
				case JS.ui.keycode.DOWN :
					this.moveDown();
					break;
			}
			event.stopPropagation();
		},
		getActive : function(){
			var selectedClass = this.classes['selected'],
				selectedEle = $("." + selectedClass);
			if(selectedEle.length != 0){
				this.selectedIndex = selectedEle.data("index");
				return selectedEle;
			}
			this.selectedIndex = -1;
			return null;
		},
		setActive : function(){
			var suggestionClass = this.classes['suggestion'],
				selectedClass = this.classes['selected'],
				suggestionEle = $("." + suggestionClass);
			suggestionEle.removeClass(selectedClass);
			suggestionEle.eq(this.selectedIndex).addClass(selectedClass);
		},
		moveUp : function(){
			this.getActive();
			this.selectedIndex = (--this.selectedIndex) < 0 ? (this.suggestions.length-1) : this.selectedIndex;
			this.setActive();
			this.onSelect(this.selectedIndex);
			this.adjustScroll();
		},
		moveDown : function(){
			this.getActive();
			if(this.selectedIndex == -1 || (this.suggestions.length <= (this.selectedIndex + 1))){
				this.selectedIndex = 0;
			}else if(this.suggestions.length > (this.selectedIndex - 1)){
				++this.selectedIndex;
			}
			this.setActive();
			this.onSelect(this.selectedIndex);
			this.adjustScroll();
		},
		select : function(index){
			this.selectedIndex = index;
			if(!this.options['always']){
				this.containerWrapper.hide();
			}
			this.onSelect(index);
			//this.suggestions = [];
			this.hideSuggesitons();
		},
		onSelect : function(index){
			var suggestion = this.suggestions[index];
			this.ele.val(suggestion.value);
			this.options['selectedCall'](index);
		},
		/*
		 * keyup事件处理
		 */
		onKeyUp : function(event){
			var that = this,
				value = "";
			switch(event.which){
				//留给keydown处理
				case JS.ui.keycode.ENTER:
				case JS.ui.keycode.UP :
				case JS.ui.keycode.DOWN :
					return;
			}
			value = $.trim(this.ele.val());
			if(this.currentValue != value){
				//如果值发生改变
				this.currentValue = value;
				if(value != ""){
					//如果值不为空
					this.source(this.currentValue,function(data){
						that.response(data);
					});
				}else{
					//否则隐藏建议框
					this.hideSuggesitons();
				}
			}
		},
		/*
		 * 矫正position
		 */
		fixPosition : function(){
			var that = this,
				style = {
					top : 0,
					left : 0,
					width : that.options['width']
				},
				container = this.containerWrapper,
				containerParent = container.parent().get(0);
			if(containerParent === document.body){
				//如果是被插入body中
				var height = this.ele.outerHeight(),
					offset = this.ele.offset();
				style['left'] = offset.left;
				style['top'] = offset.top + height;
			}else{
				this.options['appendTo'].css({
					"position" : "relative"
				});
			}
			if(this.options['width'] == "auto"){
				var width = this.ele.outerWidth(),
					borderWidth = parseFloat(container.css("borderLeftWidth"));
				style['width'] = width - borderWidth * 2;
			}
			container.css(style);
		},
		render : function(){	
			var suggestions = this.suggestions,
				that = this,
				value = this.currentValue,
				container = this.containerWrapper,
				suggetionClass = this.classes['suggestion'],
				formatItem = this.options['formateItem'],
				html = "";
			if(suggestions.length == 0){
				this.renderNoData();
				return;
			}
			$.each(suggestions,function(i,suggestion){
				var series = that.seriesExtend(suggestion['extendData']);
				 html += '<div class="' + suggetionClass + '" data-index="' + i + '" data-extend=\''+ series +'\'>' + formatItem(suggestion,value) + '</div>';
			});
			container.html(html);
			container.show();
			this.visible = true;
		},
		/*
		 * 处理附加数据
		 * @Parma {mix} extendData
		 * @return {string} series
		 */
		seriesExtend : function(extendData){
			if(typeof extendData == "undefined") return "";
			if(typeof extendData == "String") return extendData;
			//如果是一般对象
			if($.isPlainObject(extendData)){
				var i = 0,
					series = "{";
				for(var p in extendData){
					//开始转义对象
					series += "\""+ p + "\"" + ":" + "\""+ extendData[p] + "\"" + ",";
				}
				series = series.replace(/,$/g,"");
				series += '}';
				return series;
			}
		},
		renderNoData : function(){
			var container = this.containerWrapper,
				suggetionClass = this.classes['noSuggetion'];
			container.html('<div class="' + suggetionClass + '">' + this.options['noDataHint'] + '</div>');
			container.show();
			this.visible = true;
		},
		/*
		 * 将结果按最适合的顺序排序
		 * @param {array} data
		 * @return {array} data
		 */
		sortByBest : function(data){
			var current = this.currentValue,
				container = [],
				sorted = [];
			for(var i = 0,len = data.length;i < len;i++){
				container.push({
					index : data[i].value.indexOf(current),
					data : data[i]
				});
			}
			container.sort(function(a,b){
				return a.index - b.index;
			});
			for(var i = 0,len = container.length;i < len;i++){
				sorted.push(container[i].data);
			}
			return sorted;
		},
		/*
		 * 矫正提示框滚动条位置
		 */
		adjustScroll : function(){
			var activeItem = this.getActive(),
				wrapperTop = this.containerWrapper.scrollTop(),
				offsetTop = activeItem.position().top;
			this.containerWrapper.scrollTop(wrapperTop + offsetTop);
		},
		/*
		 * 隐藏提示框
		 */
		hideSuggesitons : function(){
			if(this.options['always']) return;
			this.containerWrapper.hide();
			this.visible = false;
		}
	};
	
	$.fn.autoComplete = function(options){
		return new AutoComplete($(this),options);
	}
}(window,jQuery)); 
