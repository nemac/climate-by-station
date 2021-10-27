import View from "./view_base.js";
import {get_data} from "../io";
import _ from "lodash-es";

export default class DailyTemperatureNormalized extends View {

		async request_update() {

				const options = this.parent.options;

				let threshold = options.threshold;

				if(options.daily_values === null) {
						this.parent._show_spinner();
						let data = await (await get_data(options, this.parent.variables)).data;
						options.daily_values = this.get_daily_values(data);

						const normal_options = {
								station: options.station,
								sdate: (new Date().getFullYear() - 4) + '-01-01',
								edate: (new Date().getFullYear()) + '-12-31',
								variable: options.variable + "_normal",
								dataAPIEndpoint: 'https://data.rcc-acis.org/'
						}

						const normal_data = await(await get_data(normal_options, this.parent.variables)).data;
						options.normal_values = this.get_daily_values(normal_data);

						this.parent._hide_spinner();
				}

				const daily_values = options.daily_values;

				const normal_values = options.normal_values;
				const normal_entries = Object.entries(normal_values);

				let years = [];
				let days = [];
				let values = [];
				let normals = [];

				Object.entries(daily_values).forEach(e => {

						let year = e[0].slice(0, 4);
						if(!years.includes(Number.parseInt(year))) {
								years.push(Number.parseInt(year));
						}
						days.push(e[0]);
						values.push(e[1].value);

				})

				const diff_days = this.parent.days_between(days[0], normal_entries[normal_entries.length - 1][0]);
				let counter = normal_entries.length - 1;
				for(let i = diff_days; i > 0; i--) {
						values[i] = values[i] - normal_entries[counter][1].value;

						counter--;

						if(counter < 0) {
								counter = normal_entries.length - 1;
						}
				}

				const chart_layout = {
						xaxis: {
								range: [(years[years.length - 1] - 30) + "-01-01", (years[years.length - 1]) + "-01-01"]
						},
						yaxis: {
								title: {
										text:"Daily Temperature Values"
								}
						},
						legend: {
								"orientation": "h"
						},
						annotations: [
								{
										x: 1,
										y: threshold,
										xref: 'paper',
										yref: 'y',
										text: `Threshold of ${options.variable === 'precipitation' ? options.threshold + " inches" : options.threshold + " °F"}`,
										xanchor: 'right',
										yanchor: 'bottom',
										showarrow: false,
										font: {
												size: 10
										},
										visible: true
								}
						]
				}

				let chart_data = [
						{
								x: days,
								y: values,
								name: "Daily Normalized Values",
								mode: "lines",
								line: {
										color: 'rgb(50,136,189)',
										width: 0.5
								}
						},
						{
								name: "Threshold",
								x: [years[0], years[years.length - 1]],
								y: [threshold, threshold],
								mode: "lines",
								line: {
										color: 'rgb(0,0,0)',
										width: 1
								}
						}
				]

				Plotly.react(this.element, chart_data, chart_layout, {displaylogo: false, modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d']});
		}

		get_daily_values(data) {

				return _.mapValues(_.fromPairs(data), (value) => {
						let valid = this.parent.validator(value);
						return {value: valid ? Number.parseFloat(this.parent._get_value(value)) : Number.NaN, valid: valid}
				})

		}


}
