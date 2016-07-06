/*
 * Author: priecint
 */
var ethTx = require("ethereumjs-tx");
var clone = require("clone");
var constants = require("../src/constants");
var BigNumber = require("bignumber.js");

/**
 * Allows to estimate what trading methods will be called based on user's order. This is useful so users know how much
 * they pay for trading
 *
 * @param {String} type buy or sell
 * @param {Number} shares
 * @param {Number} limitPrice
 * @param {String} userAddress To exclude user's orders
 * @param {Number} userPositionShares
 * @param {String} outcomeId
 * @param {Object} marketOrderBook Bids and asks for market (mixed for all outcomes)
 * @param {Function} cb
 * @return {Array}
 */
module.exports = function getTradingActions(type, shares, limitPrice, userAddress, userPositionShares, outcomeId, marketOrderBook, cb) {
	if (type.constructor === Object && type.type) {
		shares = type.shares;
		limitPrice = type.limitPrice;
		userAddress = type.userAddress;
		userPositionShares = type.userPositionShares;
		outcomeId = type.outcomeId;
		marketOrderBook = type.marketOrderBook;
		cb = type.cb;
		type = type.type;
	}

	shares = new BigNumber(shares, 10);
	limitPrice = new BigNumber(limitPrice, 10);

	var augur = this;

	if (type === "buy") {
		var matchingSortedAsks = filterAndSortOrders(marketOrderBook.sell, type, limitPrice, outcomeId, userAddress);

		var areSuitableOrders = matchingSortedAsks.length > 0;
		if (!areSuitableOrders) {
			augur.rpc.gasPrice(function (gasPrice) {
				if (!gasPrice || gasPrice.error) {
					return cb("ERROR: Cannot get gas price");
				}

				cb([getBidAction(shares, limitPrice, gasPrice)]);
			});
		} else {
			augur.rpc.gasPrice(function (gasPrice) {
				if (!gasPrice || gasPrice.error) {
					return cb("ERROR: Cannot get gas price");
				}
				var actions = [];

				var etherToTrade = constants.ZERO;
				var remainingShares = new BigNumber(shares, 10);
				for (var i = 0, length = matchingSortedAsks.length; i < length; i++) {
					var order = matchingSortedAsks[i];
					var orderSharesFilled = BigNumber.min(remainingShares, order.amount);
					etherToTrade = etherToTrade.add(orderSharesFilled.times(new BigNumber(order.price, 10)));
					remainingShares = remainingShares.minus(orderSharesFilled);
					var isUserOrderFilled = remainingShares.equals(constants.ZERO);
					if (isUserOrderFilled) {
						break;
					}
				}
				actions.push(getBuyAction(etherToTrade, shares.minus(remainingShares), gasPrice));

				if (!isUserOrderFilled) {
					actions.push(getBidAction(remainingShares, limitPrice, gasPrice));
				}

				cb(actions);
			});
		}
	} else {
		cb("todo");
	}

	/**
	 *
	 * @param {Array} orders
	 * @param {String} type
	 * @param {BigNumber} limitPrice
	 * @param {String} outcomeId
	 * @param {String} userAddress
	 * @return {Array.<Object>}
	 */
	function filterAndSortOrders(orders, type, limitPrice, outcomeId, userAddress) {
		return orders
			.filter(function filterOrdersByOutcomeAndOwnerAndPrice(order) {
				var isMatchingPrice = type === "buy" ? new BigNumber(order.price, 10).lte(limitPrice) : new BigNumber(order.price, 10).gte(limitPrice);
				return order.outcome === outcomeId &&
					order.owner !== userAddress &&
					isMatchingPrice;
			})
			.sort(function compareOrdersByPrice(order1, order2) {
				return type === "buy" ? order1.price - order2.price : order2.price - order1.price;
			});
	}

	/**
	 *
	 * @param {BigNumber} shares
	 * @param {BigNumber} limitPrice
	 * @param {Number} gasPrice
	 * @return {{action: string, feeEth: string, totalEther: string, avgPrice: string}}
	 */
	function getBidAction(shares, limitPrice, gasPrice) {
		var bidFeeEth = getTxFeeEth(clone(augur.tx.BuyAndSellShares.buy), gasPrice);
		var etherToBid = shares.times(limitPrice);
		return {
			action: "BID",
			feeEth: bidFeeEth.toFixed(),
			totalEther: etherToBid.add(bidFeeEth).toFixed(),
			avgPrice: limitPrice.toFixed()
		};
	}

	/**
	 *
	 * @param {BigNumber} buyEth
	 * @param {BigNumber} sharesFilled
	 * @param {Number} gasPrice
	 * @return {{action: string, feeEth: string, totalEther: string, avgPrice: string}}
	 */
	function getBuyAction(buyEth, sharesFilled, gasPrice) {
		var tradeFeeEth = getTxFeeEth(clone(augur.tx.Trade.trade), gasPrice);
		return {
			action: "BUY",
			feeEth: tradeFeeEth.toFixed(),
			totalEther: buyEth.add(tradeFeeEth).toFixed(),
			avgPrice: buyEth.dividedBy(sharesFilled).toFixed()
		};
	}

	/**
	 *
	 * @param {Object} tx
	 * @param {Number} gasPrice
	 * @return {BigNumber}
	 */
	function getTxFeeEth(tx, gasPrice) {
		tx.gasLimit = tx.gas || constants.DEFAULT_GAS;
		tx.gasPrice = gasPrice;
		var etx = new ethTx(tx);
		return new BigNumber(etx.getUpfrontCost().toString(), 10).dividedBy(constants.ETHER);
	}
};
