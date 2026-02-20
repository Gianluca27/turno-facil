export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'calendar' | 'payment' | 'marketing' | 'communication';
  status: 'connected' | 'disconnected' | 'pending';
  connectedAt?: Date;
  config?: Record<string, unknown>;
}

export const AVAILABLE_INTEGRATIONS: Omit<Integration, 'status' | 'connectedAt' | 'config'>[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sincroniza tus turnos con Google Calendar',
    icon: 'google',
    category: 'calendar',
  },
  {
    id: 'mercadopago',
    name: 'MercadoPago',
    description: 'Acepta pagos online con MercadoPago',
    icon: 'mercadopago',
    category: 'payment',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Envía notificaciones por WhatsApp',
    icon: 'whatsapp',
    category: 'communication',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Muestra tu perfil de Instagram',
    icon: 'instagram',
    category: 'marketing',
  },
];
