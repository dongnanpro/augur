import async from 'async';
import { augur } from '../../../services/augurjs';
import { updateAccountPositionsData, updateAccountTradesData, updateAccountBidsAsksData, updateAccountCancelsData, updateCompleteSetsBought } from '../../../modules/my-positions/actions/update-account-trades-data';
import { clearAccountTrades } from '../../../modules/my-positions/actions/clear-account-trades';
import { sellCompleteSets } from '../../../modules/my-positions/actions/sell-complete-sets';
import { selectPositionsPlusAsks } from '../../user-open-orders/selectors/positions-plus-asks';

export function loadAccountTrades(marketID, cb) {
	return (dispatch, getState) => {
		const { loginAccount } = getState();
		const account = loginAccount.address;
		if (account) {
			const options = { market: marketID };
			if (loginAccount.registerBlockNumber) {
				options.fromBlock = loginAccount.registerBlockNumber;
			}
			if (!marketID) dispatch(clearAccountTrades());
			async.parallel({
				positions: (callback) => {
					augur.getAdjustedPositions(account, options, (err, positions) => {
						if (err) return callback(err);
						const positionsPlusAsks = selectPositionsPlusAsks(account, positions, getState().orderBooks);
						dispatch(updateAccountPositionsData(positionsPlusAsks, marketID));
						callback(null, positionsPlusAsks);
					});
				},
				trades: callback => augur.getAccountTrades(account, options, (trades) => {
					if (!trades || trades.error) return callback(trades);
					console.log('trades:', trades);
					dispatch(updateAccountTradesData(trades, marketID));
					callback(null, trades);
				}),
				bidsAsks: callback => augur.getAccountBidsAsks(account, options, (err, bidsAsks) => {
					if (err) return callback(err);
					console.log('bidsAsks:', bidsAsks);
					dispatch(updateAccountBidsAsksData(bidsAsks, marketID));
					callback(null, bidsAsks);
				}),
				cancels: callback => augur.getAccountCancels(account, options, (err, cancels) => {
					if (err) return callback(err);
					console.log('cancels:', cancels);
					dispatch(updateAccountCancelsData(cancels, marketID));
					callback(null, cancels);
				}),
				completeSetsBought: callback => augur.getBuyCompleteSetsLogs(account, options, (err, logs) => {
					if (err) return callback(err);
					const completeSetsBought = augur.parseCompleteSetsLogs(logs);
					dispatch(updateCompleteSetsBought(completeSetsBought, marketID));
					callback(null, completeSetsBought);
				})
			}, (err, data) => {
				if (err) return console.error('loadAccountTrades error:', err);
				if (augur.options.debug.trading) {
					console.log('loadAccountTrades data:', data);
				}
				dispatch(sellCompleteSets(marketID, cb));
			});
		} else if (cb) cb();
	};
}
