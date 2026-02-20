export { listClients } from './ListClients.js';
export type { ListClientsInput, ListClientsResult } from './ListClients.js';

export { getClientProfile, getClientAppointments } from './GetClientProfile.js';
export type {
  GetClientProfileInput,
  GetClientProfileResult,
  GetClientAppointmentsInput,
  GetClientAppointmentsResult,
} from './GetClientProfile.js';

export { updateClientInfo, blockClient, unblockClient, toggleVip } from './UpdateClientRelation.js';
export type {
  UpdateClientInfoInput,
  UpdateClientInfoResult,
  BlockClientInput,
  BlockClientResult,
  UnblockClientInput,
  UnblockClientResult,
  ToggleVipInput,
  ToggleVipResult,
} from './UpdateClientRelation.js';
