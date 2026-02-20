export interface GetOAuthUrlInput {
  businessId: string;
  provider: 'google-calendar' | 'mercadopago';
}

export interface GetOAuthUrlResult {
  authUrl: string;
}

export async function getOAuthUrl(input: GetOAuthUrlInput): Promise<GetOAuthUrlResult> {
  const { businessId, provider } = input;

  if (provider === 'google-calendar') {
    // TODO: Use actual Google OAuth client
    const clientId = process.env.GOOGLE_CLIENT_ID || 'your-client-id';
    const redirectUri = encodeURIComponent(`${process.env.API_URL}/api/v1/oauth/callback/google`);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar');
    const state = Buffer.from(JSON.stringify({ businessId, provider: 'google-calendar' })).toString('base64');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

    return { authUrl };
  }

  // provider === 'mercadopago'
  // TODO: Use actual MercadoPago OAuth client
  const clientId = process.env.MERCADOPAGO_CLIENT_ID || 'your-client-id';
  const redirectUri = encodeURIComponent(`${process.env.API_URL}/api/v1/oauth/callback/mercadopago`);
  const state = Buffer.from(JSON.stringify({ businessId, provider: 'mercadopago' })).toString('base64');

  const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&redirect_uri=${redirectUri}&state=${state}`;

  return { authUrl };
}
