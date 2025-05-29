
import type { Farmer, Delivery, Payment, SystemSettings } from '@/types';

export const initialFarmers: Farmer[] = [
  // This data is now primarily managed in Firestore.
  // Example of how it might look if still needed for local testing without DB:
  // { id: 'farmer_john_uid', name: 'John Mukasa', phone: '+256779081600', location: 'Kampala', joinDate: '2024-01-15', idNumber: 'CF123456', notes: 'Reliable farmer' },
];

export const initialDeliveries: Delivery[] = [
  // This data is managed in Firestore.
];

export const initialPayments: Payment[] = [
  // This data is managed in Firestore.
];

// initialUsers is now removed as Admins/Operators will use Firebase Auth.
// Users listed in Settings page will be fetched from Firebase Auth.

export const initialSystemSettings: SystemSettings = {
  milkPricePerLiter: 1200,
  smsProvider: 'twilio',
  smsApiKey: process.env.TWILIO_API_KEY || '', // Default to empty or from env
  smsUsername: process.env.TWILIO_USERNAME || '',  // Default to empty or from env
};

// getFarmerName helper is no longer needed here as actions fetch names from DB.
