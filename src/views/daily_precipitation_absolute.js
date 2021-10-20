import View from "./view_base.js";
import {get_threshold_data} from "../io";
import _ from "lodash-es";

export default class DailyPrecipitationAbsolute extends View {

		async request_update() {

				if(this.parent.daily_values === null) {
						this.parent._show_spinner();
						let data = await (await get_threshold_data(this.parent.options)).data;
						this.parent.daily_values = this.get_daily_values(data);
						this.parent._hide_spinner();
				}

				let days = [];
				let daily_values = [];
				let missing_values = [];

				Object.entries(this.parent.daily_values).forEach(e => {
						// If the
						if(e[1].valid) {
								days.push(e[0]);
								daily_values.push(e[1].value);
								// missing_values.push( _.size(_.filter(e[1].dailyValues, (v) => {
								// 		return !v.valid;
								// })) );
						}
				})

				console.log(days, daily_values);

				const chart_layout = {
						// xaxis: this.parent._get_x_axis_layout(years),
						// yaxis: this.parent._get_y_axis_layout(),
						legend: {
								"orientation": "h"
						},
						// shapes: [{
						// 		type: 'line',
						// 		x0: years[0],
						// 		y0: this.parent.options.threshold,
						// 		x1: years[years.length - 1],
						// 		y1: this.parent.options.threshold
						// }]
				}

				let chart_data = [{
						type: "bar",
						x: days,
						y: daily_values,
						name: "Yearly Exceedance"
				}
						// ,{
				// 		type: "bar",
				// 		x: years,
				// 		y: missing_values,
				// 		name: "Invalid/missing daily values"
				// }
				]

				Plotly.react(this.element, chart_data, chart_layout, {modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d']});
		}

		get_daily_values(data) {

				return _.mapValues(_.fromPairs(data), (value) => {
						let valid = this.parent.validator(value);
						return {value: valid ? Number.parseFloat(this.parent._get_value(value)) : Number.NaN, valid: valid}
				})

		}


}
