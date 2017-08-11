;"use strict";

import _ from "lodash";
import $ from "jquery";
import regression from "regression";
import Chart from "chart.js";
import "jquery-ui";
import "jquery-ui/ui/unique-id";
import "chart.js";

$.widget("fernleaf.item", {
	options: {
		station: '',
		sdate: 'por',
		edate: '2016-12-31',
		variable: 'precipitation',
		threshold: 1.0,
		thresholdOperator: '>',
		thresholdFilter: '',
		thresholdFunction: undefined, //Pass in a custom function: function(v1, v2){ return v1 > v2; }
		rollingWindow: 1,
		dailyValueValidator: undefined, // Pass in a custom validator predicate function(value, date){return date.slice(0, 4) > 1960 && value > 5 }
		yearValidator: undefined,
		trendableValidator: undefined, //(exceedanceData) => {}
		dataAPIEndpoint: "https://data.rcc-acis.org/",
	},
	_variables: {
		precipitation: {
			rollingWindowFunction: 'sum',
			invalidDailyValueBehavior: 'zero',
			queryElements: [{"name": "pcpn", 'units': 'inch'}]
		},
		tmax: {
			queryElements: [{"name": "maxt", "units": "degreeF"}],
			missingValueTreatment: 'drop',
			rollingWindowFunction: 'mean',
		},
		tmin: {
			queryElements: [{"name": "mint", "units": "degreeF"}],
			missingValueTreatment: 'drop',
			rollingWindowFunction: 'mean'
		},
		tavg: {
			queryElements: [{"name": "mint", "units": "degreeF"}],
			missingValueTreatment: 'drop',
			rollingWindowFunction: 'mean'
		}
	},
	_dailyValues: null, //{date:{value: 1.0, valid: true}}

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
	/**
	 * Constructor for the widget.
	 * @private
	 */
	_create() {
		$(this.element).addClass("fl-item");
		this.update();
	},
	/**
	 * Updates data and re-draws graph as needed.
	 */
	update() {
		//clear views
		_.forEach(this._views, ($view) => {$view.remove();});
		this._views = {};

		let dataPromise;
		if (this._dailyValues === null) {
			dataPromise = Promise.resolve(this._getDailyValuesByStation())
				.then((dailyValues) => {
					this._dailyValues = this.options.rollingWindow > 1 ? this._rollingWindowDailyValues(dailyValues) : dailyValues
				});
		}
		Promise.resolve(dataPromise).then(() => {
			this._showExceedanceTimelineGraph(this._dailyValues);
		});
	},
	/**
	 * Setter for option values.
	 * @param key option name
	 * @param value new value
	 * @private
	 */
	_setOption(key, value) {
		//Apply filters to threshold as needed.
		if (key === 'threshold' && this.options.thresholdFilter in this._filters) {
			value = this._filters[this.options.thresholdFilter](value);
		}
		//change dates to acis format
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
		//clear data if any of these options change. On next update() new data will be requested.
		if (['station', 'variable', 'rollingWindow', 'sdate', 'edate'].includes(key)) {
			this._clearData();
		}
	},

	getDailyValues() {
		return this._dailyValues;
	},
	/**
	 * Gets daily values for a given the current this.options. Results stored in this._dailyValues.
	 * @returns {Promise}
	 * @private
	 */
	_getDailyValuesByStation() {
		this._updateSpinner('loading data...');
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
				elems: this._variables[this.options.variable].queryElements
			})
		})).then((response) => {
			let validator = typeof this.options.dailyValueValidator === 'function' ? this.options.dailyValueValidator : (value, date, dailyValues) => Number.isFinite(value);
			return _.mapValues(_.fromPairs(response.data), (value, date, dailyValues) => {
				value = Number.parseFloat(value);
				return {value: value, valid: validator(value, date, dailyValues)};
			});
		});
	},

	/**
	 * Gets a collection of sums of days which exceeded threshold in year.
	 * @returns {Object} Ex: {'2016':22,'2015': 11}
	 */
	getYearExceedance(dailyValues) {
		let validator = typeof this.options.yearValidator === 'function' ? this.options.yearValidator : () => true;

		return _.chain(dailyValues)
		// Group daily values by year
			.reduce((dailyValuesByYear, value, date) => {
				let year = String(date).slice(0, 4);
				dailyValuesByYear[year] = dailyValuesByYear[year] || {};
				dailyValuesByYear[year][date] = value;
				return dailyValuesByYear;
			}, {})
			// For each year group...
			.mapValues((dailyValuesByYear, year, allDailyValuesByYear) => {
				// Sum the number of days which exceeded the threshold.
				let exceedance = _.reduce(dailyValuesByYear, (exceedance, value, date) => {
					if (value.valid && this._thresholdValue(value.value)) {
						return exceedance + 1;
					}
					return exceedance;
				}, 0);
				// Validate year
				let valid = validator(exceedance, dailyValuesByYear, year, allDailyValuesByYear, dailyValues)
				return {
					exceedance: exceedance,
					valid: valid,
					dailyValues: dailyValuesByYear
				}
			})
			.value()
	},
	getExceedanceLinearRegression(yearExceedance) {
		return regression('linear', _(yearExceedance).toPairs().sortBy((v) => v[0]).filter((v) => v[1].valid).map((v) => [parseInt(v[0]), v[1].exceedance]).value());
	},
	/**
	 * Applies threshold function or comparison operator to given value.
	 * @param value
	 * @returns {boolean}
	 * @private
	 */
	_thresholdValue(value) {
		if ('function' === this.options.thresholdFunction) {
			return this.options.thresholdFunction.apply(this, value);
		}
		return this._operators[this.options.thresholdOperator](value, this.options.threshold);
	},

	/**
	 * Aggregate consecutive daily values into a rolling window value for each day. (acts on this._dailyValues)
	 * @returns
	 * @private
	 */
	_rollingWindowDailyValues(dailyValues) {
		return _.mapValues(dailyValues, (value, date) => {
			let valuesInWindow = [value.value];
			for (let i = this.options.rollingWindow - 1; i > 0; i--) {
				let newdate = new Date(date);
				newdate.setDate(newdate.getDate() - i);
				newdate.setMinutes(newdate.getMinutes() - newdate.getTimezoneOffset());
				newdate = newdate.toISOString().slice(0, 10);
				if (undefined !== dailyValues[newdate] && dailyValues[newdate].valid) {
					valuesInWindow.push(dailyValues[newdate].value);
				}
			}
			if (typeof this.options.rollingWindowFunction === 'function') {
				value.value = this.options.rollingWindowFunction(valuesInWindow);
			} else if (this.options.rollingWindowFunction === 'mean') {
				value.value = _.mean(valuesInWindow);
			}
			else {
				value.value = _.sum(valuesInWindow);
			}
			return value;
		});
	},
	_updateSpinner(msg = '') {
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
				$(this.element).append(`<div class="spinner"><i class="spinner-icon"></i><span class="sr-only">Loading...</span><span class="msg">${msg}</span></div>`);
			}
		}
	},
	_showExceedanceTimelineGraph(dailyValues) {
		this._updateSpinner(false);
		_.forEach(this._views, ($view) => {$view.hide();});
		if (undefined !== this._views.$yearlyExceedanceGraph) {
			this._views.$yearlyExceedanceGraph.show();
			return;
		}
		let yearExceedance = this.getYearExceedance(dailyValues);
		let exceedanceLine = _(yearExceedance).toPairs().map((v) => {
			return {x: String(v[0]), y: v[1].valid ? v[1].exceedance : Number.NaN}
		}).sortBy('x').value();
		let exceedanceTrendPercentage;
		let exceedanceTrendLine;
		if (typeof this.options.trendableValidator !== 'function' || this.options.trendableValidator(yearExceedance)) {
			let exceedanceTrend = this.getExceedanceLinearRegression(yearExceedance);

			//we just want the first and last points for the trendline.
			exceedanceTrendLine = [
				{x: exceedanceLine[0].x, y: exceedanceTrend.points[0][1]},
				{
					x: exceedanceLine[exceedanceLine.length - 1].x,
					y: exceedanceTrend.points[exceedanceTrend.points.length - 1][1]
				}
			];
			exceedanceTrendPercentage = _.round((exceedanceTrendLine[1].y - exceedanceTrendLine[0].y) / (exceedanceTrendLine[1].x - exceedanceTrendLine[0].x), 3);
		}
		this._views.$yearlyExceedanceGraph = $('<canvas></canvas>').uniqueId().appendTo(this.element);
		this.chart = new Chart(this._views.$yearlyExceedanceGraph, {
				label: `Yearly Exceedance`,
				type: 'line',
				animationEnabled: false,
				data: {
					datasets: [
						{
							label: exceedanceTrendPercentage ? `Trend (${exceedanceTrendPercentage}% / yr)` : 'Trend (not enough data)',
							data: exceedanceTrendLine,
							fill: false,
							borderColor: '#63dd2c',
							borderWidth: 2,
							lineTension: 0,
							pointRadius: 0,
						},
						{
							label: `Yearly Exceedance`,
							data: exceedanceLine ? exceedanceLine : [],
							borderColor: '#307bda',
							borderWidth: 2,
							pointRadius: 2,
							lineTension: 0.1,
							fill: true,
							spanGaps: false,
							backgroundColor: "rgba(50, 121, 216, 0.2)"
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
					},
					tooltips: {
						callbacks: {
							afterLabel: (tooltipItem, data) => {
								if (tooltipItem.datasetIndex = 1) {
									return 'Invalid/missing daily values: ' + _.size(_.filter(yearExceedance[data.datasets[1].data[tooltipItem.index].x].dailyValues, (v) => {
										return v.valid === false
									}));
								}
								return '';
							}
						}
					}
				}
			}
		);
	},
	/**
	 * Gets the value of the given percentile of daily values.
	 * @param percentile 0-100
	 * @returns {number}
	 */
	getPercentileValue(percentile) {
		//get all valid values from _dailyValues
		let dailyValues = _(this._dailyValues).filter((v) => v.valid && v.value > 0).sortBy((v) => v.value).value();
		let len = dailyValues.length;
		let index;
		percentile = percentile / 100;
		// [0] 0th percentile is the minimum value...
		if (percentile <= 0.0) {
			return dailyValues[0].value;
		}
		// [1] 100th percentile is the maximum value...
		if (percentile >= 1.0) {
			return dailyValues[len - 1].value;
		}
		// Calculate the vector index marking the percentile:
		index = ( len * percentile ) - 1;

		// [2] Is the index an integer?
		if (index === Math.floor(index)) {
			// Value is the average between the value at index and index+1:
			return ( dailyValues[index].value + dailyValues[index + 1].value ) / 2.0;
		}
		// [3] Round up to the next index:
		index = Math.ceil(index);
		return dailyValues[index].value;
	},
	_clearData() {
		this._dailyValues = null;
	}
});

