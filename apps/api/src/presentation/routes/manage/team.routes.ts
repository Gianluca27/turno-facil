import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User } from '../../../infrastructure/database/mongodb/models/User.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { asyncHandler, NotFoundError, BadRequestError, ConflictError } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { logger } from '../../../utils/logger.js';

const router = Router();

// Validation schemas
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'staff', 'receptionist']),
  permissions: z.array(z.string()).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'staff', 'receptionist']),
  permissions: z.array(z.string()).optional(),
});

// Available permissions
const AVAILABLE_PERMISSIONS = [
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

// Role default permissions
const ROLE_PERMISSIONS: Record<string, string[]> = {
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

// GET /api/v1/manage/team - Get team members
router.get(
  '/',
  requirePermission('staff:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;

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

    res.json({
      success: true,
      data: {
        members,
        availableRoles: ['admin', 'manager', 'staff', 'receptionist'],
        availablePermissions: AVAILABLE_PERMISSIONS,
      },
    });
  })
);

// POST /api/v1/manage/team/invite - Invite team member
router.post(
  '/invite',
  requirePermission('staff:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = inviteSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    // Check if user exists
    let user = await User.findOne({ email: data.email.toLowerCase() });

    // Check if already a member
    const business = await Business.findById(businessId);
    if (!business) {
      throw new NotFoundError('Business not found');
    }

    if (user) {
      const existingMember = business.team?.find(
        (m: { userId: mongoose.Types.ObjectId }) => m.userId.toString() === user!._id.toString()
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
    const permissions = data.permissions || ROLE_PERMISSIONS[data.role] || [];

    // Create invitation
    const invitation = {
      email: data.email.toLowerCase(),
      role: data.role,
      permissions,
      invitedBy: new mongoose.Types.ObjectId(req.user!.id),
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
      (inv: { email: string }) => inv.email !== data.email.toLowerCase()
    );

    business.pendingInvitations.push(invitation);
    await business.save();

    // TODO: Send invitation email
    logger.info('Team invitation created', {
      businessId,
      email: data.email,
      role: data.role,
      invitedBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${data.email}`,
      data: { invitation: { ...invitation, token: undefined } },
    });
  })
);

// PUT /api/v1/manage/team/:id/role - Update team member role
router.put(
  '/:id/role',
  requirePermission('staff:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = updateRoleSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;
    const memberId = req.params.id;

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
    const permissions = data.permissions || ROLE_PERMISSIONS[data.role] || [];

    // Update member
    if (business.team) {
      business.team[memberIndex].role = data.role as 'admin' | 'manager' | 'staff' | 'receptionist';
      business.team[memberIndex].permissions = permissions;
    }
    await business.save();

    logger.info('Team member role updated', {
      businessId,
      memberId,
      newRole: data.role,
      updatedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Team member role updated',
      data: { member: business.team?.[memberIndex] },
    });
  })
);

// DELETE /api/v1/manage/team/:id - Remove team member
router.delete(
  '/:id',
  requirePermission('staff:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const memberId = req.params.id;

    const business = await Business.findById(businessId);
    if (!business) {
      throw new NotFoundError('Business not found');
    }

    // Check if trying to remove owner
    if (business.ownerId.toString() === memberId) {
      throw new BadRequestError('Cannot remove owner from team');
    }

    // Check if trying to remove self
    if (req.user!.id === memberId && req.currentBusiness!.role !== 'owner') {
      throw new BadRequestError('Cannot remove yourself from team');
    }

    // Remove member
    business.team = business.team?.filter(
      (m: { userId: mongoose.Types.ObjectId }) => m.userId.toString() !== memberId
    );
    await business.save();

    // Remove business from user's businesses array
    await User.findByIdAndUpdate(memberId, {
      $pull: { businesses: { businessId: new mongoose.Types.ObjectId(businessId) } },
    });

    logger.info('Team member removed', {
      businessId,
      memberId,
      removedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Team member removed',
    });
  })
);

// POST /api/v1/manage/team/:id/resend-invite - Resend invitation
router.post(
  '/:id/resend-invite',
  requirePermission('staff:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const inviteId = req.params.id;

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
        resentBy: req.user!.id,
      });
    }

    res.json({
      success: true,
      message: 'Invitation resent',
    });
  })
);

// DELETE /api/v1/manage/team/invite/:id - Cancel invitation
router.delete(
  '/invite/:id',
  requirePermission('staff:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const inviteId = req.params.id;

    const business = await Business.findById(businessId);
    if (!business) {
      throw new NotFoundError('Business not found');
    }

    business.pendingInvitations = business.pendingInvitations?.filter(
      (inv: { _id?: mongoose.Types.ObjectId; email?: string }) =>
        inv._id?.toString() !== inviteId && inv.email !== inviteId
    );
    await business.save();

    res.json({
      success: true,
      message: 'Invitation cancelled',
    });
  })
);

// GET /api/v1/manage/team/invitations - Get pending invitations
router.get(
  '/invitations',
  requirePermission('staff:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;

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

    res.json({
      success: true,
      data: { invitations },
    });
  })
);

export default router;
