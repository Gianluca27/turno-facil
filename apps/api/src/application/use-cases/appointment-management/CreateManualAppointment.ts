import mongoose from 'mongoose';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import { timeToMinutes, minutesToTime } from '../booking/shared.js';

export interface CreateManualAppointmentInput {
  businessId: string;
  createdByUserId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  staffId: string;
  serviceIds: string[];
  date: string;
  startTime: string;
  notes?: string;
}

export interface CreateManualAppointmentResult {
  appointment: any;
}

export async function createManualAppointment(input: CreateManualAppointmentInput): Promise<CreateManualAppointmentResult> {
  const { businessId, createdByUserId, clientName, clientPhone, clientEmail, staffId, serviceIds, date, startTime, notes } = input;

  const staff = await Staff.findOne({ _id: staffId, businessId, status: 'active' });
  if (!staff) throw new NotFoundError('Staff not found');

  const services = await Service.find({ _id: { $in: serviceIds }, businessId, status: 'active' });
  if (services.length !== serviceIds.length) throw new BadRequestError('One or more services not found');

  let totalDuration = 0;
  let subtotal = 0;
  const appointmentServices = services.map((s) => {
    totalDuration += s.duration;
    subtotal += s.finalPrice;
    return { serviceId: s._id, name: s.name, duration: s.duration, price: s.price, discount: s.price - s.finalPrice };
  });

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + totalDuration;
  const endTime = minutesToTime(endMinutes);

  const appointmentDate = new Date(date);
  const startDateTime = new Date(`${date}T${startTime}:00`);
  const endDateTime = new Date(`${date}T${endTime}:00`);

  const appointment = new Appointment({
    businessId,
    clientInfo: { name: clientName, phone: clientPhone, email: clientEmail },
    staffId,
    staffInfo: { name: `${staff.profile.firstName} ${staff.profile.lastName}` },
    services: appointmentServices,
    date: appointmentDate,
    startTime,
    endTime,
    startDateTime,
    endDateTime,
    totalDuration,
    pricing: { subtotal, discount: 0, deposit: 0, depositPaid: false, total: subtotal, tip: 0, finalTotal: subtotal },
    status: 'confirmed',
    notes: { business: notes },
    source: 'app_business',
    createdBy: new mongoose.Types.ObjectId(createdByUserId),
  });

  await appointment.save();

  logger.info('Manual appointment created', { appointmentId: appointment._id, businessId });

  return { appointment };
}
