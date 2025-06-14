
# AnonyCollab Project Context & History

## Project Overview
AnonyCollab is a B2B anonymous collaboration platform. It's built with Next.js (App Router), React, ShadCN UI components, Tailwind CSS, Firebase (Auth, Firestore, Storage), and Genkit for AI features. The application aims to provide a secure and intuitive environment for businesses to connect, share ideas, and collaborate on projects.

## Key Features Implemented
*   **User Authentication**: Firebase Auth (Email/Password, Google Sign-In), reCAPTCHA on signup.
*   **Core Platform**:
    *   Homepage Dashboard: Masonry layout for posts, filtering by tags.
    *   Post Detail View: Sliding side panel for post details, comments, bidding (for "help_request" type posts).
    *   User Profiles: Display public business information, user's posts.
    *   Messaging: Real-time chat between connected users (direct and group chats).
*   **Planning & Collaboration Tools**:
    *   Collaboration Plan Creation: Users can define plans with objectives and structure.
    *   Interactive Roadmap Visualization (`/plan/[planId]`):
        *   Canvas-based interface for roadmap steps (nodes) and child items.
        *   Draggable nodes, ability to link nodes (peer connections) and spawn child items as new nodes.
        *   Version history for plans.
        *   Side panel for editing node and child item details.
*   **Settings**: Profile management, notification preferences, payment method management, account settings.
*   **Payment Integration**: Stripe for saving payment methods and managing subscriptions.
*   **Backend/Cloud Functions**: Firebase Functions for automated tasks like bot user/post/comment creation, message replies, and auto-accepting bot connection requests.
*   **AI (Genkit)**: Flows for AI connection matching and suggestions (e.g., `ai-connection-matcher.ts`, `connection-suggestions.ts`).

## Recent Development Focus (Current Session)
*   **Feature Removal - Collections**: Due to persistent complexities with Firestore security rules for listing collections, the "Collections" feature (allowing users to save posts into personal collections) has been removed from the application. This involved deleting related UI components, services, types, and Firestore rules.
*   **Previous Session Focus (Plan Detail Page)**:
    *   UI/UX Enhancements for `/plan/[planId]/page.tsx` (Info dialog, Add Child Item button, Delete Step button, removed coordinates/descriptions from canvas).
    *   Functionality Improvements (direct child item editing in panel, corrected connection line rendering, refined toast notifications).
    *   Bug Fixing (multiple JS parsing errors, "DialogTrigger not defined" error).
    *   Styling (static canvas width, diff view overlay).

## General Objectives & Direction
*   Continue building a feature-rich, stable, and user-friendly B2B collaboration platform.
*   Expand AI capabilities using Genkit for enhanced user experience and insights.
*   Maintain high code quality, adhering to the established tech stack and style guidelines.
*   Iteratively improve UI/UX based on usability considerations.

## Tech Stack Summary
*   **Frontend**: Next.js (App Router), React, TypeScript
*   **UI**: ShadCN UI Components, Tailwind CSS
*   **State Management**: React Context, TanStack Query (React Query)
*   **Backend/Database**: Firebase (Authentication, Firestore, Storage, Cloud Functions)
*   **AI**: Genkit (with Google AI models)
*   **Payments**: Stripe

## Style Guidelines Summary
*   Modern, professional aesthetic.
*   Sky blue primary theme with teal accents.
*   Rounded corners and shadows for elements.
*   Use of HSL CSS variables in `globals.css` for theming.
*   Lucide React for icons.
*   ShadCN charts for data visualization.
