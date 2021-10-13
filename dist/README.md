# jQuery Interactive Timeline Exceedance Module

This widget displays threshold exceedance over time for weather stations. Note that threshold exceedance analysis is sensitive to gaps/missing data in weather station history.

## Methodology

Daily weather station data is loaded from data services provided by the [Applied Climate Information System (ACIS)](http://www.rcc-acis.org/), then days exceeding the given threshold are aggregated to a yearly count. This provides insight into the frequency of weather events over time. The threshold may be set directly or calculated based on a percentile of the daily values for the selected weather station.
 
 Multi-day events can be viewed by selecting a window greater than 1 day. For precipitation each daily value is summed with the previous X-days values. So there is still a max possible value of 366 for each year. For example, given a 2-day window and 2 inch precipitation threshold:
 
| Day | Precipitation | 2-day Rolling Sum | Counted as an exceedance event |
|-----|---------------|-------------------|--------------------------------|
| 1   | 0             | 0                 | No                             |
| 2   | 1             | 1                 | No                             |
| 3   | 2             | 3                 | Yes                            |
| 4   | 1             | 3                 | Yes                            |
| 5   | 1             | 2                 | Yes                            |
| 6   | 3             | 4                 | Yes                            |
 
For temperature each daily value a rolling mean is used instead of a rolling sum. For example, given a 3-day window and a threshold of 32F:

| Day | Mean Temperature | 3-day Rolling Mean | Counted as an exceedance event |
|-----|-----------------|--------------------|--------------------------------|
| 1   | 14              | 14.0               | No                             |
| 2   | 32              | 23.0               | No                             |
| 3   | 35              | 27.0               | No                             |
| 4   | 34              | 33.7               | Yes                            |
| 5   | 27              | 32.0               | Yes                            |
| 6   | 33              | 31.3               | No                             |
| 7   | 38              | 32.7               | Yes                            |
| 8   | 33              | 34.7               | Yes                            |
| 9   | 29              | 33.3               | Yes                            |

Note that in this example day 1 and 2 don't have data 3 days back to draw upon, however in actual usage we wrap around years and months, so Jan 1 would be meaned with values from Dec 30 and Dec 31.

## Usage
1. Load dependencies using the versions shown below:
	
	```html
	<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js" integrity="sha256-hwg4gsxgFZhOsEEamdOYGBf13FyQuiTwlAQgxVSNgt4=" crossorigin="anonymous"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js" integrity="sha256-KM512VNnjElC30ehFwehXjx1YCHPiQkOPmqnrWtpccM=" crossorigin="anonymous"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.7.1/Chart.bundle.min.js" integrity="sha256-N4u5BjTLNwmGul6RgLoESPNqDFVUibVuOYhP4gJgrew=" crossorigin="anonymous"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.min.js" integrity="sha256-8E6QUcFg1KTnpEU8TFGhpTGHw5fJqB9vCms3OhAYLqw=" crossorigin="anonymous"></script>
	```

2. Load the widget:

	```html
	<script src="jquery.fl-item.min.js"></script>
	<link rel="stylesheet" href="fl-item.css" />
	```

3. Call the widget with desired options on a container element:

	```javascript
	$("#widget-div").item({
		station: $('#station').val(), // GHCN-D Station id (required)
		variable: 'precipitation', // Valid values: 'precipitation', 'tmax', 'tmin', 'tavg'
		threshold: 1.0, 
		thresholdOperator: '>', // Valid values: '==', '>=', '>', '<=', '<'
		thresholdFilter: '', // Transformations/Filters to support additional units. Valid Values: 'KtoC','CtoK','FtoC','CtoF','InchToCM','CMtoInch'
		thresholdFunction: undefined, //Pass in a custom function: function(this, values){ return _.sum(values) > v2; }
		window: 1, // Rolling window size in days.
		dailyValueValidator: undefined, // Pass in a custom validator predicate function(value, date){return date.slice(0, 4) > 1960 && value > 5 }
		yearValidator: undefined, // Similar to dailyValueValidator
		dataAPIEndpoint: "https://data.rcc-acis.org/", 
		barColor: '#307bda' // Color for bars.
	});
	```

3. Hook ui change events to pass updates to the widget (more examples at the end of `demo.js`):
```javascript
$('#station').change(() => {
		$("#output").item('option', 'station', $('#station').val()).item('update');
	});
$('#threshold').change(function () {
	$("#output").item({threshold: parseFloat($('#threshold').val())}).item('update');
});
$('#percentileThreshold').change(() => {
	let value = $('#percentileThreshold').val();
	if (value === '') {
		return;
	}
	if (value <= 0 || value >= 100) {
		$('#percentileThreshold').addClass('form-control-danger');
		return;
	}
	$('#threshold').val($("#output").item('getPercentileValue', value)).trigger('change');
});
```

### Widget methods:
There are a handful of widget methods that may be useful:

**getPercentileValue** - Given a value between 0 and 100, returns the percentile value (which can then be used to set the threshold)

**getDailyValues** - Returns the daily value data that is currently being shown.

**getYearlyExceedance** - Returns a collection of counts of days which exceeded threshold in year.

**downloadExceedanceData** - Given an element like `<a id='download-link'>download</a>` calling `$('#download-link').click(function(e){$('#output').item('download_exceedance_data', e.target)}) will cause the browser to download the data currently shown as a csv of year:exceedance values.

Call any of these methods like this: `$("#output").item('getPercentileValue', value)`



