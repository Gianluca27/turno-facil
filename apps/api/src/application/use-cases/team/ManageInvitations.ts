import mongoose from 'mongoose';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

// --- Resend Invitation ---

export interface ResendInvitationInput {
  businessId: string;
  inviteId: string;
  resentByUserId: string;
}

export interface ResendInvitationResult {
  success: boolean;
}

export async function resendInvitation(input: ResendInvitationInput): Promise<ResendInvitationResult> {
  const { businessId, inviteId, resentByUserId } = input;

  const business = await Business.findById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  const inviteIndex = business.pendingInvitations?.findIndex(
    (inv: { _id?: mongoose.Types.ObjectId; email?: string }) =>
      inv._id?.toString() === inviteId || inv.email === inviteId
  );

  if (inviteIndex === undefined || inviteIndex === -1) {
    throw new NotFoundError('Invitation not found');
  }

  // Update invitation
  if (business.pendingInvitations) {
    business.pendingInvitations[inviteIndex].invitedAt = new Date();
    business.pendingInvitations[inviteIndex].token = new mongoose.Types.ObjectId().toString();
    await business.save();

    // TODO: Resend invitation email
    logger.info('Team invitation resent', {
      businessId,
      email: business.pendingInvitations[inviteIndex].email,
      resentBy: resentByUserId,
    });
  }

  return { success: true };
}

// --- Cancel Invitation ---

export interface CancelInvitationInput {
  businessId: string;
  inviteId: string;
}

export interface CancelInvitationResult {
  success: boolean;
}

export async function cancelInvitation(input: CancelInvitationInput): Promise<CancelInvitationResult> {
  const { businessId, inviteId } = input;

  const business = await Business.findById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  business.pendingInvitations = business.pendingInvitations?.filter(
    (inv: { _id?: mongoose.Types.ObjectId; email?: string }) =>
      inv._id?.toString() !== inviteId && inv.email !== inviteId
  );
  await business.save();

  logger.info('Team invitation cancelled', { businessId, inviteId });

  return { success: true };
}

// --- List Invitations ---

export interface ListInvitationsInput {
  businessId: string;
}

export interface ListInvitationsResult {
  invitations: Array<{
    id: mongoose.Types.ObjectId | undefined;
    email: string;
    role: string;
    invitedAt: Date;
    status: string;
  }>;
}

export async function listInvitations(input: ListInvitationsInput): Promise<ListInvitationsResult> {
  const { businessId } = input;

  const business = await Business.findById(businessId).lean();
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  const invitations = (business.pendingInvitations || []).map((inv: {
    _id?: mongoose.Types.ObjectId;
    email: string;
    role: string;
    invitedAt: Date;
    status: string;
  }) => ({
    id: inv._id,
    email: inv.email,
    role: inv.role,
    invitedAt: inv.invitedAt,
    status: inv.status,
  }));

  return { invitations };
}
