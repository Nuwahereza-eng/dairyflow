import type { Farmer, Delivery, Payment, User, SystemSettings } from '@/types';

export const initialFarmers: Farmer[] = [
  { id: '1', name: 'John Mukasa', phone: '+256701234567', location: 'Kampala', joinDate: '2024-01-15', idNumber: 'CF123456', notes: 'Reliable farmer' },
  { id: '2', name: 'Mary Nalubega', phone: '+256702345678', location: 'Wakiso', joinDate: '2024-02-01', idNumber: 'CF123457', notes: 'High quality milk' },
  { id: '3', name: 'Peter Ssali', phone: '+256703456789', location: 'Mukono', joinDate: '2024-01-20', idNumber: 'CF123458', notes: 'Large scale farmer' }
];

export const initialDeliveries: Delivery[] = [
  { id: '1', farmerId: '1', quantity: 25.5, quality: 'A', date: '2024-07-26', time: '06:30', notes: 'Good quality', amount: 30600, farmerName: 'John Mukasa' },
  { id: '2', farmerId: '2', quantity: 18.0, quality: 'A', date: '2024-07-26', time: '07:15', notes: 'Excellent', amount: 21600, farmerName: 'Mary Nalubega' },
  { id: '3', farmerId: '3', quantity: 32.0, quality: 'B', date: '2024-07-25', time: '06:45', notes: 'Standard quality', amount: 34560, farmerName: 'Peter Ssali' } // Adjusted amount for quality B
];

export const initialPayments: Payment[] = [
  { id: '1', farmerId: '1', period: 'July 2024', totalLiters: 750, amountDue: 900000, status: 'pending', lastPaymentDate: '2024-06-30', farmerName: 'John Mukasa' },
  { id: '2', farmerId: '2', period: 'July 2024', totalLiters: 540, amountDue: 648000, status: 'paid', lastPaymentDate: '2024-07-25', farmerName: 'Mary Nalubega' },
  { id: '3', farmerId: '3', period: 'July 2024', totalLiters: 960, amountDue: 1036800, status: 'pending', lastPaymentDate: '2024-06-28', farmerName: 'Peter Ssali' } // Adjusted amount for quality B
];

export const initialUsers: User[] = [
  { id: '1', username: 'admin', role: 'admin', status: 'active' },
  { id: '2', username: 'operator1', role: 'operator', status: 'active' },
  { id: '3', username: 'farmer_john', role: 'farmer', status: 'active' }, // Corresponds to John Mukasa
];

export const initialSystemSettings: SystemSettings = {
  milkPricePerLiter: 1200,
  smsProvider: 'none', // Default to none, user can configure
  smsApiKey: '',
  smsUsername: ''
};

// Helper to get farmer name
export const getFarmerName = (farmerId: string, farmers: Farmer[]): string => {
  const farmer = farmers.find(f => f.id === farmerId);
  return farmer ? farmer.name : 'Unknown Farmer';
};
