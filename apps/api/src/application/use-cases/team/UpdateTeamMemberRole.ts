import mongoose from 'mongoose';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import { ROLE_PERMISSIONS } from './ListTeamMembers.js';

export interface UpdateTeamMemberRoleInput {
  businessId: string;
  memberId: string;
  role: string;
  permissions?: string[];
}

export interface UpdateTeamMemberRoleResult {
  member: any;
}

export async function updateTeamMemberRole(input: UpdateTeamMemberRoleInput): Promise<UpdateTeamMemberRoleResult> {
  const { businessId, memberId, role, permissions } = input;

  const business = await Business.findById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  // Check if trying to modify owner
  if (business.ownerId.toString() === memberId) {
    throw new BadRequestError('Cannot modify owner role');
  }

  // Find member
  const memberIndex = business.team?.findIndex(
    (m: { userId: mongoose.Types.ObjectId }) => m.userId.toString() === memberId
  );

  if (memberIndex === undefined || memberIndex === -1) {
    throw new NotFoundError('Team member not found');
  }

  // Get permissions
  const resolvedPermissions = permissions || ROLE_PERMISSIONS[role] || [];

  // Update member
  if (business.team) {
    business.team[memberIndex].role = role as 'admin' | 'manager' | 'staff' | 'receptionist';
    business.team[memberIndex].permissions = resolvedPermissions;
  }
  await business.save();

  logger.info('Team member role updated', {
    businessId,
    memberId,
    newRole: role,
  });

  return { member: business.team?.[memberIndex] };
}
