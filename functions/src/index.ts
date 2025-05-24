
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
// import * as functions from "firebase-functions"; // Commented out if not used by helloWorld
import * as admin from "firebase-admin";
// import {generateAnonymousName} from "./utils/pseudonymUtils"; // Commented out as createBotUser is commented out

// Initialize Firebase Admin SDK.
// When deployed to Firebase, the SDK automatically discovers service account
// credentials.
admin.initializeApp();

// Export Firestore and Auth admin instances - Commented out as not used by helloWorld
// export const dbAdmin = admin.firestore();
// export const authAdmin = admin.auth();

// Example Cloud Function (Keep this for testing deployment)
export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

// --- New Function: createBotUser ---
// export const createBotUser = onRequest(async (request, response) => {
//   logger.info(
//     "createBotUser function called (Simplified for debugging deployment)",
//   );
//   try {
//     // Original logic commented out for debugging "Maximum call stack size exceeded":
//     /*
//     // Generate a random suffix for uniqueness
//     const randomSuffix = Math.floor(1000 + Math.random() * 9000);
//     const botEmail = `bot_${Date.now()}_${randomSuffix}@example.com`;
//     // Ensure password meets Firebase minimum requirements (at least 6 chars)
//     const botPassword = `strongPassword${Date.now()}${randomSuffix}`;

//     logger.info(
//       `Attempting to create bot user with email: ${botEmail}`,
//     );

//     // Create Firebase Auth user
//     const userRecord = await authAdmin.createUser({
//       email: botEmail,
//       password: botPassword,
//       disabled: false, // Ensure the bot account is enabled
//     });

//     logger.info(
//       "Successfully created new Firebase Auth user:",
//       userRecord.uid,
//     );

//     // Generate profile data for Firestore
//     const newMentionName = generateAnonymousName(userRecord.uid);
//     const industries = [
//       "Tech", "Retail", "Healthcare", "Finance",
//       "Manufacturing", "Education",
//     ];
//     const randomIndustry = industries[
//       Math.floor(Math.random() * industries.length)
//     ];

//     const userProfileData = {
//       uid: userRecord.uid,
//       email: botEmail,
//       mentionName: newMentionName,
//       companyName: `Bot Business ${randomSuffix}`,
//       actualDisplayName: null, // Bots don't have a "real" name
//       industry: randomIndustry,
//       avatarUrl: null, // Bots will use initials by default
//       description: `This is an automated bot account for the ` +
//                    `${randomIndustry} industry.`,
//       descriptionVisibility: "everyone" as const,
//       tags: [],
//       location: null,
//       established: String( // Random year in last 10 years
//         new Date().getFullYear() - Math.floor(Math.random() * 10),
//       ),
//       contactEmail: null,
//       contactPhone: null,
//       verified: true, // Bots can be marked as verified for testing purposes
//       isBotAccount: true, // Crucial flag to identify bot accounts
//       createdAt: admin.firestore.FieldValue.serverTimestamp(),
//       updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//       lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
//     };

//     // Save profile to Firestore 'users' collection
//     await dbAdmin.collection("users").doc(userRecord.uid).set(userProfileData);
//     logger.info(
//       "Successfully created Firestore profile for bot user:",
//       userRecord.uid,
//     );

//     response.status(200).send({
//       message: "Bot user created successfully! (Original Logic)",
//       userId: userRecord.uid,
//       email: botEmail,
//       mentionName: newMentionName,
//     });
//     */

//     // Simplified response for debugging deployment
//     response.status(200).send({
//       message: "createBotUser called successfully (Simplified for debugging)",
//       userId: "debug-bot-user-id",
//     });
//   } catch (error) {
//     logger.error("Error in createBotUser (Simplified):", error);
//     response.status(500).send({
//       error: "Failed in simplified createBotUser",
//       // Safely access error message
//       details: (error as Error).message || "Unknown error",
//     });
//   }
// });


// --- New Function: createBotPost ---
// export const createBotPost = onRequest(async (request, response) => {
//   logger.info(
//     "createBotPost function called (Simplified for debugging deployment)",
//   );
//   try {
//     // Original logic commented out for debugging "Maximum call stack size exceeded":
//     /*
//     const botUsersSnapshot = await dbAdmin.collection("users")
//       .where("isBotAccount", "==", true).limit(50).get();

//     if (botUsersSnapshot.empty) {
//       logger.warn("No bot users found. Cannot create a post.");
//       response.status(404).send({
//         error: "No bot users available to create a post.",
//       });
//       return;
//     }

//     // Map to a more usable array of bot user data
//     const botUsers = botUsersSnapshot.docs.map((doc) => (
//       {id: doc.id, ...doc.data()}
//     ));
//     // Select a random bot user
//     const randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];

//     if (!randomBot || !randomBot.id) {
//       logger.error("Selected random bot is invalid.", randomBot);
//       response.status(500).send({error: "Failed to select a valid bot user."});
//       return;
//     }

//     const sampleQuestions = [
//       "What are the best B2B lead generation strategies for 2024?",
//       "How can AI be leveraged to improve supply chain efficiency?",
//       "Seeking collaborators for a new SaaS product in the fintech space.",
//       "What are common pitfalls when scaling a remote team globally?",
//       "Insights on sustainable manufacturing practices for SMEs?",
//     ];

//     const sampleDescriptions = [
//       "Exploring innovative ways to connect with potential B2B clients " +
//         "and drive growth.",
//       "Developing an AI-driven model to optimize logistics and reduce " +
//         "operational costs.",
//       "This project aims to disrupt traditional payment processing with " +
//         "a novel approach.",
//       "Facing challenges with maintaining company culture and productivity " +
//         "in a remote workforce.",
//       "Looking for partners to implement greener solutions in our " +
//         "production lines.",
//     ];
//     const sampleTags = [
//       ["Marketing", "Sales", "B2B", "Lead Generation"],
//       ["AI", "Logistics", "Supply Chain", "Optimization"],
//       ["Fintech", "SaaS", "Collaboration", "Payments"],
//       ["Remote Work", "HR", "Management", "Culture"],
//       ["Sustainability", "Manufacturing", "Green Tech", "Innovation"],
//     ];
//     const sampleSectors = [ // Assuming these are broad sector names
//       "Technology", "Logistics", "Finance",
//       "Human Resources", "Manufacturing",
//     ];

//     const question = sampleQuestions[
//       Math.floor(Math.random() * sampleQuestions.length)
//     ];
//     const description = sampleDescriptions[
//       Math.floor(Math.random() * sampleDescriptions.length)
//     ];
//     const tags = sampleTags[
//       Math.floor(Math.random() * sampleTags.length)
//     ];
//     const sector = sampleSectors[
//       Math.floor(Math.random() * sampleSectors.length)
//     ];

//     const newPostData = {
//       userId: randomBot.id,
//       question: question,
//       description: description,
//       tags: tags,
//       sector: sector,
//       // Assuming the bot's industry is stored in its profile
//       businessType: (randomBot as any).industry || "Bot Industry",
//       safetyIndicator: "Medium", // Example value
//       ratingScore: 0, // Bots might not have a rating initially
//       createdAt: admin.firestore.FieldValue.serverTimestamp(),
//       imageUrls: [], // Bots won't upload images for now
//       mentionedUserIds: [], // Bots won't mention users for now
//       requestType: "post" as const, // Explicitly a normal post
//     };

//     const postDocRef = await dbAdmin.collection("posts").add(newPostData);
//     logger.info(
//       `Bot user ${randomBot.id} created a new post: ${postDocRef.id}`,
//     );

//     response.status(200).send({
//       message: "Bot post created successfully! (Original Logic)",
//       postId: postDocRef.id,
//       botUserId: randomBot.id,
//     });
//     */

//     // Simplified response for debugging deployment
//     response.status(200).send({
//       message: "createBotPost called successfully (Simplified for debugging)",
//       postId: "debug-bot-post-id",
//     });
//   } catch (error) {
//     logger.error("Error in createBotPost (Simplified):", error);
//     response.status(500).send({
//       error: "Failed in simplified createBotPost",
//       details: (error as Error).message || "Unknown error",
//     });
//   }
// });
