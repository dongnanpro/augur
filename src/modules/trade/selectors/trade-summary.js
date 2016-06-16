import memoizerific from 'memoizerific';
import { formatShares, formatEther } from '../../../utils/format-number';
import { BUY_SHARES } from '../../transactions/constants/types';

export const selectTradeSummary = memoizerific(5)((tradeOrders) => {
	const totals = { shares: 0, ether: 0, gas: 0 };
	const len = tradeOrders && tradeOrders.length || 0;
	let shares;
	let	ether;
	let	gas;
	let tradeOrder;
	let i;

	for (i = 0; i < len; i++) {
		tradeOrder = tradeOrders[i];
		shares = (tradeOrder.shares && tradeOrder.shares.value) || 0;
		ether = (tradeOrder.ether && tradeOrder.ether.value) || 0;
		gas = (tradeOrder.gas && tradeOrder.gas.value) || 0;

		totals.shares += tradeOrder.type === BUY_SHARES ? shares : -shares;
		totals.ether += tradeOrder.type === BUY_SHARES ? -ether : ether;
		totals.gas += gas;
	}

	return {
		totalShares: formatShares(totals.shares),
		totalEther: formatEther(totals.ether),
		totalGas: formatEther(totals.gas),
		tradeOrders
	};
});
