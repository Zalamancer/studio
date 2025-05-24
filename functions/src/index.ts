
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
  logger.info("createBotUser function called (Simplified for debugging)");
  try {
    // Original logic commented out for debugging:
    /*
    // Generate a random suffix for uniqueness
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const botEmail = `bot_${Date.now()}_${randomSuffix}@example.com`;
    const botPassword = `strongPassword${Date.now()}${randomSuffix}`;

    logger.info(
      `Attempting to create bot user with email: ${botEmail}`
    );

    // Create Firebase Auth user
    const userRecord = await authAdmin.createUser({
      email: botEmail,
      password: botPassword,
      disabled: false, // Ensure the bot account is enabled
    });

    logger.info(
      "Successfully created new Firebase Auth user:",
      userRecord.uid
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
        new Date().getFullYear() - Math.floor(Math.random() * 10)
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
      userRecord.uid
    );

    response.status(200).send({
      message: "Bot user created successfully! (Original Logic)",
      userId: userRecord.uid,
      email: botEmail,
      mentionName: newMentionName,
    });
    */

    // Simplified response for debugging
    response.status(200).send({
      message: "createBotUser called successfully (Simplified for debugging)",
      userId: "debug-bot-user-id",
    });
  } catch (error) {
    logger.error("Error in createBotUser (Simplified):", error);
    response.status(500).send({
      error: "Failed in simplified createBotUser",
      details: (error as Error).message || "Unknown error",
    });
  }
});


// --- New Function: createBotPost ---
export const createBotPost = onRequest(async (request, response) => {
  logger.info("createBotPost function called (Simplified for debugging)");
  try {
    // Original logic commented out for debugging:
    /*
    const botUsersSnapshot = await dbAdmin.collection("users")
      .where("isBotAccount", "==", true).limit(50).get();

    if (botUsersSnapshot.empty) {
      logger.warn("No bot users found in Firestore. Cannot create a post.");
      response.status(404).send({error: "No bot users available to create a post."});
      return;
    }

    const botUsers = botUsersSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];

    if (!randomBot || !randomBot.id) {
      logger.error("Selected random bot is invalid.", randomBot);
      response.status(500).send({error: "Failed to select a valid bot user."});
      return;
    }

    const sampleQuestions = [
      "What are the best strategies for B2B lead generation in 2024?",
      "How can AI be leveraged for improving supply chain efficiency?",
      "Seeking collaborators for a new SaaS product in the fintech space.",
      "What are common pitfalls to avoid when scaling a remote team?",
      "Looking for insights on sustainable manufacturing practices.",
    ];
    // ... (other sample data arrays as before) ...

    const sampleDescriptions = [
      "We're exploring innovative ways to connect with potential clients...",
      "Our team is developing an AI model to optimize logistics and reduce costs...",
      "This project aims to disrupt the traditional payment processing industry...",
      "We're facing challenges in maintaining company culture with a distributed workforce...",
      "Our goal is to implement greener solutions in our production line...",
    ];
    const sampleTags = [
      ["Marketing", "Sales", "B2B"],
      ["AI", "Logistics", "Supply Chain"],
      ["Fintech", "SaaS", "Collaboration"],
      ["Remote Work", "HR", "Management"],
      ["Sustainability", "Manufacturing", "Innovation"],
    ];
    const sampleSectors = [
      "Tech", "Logistics", "Finance", "HR", "Manufacturing",
    ];

    const question = sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)];
    const description = sampleDescriptions[Math.floor(Math.random() * sampleDescriptions.length)];
    const tags = sampleTags[Math.floor(Math.random() * sampleTags.length)];
    const sector = sampleSectors[Math.floor(Math.random() * sampleSectors.length)];

    const newPostData = {
      userId: randomBot.id,
      question: question,
      description: description,
      tags: tags,
      sector: sector,
      businessType: randomBot.industry || "Bot Industry", // Use bot's industry
      safetyIndicator: "Medium",
      ratingScore: 0, // Bots might not have a rating initially
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [], // Bots won't upload images for now
      mentionedUserIds: [],
      requestType: "post" as const,
    };

    const postDocRef = await dbAdmin.collection("posts").add(newPostData);
    logger.info(
      `Bot user ${randomBot.id} created a new post: ${postDocRef.id}`
    );

    response.status(200).send({
      message: "Bot post created successfully! (Original Logic)",
      postId: postDocRef.id,
      botUserId: randomBot.id,
    });
    */

    // Simplified response for debugging
    response.status(200).send({
      message: "createBotPost called successfully (Simplified for debugging)",
      postId: "debug-bot-post-id",
    });
  } catch (error) {
    logger.error("Error in createBotPost (Simplified):", error);
    response.status(500).send({
      error: "Failed in simplified createBotPost",
      details: (error as Error).message || "Unknown error",
    });
  }
});

    