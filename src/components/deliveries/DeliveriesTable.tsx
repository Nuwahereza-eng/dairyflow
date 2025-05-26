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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Delivery } from "@/types";
import { Edit, Trash2, MoreHorizontal } from "lucide-react";
import { format } from 'date-fns';

interface DeliveriesTableProps {
  deliveries: Delivery[];
  onEdit: (delivery: Delivery) => void;
  onDelete: (deliveryId: string) => void;
}

function QualityBadge({ quality }: { quality: 'A' | 'B' | 'C' }) {
  let className = "px-2 py-0.5 rounded-full text-xs font-semibold ";
  if (quality === 'A') className += "bg-green-100 text-green-700";
  else if (quality === 'B') className += "bg-yellow-100 text-yellow-700";
  else className += "bg-red-100 text-red-700";
  return <span className={className}>Grade {quality}</span>;
}

export function DeliveriesTable({ deliveries, onEdit, onDelete }: DeliveriesTableProps) {
  return (
    <div className="rounded-lg border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Farmer</TableHead>
            <TableHead>Quantity (L)</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead>Amount (UGX)</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No deliveries found.
              </TableCell>
            </TableRow>
          ) : (
            deliveries.map((delivery) => (
              <TableRow key={delivery.id}>
                <TableCell>{format(new Date(delivery.date + 'T00:00:00'), 'PP')}</TableCell>
                <TableCell>{delivery.time}</TableCell>
                <TableCell className="font-medium">{delivery.farmerName || 'N/A'}</TableCell>
                <TableCell>{delivery.quantity.toFixed(1)}</TableCell>
                <TableCell><QualityBadge quality={delivery.quality} /></TableCell>
                <TableCell>{delivery.amount.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(delivery)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(delivery.id)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
