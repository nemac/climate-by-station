import View from "./view_base.js";
import _ from "../../node_modules/lodash-es/lodash.js";
import { get_threshold_data } from "../io.js";

export default class ThresholdView extends View {

		constructor(parent, element) {
				super(parent, element);
		}

		async request_update() {

				const {
						station,
						variable,
						window,
						threshold
				} = this.parent.options;

				if(this.parent.daily_values === null) {
						let data = await (await get_threshold_data(this.parent.options)).data;
						this.parent.daily_values = this.get_daily_values(data);
				}

				let exceedance = this.get_year_exceedance(this.parent.daily_values);

				console.log(exceedance);

				let years = [];
				let exceedance_values = [];
				let missing_values = [];

				Object.entries(exceedance).forEach(e => {
						years.push(e[0]);
						exceedance_values.push(e[1].exceedance);
						missing_values.push( _.size(_.filter(e[1].dailyValues, (v) => {
								return !v.valid;
						})) );
				})

				let chart_layout = {
						xaxis: this.parent._get_x_axis_layout(years)
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

				Plotly.react(this.element, chart_data, chart_layout);

		}

		get_year_exceedance(dailyValues) {

				let validator = this._precipitation_year_validator;

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
						.value()
		}

		_threshold_function(values) {

				// Need to add other types of functions (any, all)
				// Currently it only has rollingSum.

				let operator = this.parent.options.thresholdOperator;

				return this.operators()[operator](_.sum(values), this.parent.options.threshold);
		}

		get_daily_values(data) {

				return _.mapValues(_.fromPairs(data), (value) => {
						let valid = this.validator(value);
						return {value: valid ? Number.parseFloat(this._get_value(value)) : Number.NaN, valid: valid}
				})

		}

		operators() {
				return {
						'==': (o1, o2) => o1 == o2,
						'>=': (o1, o2) => o1 >= o2,
						'>': (o1, o2) => o1 > o2,
						'<=': (o1, o2) => o1 <= o2,
						'<': (o1, o2) => o1 < o2,
				}
		}

		validator(value) {

				let _value = this._get_value(value);

				return (!isNaN(_value) && Number.isFinite(_value));
		}

		_get_value(value) {
				if(value === "T") {
						value = 0.0;
				}

				value = Number.parseFloat(value);

				return value;
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
								return ((new Date(year, month, 0).getDate()) - valid) <= 1;
						}
				);
		}
}

