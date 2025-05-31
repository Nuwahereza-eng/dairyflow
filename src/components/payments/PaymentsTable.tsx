
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Payment } from "@/types";
import { CheckCircle2, CircleDollarSign, ExternalLink, CreditCard, Banknote, Smartphone } from "lucide-react";
import { format } from 'date-fns';

interface PaymentsTableProps {
  payments: Payment[];
  onProcessPayment: (payment: Payment) => void; // Changed to pass the full payment object
  onViewDetails: (payment: Payment) => void;
}

const PaymentMethodIcon = ({ method }: { method?: 'cash' | 'bank' | 'mobile_money' }) => {
  if (method === 'cash') return <Banknote className="mr-1 h-4 w-4 text-green-600" />;
  if (method === 'bank') return <CreditCard className="mr-1 h-4 w-4 text-blue-600" />;
  if (method === 'mobile_money') return <Smartphone className="mr-1 h-4 w-4 text-orange-600" />;
  return null;
};

export function PaymentsTable({ payments, onProcessPayment, onViewDetails }: PaymentsTableProps) {
  return (
    <div className="rounded-lg border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Farmer</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Generated On</TableHead>
            <TableHead>Total Liters (L)</TableHead>
            <TableHead>Amount Due (UGX)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment Method</TableHead>
            <TableHead>Paid On</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No payment records found.
              </TableCell>
            </TableRow>
          ) : (
            payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{payment.farmerName || 'N/A'}</TableCell>
                <TableCell>{payment.period}</TableCell>
                <TableCell>{format(new Date(payment.generatedDate), 'PP')}</TableCell>
                <TableCell>{payment.totalLiters.toFixed(1)}</TableCell>
                <TableCell>{payment.amountDue.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={payment.status === 'paid' ? 'default' : 'destructive'} 
                         className={payment.status === 'paid' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}>
                    {payment.status === 'paid' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">
                  {payment.paymentMethod ? (
                    <span className="flex items-center">
                      <PaymentMethodIcon method={payment.paymentMethod} />
                      {payment.paymentMethod.replace('_', ' ')}
                    </span>
                  ) : (
                    'N/A'
                  )}
                  {payment.transactionId && <span className="text-xs text-muted-foreground block">ID: {payment.transactionId}</span>}
                </TableCell>
                <TableCell>
                  {payment.lastPaymentDate ? format(new Date(payment.lastPaymentDate), 'PP') : 'N/A'}
                </TableCell>
                <TableCell className="text-right">
                  {payment.status === 'pending' ? (
                    <Button
                      size="sm"
                      onClick={() => onProcessPayment(payment)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow"
                    >
                      <CircleDollarSign className="mr-2 h-4 w-4" /> Pay Now
                    </Button>
                  ) : (
                     <Button size="sm" variant="outline" onClick={() => onViewDetails(payment)} disabled>
                      <ExternalLink className="mr-2 h-4 w-4" /> Details
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
