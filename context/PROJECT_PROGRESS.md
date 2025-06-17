# AnonyCollab Project Progress

## DONE
*   User Authentication (Firebase Email/Password, Google Sign-In)
*   reCAPTCHA Enterprise for Signup
*   Homepage Dashboard with Post Masonry Layout & Filtering
*   Post Detail View (Sliding Panel)
    *   AI Connection Suggestions for posts (using `ai-connection-matcher.ts`)
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

## WORKING

## NEXT