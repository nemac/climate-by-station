;( function( $, window, document, undefined ) {
	"use strict";
	$.widget( "fernleaf.simpleClimateWidget" , {

		//Options to be used as defaults
		options: {
			dataAPIEndpoint: "https://data.rcc-acis.org/",
			mode: 'pcpn',
			operator: 'gt',
			threshold: 1.0,
			thresholdUnit: 'in'
		},

		//Setup widget (eg. element creation, apply theming
		// , bind events etc.)
		_create: function () {
			this.update();
		},

		// Destroy an instantiated plugin and clean up
		// modifications the widget has made to the DOM
		destroy: function () {

			// this.element.removeStuff();
			// For UI 1.8, destroy must be invoked from the
			// base widget
			$.Widget.prototype.destroy.call(this);
			// For UI 1.9, define _destroy instead and don't
			// worry about
			// calling the base widget
		},
		// Respond to any changes the user makes to the
		// option method
		_setOption: function ( key, value ) {
			//empty data for any options that will require new data
			if (key in ['mode', 'state','county']){
				this.data = undefined;
			}

			this.update();
			// For UI 1.8, _setOption must be manually invoked
			// from the base widget
			$.Widget.prototype._setOption.apply( this, arguments );
			// For UI 1.9 the _super method can be used instead
			// this._super( "_setOption", key, value );
		},
		update: function (){
			if (this.options.mode == 'threshold'){
				if(undefined == this.data){}
				this.data = this.requestStnData({"sid":"USC00215400","sdate":"2017-01-01","edate":"2017-02-27","elems":[{"name":"pcpn"}]}, $.proxy(function(data){
					var counted = _.countBy(data.data, $.proxy(function(value){
						switch (this.options.operator){
							case ('gt'):
								return parseFloat(value[1]) > this.options.threshold
						}
					}, this));
					counted = $.extend( {}, {'true':0, 'false': 0}, counted);
					$(this.element).text(counted['true'] + " / " + counted['false'])
				}, this));
			}
		},
		requestStnData: function( params, callback ) {
			$.ajax({
				url: this.options.dataAPIEndpoint + 'StnData',
				type: "POST",
				contentType: "application/json; charset=utf-8",
				dataType: "json",
				data: JSON.stringify(params)
			}).done(callback);
		}

	});

} )( jQuery, window, document );
