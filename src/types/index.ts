
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
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  notes?: string;
  amount: number;
}

export interface Payment {
  id: string;
  farmerId: string;
  farmerName?: string; // Denormalized for display
  period: string; // e.g., "YYYY-MM"
  totalLiters: number;
  amountDue: number;
  status: 'pending' | 'paid';
  lastPaymentDate?: string; // YYYY-MM-DD
  paymentMethod?: 'cash' | 'bank' | 'mobile_money';
  transactionId?: string;
  deliveryIds: string[]; // IDs of deliveries covered by this payment
  generatedDate: string; // YYYY-MM-DD, when this payment record was generated
}

export type UserRole = 'farmer' | 'operator' | 'admin';

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
