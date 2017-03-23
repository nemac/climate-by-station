;"use strict";
import $ from 'jquery';
import "../src/jquery.fl-item.js";
import Sass from '/jspm_packages/npm/sass.js@0.10.3/dist/sass';

// initialize a Sass instance
const sass = new Sass('/jspm_packages/npm/sass.js@0.10.3/dist/sass.worker.js');

sass.preloadFiles('/assets/scss/', '', [
	'fl-item.scss'
], () => {
	sass.compileFile('fl-item.scss', (result) => {$('#compiled-styles').html(result.text)});
});

export default function () {
	$("#output").item({
		station: $('#station').val(),
		currentView: 'graph'
	});
	$('#station').change(() => {
		$("#output").item('option', 'station', $('#station').val()).item('update');
	});
	$('#threshold').change(function () {
		$("#output").item('option', 'threshold', parseFloat($('#threshold').val())).item('update');
	});
	$('#variable').change(() => {
		let queryElements, missingValueTreatment;
		switch ($('#varaible').val()) {
			case 'pcpn':
				queryElements = [{"name": "pcpn", 'units': 'inch'}];
				missingValueTreatment = 'drop';
				$('#thresholdUnits').text('in');
				$('#threshold').val(1.0);
				break;
			case 'tmax':
				queryElements = [{"name": "maxt", "units": "degreeF"}];
				missingValueTreatment = 'drop';
				$('#thresholdUnits').text('F');
				$('#threshold').val(95);
				break;
			case 'tmin':
				queryElements = [{"name": "mint", "units": "degreeF"}];
				missingValueTreatment = 'drop';
				$('#thresholdUnits').text('F');
				$('#threshold').val(95);
				break;
			case 'tavg':
				queryElements = [{"name": "avgt", "units": "degreeF"}];
				missingValueTreatment = 'drop';
				$('#thresholdUnits').text('F');
				$('#threshold').val(95);
				break;
		}
		$("#output").item({
			queryElements: queryElements,
			missingValueFilter: missingValueTreatment,
			threshold: parseFloat($('#threshold').val())
		}).item('update');
	});
	$('#operator').change(() => {
		$("#output").item({thresholdOperator: $('#operator').val()}).item('update');
	});
	$('#95ththreshold').click(() => {
		$('#threshold').val($("#output").item('getQuantile', 95)).trigger('change');
	});
	$('#90ththreshold').click(() => {
		$('#threshold').val($("#output").item('getQuantile', 90)).trigger('change');
	});
	$('#rollingSum').change(() => {
		$("#output").item({rollingSum: parseInt($('#rollingSum').val())});
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
