import AnnualExceedance from "./views/annual_exceedance.js";
import DailyPrecipitationAbsolute from "./views/daily_precipitation_absolute.js";
import DailyTemperatureAbsolute from "./views/daily_temperature_absolute.js";
import DailyTemperatureMinMax from "./views/daily_temperature_minmax.js";
import _ from "../node_modules/lodash-es/lodash.js";
import DailyPrecipitationNormalized from "./views/daily_precipitation_normalized.js";
import DailyTemperatureNormalized from "./views/daily_temperature_normalized.js";
import { save_file } from './utils.js';
import DailyPrecipitationHistogram from "./views/daily_precipitation_histogram.js";
import DailyTemperatureHistogram from "./views/daily_temperature_histogram.js";
import DailyPrecipitationYtd from "./views/daily_precipitation_ytd";

export default class ClimateByStationWidget {

		constructor(element, options) {
				this.options = {
						view_type: (typeof options.view_type === 'undefined') ? 'annual_exceedance' : options.view_type,
						station: 'USC00094429',
						sdate: 'por',
						edate: (new Date().getFullYear()) + '-12-31',
						variable: 'precipitation',
						threshold: 1.0,
						window: 1,
						measurement: "Inches",
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

				this.clickhandler = null;
				this.view = null;
				this.element = element;

				this.view_container = document.createElement("div");
				this.view_container.classList.add("climate_by_station_view");

				this.element.append(this.view_container);

				this.spinner_element = document.createElement("div");

				this.spinner_element.style.position = "absolute";
				this.spinner_element.style.left = "50%";
				this.spinner_element.style.top = "0";
				this.spinner_element.style.transform = "translateY(50%)";
				this.spinner_element.style.height = "100%";

				this.spinner_element.classList.add("d-none");

				this.spinner_styles = [
						".climatebystation-spinner { border: 2px solid #e3e3e3;  border-top: 2px solid #6e6e6e; border-radius: 50%; width: 2rem; height: 2rem; animation: spin 2s linear infinite;}",
						"@keyframes spin { 0% {transform: rotate(0deg);} 100% { transform: rotate(360deg); } }"
				]

				this.spinner_element.innerHTML = `
					<style>${this.spinner_styles.join('')}</style>
					<div class="climatebystation-spinner"></div>
				`

				this.element.append(this.spinner_element);

				this.data_cache = {}; // not implemented yet

				this.update(options);
		}

		get_view_class() {

				switch(this.options.view_type) {
						case 'annual_exceedance':
								return AnnualExceedance;
						case 'daily_precipitation_absolute':
								return DailyPrecipitationAbsolute;
						case 'daily_temperature_absolute':
								return DailyTemperatureAbsolute;
						case 'daily_temperature_minmax':
								return DailyTemperatureMinMax;
						case 'daily_precipitation_normalized':
								return DailyPrecipitationNormalized;
						case 'daily_temperature_normalized':
								return DailyTemperatureNormalized;
						case 'daily_precipitation_histogram':
								return DailyPrecipitationHistogram;
						case 'daily_temperature_histogram':
								return DailyTemperatureHistogram;
						case 'daily_precipitation_ytd':
								return DailyPrecipitationYtd;
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

						this.options.window = 1;

						if(view_type === "daily_precipitation_absolute" || view_type === "daily_precipitation_normalized" || view_type === "daily_precipitation_histogram") {

								/*
								If we are in daily_precipitation_absolute check if the variable selected is valid, if not default to
								precipitation.
								 */

								if(variable === "precipitation") {
										this.options.threshold = 1.0;
										this._reset_widget();
								} else {
										this.options.variable = "precipitation";
										this.options.threshold = 1.0;
										this._reset_widget();
								}

								this.options.measurement = "Inches";

						} else if(view_type === "daily_temperature_absolute" || view_type === "daily_temperature_normalized" || view_type === "daily_temperature_histogram") {

								/*
								If we are in daily_temperature_absolute and the updated variable is valid (tmax, tmin, tavg), update the
								values accordingly, otherwise (ex: selecting precipitation while in temp view) default to tmax.
								 */

								if(variable === "tmax") {
										this.options.threshold = 95.0;
										this._reset_widget();
								} else if(variable === "tmin") {
										this.options.threshold = 32.0;
										this._reset_widget();
								} else if(variable === "tavg") {
										this.options.threshold = 72.0;
										this._reset_widget();
								} else {
										this.options.variable = "tmax";
										this.options.threshold = 95.0;
										this._reset_widget();
								}

								this.options.measurement = "°F";

						} else if(view_type === "annual_exceedance") {
								switch(variable) {
										case "tmax":
												this.options.threshold = 95.0;
												this.options.measurement = "°F";
												break;
										case "tmin":
												this.options.threshold = 32.0;
												this.options.measurement = "°F";
												break;
										case "tavg":
												this.options.threshold = 72.0;
												this.options.measurement = "°F";
												break;
										case "precipitation":
												this.options.threshold = 1.0;
												this.options.measurement = "Inches";
												break;
								}

								this._reset_widget();
						}

				}

				if(old_options.view_type !== this.options.view_type) {
						this.destroy();
						const view_type = this.options.view_type;
						if(view_type === "annual_exceedance" || view_type === "daily_precipitation_absolute" || view_type === "daily_precipitation_normalized" || view_type === "daily_precipitation_histogram") {
								this.options.variable = "precipitation";
								this.options.measurement = "Inches";
								this.options.sdate = "por";
								this.options.edate = (new Date().getFullYear()) + "-12-31";
								this.options.threshold = 1.0;
								this.options.window = 1;
						} else if(view_type === "daily_temperature_absolute" || view_type === "daily_temperature_normalized" || view_type === "daily_temperature_histogram") {
								this.options.variable = "tmax";
								this.options.measurement = "°F";
								this.options.sdate = "por";
								this.options.edate = (new Date().getFullYear()) + "-12-31";
								this.options.threshold = 95.0;
								this.options.window = 1;
						} else if(view_type === "daily_temperature_minmax") {
								this.options.variable = "temp_min_max";
								this.options.sdate = "por";
								this.options.edate = (new Date().getFullYear()) + "-12-31";
						}
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
						this.view_container.style.filter = "opacity(0.5)"
				}
		}

		_hide_spinner() {
				if(!this.spinner_element.classList.contains("d-none")) {
						this.spinner_element.classList.add("d-none");
						this.view_container.style.filter = "opacity(1)"
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

		download_annual_exceedance() {
				return new Promise((resolve, reject) => {
						this.request_downloads().then((downloads) => {
								const download = downloads.find((d) => d['label'] === 'Annual Exceedance')
								if (!download) {
										return reject(new Error('Annual Exceedance is not available for download'));
								}
								download.download().then(() => resolve())
						})
				});
		}

		download_daily_precipitation_absolute() {
				return new Promise((resolve, reject) => {
						this.request_downloads().then((downloads) => {
								const download = downloads.find((d) => d['label'] === 'Daily Precipitation Absolute')
								if (!download) {
										return reject(new Error('Daily Precipitation Absolute is not available for download'));
								}
								download.download().then(() => resolve())
						})
				});
		}

		download_daily_temperature_absolute() {
				return new Promise((resolve, reject) => {
						this.request_downloads().then((downloads) => {
								const download = downloads.find((d) => d['label'] === 'Daily Temperature Absolute')
								if (!download) {
										return reject(new Error('Daily Temperature Absolute is not available for download'));
								}
								download.download().then(() => resolve())
						})
				});
		}

		download_daily_temperature_minmax() {
				return new Promise((resolve, reject) => {
						this.request_downloads().then((downloads) => {
								const download = downloads.find((d) => d['label'] === 'Daily Temperature Minimum and Maximum')
								if (!download) {
										return reject(new Error('Daily Temperature Minimum and Maximum is not available for download'));
								}
								download.download().then(() => resolve())
						})
				});
		}

		download_daily_temperature_normalized() {
				return new Promise((resolve, reject) => {
						this.request_downloads().then((downloads) => {
								const download = downloads.find((d) => d['label'] === 'Daily Temperature Normalized')
								if (!download) {
										return reject(new Error('Daily Temperature Normalized is not available for download'));
								}
								download.download().then(() => resolve())
						})
				});
		}

		download_daily_precipitation_normalized() {
				return new Promise((resolve, reject) => {
						this.request_downloads().then((downloads) => {
								const download = downloads.find((d) => d['label'] === 'Daily Precipitation Normalized')
								if (!download) {
										return reject(new Error('Daily Precipitation Normalized is not available for download'));
								}
								download.download().then(() => resolve())
						})
				});
		}

		download_image() {
				return new Promise((resolve, reject) => {
						this.request_downloads().then((downloads) => {
								const download = downloads.find((d) => d['filename'].slice(-3) === 'png')
								if (!download) {
										return reject(new Error('Chart image is not available for download'));
								}
								download.download().then(() => resolve())
						})
				});
		}

		/**
		 * Gets the available downloads for the current view.
		 * @return {Promise<*[]>}
		 */
		async request_downloads() {
				if (this.view) {
						return (await this.view.request_downloads()).map((d) => new Proxy(
								d,
								{
										get: (target, prop) => {
												if (prop === 'download') {
														return async () => {
																try {
																		const url = await target.when_data();

																		return await save_file(url, target['filename'])
																} catch (e) {
																		console.log('Failed download with message', e)
																		throw new Error('Failed to download ' + target['label'])
																}
														}
												}
												return target[prop]
										}
								}));
				}
				return [];
		}


		destroy() {
				if(this.view) {
						this.view.destroy();
						this._reset_widget();
						this.view = null;
				}
		}
}
