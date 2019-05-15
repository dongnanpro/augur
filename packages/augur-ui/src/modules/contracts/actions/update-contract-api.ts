import { augur } from "services/augurjs";

export const UPDATE_EVENTS_API = "UPDATE_EVENTS_API";
export const UPDATE_FUNCTIONS_API = "UPDATE_FUNCTIONS_API";
export const UPDATE_FROM_ADDRESS = "UPDATE_FROM_ADDRESS";

export const updateEventsAPI = (eventsAPI: any) => ({
  type: UPDATE_EVENTS_API,
  data: { eventsAPI }
});

export const updateFunctionsAPI = (functionsAPI: any) => (
  dispatch: Function
) => {
  augur.api = augur.generateContractApi(functionsAPI);
  dispatch({ type: UPDATE_FUNCTIONS_API, data: { functionsAPI } });
};

export const updateFromAddress = (fromAddress: String) => (
  dispatch: Function,
  getState: Function
) => {
  dispatch({ type: UPDATE_FROM_ADDRESS, data: { fromAddress } });
  augur.api = augur.generateContractApi(getState().functionsAPI);
};