/* eslint-disable max-len */
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {generateAnonymousName} from "./utils/pseudonymUtils";
// Import sector data and types
import {detailedSectorsData} from "./data/sectorData";
import type {
  SectorWithSubSectors,
  SubSector,
  Industry,
} from "./data/sectorTypes";


// Initialize Firebase Admin SDK
// This is done once when the functions module is loaded.
admin.initializeApp();

// Export Firestore and Auth admin instances
export const dbAdmin = admin.firestore();
export const authAdmin = admin.auth();

interface BotUserProfile {
  uid: string;
  email: string | null;
  mentionName: string;
  companyName: string | null;
  industry: string | null;
  description: string | null;
  descriptionVisibility: "everyone" | "connected" | "only_me";
  tags: string[];
  established: string | null; // Year as string
  verified: boolean;
  isBotAccount: boolean;
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
  lastLoginAt: admin.firestore.FieldValue;
}

/**
 * Creates a bot user with a unique anonymous name and basic profile.
 * @return {Promise<object|null>} Bot user details or null on failure.
 */
async function _createBotUserLogic(): Promise<{
  userId: string;
  email: string;
  mentionName: string;
  companyName: string;
} | null> {
  logger.info("Attempting to create a new bot user (logic)...");
  try {
    // Generate a more unique random suffix for email and password
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const botEmail = `bot_${Date.now()}_${randomSuffix}@example.com`;
    const botPassword = `StrongP@ssw0rd!${Date.now()}${randomSuffix}`;

    const userRecord = await authAdmin.createUser({
      email: botEmail,
      password: botPassword,
      disabled: false, // Bot accounts should be enabled
    });

    const industries = detailedSectorsData.map((sector) => sector.name);
    const randomIndustry =
      industries[Math.floor(Math.random() * industries.length)];

    const generatedMentionName = generateAnonymousName(userRecord.uid);
    const companyName = `Bot Entity ${generatedMentionName.slice(-5)}`;

    const userProfileData: BotUserProfile = {
      uid: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
      companyName: companyName,
      industry: randomIndustry,
      description:
        `This is an automated bot account for the ${randomIndustry} industry,` +
        ` known as ${generatedMentionName}. It actively participates by posting` +
        " and sometimes commenting on discussions.",
      descriptionVisibility: "everyone",
      tags: [], // Bots could have tags too, e.g., ["automated", "sample-content"]
      established: String(
        new Date().getFullYear() - Math.floor(Math.random() * 10)
      ),
      verified: true, // Bot accounts can be marked as verified
      isBotAccount: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await dbAdmin
      .collection("users")
      .doc(userRecord.uid)
      .set(userProfileData);

    logger.info(
      `Bot user ${userRecord.uid} (${generatedMentionName}) created (logic).`
    );
    return {
      userId: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
      companyName: companyName,
    };
  } catch (error: any) {
    logger.error(
      "_createBotUserLogic error - Code:", error.code,
      "Message:", error.message,
      "Full Error:", error
    );
    return null;
  }
}

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
      error: "Failed to create bot user.",
      detail: "Check function logs for more information.",
    });
  }
});

/**
 * Creates a bot post authored by a random bot user.
 * Uses detailed sector data for more realistic post content.
 * @return {Promise<object|null>} Post details or null on failure.
 */
async function _createBotPostLogic(): Promise<{
  postId: string;
  botUserId: string;
  botMentionName: string;
} | null> {
  logger.info("Attempting to create a new bot post (logic)...");
  try {
    const botUsersSnapshot = await dbAdmin
      .collection("users")
      .where("isBotAccount", "==", true)
      .limit(50) // Fetch up to 50 bot users to choose from
      .get();

    if (botUsersSnapshot.empty) {
      logger.warn(
        "No bot users found in Firestore. Cannot create a bot post." +
        " Please create bot users first."
      );
      return null;
    }

    const botUsers = botUsersSnapshot.docs.map((doc) => {
      return {id: doc.id, ...doc.data()};
    });
    const randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];

    if (!randomBot.mentionName) {
      logger.error(
        "Selected bot user is missing a mentionName.",
        {botId: randomBot.id}
      );
      return null;
    }

    // Generate more diverse and realistic post content
    const sampleQuestions = [
      "What are the latest trends in B2B marketing for the {sector} sector?",
      "Seeking advice on supply chain optimization for {industry} businesses.",
      "Looking for collaborators on a new SaaS product for {subSector}.",
      "How is AI impacting {industry} operations and customer engagement?",
      "Best practices for sustainable sourcing in the {sector} domain?",
      `Share your insights: Navigating regulatory changes in {naicsCode} for ${randomBot.mentionName}.`,
      `User ${randomBot.mentionName} is exploring market entry for {subSector} - tips?`,
    ];

    const sampleDescriptions = [
      `Exploring innovative solutions for customer retention in ${randomBot.industry}. Any case studies?`,
      `Developing a new platform for ${randomBot.industry} and looking for early feedback or partners. Specific focus on {naicsCode}.`,
      `User ${randomBot.mentionName} is researching effective digital advertising strategies tailored to the {sector} market.`,
      "What are the common pitfalls to avoid when scaling operations in a " +
      `${randomBot.industry} startup? #StartupChallenges`,
      `User ${randomBot.mentionName} needs help with data analytics for demand forecasting in the ${randomBot.industry} industry.`,
      `Discussing the future of remote work and collaboration tools for businesses in the {subSector} niche, by ${randomBot.mentionName}.`,
    ];

    const allTags = [
      "Strategy", "Innovation", "Technology", "Networking",
      "Collaboration", "Growth", "Startups", "SaaS", "B2B", "Marketing",
      "Sales", "Operations", "SupplyChain", "Logistics", "AI", "DataAnalytics",
      "Sustainability", "Regulations", "CustomerExperience", "Fintech",
      "HealthcareTech", "RetailTech", "ManufacturingTech", "EduTech",
    ];

    // Select a random sector
    const selectedSector = detailedSectorsData[
      Math.floor(Math.random() * detailedSectorsData.length)
    ];
    let selectedSubSector: SubSector | null = null;
    let selectedIndustry: Industry | null = null;
    let mostSpecificNaicsCode = selectedSector.code;

    if (selectedSector.subSectors && selectedSector.subSectors.length > 0) {
      selectedSubSector = selectedSector.subSectors[
        Math.floor(Math.random() * selectedSector.subSectors.length)
      ];
      mostSpecificNaicsCode = selectedSubSector.code;
      if (
        selectedSubSector.industries &&
        selectedSubSector.industries.length > 0
      ) {
        selectedIndustry = selectedSubSector.industries[
          Math.floor(Math.random() * selectedSubSector.industries.length)
        ];
        mostSpecificNaicsCode = selectedIndustry.code;
      }
    }

    const questionTemplate = sampleQuestions[
      Math.floor(Math.random() * sampleQuestions.length)
    ];
    const descriptionTemplate = sampleDescriptions[
      Math.floor(Math.random() * sampleDescriptions.length)
    ];

    // Basic template replacement
    const finalQuestion = questionTemplate
      .replace("{sector}", selectedSector.name)
      .replace("{subSector}", selectedSubSector?.name || selectedSector.name)
      .replace("{industry}", selectedIndustry?.name || selectedSubSector?.name || selectedSector.name)
      .replace("{naicsCode}", mostSpecificNaicsCode);

    const finalDescription = descriptionTemplate
      .replace("{sector}", selectedSector.name)
      .replace("{subSector}", selectedSubSector?.name || selectedSector.name)
      .replace("{industry}", selectedIndustry?.name || selectedSubSector?.name || selectedSector.name)
      .replace("{naicsCode}", mostSpecificNaicsCode);


    // Generate 2-4 random tags
    const numTags = Math.floor(Math.random() * 3) + 2; // 2 to 4 tags
    const postTags = [];
    const usedTagIndices = new Set();
    for (let i = 0; i < numTags; i++) {
      let tagIndex;
      do {
        tagIndex = Math.floor(Math.random() * allTags.length);
      } while (usedTagIndices.has(tagIndex));
      usedTagIndices.add(tagIndex);
      postTags.push(allTags[tagIndex]);
    }
    // Add sector/industry specific tags
    postTags.unshift(selectedIndustry?.name || selectedSubSector?.name || selectedSector.name);


    const newPostData = {
      userId: randomBot.id,
      question: finalQuestion,
      description: finalDescription,
      tags: [...new Set(postTags)].slice(0, 5), // Ensure unique tags, max 5
      sector: selectedSector.name,
      subSector: selectedSubSector?.name || null,
      industry: selectedIndustry?.name || null,
      naicsCode: mostSpecificNaicsCode,
      businessType: randomBot.industry || "General Business",
      safetyIndicator: "Medium" as const, // Assuming type safety from your app
      ratingScore: Number(((Math.random() * 2) + 3).toFixed(1)), // 3.0 to 5.0
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [], // Bots won't upload images for now
      mentionedUserIds: [], // Bots won't mention users for now
      requestType: "post" as const,
      descriptionDetails: null,
      descriptionTried: null,
      descriptionOutcome: null,
      maxBudget: null,
      deadline: null,
    };

    const postRef = await dbAdmin.collection("posts").add(newPostData);
    logger.info(
      `Bot user ${randomBot.id} (${randomBot.mentionName})` +
      ` created post ${postRef.id} in sector ${selectedSector.name}.`
    );

    return {
      postId: postRef.id,
      botUserId: randomBot.id,
      botMentionName: randomBot.mentionName,
    };
  } catch (error: any) {
    logger.error(
      "_createBotPostLogic error - Code:", error.code,
      "Message:", error.message,
      "Full Error:", error
    );
    return null;
  }
}

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
      error: "Failed to create bot post.",
      detail: "Check function logs for more information.",
    });
  }
});


// Example Cloud Function (HTTP-triggered)
export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

const BOT_ACTIVITY_TOPIC = "bot-activity-tick"; // Topic name

export const scheduledBotActivity = onMessagePublished(
  BOT_ACTIVITY_TOPIC,
  async (event) => {
    logger.info("scheduledBotActivity triggered", event);

    // Randomly decide to perform an action (e.g., 70% chance)
    if (Math.random() < 0.7) {
      // If action is performed, randomly decide to create user or post
      if (Math.random() < 0.2) { // 20% chance to create a user
        logger.info("Scheduled task: Decided to create a new bot user.");
        await _createBotUserLogic();
      } else { // 80% chance to create a post
        logger.info("Scheduled task: Decided to create a new bot post.");
        await _createBotPostLogic();
      }
    } else {
      logger.info(
        "Scheduled task: Decided to do nothing this time."
      );
    }
    return null; // Important to return null or a Promise
  }
);
