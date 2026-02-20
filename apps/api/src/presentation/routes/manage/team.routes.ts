import { Router, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import {
  listTeamMembers,
  AVAILABLE_PERMISSIONS,
  ROLE_PERMISSIONS,
  inviteTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  resendInvitation,
  cancelInvitation,
  listInvitations,
} from '../../../application/use-cases/team/index.js';

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

// GET /api/v1/manage/team - Get team members
router.get(
  '/',
  requirePermission('staff:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await listTeamMembers({
      businessId: req.currentBusiness!.businessId,
    });

    res.json({ success: true, data: result });
  })
);

// GET /api/v1/manage/team/permissions - Get available permissions and role defaults
router.get(
  '/permissions',
  requirePermission('staff:read'),
  asyncHandler(async (_req: BusinessAuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        availablePermissions: AVAILABLE_PERMISSIONS,
        rolePermissions: ROLE_PERMISSIONS,
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

    const result = await inviteTeamMember({
      businessId: req.currentBusiness!.businessId,
      email: data.email,
      role: data.role,
      permissions: data.permissions,
      invitedByUserId: req.user!.id,
    });

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${data.email}`,
      data: result,
    });
  })
);

// PUT /api/v1/manage/team/:userId/role - Update team member role
router.put(
  '/:userId/role',
  requirePermission('staff:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = updateRoleSchema.parse(req.body);

    const result = await updateTeamMemberRole({
      businessId: req.currentBusiness!.businessId,
      memberId: req.params.userId,
      role: data.role,
      permissions: data.permissions,
    });

    res.json({ success: true, message: 'Team member role updated', data: result });
  })
);

// DELETE /api/v1/manage/team/:userId - Remove team member
router.delete(
  '/:userId',
  requirePermission('staff:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await removeTeamMember({
      businessId: req.currentBusiness!.businessId,
      memberId: req.params.userId,
      requestUserId: req.user!.id,
      requestUserRole: req.currentBusiness!.role,
    });

    res.json({ success: true, message: 'Team member removed' });
  })
);

// GET /api/v1/manage/team/invitations - Get pending invitations
router.get(
  '/invitations',
  requirePermission('staff:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await listInvitations({
      businessId: req.currentBusiness!.businessId,
    });

    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/team/invitations/:id/resend - Resend invitation
router.post(
  '/invitations/:id/resend',
  requirePermission('staff:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await resendInvitation({
      businessId: req.currentBusiness!.businessId,
      inviteId: req.params.id,
      resentByUserId: req.user!.id,
    });

    res.json({ success: true, message: 'Invitation resent', data: result });
  })
);

// DELETE /api/v1/manage/team/invitations/:id - Cancel invitation
router.delete(
  '/invitations/:id',
  requirePermission('staff:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await cancelInvitation({
      businessId: req.currentBusiness!.businessId,
      inviteId: req.params.id,
    });

    res.json({ success: true, message: 'Invitation cancelled' });
  })
);

export default router;
