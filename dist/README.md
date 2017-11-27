# jQuery Interactive Timeline Exceedance Module

This widget displays threshold exceedance over time for weather stations. Note that threshold exceedance analysis is sensitive to gaps/missing data in weather station history.


## Usage

1. Include plugin's code (Note that jQuery and jQuery UI are pre-bundled in the minified script, but should not conflict with alternate versions running on the page.):

	```html
	<script src="jquery.fl-item.min.js"></script>
	<link rel="stylesheet" href="fl-item.css" />
	```

2. Call the plugin with desired options:

	```javascript
	$("#widget-div").item({
		station: $('#station').val(), // GHCN-D Station id (required)
		sdate: 'por', // Date string in the form YYYY-MM-DD or 'por'
		edate: '2016-12-31', // Date string in the form YYYY-MM-DD or 'por'
		variable: 'precipitation', // Valid values: 'precipitation', 'tmax', 'tmin', 'tavg'
		threshold: 1.0, 
		thresholdOperator: '>', // Valid values: '==', '>=', '>', '<=', '<'
		thresholdFilter: '', // Transformations/Filters to support additional units. Valid Values: 'KtoC','CtoK','FtoC','CtoF','InchToCM','CMtoInch'
		thresholdFunction: undefined, //Pass in a custom function: function(this, values){ return _.sum(values) > v2; }
		window: 1, // Rolling window size in days.
		dailyValueValidator: undefined, // Pass in a custom validator predicate function(value, date){return date.slice(0, 4) > 1960 && value > 5 }
		yearValidator: undefined, // Similar to dailyValueValidator
		dataAPIEndpoint: "https://data.rcc-acis.org/", 
	});
	```

3. Hook ui change events to pass updates to the widget:
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

Call any of these methods like this: `$("#output").item('getPercentileValue', value)`

