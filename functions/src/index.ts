
// functions/src/index.ts
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {PubSub} from "@google-cloud/pubsub"; // Import for PubSub
import {onMessagePublished} from "firebase-functions/v2/pubsub"; // For Pub/Sub triggered functions

import {generateAnonymousName} from "./utils/pseudonymUtils";

// Initialize Firebase Admin SDK
// This is done once per function instance.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();

// ========== HELPER LOGIC for Bot User Creation ==========
async function _createBotUserLogic(): Promise<{userId: string; email: string; mentionName: string} | null> {
  logger.info("Attempting to create a new bot user (logic)...");
  try {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const botEmail = `bot_${Date.now()}_${randomSuffix}@example.com`;
    const botPassword = `strongPassword${Date.now()}${randomSuffix}`;

    const userRecord = await auth.createUser({
      email: botEmail,
      password: botPassword,
      disabled: false,
    });

    const industries = [
      "Tech", "Retail", "Healthcare", "Finance",
      "Manufacturing", "Education", "Other",
    ];
    const randomIndustry = industries[
      Math.floor(Math.random() * industries.length)
    ];

    const generatedMentionName = generateAnonymousName(userRecord.uid);

    const userProfileData = {
      uid: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
      industry: randomIndustry,
      description: `This is an automated bot account for the ${randomIndustry} industry, known as ${generatedMentionName}.`,
      descriptionVisibility: "everyone" as const,
      tags: [],
      established: String(
        new Date().getFullYear() - Math.floor(Math.random() * 10),
      ),
      verified: true,
      isBotAccount: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(userRecord.uid).set(userProfileData);
    logger.info(
      `Bot user ${userRecord.uid} (${generatedMentionName}) created successfully (logic).`,
    );
    return {
      userId: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
    };
  } catch (error: any) {
    logger.error("Error in _createBotUserLogic:", error);
    return null;
  }
}

// ========== HELPER LOGIC for Bot Post Creation ==========
async function _createBotPostLogic(): Promise<{postId: string; botUserId: string; botMentionName: string} | null> {
  logger.info("Attempting to create a new bot post (logic)...");
  try {
    const botUsersSnapshot = await db
      .collection("users")
      .where("isBotAccount", "==", true)
      .limit(50) // Fetch up to 50 bot users
      .get();

    if (botUsersSnapshot.empty) {
      logger.warn("No bot users found. Cannot create a post (logic).");
      return null;
    }

    const botUsers = botUsersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    }));
    const randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];

    if (!randomBot || !randomBot.id || !randomBot.mentionName) {
      logger.error(
        "Selected random bot is invalid or missing mentionName (logic).", randomBot,
      );
      return null;
    }

    const sampleQuestions = [
      "What are best B2B lead gen strategies for 2024?",
      "How can AI improve supply chain efficiency?",
      "Seeking collaborators for a new SaaS product in fintech.",
      "Common pitfalls when scaling a remote team globally?",
      "Insights on sustainable manufacturing for SMEs?",
      `Any ${randomBot.industry || "experts"} for a quick chat?`,
      `Advice on entering the ${randomBot.industry || "new"} market.`,
    ];
    const sampleDescriptions = [
      "Exploring innovative ways to connect with B2B clients.",
      "Developing an AI model for logistics optimization.",
      `Project: Disrupting payments. User: ${randomBot.mentionName}`,
      "Challenges with remote team culture and productivity.",
      "Implementing greener solutions in production lines.",
      `User ${randomBot.mentionName} from the ${randomBot.industry || "general"} sector needs advice.`,
      `User ${randomBot.mentionName} is exploring the ${randomBot.industry || "new"} market.`,
    ];
    const sampleTags = [
      ["Marketing", "Sales", "B2B"],
      ["AI", "Logistics", "Supply Chain"],
      ["Fintech", "SaaS", "Collaboration"],
      ["Remote Work", "HR", "Management"],
      ["Sustainability", "Manufacturing", "Green Tech"],
      [randomBot.industry || "General", "Networking", "Advice"],
      [randomBot.industry || "General", "Market Entry", "Strategy"],
    ];
    const index = Math.floor(Math.random() * sampleQuestions.length);
    const postSector = randomBot.industry || "General Business";
    const botRating = Math.floor(Math.random() * 3) + 2; // 2-4 stars

    const newPostData = {
      userId: randomBot.id,
      question: sampleQuestions[index],
      description: sampleDescriptions[index],
      tags: sampleTags[index] || ["General"],
      sector: postSector,
      subSector: null, // Bots can start with null subSector
      industry: randomBot.industry || null, // Bots can use their own industry or null
      naicsCode: null, // Bots may not have specific NAICS for now
      businessType: randomBot.industry || "Bot Industry",
      safetyIndicator: "Medium" as const,
      ratingScore: botRating,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [],
      mentionedUserIds: [],
      requestType: "post" as const,
      descriptionDetails: null,
      descriptionTried: null,
      descriptionOutcome: null,
      maxBudget: null,
      deadline: null,
    };

    const postDocRef = await db.collection("posts").add(newPostData);
    logger.info(
      `Bot user ${randomBot.id} (${randomBot.mentionName}) ` +
      `created new post: ${postDocRef.id} (logic).`,
    );
    return {
      postId: postDocRef.id,
      botUserId: randomBot.id,
      botMentionName: randomBot.mentionName,
    };
  } catch (error: any) {
    logger.error("Error in _createBotPostLogic:", error);
    return null;
  }
}

// ========== HTTP-Triggered createBotUser Function ==========
export const createBotUser = onRequest(async (request, response) => {
  logger.info("createBotUser HTTP function called.");
  const result = await _createBotUserLogic();
  if (result) {
    response.status(200).send({
      message: "Bot user created successfully!",
      ...result,
    });
  } else {
    response.status(500).send({
      error: "Failed to create bot user",
    });
  }
});

// ========== HTTP-Triggered createBotPost Function ==========
export const createBotPost = onRequest(async (request, response) => {
  logger.info("createBotPost HTTP function called.");
  const result = await _createBotPostLogic();
  if (result) {
    response.status(200).send({
      message: "Bot post created successfully!",
      ...result,
    });
  } else {
    response.status(500).send({
      error: "Failed to create bot post",
    });
  }
});

// ========== helloWorld Function (example) ==========
export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

// ========== Pub/Sub-Triggered scheduledBotActivity Function ==========
// Replace 'bot-activity-tick' with your desired Pub/Sub topic name
const BOT_ACTIVITY_TOPIC_NAME = "bot-activity-tick";

export const scheduledBotActivity = onMessagePublished(
  BOT_ACTIVITY_TOPIC_NAME,
  async (event) => {
    logger.info("scheduledBotActivity triggered by Pub/Sub message:", event);

    // Randomly decide to take an action (e.g., 70% chance)
    if (Math.random() < 0.7) {
      // Randomly decide action: 20% chance to create user, 80% to create post
      if (Math.random() < 0.2) {
        logger.info("scheduledBotActivity: Decided to create a new bot user.");
        const userResult = await _createBotUserLogic();
        if (userResult) {
          logger.info(
            `scheduledBotActivity: Bot user ${userResult.mentionName} created.`,
          );
        } else {
          logger.error("scheduledBotActivity: Failed to create bot user.");
        }
      } else {
        logger.info("scheduledBotActivity: Decided to create a new bot post.");
        const postResult = await _createBotPostLogic();
        if (postResult) {
          logger.info(
            `scheduledBotActivity: Bot post ${postResult.postId} created by ${postResult.botMentionName}.`,
          );
        } else {
          logger.warn(
            "scheduledBotActivity: Failed to create bot post (perhaps no bot users yet?).",
          );
        }
      }
    } else {
      logger.info("scheduledBotActivity: Decided to do nothing this time.");
    }
    return null; // Indicate successful handling of the Pub/Sub message
  },
);
