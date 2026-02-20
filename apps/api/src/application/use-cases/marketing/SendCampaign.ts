import mongoose from 'mongoose';
import { Campaign } from '../../../infrastructure/database/mongodb/models/Campaign.js';
import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { notificationService } from '../../../domain/services/NotificationService.js';
import { addJob, QUEUE_NAMES, EmailJobData } from '../../../infrastructure/jobs/queues.js';
import { logger } from '../../../utils/logger.js';
import { buildAudienceQuery } from './shared.js';

export interface SendCampaignInput {
  campaignId: string;
  businessId: string;
}

export interface SendCampaignResult {
  sentCount: number;
  targetCount: number;
  message: string;
}

/**
 * Sends a campaign to its target audience. Retrieves clients matching
 * the audience query, then queues messages by campaign type (email via
 * addJob, push via notificationService, sms via addJob). Updates campaign
 * stats upon completion.
 */
export async function sendCampaign(input: SendCampaignInput): Promise<SendCampaignResult> {
  const { campaignId, businessId } = input;

  const campaign = await Campaign.findOne({
    _id: campaignId,
    businessId,
    status: { $in: ['draft', 'scheduled'] },
  });

  if (!campaign) {
    throw new NotFoundError('Campaign not found or already sent');
  }

  // Get target audience - convert customFilters to expected format
  const customFiltersConverted = campaign.audience?.customFilters ? {
    lastVisitDaysAgo: campaign.audience.customFilters.lastVisitDaysAgo?.min,
    totalVisits: campaign.audience.customFilters.totalVisits?.min,
    totalSpent: campaign.audience.customFilters.totalSpent?.min,
    services: campaign.audience.customFilters.services?.map(s => s.toString()),
    staff: campaign.audience.customFilters.staff?.map(s => s.toString()),
  } : undefined;

  const audienceQuery = await buildAudienceQuery(
    businessId,
    campaign.audience?.type === 'segment' ? campaign.audience?.segment : campaign.audience?.type,
    customFiltersConverted
  );

  const clients = await ClientBusinessRelation.find(audienceQuery)
    .populate('clientId', 'email phone profile.firstName devices')
    .lean();

  if (clients.length === 0) {
    throw new BadRequestError('No clients to send to');
  }

  // Update campaign status
  campaign.status = 'sending';
  campaign.sentAt = new Date();
  campaign.stats.totalRecipients = clients.length;
  await campaign.save();

  // Queue messages based on campaign type
  let sentCount = 0;

  for (const client of clients) {
    const user = client.clientId as unknown as {
      _id: mongoose.Types.ObjectId;
      email?: string;
      phone?: string;
      profile?: { firstName?: string };
      devices?: { fcmToken: string }[];
    };

    if (!user) continue;

    try {
      switch (campaign.type) {
        case 'email':
          if (user.email) {
            await addJob<EmailJobData>(QUEUE_NAMES.EMAILS, {
              to: user.email,
              subject: campaign.content?.title || campaign.name,
              html: (campaign.content?.htmlTemplate || campaign.content?.body || '').replace('{{nombre}}', user.profile?.firstName || 'Cliente'),
            });
            sentCount++;
          }
          break;

        case 'push':
          if (user.devices?.length) {
            await notificationService.sendNotification({
              userId: user._id.toString(),
              type: 'promotion',
              channels: ['push'],
              businessId,
              data: {
                title: campaign.content?.title || campaign.name,
                body: (campaign.content?.body || '').substring(0, 200),
                campaignId: campaign._id.toString(),
              },
            });
            sentCount++;
          }
          break;

        case 'sms':
          if (user.phone) {
            await addJob(QUEUE_NAMES.SMS, {
              to: user.phone,
              body: (campaign.content?.body || '').replace('{{nombre}}', user.profile?.firstName || '').substring(0, 160),
            });
            sentCount++;
          }
          break;
      }
    } catch (error) {
      logger.error('Failed to send campaign message', {
        campaignId: campaign._id,
        userId: user._id,
        error,
      });
    }
  }

  // Update final stats
  campaign.status = 'sent';
  campaign.stats.sent = sentCount;
  await campaign.save();

  logger.info('Campaign sent', {
    campaignId: campaign._id,
    businessId,
    sentCount,
  });

  return {
    sentCount,
    targetCount: clients.length,
    message: `Campaign sent to ${sentCount} clients`,
  };
}
