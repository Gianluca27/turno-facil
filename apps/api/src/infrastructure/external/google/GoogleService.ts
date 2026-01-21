import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';

export interface GoogleUserInfo {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  givenName: string;
  familyName: string;
  picture?: string;
}

export interface VerifyTokenResult {
  success: boolean;
  user?: GoogleUserInfo;
  error?: string;
}

export interface GeocodingResult {
  success: boolean;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  placeId?: string;
  error?: string;
}

export interface ReverseGeocodingResult {
  success: boolean;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  placeId?: string;
  error?: string;
}

export interface PlaceAutocompleteResult {
  success: boolean;
  predictions?: {
    placeId: string;
    description: string;
    mainText: string;
    secondaryText: string;
  }[];
  error?: string;
}

export interface PlaceDetailsResult {
  success: boolean;
  placeId?: string;
  name?: string;
  formattedAddress?: string;
  lat?: number;
  lng?: number;
  phoneNumber?: string;
  website?: string;
  openingHours?: string[];
  error?: string;
}

export interface DistanceMatrixResult {
  success: boolean;
  distance?: {
    text: string;
    value: number;
  };
  duration?: {
    text: string;
    value: number;
  };
  error?: string;
}

class GoogleService {
  private oauthClient: OAuth2Client | null = null;
  private mapsApiKey: string | undefined;
  private oauthInitialized: boolean = false;
  private mapsInitialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const { clientId, clientSecret, mapsApiKey } = config.google;

    if (clientId && clientSecret) {
      this.oauthClient = new OAuth2Client(clientId, clientSecret);
      this.oauthInitialized = true;
      logger.info('Google OAuth service initialized successfully');
    } else {
      logger.warn('Google OAuth credentials not configured. Google sign-in will be unavailable.');
    }

    if (mapsApiKey) {
      this.mapsApiKey = mapsApiKey;
      this.mapsInitialized = true;
      logger.info('Google Maps service initialized successfully');
    } else {
      logger.warn('Google Maps API key not configured. Maps features will be unavailable.');
    }
  }

  isOAuthConfigured(): boolean {
    return this.oauthInitialized && this.oauthClient !== null;
  }

  isMapsConfigured(): boolean {
    return this.mapsInitialized && this.mapsApiKey !== undefined;
  }

  async verifyIdToken(idToken: string): Promise<VerifyTokenResult> {
    if (!this.isOAuthConfigured()) {
      return { success: false, error: 'Google OAuth not configured' };
    }

    try {
      const ticket = await this.oauthClient!.verifyIdToken({
        idToken,
        audience: config.google.clientId,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        return { success: false, error: 'Invalid token payload' };
      }

      const user: GoogleUserInfo = {
        id: payload.sub,
        email: payload.email!,
        emailVerified: payload.email_verified || false,
        name: payload.name || '',
        givenName: payload.given_name || '',
        familyName: payload.family_name || '',
        picture: payload.picture,
      };

      logger.info('Google token verified successfully', {
        userId: user.id,
        email: user.email,
      });

      return { success: true, user };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to verify Google token', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async geocode(address: string): Promise<GeocodingResult> {
    if (!this.isMapsConfigured()) {
      return { success: false, error: 'Google Maps not configured' };
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address,
          key: this.mapsApiKey,
          language: 'es',
          region: 'ar',
        },
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        return { success: false, error: `Geocoding failed: ${response.data.status}` };
      }

      const result = response.data.results[0];

      return {
        success: true,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Geocoding failed', { error: errorMessage, address });
      return { success: false, error: errorMessage };
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodingResult> {
    if (!this.isMapsConfigured()) {
      return { success: false, error: 'Google Maps not configured' };
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${lat},${lng}`,
          key: this.mapsApiKey,
          language: 'es',
        },
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        return { success: false, error: `Reverse geocoding failed: ${response.data.status}` };
      }

      const result = response.data.results[0];
      const components = result.address_components;

      const getComponent = (types: string[]): string | undefined => {
        const comp = components.find((c: { types: string[] }) =>
          types.some((t) => c.types.includes(t))
        );
        return comp?.long_name;
      };

      return {
        success: true,
        address: result.formatted_address,
        city: getComponent(['locality', 'administrative_area_level_2']),
        state: getComponent(['administrative_area_level_1']),
        country: getComponent(['country']),
        postalCode: getComponent(['postal_code']),
        placeId: result.place_id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Reverse geocoding failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async placeAutocomplete(input: string, sessionToken?: string): Promise<PlaceAutocompleteResult> {
    if (!this.isMapsConfigured()) {
      return { success: false, error: 'Google Maps not configured' };
    }

    try {
      const params: Record<string, string> = {
        input,
        key: this.mapsApiKey!,
        language: 'es',
        components: 'country:ar',
        types: 'address',
      };

      if (sessionToken) {
        params.sessiontoken = sessionToken;
      }

      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        { params }
      );

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        return { success: false, error: `Autocomplete failed: ${response.data.status}` };
      }

      const predictions = response.data.predictions.map((p: {
        place_id: string;
        description: string;
        structured_formatting: {
          main_text: string;
          secondary_text: string;
        };
      }) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting.main_text,
        secondaryText: p.structured_formatting.secondary_text,
      }));

      return { success: true, predictions };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Place autocomplete failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async getPlaceDetails(placeId: string, sessionToken?: string): Promise<PlaceDetailsResult> {
    if (!this.isMapsConfigured()) {
      return { success: false, error: 'Google Maps not configured' };
    }

    try {
      const params: Record<string, string> = {
        place_id: placeId,
        key: this.mapsApiKey!,
        language: 'es',
        fields: 'place_id,name,formatted_address,geometry,formatted_phone_number,website,opening_hours',
      };

      if (sessionToken) {
        params.sessiontoken = sessionToken;
      }

      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        { params }
      );

      if (response.data.status !== 'OK') {
        return { success: false, error: `Place details failed: ${response.data.status}` };
      }

      const result = response.data.result;

      return {
        success: true,
        placeId: result.place_id,
        name: result.name,
        formattedAddress: result.formatted_address,
        lat: result.geometry?.location?.lat,
        lng: result.geometry?.location?.lng,
        phoneNumber: result.formatted_phone_number,
        website: result.website,
        openingHours: result.opening_hours?.weekday_text,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Place details failed', { error: errorMessage, placeId });
      return { success: false, error: errorMessage };
    }
  }

  async getDistanceMatrix(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<DistanceMatrixResult> {
    if (!this.isMapsConfigured()) {
      return { success: false, error: 'Google Maps not configured' };
    }

    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/distancematrix/json',
        {
          params: {
            origins: `${origin.lat},${origin.lng}`,
            destinations: `${destination.lat},${destination.lng}`,
            key: this.mapsApiKey,
            language: 'es',
            units: 'metric',
          },
        }
      );

      if (response.data.status !== 'OK') {
        return { success: false, error: `Distance matrix failed: ${response.data.status}` };
      }

      const element = response.data.rows[0]?.elements[0];

      if (!element || element.status !== 'OK') {
        return { success: false, error: 'No route found' };
      }

      return {
        success: true,
        distance: {
          text: element.distance.text,
          value: element.distance.value,
        },
        duration: {
          text: element.duration.text,
          value: element.duration.value,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Distance matrix failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  generateMapsUrl(lat: number, lng: number, label?: string): string {
    const baseUrl = 'https://www.google.com/maps/search/?api=1';
    const query = label ? encodeURIComponent(label) : `${lat},${lng}`;
    return `${baseUrl}&query=${query}`;
  }

  generateDirectionsUrl(
    destLat: number,
    destLng: number,
    originLat?: number,
    originLng?: number
  ): string {
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;

    if (originLat !== undefined && originLng !== undefined) {
      url += `&origin=${originLat},${originLng}`;
    }

    return url;
  }
}

export const googleService = new GoogleService();
