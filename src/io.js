export async function fetch_acis_station_data(options, acis_elements) {
	const url = options.data_api_endpoint + "StnData";

	const response = await (await fetch(url, {
		method: "POST",
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({
			"sdate": options.sdate,
			"edate": options.edate,
			"elems": acis_elements,
			"sid": options.station
		})
	})).json();

	return response;
}

