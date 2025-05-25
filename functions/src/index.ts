
// functions/src/index.ts
/* eslint-disable object-curly-spacing, comma-spacing, indent */
import {dbAdmin as db, authAdmin as auth} from "./admin"; // Use aliased imports
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {onMessagePublished} from "firebase-functions/v2/pubsub";
import {generateAnonymousName} from "./utils/pseudonymUtils";
import {detailedSectorsData} from "./data/sectorData";
import * as admin from "firebase-admin";

/**
 * Core logic to create a bot user account with randomized details.
 * Saves the user to Firebase Auth and their profile to Firestore.
 * @return {Promise<{userId: string, email: string, mentionName: string} | null>}
 * An object with bot user details or null on error.
 */
async function _createBotUserLogic(): Promise<{
  userId: string;
  email: string;
  mentionName: string;
} | null> {
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

    const generatedMentionName = generateAnonymousName(userRecord.uid);
    const randomSector = detailedSectorsData[
      Math.floor(Math.random() * detailedSectorsData.length)
    ];
    const randomSubSector = randomSector.subSectors.length > 0 ?
      randomSector.subSectors[
        Math.floor(Math.random() * randomSector.subSectors.length)
      ] :
      null;
    const randomIndustry = randomSubSector && randomSubSector.industries.length > 0 ?
      randomSubSector.industries[
        Math.floor(Math.random() * randomSubSector.industries.length)
      ] :
      null;

    const industryName = randomIndustry?.name ||
                       randomSubSector?.name ||
                       randomSector.name;

    const userProfileData = {
      uid: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
      industry: industryName,
      description: `This is an automated bot account for the ` +
                   `${industryName} industry, known as ${generatedMentionName}.`,
      descriptionVisibility: "everyone" as const,
      tags: [] as string[],
      established: String(
        new Date().getFullYear() - Math.floor(Math.random() * 10)
      ),
      verified: true,
      isBotAccount: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      // Fields explicitly omitted: actualDisplayName, avatarUrl, companyName,
      // contactEmail, contactPhone, location
    };

    await db
      .collection("users")
      .doc(userRecord.uid)
      .set(userProfileData);
    logger.info(
      `Bot user ${userRecord.uid} (${generatedMentionName}) ` +
      "created successfully (logic)."
    );

    return {
      userId: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
    };
  } catch (error) {
    logger.error("_createBotUserLogic error:", error);
    return null;
  }
}

/**
 * Core logic to select a random bot user and create a post on their behalf.
 * Uses randomized content from predefined samples and detailed sector data.
 * @return {Promise<{postId: string, botUserId: string,
 * botMentionName: string} | null>}
 * An object with post details or null on error.
 */
async function _createBotPostLogic(): Promise<{
  postId: string;
  botUserId: string;
  botMentionName: string;
} | null> {
  logger.info("Attempting to create a new bot post (logic)...");
  try {
    const botUsersSnapshot = await db
      .collection("users")
      .where("isBotAccount", "==", true)
      .limit(50)
      .get();

    if (botUsersSnapshot.empty) {
      logger.warn(
        "No bot users found in Firestore. Cannot create a bot post."
      );
      return null;
    }

    const botUsers = botUsersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    // Type assertion, assuming bot users will have mentionName and industry
    } as { id: string, mentionName?: string, industry?: string } ));

    const randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];

    if (!randomBot.id || !randomBot.mentionName) {
      logger.error(
        "Selected bot user is invalid or missing key fields (id, mentionName).",
        randomBot
      );
      return null;
    }

    const postSectorData = detailedSectorsData[
      Math.floor(Math.random() * detailedSectorsData.length)
    ];
    const postSubSector = postSectorData.subSectors.length > 0 ?
      postSectorData.subSectors[
        Math.floor(Math.random() * postSectorData.subSectors.length)
      ] : null;
    const postIndustry = postSubSector && postSubSector.industries.length > 0 ?
      postSubSector.industries[
        Math.floor(Math.random() * postSubSector.industries.length)
      ] : null;

    const naicsCode = postIndustry?.code ||
                      postSubSector?.code ||
                      postSectorData.code;
    const sectorName = postSectorData.name;
    const subSectorName = postSubSector?.name || null; // Can be null
    const industryName = postIndustry?.name || null;   // Can be null

    const sampleQuestions = [
      `What are the latest trends in ${industryName || subSectorName || sectorName}? #Innovation`,
      `Seeking collaborators for a project in ${randomBot.mentionName}'s field (${industryName || "general"}).`,
      `Best practices for supply chain in ${sectorName}?`,
      `How is AI transforming the ${sectorName} sector? #AI #FutureTech`,
      `User ${randomBot.mentionName} is looking for insights on market entry strategies for ${subSectorName || sectorName}.`,
      `Discussing sustainability impact on ${industryName || sectorName} business models. #ESG`,
      `Need advice on scaling a startup in ${randomBot.industry || "our industry"}. Key challenges? #StartupLife`,
      `Exploring new tech for remote work efficiency in ${sectorName}. #FutureOfWork`,
    ];
    const sampleDescriptions = [
      "Looking for detailed insights and real-world examples. All contributions appreciated!",
      "This is an exciting new venture and we're looking for partners with expertise.",
      "Trying to optimize logistics and reduce costs. What strategies have worked for you?",
      "Focusing on machine learning applications and data analytics. Share your thoughts!",
      "Specifically interested in targeting new demographics. Open to all suggestions.",
      "How can businesses integrate sustainable practices without compromising profitability?",
      "What are common pitfalls to avoid when growing a company?",
      "Virtual collaboration tools, project management software - what's working best?",
    ];
    const sampleTagsPool = [
      ["Tech", "Innovation"], ["Collaboration", "Projects"],
      ["Logistics", "SupplyChain"], ["AI", "FutureTech"],
      ["Strategy", "MarketEntry"], ["Sustainability", "Business"],
      ["Startup", "Growth"], ["RemoteWork", "Productivity"],
      ["Finance"], ["Healthcare"], ["Education"], ["Marketing"],
      ["Legal"], ["Product"],
    ];

    const newPostData = {
      userId: randomBot.id,
      question: sampleQuestions[
        Math.floor(Math.random() * sampleQuestions.length)
      ],
      description: sampleDescriptions[
        Math.floor(Math.random() * sampleDescriptions.length)
      ],
      tags: sampleTagsPool[
        Math.floor(Math.random() * sampleTagsPool.length)
      ],
      sector: sectorName,
      subSector: subSectorName,
      industry: industryName,
      naicsCode: naicsCode,
      businessType: randomBot.industry || "General Business",
      safetyIndicator: "Medium" as const,
      ratingScore: Math.random() * 2 + 3,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [] as string[],
      mentionedUserIds: [] as string[],
      requestType: "post" as const,
      descriptionDetails: null,
      descriptionTried: null,
      descriptionOutcome: null,
      maxBudget: null,
      deadline: null,
    };

    const postRef = await db.collection("posts").add(newPostData);
    logger.info(
      `Bot user ${randomBot.id} (${randomBot.mentionName}) ` +
      `created post ${postRef.id} (logic).`
    );

    return {
      postId: postRef.id,
      botUserId: randomBot.id,
      botMentionName: randomBot.mentionName,
    };
  } catch (error) {
    logger.error("_createBotPostLogic error:", error);
    return null;
  }
}

/**
 * HTTP-triggered function to create a new bot user.
 */
export const createBotUser = onRequest(async (req, res) => {
  logger.info("createBotUser HTTP function triggered.");
  const result = await _createBotUserLogic();
  if (result) {
    res.status(200).send({
      message: "Bot user created successfully!", ...result,
    });
  } else {
    res.status(500).send({error: "Failed to create bot user."});
  }
});

/**
 * HTTP-triggered function to create a new bot post.
 */
export const createBotPost = onRequest(async (req, res) => {
  logger.info("createBotPost HTTP function triggered.");
  const result = await _createBotPostLogic();
  if (result) {
    res.status(200).send({
      message: "Bot post created successfully!", ...result,
    });
  } else {
    res.status(500).send({error: "Failed to create bot post."});
  }
});

/**
 * Simple test endpoint.
 */
export const helloWorld = onRequest((req, res) => {
  logger.info("Hello logs!", {structuredData: true});
  res.send("Hello from Firebase!");
});

// --- Pub/Sub-Triggered Cloud Function for Scheduled Activity ---
const BOT_ACTIVITY_TOPIC_NAME = "bot-activity-tick";

/**
 * PubSub-triggered function that randomly decides to create a bot user or post.
 * @param {functions.pubsub.Message} event The Pub/Sub message event.
 * @return {Promise<null>} A promise that resolves when processing is complete.
 */
export const scheduledBotActivity = onMessagePublished(
  BOT_ACTIVITY_TOPIC_NAME,
  async (event) => { // Added event parameter for PubSub functions
    logger.info("scheduledBotActivity triggered by Pub/Sub message:", event);

    const shouldAct = Math.random() < 0.7; // 70% chance to perform an action

    if (shouldAct) {
      const actionType = Math.random();
      if (actionType < 0.2) { // 20% chance to create a user
        logger.info("Scheduled bot activity: Decided to create a bot user.");
        await _createBotUserLogic();
      } else { // 80% chance to create a post
        logger.info("Scheduled bot activity: Decided to create a bot post.");
        await _createBotPostLogic();
      }
    } else {
      logger.info(
        "Scheduled bot activity: Decided to do nothing this time."
      );
    }
    return null; // Indicate successful processing of the Pub/Sub message
  }
);
