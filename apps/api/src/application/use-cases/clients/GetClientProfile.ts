import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface GetClientProfileInput {
  clientRelationId: string;
  businessId: string;
}

export interface GetClientProfileResult {
  client: any;
}

export async function getClientProfile(input: GetClientProfileInput): Promise<GetClientProfileResult> {
  const client = await ClientBusinessRelation.findOne({
    _id: input.clientRelationId,
    businessId: input.businessId,
  }).populate('clientId', 'profile email phone');

  if (!client) throw new NotFoundError('Client not found');

  return { client };
}

export interface GetClientAppointmentsInput {
  clientRelationId: string;
  businessId: string;
}

export interface GetClientAppointmentsResult {
  appointments: any[];
}

export async function getClientAppointments(input: GetClientAppointmentsInput): Promise<GetClientAppointmentsResult> {
  const client = await ClientBusinessRelation.findOne({
    _id: input.clientRelationId,
    businessId: input.businessId,
  });

  if (!client) throw new NotFoundError('Client not found');

  const appointments = await Appointment.find({
    businessId: input.businessId,
    clientId: client.clientId,
  })
    .populate('staffId', 'profile')
    .sort({ startDateTime: -1 })
    .limit(50);

  return { appointments };
}
