import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { Gas } from 'modules/modal/gas';
import { closeModal } from 'modules/modal/actions/close-modal';
import { updateGasPriceInfo } from 'modules/app/actions/update-gas-price-info';
import { registerUserDefinedGasPriceFunction } from 'modules/app/actions/register-user-defined-gasPrice-function';
import { AppState } from 'store';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';

const mapStateToProps = (state: AppState) => ({
  modal: state.modal,
  ...state.gasPriceInfo,
  ethToDaiRate: state.appStatus.ethToDaiRate,
});

const mapDispatchToProps = (dispatch: ThunkDispatch<void, any, Action>) => ({
  closeAction: () => dispatch(closeModal()),
  saveAction: (userDefinedGasPrice: number, average: number) => {
    dispatch(updateGasPriceInfo({ userDefinedGasPrice }));
    registerUserDefinedGasPriceFunction(userDefinedGasPrice, average);
    dispatch(closeModal());
  },
});

export default withRouter(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(Gas)
);
