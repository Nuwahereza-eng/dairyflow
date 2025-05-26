
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
import twilio from 'twilio';

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

// Updated output schema
const SendPaymentNotificationOutputSchema = z.object({
  success: z.boolean().describe('Whether the SMS notification was sent successfully via Twilio or simulated.'),
  statusMessage: z.string().describe('A message indicating the status of the SMS (e.g., "SMS sent", "Failed to send SMS", "SMS simulated").'),
  messageSid: z.string().optional().describe('The Twilio message SID if sent successfully.'),
  errorDetails: z.string().optional().describe('Detailed error if sending failed.'),
});
export type SendPaymentNotificationOutput = z.infer<
  typeof SendPaymentNotificationOutputSchema
>;

export async function sendPaymentNotification(
  input: SendPaymentNotificationInput
): Promise<SendPaymentNotificationOutput> {
  return sendPaymentNotificationFlow(input);
}

// This prompt now only focuses on generating the message content.
const generatePaymentSMSPrompt = ai.definePrompt({
  name: 'generatePaymentSMSPrompt',
  input: {schema: SendPaymentNotificationInputSchema},
  output: { // This output is just the SMS content string
    schema: z.string() 
  },
  prompt: `Compose a concise and informative SMS message for a farmer about their payment.
  Payment Amount: {{{amount}}} UGX
  Payment Period: {{{period}}}
  Message: Payment processed: UGX {{{amount}}} for {{{period}}}. Thank you!
  
  Return ONLY the message content.`,
});


const sendPaymentNotificationFlow = ai.defineFlow(
  {
    name: 'sendPaymentNotificationFlow',
    inputSchema: SendPaymentNotificationInputSchema,
    outputSchema: SendPaymentNotificationOutputSchema,
  },
  async (input): Promise<SendPaymentNotificationOutput> => {
    const { output: messageContent } = await generatePaymentSMSPrompt(input);

    if (!messageContent) {
      console.error("SMS Notification Error: Failed to generate message content for payment.", input);
      return { success: false, statusMessage: "Failed to generate SMS content." };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    console.log(`Attempting to send payment SMS. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}, Account SID: ${accountSid ? 'Exists' : 'MISSING'}`);

    if (accountSid && authToken && twilioPhoneNumber) {
      try {
        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
          body: messageContent,
          from: twilioPhoneNumber,
          to: input.phoneNumber,
        });
        console.log(`Twilio payment SMS sent. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}, SID: ${message.sid}`);
        return { success: true, statusMessage: 'SMS sent successfully via Twilio.', messageSid: message.sid };
      } catch (error: any) {
        console.error(`Twilio payment SMS failed. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}. Error:`, JSON.stringify(error, null, 2));
        return { success: false, statusMessage: `Failed to send SMS via Twilio: ${error.message}`, errorDetails: JSON.stringify(error) };
      }
    } else {
      console.warn(`Twilio payment SMS simulated (credentials missing). To: ${input.phoneNumber}, From: ${twilioPhoneNumber}. Content: ${messageContent}`);
      return { success: true, statusMessage: 'SMS simulated. Twilio credentials not found or incomplete in .env.' };
    }
  }
);

