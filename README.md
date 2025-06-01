# AnonyCollab

This is a Next.js application for the AnonyCollab platform, built using Firebase Studio.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Set Up Environment Variables**:

    You need to configure your Firebase project credentials and other service API keys. Create a file named `.env.local` in the root of your project directory and add the following environment variables, replacing the placeholder values with your actual configuration:

    ```dotenv
    # Firebase Config (Required for Client-Side Authentication & other Firebase services)
    NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
    NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_FIREBASE_MEASUREMENT_ID # Optional

    # Firebase Admin SDK Config (Required for Server-Side Operations, e.g., in API routes)
    # 1. Go to Firebase Project Settings > Service accounts.
    # 2. Click "Generate new private key" and download the JSON file.
    # 3. Save this file securely in your project (e.g., at the root, named 'serviceAccountKey.json').
    #    Ensure this file is added to .gitignore if you place it in your project directory.
    # 4. Set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the *absolute path* of this JSON file.
    #    Example (if serviceAccountKey.json is in the root of your project):
    #    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json 
    #    (Note: For some deployments like Vercel, you might need to provide the content
    #     of the JSON file directly as an environment variable, or use platform-specific
    #     integrations. Refer to your deployment provider's documentation.)

    # Genkit/Google AI Config (Required for AI features)
    # Obtain an API key from Google AI Studio: https://aistudio.google.com/app/apikey
    GOOGLE_API_KEY=YOUR_GOOGLE_AI_API_KEY

    # Stripe Config (Required for Payment Features)
    # Get your keys from the Stripe Dashboard: https://dashboard.stripe.com/apikeys
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=YOUR_STRIPE_PUBLISHABLE_KEY
    STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
    # Optional: Stripe Webhook Secret for verifying webhook events
    # STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET
    ```

    *   You can find your Firebase client configuration details in your Firebase project settings:
        *   Go to your Firebase project console.
        *   Click the gear icon next to "Project Overview" and select "Project settings".
        *   Scroll down to the "Your apps" section.
        *   Select your web app.
        *   Under "Firebase SDK snippet", choose "Config" to view the configuration object.
    *   **Important for client-side Firebase**: Ensure the `NEXT_PUBLIC_FIREBASE_API_KEY` is correct. The error `auth/api-key-not-valid` indicates this key is missing or incorrect.
    *   **Important for server-side Firebase Admin SDK**: `GOOGLE_APPLICATION_CREDENTIALS` must be correctly set in the environment where your Next.js server (and API routes) run. If this is not set, Firebase Admin SDK cannot initialize, leading to errors like "Auth admin not available" or "Firestore admin not available" in your API routes.
    *   Make sure `.env.local` and your `serviceAccountKey.json` file are listed in your `.gitignore` file to avoid committing sensitive keys.

3.  **Run the Development Server**:
    ```bash
    npm run dev
    ```
    This will start the Next.js development server, typically on `http://localhost:9003`.

4.  **(Optional) Run Genkit Dev Server (for AI features)**:
    If you are working with AI features, you might need to run the Genkit development server separately:
    ```bash
    npm run genkit:dev
    # or for watching changes
    npm run genkit:watch
    ```

## Key Features Implemented

*   **User Authentication**: Secure signup and login using Firebase Authentication (Email/Password and Google Sign-In).
*   **Homepage Dashboard**: Displays posts in a masonry layout after login.
*   **Post Filtering**: Filter posts based on tags.
*   **Post Detail View**: Clicking a post card opens a sliding side panel with details.
*   **Styling**: Uses ShadCN UI components and Tailwind CSS, following the specified style guidelines (sky blue theme, rounded corners, shadows).
*   **Profile Management**: Users can update their profile information and business classification.
*   **Messaging**: Real-time chat between connected users.
*   **Payment Integration**: Stripe integration for saving payment methods.

## Available Scripts

*   `npm run dev`: Starts the Next.js development server with Turbopack.
*   `npm run genkit:dev`: Starts the Genkit development server.
*   `npm run genkit:watch`: Starts the Genkit development server with file watching.
*   `npm run build`: Builds the application for production.
*   `npm run start`: Starts the production server.
*   `npm run lint`: Lints the codebase using Next.js's built-in ESLint configuration.
*   `npm run typecheck`: Runs TypeScript type checking.
```