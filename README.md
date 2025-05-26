# DairyFlow - MCC & Dairy Farmer Management System

This is a Next.js application built with Firebase Genkit for AI-powered features, designed to streamline dairy operations for Milk Collection Centers (MCCs) and farmers.

## Features

- **Farmer Management**: Register and manage farmer profiles.
- **Milk Delivery Recording**: Track milk deliveries with quantity, quality, and pricing.
- **Automated SMS Notifications**: Farmers receive real-time SMS updates on deliveries and payments, powered by Genkit AI.
- **Payment Processing**: Manage and track payments to farmers.
- **Reporting**: Generate insightful reports on collections, payments, and quality.
- **System Settings**: Configure application parameters and manage users (admin).
- **Role-Based Access Control**: Different views and permissions for Farmers, MCC Operators, and System Admins.
- **Modern UI/UX**: Built with Next.js, Tailwind CSS, and ShadCN UI components for a professional and responsive experience.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```

2.  **Set up Environment Variables**:
    Create a `.env` file in the root directory and add your Genkit and SMS provider API keys:
    ```env
    GOOGLE_API_KEY=your_google_ai_api_key
    # Add other necessary environment variables (e.g., for SMS provider if not using Genkit directly for sending)
    ```

3.  **Run Genkit Development Server (Optional, for AI flow development)**:
    If you need to modify or test the Genkit AI flows:
    ```bash
    npm run genkit:dev
    ```
    This typically runs on `http://localhost:4000`.

4.  **Run Next.js Development Server**:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    The application will be available at `http://localhost:9002` (or the port specified in `package.json`).

## Project Structure

-   `src/app/`: Next.js App Router pages and layouts.
    -   `(auth)/`: Routes related to authentication (e.g., login).
    -   `(app)/`: Authenticated application routes (dashboard, farmers, etc.).
-   `src/components/`: Reusable UI components.
    -   `auth/`: Authentication-specific components.
    -   `layout/`: Sidebar, header, and other layout components.
    -   `dashboard/`, `farmers/`, `deliveries/`, `payments/`, `reports/`, `settings/`: Feature-specific components.
    -   `shared/`: Common components used across multiple features.
    -   `ui/`: ShadCN UI library components.
-   `src/lib/`: Utility functions, mock data, server actions.
    -   `mockData.ts`: Initial data for demonstration.
    -   `actions.ts` (within feature folders in `src/app/(app)/feature`): Next.js Server Actions for data mutations.
-   `src/contexts/`: React Context providers (e.g., `AuthContext.tsx`).
-   `src/types/`: TypeScript type definitions.
-   `src/ai/`: Genkit AI configuration and flows.
    -   `flows/`: Pre-implemented Genkit flows for SMS notifications.
    -   `genkit.ts`: Genkit initialization.
-   `public/`: Static assets.
-   `tailwind.config.ts`: Tailwind CSS configuration.
-   `next.config.ts`: Next.js configuration.

## Core Technologies

-   **Next.js**: React framework for server-side rendering and static site generation.
-   **TypeScript**: Typed JavaScript for better code quality.
-   **Tailwind CSS**: Utility-first CSS framework for styling.
-   **ShadCN UI**: Reusable UI components built with Radix UI and Tailwind CSS.
-   **Genkit (Firebase GenAI)**: For AI-powered SMS notification generation.
-   **Lucide React**: Icon library.
-   **React Hook Form & Zod**: For form handling and validation.

## Available Scripts

-   `npm run dev`: Starts the Next.js development server.
-   `npm run build`: Builds the application for production.
-   `npm run start`: Starts the production server.
-   `npm run lint`: Lints the codebase.
-   `npm run typecheck`: Checks TypeScript types.
-   `npm run genkit:dev`: Starts the Genkit development server.
-   `npm run genkit:watch`: Starts Genkit with watch mode.

## Customization

-   **Theme**: Modify `src/app/globals.css` to change the color scheme and base styles.
-   **Mock Data**: Update `src/lib/mockData.ts` to use different initial data. For a production application, replace this with actual database integrations within Server Actions.
-   **SMS Provider**: The SMS sending logic is currently simulated in the Genkit flows or server actions. To use a real SMS provider like Africa's Talking or Twilio:
    1.  Install the provider's SDK (`npm install africastalking` or `npm install twilio`).
    2.  Update the Genkit flows in `src/ai/flows/` or the server actions (e.g., `src/app/(app)/deliveries/actions.ts`) to call the SMS API with your credentials (use environment variables).
    3.  Configure API keys and sender IDs in `src/app/(app)/settings/page.tsx` and persist them securely.

## Deployment

This application is structured for deployment on platforms that support Next.js, such as Vercel, Netlify, or Firebase App Hosting. Ensure environment variables are configured on your deployment platform.
```