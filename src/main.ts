import { renderDAUChart } from './temp';

document.addEventListener('DOMContentLoaded', async () => {

	const dauChartEl= document.getElementById('dailyUsersChart');
	if (dauChartEl) {
		await renderDAUChart(dauChartEl);
	}
});