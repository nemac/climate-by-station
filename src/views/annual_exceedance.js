import View from "./view_base.js";
import _ from "../../node_modules/lodash-es/lodash.js";
import { get_threshold_data } from "../io.js";

export default class AnnualExceedance extends View {

		constructor(parent, element) {
				super(parent, element);
		}

		async request_update() {

				if(this.parent.daily_values === null) {
						this.parent._show_spinner();
						let data = await (await get_threshold_data(this.parent.options)).data;
						this.parent.daily_values = this.get_daily_values(data);
						this.parent._hide_spinner();
				}

				let exceedance = this.get_year_exceedance(this.parent.daily_values);

				let years = [];
				let exceedance_values = [];
				let missing_values = [];

				Object.entries(exceedance).forEach(e => {
						// If the
						if(e[1].valid) {
								years.push(e[0]);
								exceedance_values.push(e[1].exceedance);
								missing_values.push( _.size(_.filter(e[1].dailyValues, (v) => {
										return !v.valid;
								})) );
						}
				})

				const chart_layout = {
						xaxis: this.parent._get_x_axis_layout(years),
						yaxis: this.parent._get_y_axis_layout(),
						legend: {
								"orientation": "h"
						}
				}

				let chart_data = [{
						type: "bar",
						x: years,
						y: exceedance_values,
						name: "Yearly Exceedance"
				},{
						type: "bar",
						x: years,
						y: missing_values,
						name: "Invalid/missing daily values"
				}]

				Plotly.react(this.element, chart_data, chart_layout, {modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d']});

		}

		get_year_exceedance(dailyValues) {
				let validator;
				if(this.parent.options.variable === 'precipitation') {
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
										for (let i = this.parent.options.window - 1; i > 0; i--) {
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

				let operator = this.parent.options.thresholdOperator;
				let operator_function = this.operators()[operator];

				switch(this.parent.options.window_behaviour) {
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

		operators() {
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

		_get_percentile_value(percentile) {
				//get all valid values from _dailyValues
				let dailyValues = _(this.parent.daily_values).filter((v) => v.valid && v.value > 0).sortBy((v) => v.value).value();

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
		}
}

