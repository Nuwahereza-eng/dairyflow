// src/ai/flows/payment-notification.ts
'use server';

/**
 * @fileOverview Sends SMS notifications to farmers when their payments are processed.
 *
 * - sendPaymentNotification - Sends an SMS notification to a farmer after their payment is processed.
 * - SendPaymentNotificationInput - The input type for the sendPaymentNotification function.
 * - SendPaymentNotificationOutput - The return type for the sendPaymentNotification function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SendPaymentNotificationInputSchema = z.object({
  phoneNumber: z
    .string()
    .describe('The phone number of the farmer to send the SMS to.'),
  amount: z.number().describe('The amount paid to the farmer.'),
  period: z.string().describe('The payment period (e.g., May 2024).'),
});
export type SendPaymentNotificationInput = z.infer<
  typeof SendPaymentNotificationInputSchema
>;

const SendPaymentNotificationOutputSchema = z.object({
  success: z.boolean().describe('Whether the SMS notification was sent successfully.'),
  message: z.string().describe('The message that was sent.'),
});
export type SendPaymentNotificationOutput = z.infer<
  typeof SendPaymentNotificationOutputSchema
>;

export async function sendPaymentNotification(
  input: SendPaymentNotificationInput
): Promise<SendPaymentNotificationOutput> {
  return sendPaymentNotificationFlow(input);
}

const sendPaymentNotificationPrompt = ai.definePrompt({
  name: 'sendPaymentNotificationPrompt',
  input: {schema: SendPaymentNotificationInputSchema},
  output: {schema: SendPaymentNotificationOutputSchema},
  prompt: `You are tasked with sending an SMS notification to a farmer after their payment has been processed.

  Compose a concise and informative SMS message to the farmer, including the amount paid and the payment period.

  Input:
  - Farmer's Phone Number: {{{phoneNumber}}}
  - Amount Paid: {{{amount}}}
  - Payment Period: {{{period}}}

  Output (JSON):
  {
    "success": true,
    "message": "Payment processed: UGX {{{amount}}} for {{{period}}}. Thank you!"
  }
  `,
});

const sendPaymentNotificationFlow = ai.defineFlow(
  {
    name: 'sendPaymentNotificationFlow',
    inputSchema: SendPaymentNotificationInputSchema,
    outputSchema: SendPaymentNotificationOutputSchema,
  },
  async input => {
    const {output} = await sendPaymentNotificationPrompt(input);
    return output!;
  }
);
