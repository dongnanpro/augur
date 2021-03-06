import {
  ADD_PENDING_ORDER,
  REMOVE_PENDING_ORDER,
  UPDATE_PENDING_ORDER,
} from 'modules/orders/actions/pending-orders-management';
import { PendingOrders, BaseAction, UIOrder } from 'modules/types';
import { RESET_STATE } from 'modules/app/actions/reset-state';

const DEFAULT_STATE: PendingOrders = {};

export default function(
  pendingOrders: PendingOrders = DEFAULT_STATE,
  { type, data }: BaseAction
): PendingOrders {
  switch (type) {
    case ADD_PENDING_ORDER: {
      const { pendingOrder, marketId } = data;
      const orders = pendingOrders[marketId] || [];
      if (pendingOrder) orders.push(pendingOrder);

      return {
        ...pendingOrders,
        [marketId]: orders,
      };
    }
    case UPDATE_PENDING_ORDER: {
      const { id, marketId, status, hash } = data;
      const orders = pendingOrders[marketId];
      if (!orders) return pendingOrders;
      const order = orders.find(o => o.id === id);
      if (!order) return pendingOrders;
      order.status = status;
      order.hash = hash;
      return pendingOrders;
    }
    case REMOVE_PENDING_ORDER: {
      let orders = pendingOrders[data.marketId] || [];
      orders = orders.filter(obj => obj.id !== data.id);
      if (orders.length > 0) {
        return {
          ...pendingOrders,
          [data.marketId]: orders,
        };
      }
      delete pendingOrders[data.marketId];
      return {
        ...pendingOrders,
      };
    }
    default:
      return pendingOrders;
  }
}
