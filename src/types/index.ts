
export interface Farmer {
  id: string;
  name: string;
  phone: string; // Should be E.164 format
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

export interface User { // This type is mainly for the mock users / settings page user list
  id: string;
  username: string;
  role: UserRole;
  password?: string; 
  status: 'active' | 'inactive';
}

export interface SystemSettings {
  milkPricePerLiter: number;
  smsProvider: 'africas_talking' | 'twilio' | 'none';
  smsApiKey: string;
  smsUsername: string;
}

// Updated AuthenticatedUser for Firebase Auth integration
export interface AuthenticatedUser {
  uid?: string; // Firebase User ID, present if isFirebaseUser is true
  username: string; // For Firebase, this will be the email (farmer's phone). For mock, it's the mock username.
  role: UserRole;
  isFirebaseUser?: boolean; // True if authenticated via Firebase
}
