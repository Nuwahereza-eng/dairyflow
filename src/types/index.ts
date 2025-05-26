
export interface Farmer {
  id: string;
  name: string;
  phone: string;
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

export interface User {
  id: string;
  username: string;
  role: UserRole;
  password?: string; // Only for creation/login, not stored in frontend state long-term
  status: 'active' | 'inactive';
}

export interface SystemSettings {
  milkPricePerLiter: number;
  smsProvider: 'africas_talking' | 'twilio' | 'none';
  smsApiKey: string;
  smsUsername: string;
}

export interface AuthenticatedUser {
  username: string;
  role: UserRole;
}
