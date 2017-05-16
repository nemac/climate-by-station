;"use strict";
import $ from "jquery";
import "../src/jquery.fl-item.js";

export default function() {
	$("#output").item({
		station: $('#station').val(),
		currentView: 'graph'
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
			case 'pcpn':
				queryElements = [{"name": "pcpn", 'units': 'inch'}];
				missingValueTreatment = 'drop';
				rollingWindowFunction = 'sum';
				$('#thresholdUnits').text('in');
				$('#threshold').val(1.0);
				break;
			case 'tmax':
				queryElements = [{"name": "maxt", "units": "degreeF"}];
				missingValueTreatment = 'drop';
				rollingWindowFunction = 'mean';
				$('#thresholdUnits').text('F');
				$('#threshold').val(95);
				break;
			case 'tmin':
				queryElements = [{"name": "mint", "units": "degreeF"}];
				missingValueTreatment = 'drop';
				rollingWindowFunction = 'mean';
				$('#thresholdUnits').text('F');
				$('#threshold').val(32);
				break;
			case 'tavg':
				queryElements = [{"name": "avgt", "units": "degreeF"}];
				missingValueTreatment = 'drop';
				rollingWindowFunction = 'mean';
				$('#thresholdUnits').text('F');
				$('#threshold').val(95);
				break;
		}
		$("#output").item({
			queryElements: queryElements,
			missingValueFilter: missingValueTreatment,
			threshold: parseFloat($('#threshold').val()),
			rollingWindowFunction: rollingWindowFunction
		}).item('update');
	});
	$('#operator').change(() => {
		$("#output").item({thresholdOperator: $('#operator').val()}).item('update');
	});
	$('#percentileThreshold').change(() => {
		let value = $('#percentileThreshold').val();
		if (value === ''){
			return;
		}
		if ( value <= 0 || value >= 100) {
			$('#percentileThreshold').addClass('form-control-danger');
			return;
		}
		$('#threshold').val($("#output").item('getQuantile', value)).trigger('change');
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
