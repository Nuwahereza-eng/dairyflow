
// src/ai/flows/welcome-notification.ts
'use server';

/**
 * @fileOverview Sends a welcome SMS notification to a newly registered farmer.
 *
 * - sendWelcomeNotification - Sends a welcome SMS with login details.
 * - SendWelcomeNotificationInput - The input type for the sendWelcomeNotification function.
 * - SendWelcomeNotificationOutput - The return type for the sendWelcomeNotification function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import twilio from 'twilio';

const SendWelcomeNotificationInputSchema = z.object({
  farmerName: z.string().describe("The name of the newly registered farmer."),
  phoneNumber: z
    .string()
    .describe('The phone number of the farmer to send the SMS to.'),
  defaultPassword: z.string().describe('The default password for the farmer to log in.'),
});
export type SendWelcomeNotificationInput = z.infer<
  typeof SendWelcomeNotificationInputSchema
>;

const SendWelcomeNotificationOutputSchema = z.object({
  success: z.boolean().describe('Whether the SMS notification was sent successfully via Twilio or simulated.'),
  statusMessage: z.string().describe('A message indicating the status of the SMS (e.g., "SMS sent", "Failed to send SMS", "SMS simulated").'),
  messageSid: z.string().optional().describe('The Twilio message SID if sent successfully.'),
  errorDetails: z.string().optional().describe('Detailed error if sending failed.'),
});
export type SendWelcomeNotificationOutput = z.infer<
  typeof SendWelcomeNotificationOutputSchema
>;

export async function sendWelcomeNotification(
  input: SendWelcomeNotificationInput
): Promise<SendWelcomeNotificationOutput> {
  return sendWelcomeNotificationFlow(input);
}

const generateWelcomeSMSPrompt = ai.definePrompt({
  name: 'generateWelcomeSMSPrompt',
  input: {schema: SendWelcomeNotificationInputSchema},
  output: { // This output is just the SMS content string
    schema: z.string()
  },
  prompt: `Compose a welcome SMS for a new farmer.
  Farmer Name: {{farmerName}}
  Phone Number (Login ID): {{phoneNumber}}
  Default Password: {{defaultPassword}}
  
  Message:
  Welcome to DairyFlow, {{farmerName}}! Your login ID is your phone number ({{phoneNumber}}) and your temporary password is: {{defaultPassword}}. Please change it upon first login if possible.
  
  Return ONLY the message content.`,
});


const sendWelcomeNotificationFlow = ai.defineFlow(
  {
    name: 'sendWelcomeNotificationFlow',
    inputSchema: SendWelcomeNotificationInputSchema,
    outputSchema: SendWelcomeNotificationOutputSchema,
  },
  async (input): Promise<SendWelcomeNotificationOutput> => {
    const { output: messageContent } = await generateWelcomeSMSPrompt(input);

    if (!messageContent) {
      console.error("Welcome SMS Error: Failed to generate message content. Received null or empty.", input);
      return { success: false, statusMessage: "Failed to generate welcome SMS content (received null/empty)." };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    console.log(`Attempting to send welcome SMS. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}, Account SID: ${accountSid ? 'Exists' : 'MISSING'}`);

    if (accountSid && authToken && twilioPhoneNumber) {
      try {
        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
          body: messageContent,
          from: twilioPhoneNumber,
          to: input.phoneNumber,
        });
        console.log(`Twilio welcome SMS sent. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}, SID: ${message.sid}`);
        return { success: true, statusMessage: 'Welcome SMS sent successfully via Twilio.', messageSid: message.sid };
      } catch (error: any) {
        console.error(`Twilio welcome SMS failed. To: ${input.phoneNumber}, From: ${twilioPhoneNumber}. Error:`, JSON.stringify(error, null, 2));
        return { success: false, statusMessage: `Failed to send welcome SMS via Twilio: ${error.message || 'Unknown error'}`, errorDetails: JSON.stringify(error) };
      }
    } else {
      console.warn(`Twilio welcome SMS simulated (credentials missing). To: ${input.phoneNumber}, From: ${twilioPhoneNumber}. Content: ${messageContent}`);
      return { success: true, statusMessage: 'Welcome SMS simulated. Twilio credentials not found or incomplete in .env.' };
    }
  }
);
