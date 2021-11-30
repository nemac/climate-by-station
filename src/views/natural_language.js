import View from "./view_base.js";
import {fetch_acis_station_data} from "../io";
import {get_percentile_value} from "../utils";
import _ from "lodash-es";
import AnnualExceedance from "./annual_exceedance";

export default class NaturalLanguage extends AnnualExceedance {

		async request_update() {

				const options = this.parent.options;
				let daily_values = this.parent.get_daily_values(options.station, options.variable, false);
				if (daily_values === null) {
						// create a promise for data and set it on parent.daily_values so that it gets cached.
						daily_values = this.parent.set_daily_values(options.station, options.variable, false, fetch_acis_station_data(options, this.parent.variables[options.variable].acis_elements).then(a => a.data).then(super.get_daily_values.bind(this)))
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

				let exceedance = super.get_year_exceedance(daily_values);

				let years = [];
				let exceedance_values = [];
				let missing_values = [];
				let total = 0;

				Object.entries(exceedance).forEach(e => {

						const year = e[0];
						const exceedance = e[1].exceedance;
						const missing = _.size(_.filter(e[1].dailyValues, (v) => {
								return !v.valid;
						}));

						if (e[1].valid) {
								exceedance_values.push(exceedance);
								total += exceedance;
								missing_values.push(missing);
						} else {
								exceedance_values.push(Number.NaN);
								missing_values.push(Number.NaN);
						}

						years.push(year);

				})

				const average = (total / (years[years.length - 1] - years[0]));

				const output = this.get_natural_language(this.parent.options.variable, this.parent.options.threshold, this.parent.options.threshold_operator, this.parent.options.window_days, total, average, years[0], years[years.length - 1]);

				console.log(output);

		}

		get_natural_language(variable, threshold, operator, window, total, average, start_year, end_year) {

				let output = `${variable} of ${threshold} ${this.parent.variable_unit}`;
				let operator_text = operator === '>=' ? " or above in a" : " or less in a";

				output += operator_text;
				let window_text = window > 1 ? window + " day period" : "single day";

				output += ` ${window_text} occurred ${total} times (an average of ${average.toFixed(2)} per year) between ${start_year}-${end_year}.`;

				return output;
		}

}
