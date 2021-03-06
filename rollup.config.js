// rollup.config.js
import babel from '@rollup/plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';
let production = process.env.build_env === 'prod' || process.env.build_env === 'production'
const plugins = [
		nodeResolve(),
];
if (production){
		plugins.push(
				babel({
						exclude: 'node_modules/**', // only transpile our source code
						babelHelpers: 'bundled',
				})
		)
}
export default [{
		input: './src/main.js',
		output: {
				file: 'dist/climate_by_station_widget.js',
				format: 'umd',
				name: 'ClimateByStationWidget',
				sourcemap: !production ? 'inline' : false,
		},
		plugins: plugins
}];
