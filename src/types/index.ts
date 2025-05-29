
export interface Farmer {
  id: string; // This will be the Firebase Auth UID for farmers
  name: string;
  phone: string; // Should be E.164 format, used for Firebase Auth email
  location: string;
  joinDate: string;
  idNumber?: string;
  notes?: string;
}

export interface Delivery {
  id: string;
  farmerId: string;
  farmerName?: string; // Denormalized for display
  quantity: number;
  quality: 'A' | 'B' | 'C';
  date: string;
  time: string;
  notes?: string;
  amount: number;
}

export interface Payment {
  id: string;
  farmerId: string;
  farmerName?: string; // Denormalized for display
  period: string; // e.g., "May 2024"
  totalLiters: number;
  amountDue: number;
  status: 'pending' | 'paid';
  lastPaymentDate?: string;
}

export type UserRole = 'farmer' | 'operator' | 'admin';

// This User type is now primarily for listing Admin/Operator users in settings.
// It reflects data that can be derived from Firebase Auth users.
export interface User {
  id: string; // Firebase Auth UID
  username: string; // Plain username (e.g., 'admin1', 'operator_jane')
  email?: string; // The pseudo-email used for Firebase Auth (e.g., username@admin.dairyflow.com)
  role: UserRole;
  password?: string; // Only used for setting initial password, not stored/retrieved
  status: 'active' | 'inactive'; // Mapped to Firebase Auth user's `disabled` state
}

export interface SystemSettings {
  milkPricePerLiter: number;
  smsProvider: 'africas_talking' | 'twilio' | 'none';
  smsApiKey: string;
  smsUsername: string;
}

export interface AuthenticatedUser {
  uid: string; // Firebase User ID
  username: string; // Plain username (farmer phone, admin/op username)
  role: UserRole;
  isFirebaseUser: true; // All users will now be Firebase users
}

export const FARMER_EMAIL_DOMAIN = '@phone.dairyflow.com';
export const OPERATOR_EMAIL_DOMAIN = '@operator.dairyflow.com';
export const ADMIN_EMAIL_DOMAIN = '@admin.dairyflow.com';
