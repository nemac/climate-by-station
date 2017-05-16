//TODO Semantic printout

;"use strict";

import _ from "lodash";
import $ from "jquery";
import regression from "regression";
import Chart from "chart.js";
import "jquery-ui";
import "jquery-ui/ui/unique-id";
import "chart.js";

const defaultTemplates = {
	index: () => `<div class="top-buttons">
				<div class="graph-button"><i class="fa fa-bar-chart" aria-hidden="true"></i></div>
				<div class="options-button"><i class="fa fa-cog" aria-hidden="true"></i></div>
			</div>`,
	spinner: (msg) => `<div class="spinner"><i class="spinner-icon"></i><span class="sr-only">Loading...</span><span class="msg">${msg}</span></div>`,
	summary: (summary = '', trendAngle = 0) => `
<div class="summary">
<div class="summary-arrow"><i class="fa fa-long-arrow-right" style="transform: rotate(${trendAngle}deg)" aria-hidden="true"></i></div>
<div class="summary-text">${summary}</div>
</div>`,
	graph: () => `<canvas></canvas>`,
	options: (threshold = 0, units = 'in') => `<div class="options"><label>Threshold: <input name="threshold" type="number" step="0.1" value="${threshold}"></label></div>`,
};

$.widget("fernleaf.item", {
	datasets: [],
	options: {
		station: '',
		grid: '21',
		boundingBoxes: [], //Use format [lat, lon, lat, lon]
		states: [], //two-digit state codes
		counties: [], //Use fips codes
		sdate: 'por',
		edate: '2016-12-31',
		dataAPIEndpoint: "https://data.rcc-acis.org/",
		queryElements: [{"name": "pcpn", 'units': 'inch'}], //[{"name": "maxt", "units": "degreeF"}],
		chart: 'timeline', //timeline, exceedance-timeline, exceedance-deviation
		interval: 'yly',
		threshold: 1.0,
		thresholdOperator: '>',
		thresholdFilter: '',
		thresholdFunction: undefined, //Pass in a custom function: function(value){ return value > 1; }
		areaReductionFunction: _.mean, //Pass in a custom function: function(values){ return _.mean(values); },
		missingValues: ['T', 'M', 'S'],
		missingValueFilter: 'zero',
		currentView: 'summary',
		rollingWindow: 1,
		rollingWindowFunction: _.sum
	},
	_operators: {
		'==': (o1, o2) => o1 == o2,
		'>=': (o1, o2) => o1 >= o2,
		'>': (o1, o2) => o1 > o2,
		'<=': (o1, o2) => o1 <= o2,
		'<': (o1, o2) => o1 < o2,
	},
	_filters: {
		KtoC: (v) => v + 273.15,
		CtoK: (v) => v - 273.15,
		FtoC: (v) => (v * 9 / 5) + 32,
		CtoF: (v) => (v - 32) * 5 / 9,
		InchToCM: (v) => v * 2.54,
		CMtoInch: (v) => v / 2.54,
		DaytoWeek: (v) => v / 7,
		WeektoDay: (v) => v * 7,
		DaytoYear: (v) => v / 365,
		YeartoDay: (v) => v * 365,
	},
	_views: {},
	//Setup widget (eg. element creation, apply theming, bind events etc.)
	_create(){
		this.templates = defaultTemplates;
		if (this.options.hasOwnProperty('templates')) {
			Object.assign(this.templates, options.templates);
		}
		$(this.element).addClass("fl-item");
		$(this.element).html(this.templates.index());
		//events
		$(this.element).find('.graph-button').click(() => {this._showYearlyExceedanceGraph()});
		$(this.element).find('.options-button').click(() => {this._showOptions()});

		this.update();
	},

	// Respond to any changes the user makes to the
	// option method
	_setOption(key, value) {
		//Apply filters to threshold as needed.
		if (key === 'threshold' && this.options.thresholdFilter in this._filters) {
			value = this._filters[this.options.thresholdFilter](value);
		}
		//change dates to what acis requires
		if (key === 'sdate') {
			value = value ? String(value).slice(0, 4) + '-01-01' : 'por';
		}
		if (key === 'edate') {
			if (undefined === value || parseInt(String(value).slice(0, 4)) >= parseInt(new Date().getFullYear())) {
				value = String(parseInt(new Date().getFullYear()) - 1) + '-12-31';
			} else {
				value = String(value).slice(0, 4) + '-12-31';
			}
		}

		this._super(key, value);

		//empty data for any options that will require new data
		if (['station', 'state', 'county', 'queryElements', 'rollingWindow', 'sdate', 'edate'].includes(key)) {
			delete this.data;
		}
	},
	update() {
		//clear views
		_.forEach(this._views, ($view) => {$view.remove();});
		this._views = {};

		let dataPromise;
		if (undefined === this.data) {
			this.data = {};
			if (this.options.station) {
				dataPromise = this._getStationData()
			}
			else {
				dataPromise = this._getGridData()
			}
		}
		Promise.resolve(dataPromise).then((data) => {
			this._updateSpinner(false);
			switch (this.options.currentView) {
				case 'summary':
					this._showSummary();
					break;
				case 'graph':
					this._showYearlyExceedanceGraph();
					break;
				case'options':
					this._showOptions();
			}
		});
	},
	getData(){
		return this.data;
	},
	getExceedanceData(){
		return this.yearlyExceedanceData;
	},
	_getStationData(){
		this._updateSpinner('downloading data...');
		return Promise.resolve($.ajax({
			url: this.options.dataAPIEndpoint + 'StnData',
			type: "POST",
			context: this,
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			data: JSON.stringify({
				sid: this.options.station,
				sdate: this.options.sdate,
				edate: this.options.edate,
				elems: this.options.queryElements
			})
		})).then((response) => {
			this._updateSpinner('reducing data...');
			let data = this._filterMissingValues(_.fromPairs(response.data), this.options.missingValueFilter);
			//Parse string to floats (and ignore NaN values).
			data = _(data).mapValues((v) => parseFloat(v)).pickBy(_.isFinite).value();
			if (this.options.rollingWindow > 1) {
				data = this._rollingWindowDaily(data);
			}
			this.data = data;
			return data;
		});
	},
	getYearlyExceedanceData(){
		return this._reduceDailyToYearly(this.data,
			(dailies, year) => _.reduce(dailies, (yearly, value, date) => {
				if (this._thresholdFunction(value)) {
					return yearly + 1;
				}
				return yearly;
			}, 0)
		);
	},
	getYearlyExceedanceLinearRegression(yearlyExceedanceData){
		return regression('linear', _(yearlyExceedanceData).toPairs().map((v) => [parseInt(v[0]), v[1]]).filter((v) => v[1] > 0).value());
	},
	/**
	 *
	 * @returns {Promise}
	 * @private
	 */
	_getGridData(){
		return new Promise((resolve, reject) => {
			//Get bounding boxes if we don't already have them
			let bboxPromise;
			if (this.options.boundingBoxes.length === 0) {
				this._updateSpinner('finding region...');
				if (this.options.counties.length !== 0) {
					bboxPromise = this._requestRegionBoundingBoxes('county', this.options.counties);
				}
				else if (this.options.states.length !== 0) {
					bboxPromise = this._requestRegionBoundingBoxes('state', this.options.states);
				}
				else {
					return promise.reject('No station, county, state, or bounding box specified.');
				}
			}

			Promise.resolve(bboxPromise).then(() => {
				this._updateSpinner('downloading data...');

				let dataPromises = [];
				_.each(this.options.boundingBoxes, (box) => {
					dataPromises.push(this._requestGridData({
						bbox: box.join(','),
						sdate: this.options.sdate,
						edate: this.options.edate,
						elems: this.options.queryElements
					}));
				});
				Promise.all(dataPromises).then((datasets) => {
					this._updateSpinner('reducing data...');
					this.data = this._reduceArea(datasets);
					resolve(this.data);
				}, reject);
			});
		});
	},
	_requestStationData(params) {

	},
	_requestGridData: function (params) {
		params = Object.assign({grid: this.options.grid}, params);
		return Promise.resolve($.ajax({
			url: this.options.dataAPIEndpoint + 'GridData',
			type: "POST",
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			context: this,
			data: JSON.stringify(params)
		})).then((data) => {
			return data.data;
		});
	},
	_requestRegionBoundingBoxes: function (regionType, regions) {
		return Promise.resolve($.ajax({
			url: this.options.dataAPIEndpoint + 'General/' + regionType,
			context: this,
			type: "POST",
			data: {"id": regions.join(','), "meta": "id,name,bbox"}
		})).then((data) => {
			if (undefined === data['meta']) {
				throw new Error('invalid bounding box response');
			}
			_.each(data['meta'], (region) => {
				this.options.boundingBoxes.push(region['bbox'])
			});
			return this.options.boundingBoxes;
		});
	},
	_thresholdFunction(value){
		if ('function' === this.options.thresholdFunction) {
			return this.options.thresholdFunction.apply(this, value);
		}
		return this._operators[this.options.thresholdOperator](value, this.options.threshold);
	},
	/**
	 * Reduces dataset temporally from daily values to monthly values
	 * @param {Array} dataset Ex: {"2017-01-01":0.13,"2017-01-02":0.13,"2017-01-02":0.13}
	 * @param {Function} reductionFunction the reduction function to use. Default: _.meanBy.
	 * @returns {Collection} Ex: {"2017-01":0.13}
	 * @private
	 */
	_reduceDailyToMonthly(dataset, reductionFunction = _.meanBy){
		return _(dataset)
			.groupBy((value) => value[0].slice(7)) //group by month{"2017-01":["2017-01-01":0.13]}
			.mapValues((value, key, collection) => { //reduce dailies
				return reductionFunction(value, (o) => _.values(o)[0]);
			});
	},
	/**
	 * Reduces collection temporally from daily values to yearly values
	 * @param {Object} collection Ex: {"2017-01-01":0.13,"2017-01-02":0.13,"2017-01-02":0.13}
	 * @param {Function} reductionFunction Function which is called on every year, receives parameters (dailies, year)
	 * @returns {Collection} Ex: {"2017":0.13}
	 * @private
	 */
	_reduceDailyToYearly(collection, reductionFunction){
		return _(collection)
		//group by year
			.transform((collection, value, date) => {
				let year = parseInt(date.slice(0, 4));
				collection[year] = collection[year] || {};
				collection[year][date] = value;
			}, {})
			.mapValues((dailies, year) => { //reduce dailies
				return reductionFunction(dailies, year);
			})
			.value();
	},
	/**
	 * Reduces datasets spatially returning one value per time interval.
	 * @param datasets Ex: [[["2017-01-01",{"NC":0.13425317406654358}]],[["2017-01-01",{"NC":0.66}]]]
	 * @returns {Collection} Ex: {"2017-01-01":0.13}
	 * @private
	 */
	_reduceArea(datasets){
		//"interval" may be daily, monthly, or annually, it doesn't matter.
		let intervalData = {};
		_.each(datasets, (dataset) => {
			_.each(dataset, (intervalrecord) => {
				if (undefined === intervalData[intervalrecord[0]]) {
					intervalData[intervalrecord[0]] = [];
				}
				intervalData[intervalrecord[0]].push(intervalrecord[1][0]);
			})
		});
		if ($.isFunction(this.options.areaReductionFunction)) {
			return _.mapValues(intervalData, this.options.areaReductionFunction);
		}
		return _.mapValues(intervalData, _.mean);
	},
	//aggregates consecutive days
	_rollingWindowDaily(collection){
		return _.mapValues(collection, (value, date) => {
			let valuesInWindow = [value];
			for (let i = this.options.rollingWindow - 1; i > 0; i--) {
				let newdate = new Date(date);
				newdate.setDate(newdate.getDate() - i);
				newdate.setMinutes(newdate.getMinutes() - newdate.getTimezoneOffset());
				newdate = newdate.toISOString().slice(0, 10);
				if (undefined !== collection[newdate]) {
					valuesInWindow.push(collection[newdate]);
				}
			}
			if ('function' === this.options.rollingWindowFunction) {
				return this.options.rollingWindowFunction.apply(this, valuesInWindow);
			}else if (this.options.rollingWindowFunction === 'mean'){
				 value = _.mean(valuesInWindow);
			}
			else {
				value = _.sum(valuesInWindow);
			}
			return value;
		});
	},
	_updateSpinner(msg = ''){
		let spinner = $(this.element).children('div.spinner');
		if (spinner.length) {
			if (msg === '' || msg === false) {
				spinner.remove();
			}
			else {
				spinner.children('.msg').text(msg);
			}
		} else {
			if (msg !== false) {
				$(this.element).append(this.templates.spinner(msg));
			}
		}
	},
	_showYearlyExceedanceGraph(){
		this.options.currentView = 'graph';
		_.forEach(this._views, ($view) => {$view.hide();});
		if (undefined !== this._views.$yearlyExceedanceGraph) {
			this._views.$yearlyExceedanceGraph.show();
			return;
		}

		let yearlyExceedanceData = this.getYearlyExceedanceData();
		let yearlyExceedanceTrend = this.getYearlyExceedanceLinearRegression(yearlyExceedanceData);
		let yearlyExceedanceLine = _(yearlyExceedanceData).toPairs().map((v) => {
			return {x: String(v[0]), y: v[1]}
		}).sortBy('x').value();
		let yearlyExceedanceTrendLine = _(yearlyExceedanceTrend.points).map((v) => {
			return {x: String(v[0]), y: v[1]}
		}).sortBy('x').value();
		this._views.$yearlyExceedanceGraph = $(this.templates.graph()).uniqueId().appendTo(this.element);
		this.chart = new Chart(this._views.$yearlyExceedanceGraph, {
				label: 'Yearly Exceedance',
				type: 'line',
				animationEnabled: false,
				data: {
					datasets: [
						{
							label: 'Yearly Exceedance',
							data: yearlyExceedanceLine,
							borderColor: '#000000',
							borderWidth: 1,
							lineTension: 0
						},
						{
							label: `Trend (${yearlyExceedanceTrend.string})`,
							data: yearlyExceedanceTrendLine,
							fill: false,
							borderColor: '#00dd09',
							borderWidth: 1,
							lineTension: 0,
							pointRadius: 0,
						}
					]
				},
				options: {
					scales: {
						xAxes: [{
							type: 'time',
							display: true,
							time: {unit: 'year', unitStepSize: 3},
							scaleLabel: {
								display: true,
								labelString: 'Date'
							},
							position: 'bottom'
						}],
						yAxes: [{
							display: true,
							scaleLabel: {
								display: true,
								labelString: 'Exceedance'
							}, ticks: {
								beginAtZero: true
							}
						}]
					}
				}
			}
		);

	},
	_showExceedanceGraph(){
		this.options.currentView = 'graph';
		_.forEach(this._views, ($view) => {$view.hide();});
		if (undefined !== this._views.$exceedanceGraph) {
			this._views.$exceedanceGraph.show();
			return;
		}
		let exceedanceLine = _(this.data).toPairs().map((v) => {
			return {
				x: String(v[0]),
				y: v[1]
			}
		}).sortBy('x').value();
		let thresholdLine = _(this.yearlyExceedanceLinearRegression.points).map((v) => {
			return {x: String(v[0]), y: v[1]}
		}).sortBy('x').value();
		this._views.$exceedanceGraph = $(this.templates.graph()).uniqueId().appendTo(this.element);
		this.chart = new Chart(this._views.$exceedanceGraph, {
				label: 'Yearly Exceedance',
				type: 'line',
				data: {
					datasets: [
						{
							label: 'Precipitation',
							data: exceedanceLine,
							borderColor: '#000000',
							borderWidth: 1,
							lineTension: 0
						},
						{
							label: 'Threshold',
							data: yearlyExceedanceTrendLine,
							fill: false,
							borderColor: '#00dd09',
							borderWidth: 1,
							lineTension: 0,
							pointRadius: 0,
						}
					]

				},
				options: {
					scales: {
						xAxes: [{
							type: 'time',
							display: true,
							time: {unit: 'year', unitStepSize: 3},
							scaleLabel: {
								display: true,
								labelString: 'Date'
							},
							position: 'bottom'
						}],
						yAxes: [{
							display: true,
							scaleLabel: {
								display: true,
								labelString: 'Exceedance'
							}, ticks: {
								beginAtZero: true
							}
						}]
					}
				}
			}
		);

	},
	_showOptions(){
		this.options.currentView = 'options';
		_.forEach(this._views, ($view) => {$view.hide();});
		if (undefined !== this._views.$options) {
			this._views.$options.show();
			return;
		}
		this._views.$options = $(this.templates.options(this.options.threshold)).uniqueId().appendTo(this.element);
		this._views.$options.find('input[name="threshold"]').change((e, element) => {
			this.options.threshold = parseFloat(e.target.value);
			this.update();
		});
	},
	_showSummary(){
		this.options.currentView = 'summary';
		_.forEach(this._views, ($view) => {$view.hide();});
		if (undefined !== this._views.$summary) {
			this._views.$summary.show();
			return;
		}
		let partitioned = _.partition(this.data, this._thresholdFunction.bind(this));
		this._views.$summary = $(this.templates.summary((partitioned[0].length + " / " + Object.keys(this.data).length), 75)).uniqueId().appendTo(this.element);
	},
	/**
	 * Returns a new object with all missing values removed.
	 * @param {Object} collection
	 * @returns {Object}
	 * @private
	 */
	_filterMissingValues(collection, missingValueFilter){
		if (missingValueFilter === 'zero') {
			return _.reduce(collection, (acc, value, key, collection) => {
				acc[key] = this.options.missingValues.includes(value) ? 0.0 : value;
				return acc;
			}, {});
		}
		else if (missingValueFilter === 'drop') {
			return _.reduce(collection, (acc, value, key) => {
				if (this.options.missingValues.includes(value)) {
					return acc;
				}
				acc[key] = value;

				return acc;
			}, {});
		}
		else if ($.isFunction(missingValueFilter)) {
			return _.reduce(collection, missingValueFilter, {})
		}
	},
	getQuantile(percentile){
		//get all non-zero values from data
		let data = _(this.data).filter((v) => v > 0.0).sortBy((v) => v).value();
		let len = data.length;
		let index;
		percentile = percentile / 100;
		// [0] 0th percentile is the minimum value...
		if (percentile === 0.0) {
			return data[0];
		}
		// [1] 100th percentile is the maximum value...
		if (percentile === 1.0) {
			return data[len - 1];
		}
		// Calculate the vector index marking the quantile:
		index = ( len * percentile ) - 1;

		// [2] Is the index an integer?
		if (index === Math.floor(index)) {
			// Value is the average between the value at index and index+1:
			return ( data[index] + data[index + 1] ) / 2.0;
		}
		// [3] Round up to the next index:
		index = Math.ceil(index);
		return data[index];
	}
});

