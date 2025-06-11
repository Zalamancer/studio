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
    *   Collections: Users can create collections and save posts to them.
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
The primary focus of the current session has been on refining the **Plan Detail Page (`/plan/[planId]/page.tsx`)** for roadmap visualization and interaction:

*   **UI/UX Enhancements**:
    *   Moved the "Plan Overview" section into a pop-up "Info" dialog, triggered by a button in the header.
    *   Removed redundant "Close" button from the Plan Info dialog.
    *   Relocated the "Add Child Item" button from the side panel to individual node card headers (as a `+` icon).
    *   Moved the "Delete Step" button from the side panel footer to its header, next to the close button.
    *   Removed direct display of X/Y coordinates from the node details panel.
    *   Removed direct display of node descriptions from the canvas cards; descriptions are now only visible/editable in the side panel.
*   **Functionality Improvements**:
    *   Enabled direct editing of child item titles and descriptions within the side panel, even if the child item is not spawned as a separate node on the canvas.
    *   Corrected the visual rendering of connection lines when a child item (green dot) is dragged to create a new node. The line now correctly originates from the child item's position and connects to the west (left) side of the newly created node.
    *   Refined the toast notification for child item updates in the panel: it now only appears once when the panel is closed and only if changes were actually made to the item's title or description.
*   **Bug Fixing**:
    *   Resolved multiple persistent JavaScript parsing errors in `src/app/plan/[planId]/page.tsx`. These errors were typically "Unexpected token `div`. Expected jsx identifier" and were caused by unclosed parentheses or backticks in JavaScript code preceding the main JSX return statement. Specific fixes included:
        *   Correcting missing closing braces `}}` in a `style` prop.
        *   Ensuring all `useCallback`, `useEffect`, and other hook structures were correctly terminated.
        *   Fixing missing backticks for a template literal in the `drawConnectionLines` function.
        *   Adding a missing closing parenthesis `)` for a `React.memo(...)` call wrapping the `RoadmapStepCardComponent`.
    *   Fixed a runtime error "DialogTrigger is not defined" by ensuring `DialogTrigger` and `DialogClose` were correctly imported in `src/app/plan/[planId]/page.tsx`.
*   **Styling**:
    *   Set a static width (1920px) for the plan canvas grid background.
    *   Ensured the semi-transparent overlay in the "diff view" mode for plan versions covers the entire (potentially wider) grid area.

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
