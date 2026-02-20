import mongoose from 'mongoose';
import { User } from '../../../infrastructure/database/mongodb/models/User.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError, ConflictError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import { ROLE_PERMISSIONS } from './ListTeamMembers.js';

export interface InviteTeamMemberInput {
  businessId: string;
  invitedByUserId: string;
  email: string;
  role: string;
  permissions?: string[];
}

export interface InviteTeamMemberResult {
  invitation: any;
}

export async function inviteTeamMember(input: InviteTeamMemberInput): Promise<InviteTeamMemberResult> {
  const { businessId, invitedByUserId, email, role, permissions } = input;

  // Check if user exists
  const user = await User.findOne({ email: email.toLowerCase() });

  // Check if already a member
  const business = await Business.findById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  if (user) {
    const existingMember = business.team?.find(
      (m: { userId: mongoose.Types.ObjectId }) => m.userId.toString() === user._id.toString()
    );
    if (existingMember) {
      throw new ConflictError('User is already a team member');
    }

    // Check if user is owner
    if (business.ownerId.toString() === user._id.toString()) {
      throw new ConflictError('Cannot invite the business owner');
    }
  }

  // Get permissions
  const resolvedPermissions = permissions || ROLE_PERMISSIONS[role] || [];

  // Create invitation
  const invitation = {
    email: email.toLowerCase(),
    role,
    permissions: resolvedPermissions,
    invitedBy: new mongoose.Types.ObjectId(invitedByUserId),
    invitedAt: new Date(),
    status: 'pending',
    token: new mongoose.Types.ObjectId().toString(),
  };

  // Add to pending invitations
  if (!business.pendingInvitations) {
    business.pendingInvitations = [];
  }

  // Remove existing pending invitation for same email
  business.pendingInvitations = business.pendingInvitations.filter(
    (inv: { email: string }) => inv.email !== email.toLowerCase()
  );

  business.pendingInvitations.push(invitation);
  await business.save();

  // TODO: Send invitation email
  logger.info('Team invitation created', {
    businessId,
    email,
    role,
    invitedBy: invitedByUserId,
  });

  return { invitation: { ...invitation, token: undefined } };
}
