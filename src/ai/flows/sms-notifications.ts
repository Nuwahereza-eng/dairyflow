'use server';

/**
 * @fileOverview Implements SMS notification functionality for farmers upon milk delivery.
 *
 * - sendDeliveryNotification - Sends an SMS notification to a farmer after a milk delivery is recorded.
 * - SendDeliveryNotificationInput - The input type for the sendDeliveryNotification function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SendDeliveryNotificationInputSchema = z.object({
  phoneNumber: z.string().describe('The phone number of the farmer to send the SMS to.'),
  quantity: z.number().describe('The quantity of milk delivered in liters.'),
  quality: z.string().describe('The quality grade of the milk delivered (A, B, C).'),
  amount: z.number().describe('The estimated payment amount for the milk delivery.'),
});

export type SendDeliveryNotificationInput = z.infer<typeof SendDeliveryNotificationInputSchema>;

export async function sendDeliveryNotification(input: SendDeliveryNotificationInput): Promise<void> {
  await sendDeliveryNotificationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'sendDeliveryNotificationPrompt',
  input: {schema: SendDeliveryNotificationInputSchema},
  prompt: `Dear Farmer, we have recorded your milk delivery of {{quantity}} liters with grade {{quality}}. Your estimated payment is UGX {{amount}}. Thank you for your contribution!`,
});

const sendDeliveryNotificationFlow = ai.defineFlow(
  {
    name: 'sendDeliveryNotificationFlow',
    inputSchema: SendDeliveryNotificationInputSchema,
    outputSchema: z.void(),
  },
  async input => {
    // The prompt is not used since SMS sending is handled outside the LLM.
    // Instead, we just log the SMS content here for demonstration.
    const message = `SMS to ${input.phoneNumber}: ${prompt(input)}`;
    console.log(message);

    // In a real implementation, you would call an SMS API here.
    // For example, using Africa's Talking or Twilio.
    // This is a placeholder for that functionality.
    // await smsService.sendSms(input.phoneNumber, message);

    return;
  }
);
