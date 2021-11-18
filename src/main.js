import AnnualExceedance from "./views/annual_exceedance.js";
import DailyPrecipitationAbsolute from "./views/daily_precipitation_absolute.js";
import DailyTemperatureAbsolute from "./views/daily_temperature_absolute.js";
import DailyTemperatureMinMax from "./views/daily_temperature_minmax.js";
import _ from "../node_modules/lodash-es/lodash.js";
import DailyPrecipitationNormalized from "./views/daily_precipitation_normalized.js";
import DailyTemperatureNormalized from "./views/daily_temperature_normalized.js";
import {get_cache_item, save_file, set_cache_item} from './utils.js';
import DailyPrecipitationHistogram from "./views/daily_precipitation_histogram.js";
import DailyTemperatureHistogram from "./views/daily_temperature_histogram.js";
import DailyPrecipitationYtd from "./views/daily_precipitation_ytd";

export default class ClimateByStationWidget {

		/**
		 *
		 * @param element
		 * @param {Object} options
		 * @param {number} options.threshold_percentile - Allows setting the threshold based on percentile of daily values. When updated, set options.threshold to null to signify that percentile should be calculated.
		 * @param {Object} options.cache_obj - Pass a common object for caching daily values data based on station/variable to reduce API requests.
		 */
		constructor(element, options = {}) {
				this.options = {
						view_type: null, //!!options.view_type ? 'annual_exceedance' : options.view_type,
						station: null,
						sdate: 'por',
						edate: (new Date().getFullYear()) + '-12-31',
						variable: 'precipitation',
						threshold: 1.0,
						threshold_percentile: null,
						window_days: 1,
						window_behaviour: 'rollingSum',
						threshold_operator: '>=',
						data_api_endpoint: 'https://data.rcc-acis.org/',
						cache_objs: null, // [{}, window.localStorage]
				};

				this.variables = {
						precipitation: {
								acis_elements: [{"name": "pcpn", "units": "inch"}]
						},
						precipitation_normal: {
								acis_elements: [{"name": "pcpn", "prec": 1, "normal": "1", "units": "inch"}]
						},
						tmax: {
								acis_elements: [{"name": "maxt", "units": "degreeF"}]
						},
						tmax_normal: {
								acis_elements: [{"name": "maxt", "prec": 1, "normal": "1", "units": "degreeF"}]
						},
						tmin: {
								acis_elements: [{"name": "mint", "units": "degreeF"}]
						},
						tmin_normal: {
								acis_elements: [{"name": "mint", "prec": 1, "normal": "1", "units": "degreeF"}]
						},
						tavg: {
								acis_elements: [{"name": "avgt", "units": "degreeF"}]
						},
						tavg_normal: {
								acis_elements: [{"name": "avgt", "prec": 1, "normal": "1", "units": "degreeF"}]
						},
				}

				// this.daily_values = {};
				// this.normal_values = {};

				this.clickhandler = null;
				this.view = null;

				if (typeof element === "string") {
						element = document.querySelector(this.element);
				} else if (typeof element === 'object' && typeof element.jquery !== 'undefined') {
						element = element[0];
				}

				this.element = element;

				this.view_container = document.createElement("div");
				this.view_container.classList.add("climate-by-station-view");

				this.element.append(this.view_container);

				this.spinner_element = document.createElement("div");

				this.spinner_element.style.position = "absolute";
				this.spinner_element.style.left = "50%";
				this.spinner_element.style.top = "50%";
				this.spinner_element.style.transform = "translate(-50%, -50%)";

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

				this.update(options);
		}

		get_view_class() {

				switch (this.options.view_type) {
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

				// shortcut threshold change
				 if(Object.keys(options).length === 1
					 && Object.keys(options)[0] === 'threshold'
					 && options.threshold !== null
					 && this.view
					 && this.view.hasOwnProperty('set_threshold')) {
						 this.view.set_threshold(options.threshold);
						 return;
				 }

				this.options = _.merge({}, old_options, options);

				if (old_options.view_type !== this.options.view_type) {
						this.destroy();
						const view_type = this.options.view_type;

						this.options.sdate = "por";
						this.options.edate = (new Date().getFullYear()) + "-12-31";

						if (view_type === "annual_exceedance" || view_type === "daily_precipitation_absolute" || view_type === "daily_precipitation_normalized" || view_type === "daily_precipitation_histogram") {
								this.options.variable = "precipitation";
								this.options.threshold = !options.hasOwnProperty("threshold") || options.threshold === null ? 1.0 : options.threshold;
								this.options.window_days = options.hasOwnProperty("window_days") ? options.window_days : 1;
						} else if (view_type === "daily_temperature_absolute" || view_type === "daily_temperature_normalized" || view_type === "daily_temperature_histogram") {
								this.options.variable = "tmax";
								this.options.threshold = !options.hasOwnProperty("threshold") || options.threshold === null ? 95.0 : options.threshold;
						} else if (view_type === "daily_temperature_minmax") {
								this.options.variable = "tmax";
						}
				}

				if (old_options.variable !== this.options.variable) {
						const view_type = this.options.view_type;

						this.options.window_days = options.hasOwnProperty("window_days") ? options.window_days : 1;

						if (view_type === "daily_precipitation_absolute" || view_type === "daily_precipitation_normalized" || view_type === "daily_precipitation_histogram") {
								this.options.variable = "precipitation";
						} else if (view_type === "daily_temperature_absolute" || view_type === "daily_temperature_normalized" || view_type === "daily_temperature_histogram") {
								this.options.variable = this.options.variable === 'precipitation' ? old_options.variable || "tmax" : this.options.variable;
						}

						if (this.options.variable === "precipitation") {
								this.options.threshold = !options.hasOwnProperty("threshold") || options.threshold === null ? 1.0 : options.threshold;
						} else {
								if (this.options.variable === "tmin") {
										this.options.threshold = !options.hasOwnProperty("threshold") || options.threshold === null ? 32.0 : options.threshold;
								} else if (this.options.variable === "tavg") {
										this.options.threshold = !options.hasOwnProperty("threshold") || options.threshold === null ? 72.0 : options.threshold;
								} else { // catchall set to tmax
										this.options.variable = "tmax";
										this.options.threshold = !options.hasOwnProperty("threshold") || options.threshold === null ? 95.0 : options.threshold;
								}
						}
				}

				if (this.options.threshold === null && this.options.threshold_percentile === null) {
						if (this.options.variable === "precipitation") {
								this.options.threshold = 1.0;
						} else {
								if (this.options.variable === "tmin") {
										this.options.threshold = 32.0;
								} else if (this.options.variable === "tavg") {
										this.options.threshold = 72.0;
								} else { // catchall set to tmax
										this.options.variable = "tmax";
										this.options.threshold = 95.0;
								}
						}
				}

				if (!this.options.station) {
						this._show_spinner();
						return;
				}

				this._update();
		}

		async _update() {

				if (this.view === null) {
						const view_class = this.get_view_class();
						if (!view_class) {
								return
						}
						this.view = new view_class(this, this.view_container);
				}

				await this.view.request_update();


				window.setTimeout((() => {
						this.element.dispatchEvent(new CustomEvent('update_complete', {}));
				}).bind(this));
		}

		_show_spinner() {
				if (this.spinner_element.classList.contains("d-none")) {
						this.spinner_element.classList.remove("d-none");
						this.view_container.style.filter = "opacity(0.5)"
				}
		}

		_hide_spinner() {
				if (!this.spinner_element.classList.contains("d-none")) {
						this.spinner_element.classList.add("d-none");
						this.view_container.style.filter = "opacity(1)"
				}
		}

		validator(value) {

				let _value = this._get_value(value);

				return (!isNaN(_value) && Number.isFinite(_value));
		}

		_get_value(value) {
				if (value === "T") {
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

		download_daily_temperature_histogram() {
				return new Promise((resolve, reject) => {
						this.request_downloads().then((downloads) => {
								const download = downloads.find((d) => d['label'] === 'Daily Temperature Histogram')
								if (!download) {
										return reject(new Error('Daily Temperature Histogram is not available for download'));
								}
								download.download().then(() => resolve())
						})
				});
		}

		download_daily_precipitation_histogram() {
				return new Promise((resolve, reject) => {
						this.request_downloads().then((downloads) => {
								const download = downloads.find((d) => d['label'] === 'Daily Precipitation Histogram')
								if (!download) {
										return reject(new Error('Daily Precipitation Histogram is not available for download'));
								}
								download.download().then(() => resolve())
						})
				});
		}

		download_daily_precipitation_ytd() {
				return new Promise((resolve, reject) => {
						this.request_downloads().then((downloads) => {
								const download = downloads.find((d) => d['label'] === 'Daily Precipitation YTD')
								if (!download) {
										return reject(new Error('Daily Precipitation YTD is not available for download'));
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

		get variable_unit() {
				return this.options.variable === "precipitation" ? "in" : "°F";
		}

		get cache_objs() {
				if (!this._cache_objs) {
						if (!!this.options.cache_obj) {
								this._cache_objs = this.options.cache_objs
						} else {
								// default to using a js obj and localStorage.
								if (!this._cache_obj) {
										this._cache_obj = {}
								}
								this._cache_objs = [this._cache_obj, localStorage]
						}
				}
				return this._cache_objs
		}

		/**
		 * Retrieves the cached daily values based on the station/variable/whether the data are observations or normals.
		 *
		 * @param station The station
		 * @param variable The variable
		 * @param normals Whether the daily values represent normals (true) or observed(false) data
		 * @return {Object|Promise<Object>|null} May return the daily values directly, a promise which will will resolve to the values, or null.
		 */
		get_daily_values(station, variable, normals = false) {
				const v = get_cache_item(this.cache_objs, [station, variable, normals ? 'normals' : 'observed'].join('_'));
				if (!v) {
						return null;
				}
				if (typeof v === "object" && typeof v.then === "function") {
						return v;
				} else {
						return Promise.resolve(v);
				}
		}

		/**
		 * Caches the given daily values according to the station/variable/whether the data are observations or normals. Unpacks promises.
		 *
		 * @param station The station
		 * @param variable The variable
		 * @param normals Whether the daily values represent normals (true) or observed(false) data
		 * @param values The daily values or a promise that will resolved to give the daily values.
		 * @return {Object|Promise<Object>}
		 */
		set_daily_values(station, variable, normals = false, values) {
				set_cache_item(this.cache_objs, [this.options.station, variable, normals ? 'normals' : 'observed'].join('_'), values)
				return values;
		}


		destroy() {
				if (this.view) {
						this.view.destroy();
						Plotly.purge(this.view.element);
						this.view = null;
				}
		}
}
