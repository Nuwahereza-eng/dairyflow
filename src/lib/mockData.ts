
import type { Farmer, Delivery, Payment, User, SystemSettings } from '@/types';

export const initialFarmers: Farmer[] = [
  { id: '1', name: 'John Mukasa', phone: '+256779081600', location: 'Kampala', joinDate: '2024-01-15', idNumber: 'CF123456', notes: 'Reliable farmer' },
  { id: '2', name: 'Mary Nalubega', phone: '+256702345678', location: 'Wakiso', joinDate: '2024-02-01', idNumber: 'CF123457', notes: 'High quality milk' },
  { id: '3', name: 'Peter Ssali', phone: '+256703456789', location: 'Mukono', joinDate: '2024-01-20', idNumber: 'CF123458', notes: 'Large scale farmer' }
];

// initialDeliveries and initialPayments are no longer primary sources
// if Deliveries and Payments actions are fully migrated to Firestore.
// Kept here for reference or if some part still uses them.
export const initialDeliveries: Delivery[] = [
  // { id: '1', farmerId: '1', quantity: 25.5, quality: 'A', date: '2024-07-26', time: '06:30', notes: 'Good quality', amount: 30600, farmerName: 'John Mukasa' },
];

export const initialPayments: Payment[] = [
  // { id: '1', farmerId: '1', period: 'July 2024', totalLiters: 750, amountDue: 900000, status: 'pending', lastPaymentDate: '2024-06-30', farmerName: 'John Mukasa' },
];

export const initialUsers: User[] = [
  { id: '1', username: 'admin', role: 'admin', status: 'active', password: 'adminpass' }, // Added mock password for consistency
  { id: '2', username: 'operator1', role: 'operator', status: 'active', password: 'op1pass' },
  { id: '3', username: 'farmer_john', role: 'farmer', status: 'active', password: 'farmerpass' },
];

export const initialSystemSettings: SystemSettings = {
  milkPricePerLiter: 1200,
  smsProvider: 'twilio', 
  smsApiKey: '', // Default to empty as these should be in .env or secure store
  smsUsername: ''  // Default to empty
};

// Helper to get farmer name - no longer used by actions if they fetch from DB
export const getFarmerName = (farmerId: string, farmers: Farmer[]): string => {
  const farmer = farmers.find(f => f.id === farmerId);
  return farmer ? farmer.name : 'Unknown Farmer';
};

    