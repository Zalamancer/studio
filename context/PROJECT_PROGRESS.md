
# AnonyCollab Project Progress

## DONE
*   User Authentication (Firebase Email/Password, Google Sign-In)
*   reCAPTCHA Enterprise for Signup
*   Homepage Dashboard with Post Masonry Layout & Filtering
*   Post Detail View (Sliding Panel)
*   Basic Profile Viewing & Editing (Settings)
*   Real-time Messaging (Direct & Group Chats, including UI refinements for mobile)
*   Stripe Integration (Saving Payment Methods, Creating Subscriptions, Cancelling Subscriptions)
*   Post Creation with Image Uploads (up to 5, client-side compression)
*   Commenting System with Replies & Likes (Main & Sub-comments)
*   User Connection System (Request, Accept, Reject, Remove)
*   Notification System (Firebase Functions for backend, Dropdown UI)
*   Collaboration Plan Creation (Basic structure definition)
*   Interactive Roadmap Visualization (`/plan/[planId]`):
    *   Canvas with draggable nodes (Roadmap Steps).
    *   Ability to add/edit/delete nodes and child items.
    *   Visual linking between nodes (peer connections).
    *   Spawning child items as new canvas nodes.
    *   Version history for plans (viewing diffs, restoring versions).
    *   Side panel for detailed editing of nodes and child items.
    *   Plan Overview moved to "Info" dialog.
    *   Static width (1920px) for canvas grid.
    *   Corrected overlay for diff view.
    *   Fixed multiple parsing and runtime errors related to plan visualization page.
    *   UI/UX refinements for node card display (no description on card) and panel controls.
    *   Improved toast notifications for child item edits.
*   Discover Page for recently created Collaboration Plans.
*   Forgot Password functionality.
*   Settings pages (Profile, Account, Notifications, Payment Method, Verification placeholder).
*   Dark/Light Theme Toggle.
*   Firebase Cloud Functions for:
    *   Bot user/post/comment creation and scheduled activity.
    *   Auto-reply for messages to bots.
    *   Auto-accepting bot connection requests.

## REMOVED FEATURES
*   User Collections for Posts (Create, Add/Remove Posts, View) - Removed due to Firestore rule complexities.

## WORKING
*   Refining UI/UX across the application (ongoing).
*   Ensuring robustness and error handling in all services and components (ongoing).
*   Optimizing data fetching and state management (ongoing).
*   Further development of AI features with Genkit.

## NEXT
*   **Full AI Integration**:
    *   Implement `ai-connection-matcher.ts` and `connection-suggestions.ts` into the UI (e.g., suggesting collaborators on posts or in user profiles).
    *   Explore other AI-driven features (e.g., content summarization, trend analysis).
*   **Enhanced Collaboration Plan Features**:
    *   More sophisticated node types or properties.
    *   Real-time collaboration on plans (if feasible).
    *   Permissions and sharing for plans.
*   **Profile Enhancements**:
    *   Implement business verification flow (`/settings/verification`).
    *   More detailed profile sections (e.g., portfolio, case studies).
*   **Search & Discovery**:
    *   Implement global search functionality.
    *   Advanced filtering options for posts and user discovery.
*   **Notifications**:
    *   Integrate in-app notifications more deeply.
    *   Refine email notification templates and triggers.
*   **Admin/Moderation Tools**: (If applicable for platform management)
*   **Testing**: More comprehensive unit and integration tests.
*   **Deployment & Hosting**: Prepare for deployment on Firebase Hosting or similar.
