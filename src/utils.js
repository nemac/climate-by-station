import {round} from "../node_modules/lodash-es/lodash.js";

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
				if (!!url.match(IS_DATA_URL_REGEX)){
						objectUrl = url
				}else {
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

export function format_export_data(column_labels, data, message_row=null, rounding_precision=null) {
		const export_data = [];
		if (message_row !== null){
				export_data.push(message_row);
		}
		if (column_labels !== null){
				export_data.push(column_labels);
		}
		const round_fn = rounding_precision ===null ? (v)=>v : (v)=>round(v, rounding_precision)

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
