import View from "./view_base.js";
import _, {cloneDeep} from "../../node_modules/lodash-es/lodash.js";
import {fetch_acis_station_data} from "../io.js";
import {format_export_data, get_percentile_value} from "../utils.js";

export default class AnnualExceedance extends View {

		constructor(parent, element) {
				super(parent, element);
		}

		async request_update() {

				const options = this.parent.options;
				let daily_values = this.parent.get_daily_values(options.station, options.variable, false);
				if (daily_values === null) {
						// create a promise for data and set it on parent.daily_values so that it gets cached.
						daily_values = this.parent.set_daily_values(options.station, options.variable, false, fetch_acis_station_data(options, this.parent.variables[options.variable].acis_elements).then(a => a.data).then(this.get_daily_values.bind(this)))
				}
				// unwrap/await daily values if they are promises.
				if (typeof daily_values === "object" && typeof daily_values.then === "function") {
						this.parent._show_spinner();
						daily_values = await daily_values;
				}
				this.parent._hide_spinner();
				if (options.threshold == null && options.threshold_percentile !== null && options.threshold_percentile >= 0) {
						options.threshold = get_percentile_value(options.threshold_percentile, daily_values, options.variable === 'precipitation');
				}

				let exceedance = this.get_year_exceedance(daily_values);

				let years = [];
				let exceedance_values = [];
				let missing_values = [];

				Object.entries(exceedance).forEach(e => {

						const year = e[0];
						const exceedance = e[1].exceedance;
						const missing = _.size(_.filter(e[1].dailyValues, (v) => {
								return !v.valid;
						}));

						if (e[1].valid) {
								years.push(year);
								exceedance_values.push(exceedance);
								missing_values.push(missing);
						} else {
								years.push(year);
								exceedance_values.push(Number.NaN);
								missing_values.push(Number.NaN);
						}

				})

				this._download_callbacks = {
						annual_exceedance: async () => format_export_data(['year', 'annual_exceedance', 'missing_value'], this.get_download_data(years, exceedance_values, missing_values), null, null)
				}

				this.parent.options.title = this._get_y_axis_title(options.window_days, options.variable, options.threshold, options.threshold_operator);

				const chart_layout = {
						xaxis: this._get_x_axis_layout(years),
						yaxis: this._get_y_axis_layout(options),
						legend: {
								"orientation": "h"
						},
						autosize: true,
						margin: {
								l: 40,
								r: 20,
								b: 20,
								t: 5
						}
				}

				let chart_data = [{
						type: "bar",
						x: years,
						y: exceedance_values,
						name: "Yearly Exceedance",
						customdata: missing_values,
						hovertemplate: "Exceedance: %{y} Missing values: %{customdata}"
				}]

				this.layout = chart_layout;

				Plotly.react(this.element, chart_data, chart_layout, {
						displaylogo: false,
						modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d'],
						responsive: true
				});

		}

		get_download_data(years, exceedance, missing) {
				let output = [];

				for(let i = 0; i < years.length; i++) {
						output.push([years[i], exceedance[i], missing[i]]);
				}

				return output;
		}

		get_year_exceedance(dailyValues) {
				let validator;
				let variable = this.parent.options.variable;
				let window = this.parent.options.window_days;

				if (variable === 'precipitation') {
						validator = this._precipitation_year_validator;
				} else {
						validator = this._temp_year_validator;
				}

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
										for (let i = window - 1; i > 0; i--) {
												let newdate = new Date(date);
												newdate.setDate(newdate.getDate() - i);
												newdate = newdate.toISOString().slice(0, 10);
												if (undefined !== dailyValues[newdate] && dailyValues[newdate].valid) {
														valuesInWindow.push(dailyValues[newdate].value);
												}
										}

										if (valuesInWindow.length > 0 && this._threshold_function(valuesInWindow)) {
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
						.value();
		}

		_threshold_function(values) {

				let operator = this.parent.options.threshold_operator;
				let operator_function = this.operators[operator];

				switch (this.parent.options.window_behaviour) {
						case 'rollingSum':
								return operator_function(_.sum(values), this.parent.options.threshold);
								break;
						case 'all':
								return _.every(values, (value) => operator_function(value, this.parent.options.threshold));
								break;
				}

		}

		get_daily_values(data) {
				return _.mapValues(_.fromPairs(data), (value) => {
						let valid = this.parent.validator(value);
						return {value: valid ? Number.parseFloat(this.parent._get_value(value)) : Number.NaN, valid: valid}
				})
		}

		get operators() {
				return {
						'==': (o1, o2) => o1 === o2,
						'>=': (o1, o2) => o1 >= o2,
						'>': (o1, o2) => o1 > o2,
						'<=': (o1, o2) => o1 <= o2,
						'<': (o1, o2) => o1 < o2,
				}
		}

		_precipitation_year_validator(exceedance, dailyValuesByYear, year, allDailyValuesByYear, dailyValues) {
				let validByMonth = {};

				// Loop through each daily value and separate them by month.
				// Add one to that months total if the value is valid.

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

								return ((new Date(year, month, 0).getDate()) - valid) <= 2;
						}
				);
		}

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
		}


		_get_y_axis_title(window, variable, threshold, operator) {

				let window_str;
				let operator_str;
				let threshold_str;
				let variable_str;

				if (window > 1) {
						window_str = window + "-Day periods/year";
				} else {
						window_str = "Days/year";
				}

				if (variable === "precipitation") {
						variable_str = "precipitation";
						threshold_str = threshold + " in";
				} else if (variable === "tmax") {
						variable_str = "maximum temperature";
						threshold_str = threshold + " °F";
				} else if (variable === "tmin") {
						variable_str = "minimum temperature";
						threshold_str = threshold + " °F";
				} else if (variable === "tavg") {
						variable_str = "average temperature";
						threshold_str = threshold + " °F";
				}

				if (operator === ">=") {
						operator_str = "at least";
				} else if (operator === "<=") {
						operator_str = "no more than";
				}

				return window_str + " with " + variable_str + " of " + operator_str + " " + threshold_str;

		}

		_get_x_axis_layout(x_axis_range) {
				return {
						tickformat: "%Y",
						ticklabelmode: "period",
						type: "date",
						range: [x_axis_range].map(a => a + '-01-01'),
						linecolor: "#828282"
				}
		}

		_get_y_axis_layout(options) {
				return {
						title: {
								text: this.parent.options.hide_y_axis_title ? '' : this._get_y_axis_title(options.window_days, options.variable, options.threshold, options.threshold_operator),
								font: {
										size: 11
								}
						}
				}
		}

		async request_downloads() {
				const {station, variable} = this.parent.options;
				return [
						{
								label: 'Annual Exceedance',
								icon: 'bar-chart',
								attribution: 'ACIS: livneh',
								when_data: this._download_callbacks['annual_exceedance'],
								filename: [
										station,
										"annual_exceedance",
										variable
								].join('-').replace(/ /g, '_') + '.csv'
						},
						{
								label: 'Chart image',
								icon: 'picture-o',
								attribution: 'ACIS: Livneh & LOCA (CMIP 5)',
								when_data: async () => {
										const width = 1440;
										const height = 720;

										const old_layout = cloneDeep(this.layout);

										old_layout.title = ""

										const temp_layout = cloneDeep(this.layout);

										temp_layout.title = cloneDeep(temp_layout.yaxis.title)
										temp_layout.title.text = `<b>${this.parent.options.title}</b>`
										temp_layout.title.x = 0.015;
										temp_layout.title.font = {
												// family: this.options.font === null ? "Roboto" : this.options.font,
												size: 18,
												color: '#124086'
										}
										temp_layout.yaxis.title.text = "";
										temp_layout.margin = {
												l: 50,
												t: 50,
												r: 50,
												b: 50
										}

										await Plotly.relayout(this.element, temp_layout);

										const result = await Plotly.toImage(this.element, {
												format: 'png', width: width, height: height
										});

										await Plotly.relayout(this.element, old_layout);

										return result;
								},
								filename: [
										station,
										variable,
										"graph"
								].join('-').replace(/[^A-Za-z0-9\-]/g, '_') + '.png'
						},
				]
		}

}

