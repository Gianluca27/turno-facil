import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateClientInfoInput {
  clientRelationId: string;
  businessId: string;
  tags?: string[];
  notes?: string;
  allergies?: string[];
  preferences?: string[];
}

export interface UpdateClientInfoResult {
  client: any;
}

export async function updateClientInfo(input: UpdateClientInfoInput): Promise<UpdateClientInfoResult> {
  const { clientRelationId, businessId, tags, notes, allergies, preferences } = input;

  const client = await ClientBusinessRelation.findOneAndUpdate(
    { _id: clientRelationId, businessId },
    { $set: { 'clientInfo.tags': tags, 'clientInfo.notes': notes, 'clientInfo.allergies': allergies, 'clientInfo.preferences': preferences } },
    { new: true },
  );

  if (!client) throw new NotFoundError('Client not found');

  logger.info('Client info updated', { clientRelationId, businessId });

  return { client };
}

export interface BlockClientInput {
  clientRelationId: string;
  businessId: string;
  reason?: string;
}

export interface BlockClientResult {
  client: any;
}

export async function blockClient(input: BlockClientInput): Promise<BlockClientResult> {
  const { clientRelationId, businessId, reason } = input;

  const client = await ClientBusinessRelation.findOneAndUpdate(
    { _id: clientRelationId, businessId },
    { isBlocked: true, blockedAt: new Date(), blockedReason: reason },
    { new: true },
  );

  if (!client) throw new NotFoundError('Client not found');

  logger.info('Client blocked', { clientRelationId, businessId, reason });

  return { client };
}

export interface UnblockClientInput {
  clientRelationId: string;
  businessId: string;
}

export interface UnblockClientResult {
  client: any;
}

export async function unblockClient(input: UnblockClientInput): Promise<UnblockClientResult> {
  const { clientRelationId, businessId } = input;

  const client = await ClientBusinessRelation.findOneAndUpdate(
    { _id: clientRelationId, businessId },
    { isBlocked: false, blockedAt: null, blockedReason: null },
    { new: true },
  );

  if (!client) throw new NotFoundError('Client not found');

  logger.info('Client unblocked', { clientRelationId, businessId });

  return { client };
}

export interface ToggleVipInput {
  clientRelationId: string;
  businessId: string;
}

export interface ToggleVipResult {
  client: any;
  isVip: boolean;
}

export async function toggleVip(input: ToggleVipInput): Promise<ToggleVipResult> {
  const { clientRelationId, businessId } = input;

  const client = await ClientBusinessRelation.findOne({
    _id: clientRelationId,
    businessId,
  });

  if (!client) throw new NotFoundError('Client not found');

  const hasVip = client.clientInfo.tags.includes('VIP');
  const update = hasVip
    ? { $pull: { 'clientInfo.tags': 'VIP' } }
    : { $addToSet: { 'clientInfo.tags': 'VIP' } };

  const updated = await ClientBusinessRelation.findByIdAndUpdate(clientRelationId, update, { new: true });

  logger.info('Client VIP toggled', { clientRelationId, businessId, isVip: !hasVip });

  return { client: updated, isVip: !hasVip };
}
