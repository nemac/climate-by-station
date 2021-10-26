;"use strict";

// uncomment if you want to use jspm module loading instead of cdn/manual loading
// import _ from "lodash";
// import $ from "jquery";
// import Chart from "chart.js";
// import "jquery-ui";
// import "jquery-ui/ui/unique-id";
// import "chart.js";


$.widget("fernleaf.item", {
	options: {
		station: '',
		sdate: 'por',
		edate: (new Date().getFullYear()) + '-12-31',
		variable: 'precipitation',
		threshold: 1.0,
		thresholdOperator: '>',
		thresholdFilter: '',
		thresholdFunction: undefined, //Pass in a custom function: function(this, values){ return _.sum(values) > v2; }
		window: 1,
		dailyValueValidator: undefined, // Pass in a custom validator predicate function(value, date){return date.slice(0, 4) > 1960 && value > 5 }
		yearValidator: undefined,
		barColor: "#307bda",
		dataAPIEndpoint: "https://data.rcc-acis.org/",
	},
	_variables: {
		precipitation: {
			queryElements: [{"name": "pcpn", 'units': 'inch'}],
			windowBehavior: 'rollingSum',
		},
		tmax: {
			queryElements: [{"name": "maxt", "units": "degreeF"}],
			windowBehavior: 'all'
		},
		tmin: {
			queryElements: [{"name": "mint", "units": "degreeF"}],
			windowBehavior: 'all'
		},
		tavg: {
			queryElements: [{"name": "avgt", "units": "degreeF"}],
			windowBehavior: 'all'
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
	_views: {},
	_filters: {
		KtoC: (v) => v + 273.15,
		CtoK: (v) => v - 273.15,
		FtoC: (v) => ((v * 9 / 5) + 32),
		CtoF: (v) => ((v - 32) * 5 / 9),
		InchToCM: (v) => v * 2.54,
		CMtoInch: (v) => v / 2.54,
		DaytoWeek: (v) => v / 7,
		WeektoDay: (v) => v * 7,
		DaytoYear: (v) => v / 365,
		YeartoDay: (v) => v * 365,
	},
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
					this._dailyValues = dailyValues;
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
		if (['station', 'variable', 'sdate', 'edate'].includes(key)) {
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
				if (value === 'T') {
					value = '0'
				}
				value = Number.parseFloat(value);
				if (value == -999) {
					value = Number.NaN
				}
				return {value: value, valid: validator(value, date, dailyValues)};
			});
		});
	},

	/**
	 * Gets a collection of counts of days which exceeded threshold in year.
	 * @returns {Object} Ex: {'2016':22,'2015': 11}
	 */
	getYearExceedance(dailyValues) {
		let validator;
		if (this.options.variable === 'precipitation') {validator = this._precip_year_validator;}
		else {validator = this._temp_year_validator}
		if (typeof this.options.yearValidator === 'function') {validator = this.options.yearValidator;}

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
					//gather values from window
					let valuesInWindow = [];
					if (value.valid) {
						valuesInWindow.push(value.value);
					}
					for (let i = this.options.window - 1; i > 0; i--) {
						let newdate = new Date(date);
						newdate.setDate(newdate.getDate() - i);
						newdate = newdate.toISOString().slice(0, 10);
						if (undefined !== dailyValues[newdate] && dailyValues[newdate].valid) {
							valuesInWindow.push(dailyValues[newdate].value);
						}
					}
					if (valuesInWindow.length > 0 && this._thresholdFunction(valuesInWindow)) {
						return exceedance + 1;
					}
					return exceedance;
				}, 0);
				// Validate year
				let valid = validator(exceedance, dailyValuesByYear, year, allDailyValuesByYear, dailyValues);
				return {
					exceedance: exceedance,
					valid: valid,
					dailyValues: dailyValuesByYear
				}
			})
			.value()
	},
	/**
	 * Applies threshold function or comparison operator to given values (array of values in window).
	 * @param values
	 * @returns {boolean}
	 * @private
	 */
	_thresholdFunction(values) {
		if ('function' === this.options.thresholdFunction) {
			return this.options.thresholdFunction(this, values);
		}
		let operator = this._operators[this.options.thresholdOperator];
		switch (this._variables[this.options.variable].windowBehavior) {
			case 'rollingSum':
				return operator(_.sum(values), this.options.threshold);
				break;
			case 'any':
				return _.any(values, (value) => operator(value, this.options.threshold));
				break;
			case 'all':
				return _.every(values, (value) => operator(value, this.options.threshold));
				break;
		}
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
		let validYears = 0;
		let yearExceedance = this.getYearExceedance(dailyValues);
		let exceedanceBars = _(yearExceedance).toPairs().map((v) => {
			if (v[1].valid){
				validYears++
			}
			return {x: String(v[0]), y: v[1].valid ? v[1].exceedance : Number.NaN}
		}).sortBy('x').value();
		this.exceedanceByYear = exceedanceBars;
		this._views.$yearlyExceedanceGraph = $('<canvas></canvas>').uniqueId().appendTo(this.element);

		// White background for downloaded images.
		Chart.plugins.register({
			beforeDraw: function(chartInstance) {
				var ctx = chartInstance.chart.ctx;
				ctx.fillStyle = "white";
				ctx.fillRect(0, 0, chartInstance.chart.width, chartInstance.chart.height);
			}
		});

		this.chart = new Chart(this._views.$yearlyExceedanceGraph, {
				label: `Yearly Exceedance`,
				type: 'bar',
				animationEnabled: false,
				data: {
					datasets: [
						{
							label: `Yearly Exceedance`,
							data: exceedanceBars ? exceedanceBars : [],
							fill: true,
							backgroundColor: this.options.barColor ? this.options.barColor : "#307bda",
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					animation: {
						duration: 0,
					},
					scales: {
						xAxes: [{
							type: 'time',
							display: true,
							distribution: 'linear',
							time: {
								unit: 'year',
								unitStepSize: 3,
								max: String(parseInt(String(this.options.edate).slice(0, 4)) + 1)
							},
							scaleLabel: {
								fontSize: 13,
								display: true,
								labelString: 'Year'
							},
							position: 'bottom'
						}],
						yAxes: [{
							display: true,
							scaleLabel: {
								fontSize: 13,
								display: true,
								labelString: 'Events per Year Above Threshold'
							}, ticks: {
								beginAtZero: true
							}
						}]
					},
					tooltips: {
						callbacks: {
							afterLabel: (tooltipItem, data) => {
								if (tooltipItem.datasetIndex === 0) {
									return 'Invalid/missing daily values: ' + _.size(_.filter(yearExceedance[data.datasets[0].data[tooltipItem.index].x].dailyValues, (v) => {
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
		index = (len * percentile) - 1;

		// [2] Is the index an integer?
		if (index === Math.floor(index)) {
			// Value is the average between the value at index and index+1:
			return _.round((dailyValues[index].value + dailyValues[index + 1].value) / 2.0, 3);
		}
		// [3] Round up to the next index:
		index = Math.ceil(index);
		return _.round(dailyValues[index].value, 3);
	},
	_clearData() {
		this._dailyValues = null;
	},
	_precip_year_validator(exceedance, dailyValuesByYear, year, allDailyValuesByYear, dailyValues) {
		let validByMonth = {};
		_.forEach(dailyValuesByYear, (v, date) => {
			let month = date.substring(date.indexOf('-') + 1, date.indexOf('-') + 3);
			if (!validByMonth.hasOwnProperty(month)) {
				validByMonth[month] = 0
			}
			if (v.valid) {
				validByMonth[month] = validByMonth[month] + 1
			}
		});
		return (Object.keys(validByMonth).length === 12) && _.every(validByMonth, (valid, month) => {
				return ((new Date(year, month, 0).getDate()) - valid) <= 1;
			}
		);
	},
	_temp_year_validator(exceedance, dailyValuesByYear, year, allDailyValuesByYear, dailyValues) {
		let validByMonth = {};
		_.forEach(dailyValuesByYear, (v, date) => {
			let month = date.substring(date.indexOf('-') + 1, date.indexOf('-') + 3);
			if (!validByMonth.hasOwnProperty(month)) {
				validByMonth[month] = 0
			}
			if (v.valid) {
				validByMonth[month] = validByMonth[month] + 1
			}
		});
		return (Object.keys(validByMonth).length === 12) && _.every(validByMonth, (valid, month) => {
				return ((new Date(year, month, 0).getDate()) - valid) <= 5;
			}
		);
	},
	downloadExceedanceData(link) {
		link.href =  'data:text/csv;base64,' + window.btoa(('year,' + this.options.variable + '\n' + this.exceedanceByYear.map((v)=>[v['x'],v['y']].join(',')).join('\n')));
		link.download = [
			this.options.station,
			"yearly_exceedance",
			this.options.variable,
			this.options.threshold,
			this._variables[this.options.variable]['queryElements'][0]['units'],

		].join('-').replace(/ /g, '_') + '.csv';
	}
});
