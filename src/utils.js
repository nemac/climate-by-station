import _, {round} from "../node_modules/lodash-es/lodash.js";

/**
 * Helper function which handles saving dataurls as files in several browsers.
 *
 * Copied from plotly.js with minimal tweaks https://github.com/plotly/plotly.js/blob/master/src/snapshot/filesaver.js (MIT licensed)
 * Originally based on FileSaver.js  https://github.com/eligrey/FileSaver.js (MIT licensed)
 *
 * @param url
 * @param filename
 */
export async function save_file(url, filename) {
	const saveLink = document.createElement('a');
	const canUseSaveLink = 'download' in saveLink;
	const format = filename.split('.').slice(-1)[0]

	let blob;
	let objectUrl;

	// Copied from https://bl.ocks.org/nolanlawson/0eac306e4dac2114c752
	function fixBinary(b) {
		var len = b.length;
		var buf = new ArrayBuffer(len);
		var arr = new Uint8Array(buf);
		for (var i = 0; i < len; i++) {
			arr[i] = b.charCodeAt(i);
		}
		return buf;
	}

	const IS_DATA_URL_REGEX = /^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;

	// Copied from https://github.com/plotly/plotly.js/blob/master/src/snapshot/helpers.js

	const createBlob = function (url, format) {
		if (format === 'svg') {
			return new window.Blob([url], {type: 'image/svg+xml;charset=utf-8'});
		} else if (format === 'full-json') {
			return new window.Blob([url], {type: 'application/json;charset=utf-8'});
		} else if (format === 'csv') {
			return new window.Blob([url], {type: 'text/csv;charset=utf-8'});
		} else {
			const binary = fixBinary(window.atob(url));
			return new window.Blob([binary], {type: 'image/' + format});
		}
	};

	const octetStream = function (s) {
		document.location.href = 'data:application/octet-stream' + s;
	};

	const IS_SAFARI_REGEX = /Version\/[\d\.]+.*Safari/;
	// Safari doesn't allow downloading of blob urls
	if (IS_SAFARI_REGEX.test(window.navigator.userAgent)) {
		const prefix = format === 'svg' ? ',' : ';base64,';
		octetStream(prefix + encodeURIComponent(url));
		return filename;
	}

	// IE 10+ (native saveAs)
	if (typeof window.navigator.msSaveBlob !== 'undefined' && !url.match(IS_DATA_URL_REGEX)) {
		// At this point we are only dealing with a decoded SVG as
		// a data URL (since IE only supports SVG)
		blob = createBlob(url, format);
		window.navigator.msSaveBlob(blob, filename);
		blob = null;
		return filename;
	}

	const DOM_URL = window.URL || window.webkitURL;

	if (canUseSaveLink) {
		if (!!url.match(IS_DATA_URL_REGEX)) {
			objectUrl = url
		} else {
			blob = createBlob(url, format);
			objectUrl = DOM_URL.createObjectURL(blob)
		}
		saveLink.href = objectUrl;
		saveLink.download = filename;
		document.body.appendChild(saveLink);
		saveLink.click();

		document.body.removeChild(saveLink);
		DOM_URL.revokeObjectURL(objectUrl);
		blob = null;

		return filename;
	}
	throw new Error('download error')

}

export function format_export_data(column_labels, data, message_row = null, rounding_precision = null) {
	const export_data = [];
	if (message_row !== null) {
		export_data.push(message_row);
	}
	if (column_labels !== null) {
		export_data.push(column_labels);
	}
	const round_fn = rounding_precision === null ? (v) => v : (v) => round(v, rounding_precision)

	for (const row of data) {
		export_data.push([row[0], row.slice(1).map(round_fn)])
	}

	// return 'data:text/csv;base64,' + window.btoa(export_data.map((a) => a.join(', ')).join('\n'));
	return export_data.map((a) => a.join(', ')).join('\n');
}

export function confidence_interval(n, s) {
	const z = 1.96 // 95% confidence
	s = s / 100;
	return round(z * Math.sqrt((s * (1 - s)) / n) * 100, 1);
}


export function get_percentile_value(percentile, daily_values, gt_0 = false) {
	//get all valid values from _dailyValues

	percentile = Number.parseFloat(percentile);
	if (gt_0) {
		daily_values = _(daily_values).filter((v) => v.valid && v.value > 0).sortBy((v) => v.value).value();
	} else {
		daily_values = _(daily_values).filter((v) => v.valid).sortBy((v) => v.value).value();
	}
	let len = daily_values.length;
	let index;
	percentile = percentile / 100;
	// [0] 0th percentile is the minimum value...
	if (percentile <= 0.0) {
		return daily_values[0].value;
	}
	// [1] 100th percentile is the maximum value...
	if (percentile >= 1.0) {
		return daily_values[len - 1].value;
	}
	// Calculate the vector index marking the percentile:
	index = (len * percentile) - 1;

	// [2] Is the index an integer?
	if (index === Math.floor(index)) {
		// Value is the average between the value at index and index+1:
		return _.round((daily_values[index].value + daily_values[index + 1].value) / 2.0, 3);
	}
	// [3] Round up to the next index:
	index = Math.ceil(index);
	return _.round(daily_values[index].value, 3);
}

/**
 * Retrieve a value from a naive js cache. Supports Web Storage API Objects alongside in memory JS objects.
 *
 * @param {Object[]} cache_objs - A list of objects to attempt to retrieve the value from. e.g. [my_in_memory_object, sessionStorage, localStorage]
 * @param key
 * @return {null|*}
 */
export function get_cache_item(cache_objs, key) {
	let v = null;
	for (const cache_obj of cache_objs) {
		if (cache_obj.hasOwnProperty('getItem')) {
			v = cache_obj.get(key)
		} else {
			if (key in cache_obj) {
				v = cache_obj[key]
			}
		}
		if (v) {
			if (v[0] < Date.now()) {
				return v[1]
			} else{
				if (cache_obj.hasOwnProperty('removeItem')){
					cache_obj.removeItem(key)
				}
				else {
					delete cache_obj[key]
				}
			}
		}
	}
	return null
}

/**
 * Set a value in a naive js cache. Supports Web Storage API Objects alongside in memory JS objects. Allows promises to be set immediately (if a plain js Object is given as a cache object), then stores the result when the promise resolves.
 *
 * @param {Object[]} cache_objs - A list of objects to attempt to cache the value in, preferring the last object first. e.g. [my_in_memory_obj, sessionStorage, localStorage]
 * @param key
 * @param value
 * @param {number} ttl - Milliseconds to keep the cached value
 */
export function set_cache_item(cache_objs, key, value, ttl = 60 * 60 * 1000) {
	const v = [Date.now() + ttl, value];
	cache_objs = [...cache_objs]
	cache_objs.reverse()
	if (value.hasOwnProperty('then')){
		value.then((result)=>{
			del_cache_item(cache_objs, key)
			set_cache_item(cache_objs, key, result, v[0])
		})
	}

for (const cache_obj of cache_objs) {
		// attempt to use Web Storage API
		if (cache_obj.hasOwnProperty('setItem')) {
			try {
				cache_obj.set(key, v);
			} catch { // attempt to clear cache in case it's just full
				if (cache_obj.hasOwnProperty('clear')) {
					cache_obj.clear() // naively dump storage since we are not in full control of this object
					cache_obj.set(key, v)
					return
				}
			}
		}
		// fallback to in memory storage
		try {
			// check all cache objs for expiry
			for (const k of Object.keys(cache_obj)) {
				const now = Date.now()
				if (cache_obj[k][0] > now){
					delete cache_obj[k]
				}
			}
			// set the new cache key
			cache_obj[key] = v;
			return
		} catch {
			// do nothing
		}

	}
}

/**
 * Remove item from cache based on key.
 *
 * @param cache_objs
 * @param key
 */
export function del_cache_item(cache_objs, key){
	for (const cache_obj of cache_objs) {
		// attempt to use Web Storage API
		if (cache_obj.hasOwnProperty('removeItem')) {
			try {
				cache_obj.removeItem(key);
			} catch {
				// do nothing
			}
		}
		try {
			delete cache_obj[k]
		} catch {
			// do nothing
		}
	}
}
