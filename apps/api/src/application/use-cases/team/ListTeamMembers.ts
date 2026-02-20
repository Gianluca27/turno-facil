import mongoose from 'mongoose';
import { User } from '../../../infrastructure/database/mongodb/models/User.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export const AVAILABLE_PERMISSIONS = [
  'appointments:read',
  'appointments:write',
  'appointments:delete',
  'clients:read',
  'clients:write',
  'clients:delete',
  'services:read',
  'services:write',
  'services:delete',
  'staff:read',
  'staff:write',
  'staff:delete',
  'finances:read',
  'finances:write',
  'finances:delete',
  'marketing:read',
  'marketing:write',
  'analytics:read',
  'reviews:read',
  'reviews:write',
  'settings:read',
  'settings:write',
  'pos:read',
  'pos:write',
  'pos:delete',
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  manager: [
    'appointments:*',
    'clients:*',
    'services:read',
    'staff:read',
    'finances:read',
    'marketing:read',
    'analytics:read',
    'reviews:*',
    'pos:*',
  ],
  staff: [
    'appointments:read',
    'appointments:write',
    'clients:read',
    'services:read',
    'pos:read',
    'pos:write',
  ],
  receptionist: [
    'appointments:*',
    'clients:read',
    'clients:write',
    'services:read',
    'pos:read',
  ],
};

export interface ListTeamMembersInput {
  businessId: string;
}

export interface ListTeamMembersResult {
  members: any[];
  availableRoles: string[];
  availablePermissions: string[];
}

export async function listTeamMembers(input: ListTeamMembersInput): Promise<ListTeamMembersResult> {
  const { businessId } = input;

  // Get business with team members
  const business = await Business.findById(businessId).lean();

  if (!business) {
    throw new NotFoundError('Business not found');
  }

  // Get user details for team members
  const userIds = business.team?.map((m: { userId: mongoose.Types.ObjectId }) => m.userId) || [];
  const users = await User.find({ _id: { $in: userIds } })
    .select('profile email phone status createdAt')
    .lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const members = (business.team || []).map((member: {
    userId: mongoose.Types.ObjectId;
    role: string;
    permissions: string[];
    invitedAt?: Date;
    joinedAt?: Date;
    status?: string;
  }) => {
    const user = userMap.get(member.userId.toString());
    return {
      id: member.userId,
      user: user ? {
        id: user._id,
        firstName: user.profile?.firstName,
        lastName: user.profile?.lastName,
        email: user.email,
        phone: user.phone,
        avatar: user.profile?.avatar,
        status: user.status,
      } : null,
      role: member.role,
      permissions: member.permissions,
      invitedAt: member.invitedAt,
      joinedAt: member.joinedAt,
      status: member.status || 'active',
    };
  });

  // Add owner
  const owner = await User.findById(business.ownerId).select('profile email phone').lean();
  if (owner) {
    members.unshift({
      id: owner._id,
      user: {
        id: owner._id,
        firstName: owner.profile?.firstName,
        lastName: owner.profile?.lastName,
        email: owner.email,
        phone: owner.phone,
        avatar: owner.profile?.avatar,
        status: 'active' as const,
      },
      role: 'owner',
      permissions: ['*'],
      invitedAt: undefined,
      joinedAt: business.createdAt,
      status: 'active',
    });
  }

  logger.debug('Team members listed', { businessId, count: members.length });

  return {
    members,
    availableRoles: ['admin', 'manager', 'staff', 'receptionist'],
    availablePermissions: AVAILABLE_PERMISSIONS,
  };
}
