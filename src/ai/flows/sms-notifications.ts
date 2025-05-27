
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
  output: { schema: z.string() }, // Explicitly expect a string output
  prompt: `Generate an SMS for a farmer about their milk delivery.
Delivery Details:
- Quantity: {{quantity}}L
- Quality: Grade {{quality}}
- Amount: UGX {{amount}}

SMS Message Template: Dear Farmer, your delivery of {{quantity}}L (Grade {{quality}}) for UGX {{amount}} is recorded. Thank you!

Return ONLY the "SMS Message Template" filled with the details.`,
});

const sendDeliveryNotificationFlow = ai.defineFlow(
  {
    name: 'sendDeliveryNotificationFlow',
    inputSchema: SendDeliveryNotificationInputSchema,
    outputSchema: SendDeliveryNotificationOutputSchema,
  },
  async (input): Promise<SendDeliveryNotificationOutput> => {
    const promptResponse = await deliveryPrompt(input);
    const messageContent = promptResponse.output;

    console.log(`Delivery SMS - Raw prompt response: ${JSON.stringify(promptResponse, null, 2)}`);
    console.log(`Delivery SMS - Extracted messageContent from .output: "${messageContent}"`);
    console.log(`Delivery SMS - Raw prompt response .text: "${promptResponse.text}"`);

    if (messageContent === null || messageContent === undefined || messageContent.trim() === '') {
      console.error("SMS Notification Error: Failed to generate message content for delivery. Model returned null or empty string.", {
        inputData: input,
        promptOutput: messageContent, // This will be null or undefined
        promptRawResponseText: promptResponse.text, // Log .text content
      });
      return { success: false, statusMessage: "Failed to generate SMS content (model returned null or empty string)." };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    console.log(`Attempting to send delivery SMS. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}, Account SID: ${accountSid ? 'Exists' : 'MISSING'}`);
    console.log(`SMS Content to send: "${messageContent}"`);


    if (accountSid && authToken && twilioPhoneNumber) {
      try {
        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
          body: messageContent,
          from: twilioPhoneNumber,
          to: input.phoneNumber,
        });
        console.log(`Twilio delivery SMS sent. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}, SID: ${message.sid}`);
        return { success: true, statusMessage: 'SMS sent successfully via Twilio.', messageSid: message.sid };
      } catch (error: any) {
        console.error(`Twilio delivery SMS failed. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}. Error:`, JSON.stringify(error, null, 2));
        return { success: false, statusMessage: `Failed to send SMS via Twilio: ${error.message || 'Unknown error'}`, errorDetails: JSON.stringify(error) };
      }
    } else {
      console.warn(`Twilio delivery SMS simulated (credentials missing). To: ${input.phoneNumber}, From: ${twilioPhoneNumber}. Content: "${messageContent}"`);
      return { success: true, statusMessage: 'SMS simulated. Twilio credentials not found or incomplete in .env.' };
    }
  }
);
