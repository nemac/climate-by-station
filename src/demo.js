;"use strict";
import $ from "jquery";
import _ from 'lodash';
import '../src/jquery.fl-item'

export default function () {
	$("#output").fliitem({
		station: $('#station').val(),
		// This example year validator ignores years which have less than 293 (80%) valid daily values.
		// A more advanced validator might ignore years before 1940, or years with more than 30 days of contiguous missing data.
		yearValidator: (exceedance, dailyValuesByYear, year, allDailyValuesByYear, allDailyValues) => {
			return _.size(_.filter(dailyValuesByYear, (value) => value.valid)) >= 293
		},
		// This example trendable validator won't let us run trends for less than 10 years of valid data
		trendableValidator:(exceedanceData)=>{
			return _.size(_.filter(exceedanceData, (value) => value.valid)) > 10
		}
	});
	$('#station').change(() => {
		$("#output").item('option', 'station', $('#station').val()).item('update');
	});
	$('#threshold').change(function () {
		$("#output").item({threshold: parseFloat($('#threshold').val())}).item('update');
	});
	$('#variable').change(() => {
		let queryElements, missingValueTreatment, rollingWindowFunction;
		switch ($('#variable').val()) {
			case 'precipitation':
				$('#thresholdUnits').text('in');
				$('#threshold').val(1.0);
				break;
			case 'tmax':
				$('#thresholdUnits').text('F');
				$('#threshold').val(95);
				break;
			case 'tmin':
				$('#thresholdUnits').text('F');
				$('#threshold').val(32);
				break;
			case 'tavg':
				$('#thresholdUnits').text('F');
				$('#threshold').val(95);
				break;
		}
		$("#output").item({threshold: parseFloat($('#threshold').val()), variable: $('#variable').val()}).item('update');
	});
	$('#operator').change(() => {
		$("#output").item({thresholdOperator: $('#operator').val()}).item('update');
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
	$('#95ththreshold').click(() => {
		$('#percentileThreshold').val(95).trigger('change');
	});
	$('#90ththreshold').click(() => {
		$('#percentileThreshold').val(90).trigger('change');
	});
	$('#80ththreshold').click(() => {
		$('#percentileThreshold').val(80).trigger('change');
	});
	$('#rollingWindow').change(() => {
		$("#output").item({rollingWindow: parseInt($('#rollingWindow').val())});
		$("#output").item('update');
	});
	$('#sdate').change(() => {
		$("#output").item({sdate: parseInt($('#sdate').val())});
		$("#output").item('update');
	});
	$('#edate').change(() => {
		$("#output").item({edate: parseInt($('#edate').val())});
		$("#output").item('update');
	});
};
