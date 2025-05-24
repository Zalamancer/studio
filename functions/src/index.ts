
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {generateAnonymousName} from "./utils/pseudonymUtils";

// Initialize Firebase Admin SDK.
// When deployed to Firebase, the SDK automatically discovers service account
// credentials.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export Firestore and Auth admin instances
export const dbAdmin = admin.firestore();
export const authAdmin = admin.auth();

// Example Cloud Function (Keep this if you still use it)
export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

// --- New Function: createBotUser ---
export const createBotUser = onRequest(async (request, response) => {
  try {
    // Generate a random suffix for uniqueness
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const botEmail = `bot_${Date.now()}_${randomSuffix}@example.com`;
    const botPassword = `strongPassword${Date.now()}${randomSuffix}`;

    logger.info(
      `Attempting to create bot user with email: ${botEmail}`,
    );

    // Create Firebase Auth user
    const userRecord = await authAdmin.createUser({
      email: botEmail,
      password: botPassword,
      disabled: false, // Ensure the bot account is enabled
    });

    logger.info(
      "Successfully created new Firebase Auth user:",
      userRecord.uid,
    );

    // Generate profile data for Firestore
    const newMentionName = generateAnonymousName(userRecord.uid);
    const industries = [
      "Tech", "Retail", "Healthcare", "Finance",
      "Manufacturing", "Education",
    ];
    const randomIndustry = industries[
      Math.floor(Math.random() * industries.length)
    ];

    const userProfileData = {
      uid: userRecord.uid,
      email: botEmail,
      mentionName: newMentionName,
      companyName: `Bot Business ${randomSuffix}`,
      actualDisplayName: null, // Bots don't have a "real" name
      industry: randomIndustry,
      avatarUrl: null, // Bots will use initials
      description: `This is an automated bot account for ${randomIndustry}.`,
      descriptionVisibility: "everyone" as const,
      tags: [],
      location: null,
      // Random year in last 10 years
      established: String(
        new Date().getFullYear() - Math.floor(Math.random() * 10),
      ),
      contactEmail: null,
      contactPhone: null,
      verified: true, // Bots can be marked as verified for testing
      isBotAccount: true, // Crucial flag
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save profile to Firestore 'users' collection
    await dbAdmin.collection("users").doc(userRecord.uid).set(userProfileData);
    logger.info(
      "Successfully created Firestore profile for bot user:",
      userRecord.uid,
    );

    response.status(200).send({
      message: "Bot user created successfully!",
      userId: userRecord.uid,
      email: botEmail,
      mentionName: newMentionName,
    });
  } catch (error) {
    logger.error("Error creating bot user:", error);
    response.status(500).send({
      error: "Failed to create bot user",
      details: error,
    });
  }
});
