import AnnualExceedance from "./views/annual_exceedance.js";
import DailyPrecipitationAbsolute from "./views/daily_precipitation_absolute.js";
import DailyTemperatureAbsolute from "./views/daily_temperature_absolute";
import DailyTemperatureMinMax from "./views/daily_temperature_minmax";
import _ from "../node_modules/lodash-es/lodash.js";

export default class ClimateByStationWidget {

		constructor(element, options) {
				this.options = {
						view_type: 'annual_exceedance',
						station: 'USC00094429',
						sdate: 'por',
						edate: (new Date().getFullYear()) + '-12-31',
						variable: 'precipitation',
						threshold: 1.0,
						window: 1,
						window_behaviour: 'rollingSum',
						thresholdOperator: '>=',
						dataAPIEndpoint: 'https://data.rcc-acis.org/',
						daily_values: null,
						normal_values: null
				};

				this.variables = {
						precipitation: {
								elements: [{"name": "pcpn", "units": "inch"}]
						},
						precipitation_normal: {
								elements: [{"name": "pcpn", "prec": 1, "normal": "1", "units": "inch"}]
						},
						tmax: {
								elements: [{"name": "maxt", "units": "degreeF"}]
						},
						tmax_normal: {
								elements: [{"name": "maxt", "prec": 1, "normal": "1", "units": "degreeF"}]
						},
						tmin: {
								elements: [{"name": "mint", "units": "degreeF"}]
						},
						tmin_normal: {
								elements: [{"name": "mint", "prec": 1, "normal": "1", "units": "degreeF"}]
						},
						tavg: {
								elements: [{"name": "avgt", "units": "degreeF"}]
						},
						tavg_normal: {
								elements: [{"name": "avgt", "prec": 1, "normal": "1", "units": "degreeF"}]
						},
						temp_min_max: {
								elements: [{"name": "mint", "prec": 1, "units": "degreeF"}, {"name": "maxt", "prec": 1, "units": "degreeF"}]
						},
						temp_min_max_normal: {
								elements: [{"name": "mint", "prec": 1, "normal": "1", "units": "degreeF"}, {"name": "maxt", "prec": 1, "normal": "1", "units": "degreeF"}]
						}
				}

				this.view = null;
				this.element = element;

				this.view_container = document.createElement("div");
				this.view_container.classList.add("climate_by_station_view");

				this.element.append(this.view_container);

				this.spinner_element = document.createElement("div");
				this.spinner_element.classList.add("d-none");
				this.spinner_element.classList.add("d-flex");
				this.spinner_element.classList.add("justify-content-center");
				this.spinner_element.classList.add("align-items-center");
				this.spinner_element.classList.add("h-100");

				this.spinner_styles = [
						".climatebystation-spinner { border: 2px solid #e3e3e3;  border-top: 2px solid #6e6e6e; border-radius: 50%; width: 2rem; height: 2rem; animation: spin 2s linear infinite;}",
						"@keyframes spin { 0% {transform: rotate(0deg);} 100% { transform: rotate(360deg); } }"
				]

				this.spinner_element.innerHTML = `
					<style>${this.spinner_styles.join('')}</style>
					<div class="climatebystation-spinner"></div>
				`

				this.element.append(this.spinner_element);

				this.update(options);
		}

		get_view_class() {

				switch(this.options.view_type) {
						case 'annual_exceedance':
								return AnnualExceedance;
								break;
						case 'daily_precipitation_absolute':
								return DailyPrecipitationAbsolute;
								break;
						case 'daily_temperature_absolute':
								return DailyTemperatureAbsolute;
								break;
						case 'daily_temperature_minmax':
								return DailyTemperatureMinMax;
								break;
				}
		}


		update(options) {

				let old_options = Object.assign({}, this.options);

				this.options = _.merge({}, old_options, options);

				if(old_options.station !== this.options.station) {
						this._reset_widget();
				}

				if(old_options.variable !== this.options.variable) {

						const view_type = this.options.view_type;
						const variable = this.options.variable;

						if(view_type === "annual_exceedance") {
								this._reset_widget();
						} else if(view_type === "daily_temperature_absolute") {
								if(variable === "tmax" || variable === "tmin" || variable === "tavg") {
										this._reset_widget();
								}
						} else if(view_type === "daily_precipitation_absolute") {
								if(variable === "precipitation") {
										this._reset_widget();
								}
						}

				}

				if(old_options.view_type !== this.options.view_type) {
						this.destroy();
				}

				this._update();
		}

		async _update() {

				if(this.view === null) {
						this.view = new (this.get_view_class())(this, this.view_container);
				}

				await this.view.request_update();
		}

		_show_spinner() {
				if(this.spinner_element.classList.contains("d-none")) {
						this.spinner_element.classList.remove("d-none");
				}
		}

		_hide_spinner() {
				if(!this.spinner_element.classList.contains("d-none")) {
						this.spinner_element.classList.add("d-none");
				}
		}

		_get_x_axis_layout(x_axis_range) {
				return {
						tickformat: "%Y",
						ticklabelmode: "period",
						type: "date",
						range: [x_axis_range].map(a => a + '-01-01')
				}
		}

		_get_y_axis_layout() {
				return {
						title: {
								text:"Events per Year Above Threshold"
						}
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

		days_between(date1, date2) {
				const d1 = new Date(date1);
				const d2 = new Date(date2);

				const dif = d2.getTime() - d1.getTime();

				const oneDay = 1000 * 60 * 60 * 24;

				const diffDays = Math.round(dif / oneDay);

				return diffDays;
		}

		_reset_widget() {
				this.options.daily_values = null;
				this.options.normal_values = null;
		}

		destroy() {
				this.view = null;
				// other stuff here
		}
}
