
'use server';

/**
 * @fileOverview Implements SMS notification functionality for farmers upon milk delivery.
 *
 * - sendDeliveryNotification - Sends an SMS notification to a farmer after a milk delivery is recorded.
 * - SendDeliveryNotificationInput - The input type for the sendDeliveryNotification function.
 * - SendDeliveryNotificationOutput - The return type for the sendDeliveryNotification function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import twilio from 'twilio';

const SendDeliveryNotificationInputSchema = z.object({
  phoneNumber: z.string().describe('The phone number of the farmer to send the SMS to.'),
  quantity: z.number().describe('The quantity of milk delivered in liters.'),
  quality: z.string().describe('The quality grade of the milk delivered (A, B, C).'),
  amount: z.number().describe('The estimated payment amount for the milk delivery.'),
});

export type SendDeliveryNotificationInput = z.infer<typeof SendDeliveryNotificationInputSchema>;

const SendDeliveryNotificationOutputSchema = z.object({
  success: z.boolean().describe('Whether the SMS notification was sent successfully.'),
  statusMessage: z.string().describe('A message indicating the status of the SMS (e.g., "SMS sent", "Failed to send SMS", "SMS simulated").'),
  messageSid: z.string().optional().describe('The Twilio message SID if sent successfully.'),
  errorDetails: z.string().optional().describe('Detailed error if sending failed.'),
});
export type SendDeliveryNotificationOutput = z.infer<typeof SendDeliveryNotificationOutputSchema>;


export async function sendDeliveryNotification(input: SendDeliveryNotificationInput): Promise<SendDeliveryNotificationOutput> {
  return sendDeliveryNotificationFlow(input);
}

const deliveryPrompt = ai.definePrompt({
  name: 'generateDeliverySMSPrompt',
  input: {schema: SendDeliveryNotificationInputSchema},
  prompt: `Dear Farmer, we have recorded your milk delivery of {{quantity}} liters with grade {{quality}}. Your estimated payment is UGX {{amount}}. Thank you for your contribution!`,
});

const sendDeliveryNotificationFlow = ai.defineFlow(
  {
    name: 'sendDeliveryNotificationFlow',
    inputSchema: SendDeliveryNotificationInputSchema,
    outputSchema: SendDeliveryNotificationOutputSchema,
  },
  async (input): Promise<SendDeliveryNotificationOutput> => {
    const { text: messageContent } = await deliveryPrompt(input);

    if (!messageContent) {
      console.error("SMS Notification Error: Failed to generate message content for delivery.", input);
      return { success: false, statusMessage: "Failed to generate SMS content." };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    console.log(`Attempting to send delivery SMS. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}, Account SID: ${accountSid ? 'Exists' : 'MISSING'}`);

    if (accountSid && authToken && twilioPhoneNumber) {
      try {
        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
          body: messageContent!,
          from: twilioPhoneNumber,
          to: input.phoneNumber,
        });
        console.log(`Twilio delivery SMS sent. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}, SID: ${message.sid}`);
        return { success: true, statusMessage: 'SMS sent successfully via Twilio.', messageSid: message.sid };
      } catch (error: any) {
        console.error(`Twilio delivery SMS failed. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}. Error:`, JSON.stringify(error, null, 2));
        return { success: false, statusMessage: `Failed to send SMS via Twilio: ${error.message}`, errorDetails: JSON.stringify(error) };
      }
    } else {
      console.warn(`Twilio delivery SMS simulated (credentials missing). To: ${input.phoneNumber}, From: ${twilioPhoneNumber}. Content: ${messageContent}`);
      return { success: true, statusMessage: 'SMS simulated. Twilio credentials not found or incomplete in .env.' };
    }
  }
);
