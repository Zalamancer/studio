
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {generateAnonymousName} from "./utils/pseudonymUtils";
// Corrected import path for detailedSectorsData
import {detailedSectorsData} from "./data/sectorData";
import {onMessagePublished} from "firebase-functions/v2/pubsub";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Firestore and Auth admin instances
export const dbAdmin = admin.firestore();
export const authAdmin = admin.auth();

// --- Helper Function to Create a Bot User Profile ---
async function _createBotUserLogic(): Promise<{
  userId: string;
  email: string;
  mentionName: string;
} | null> {
  logger.info("Attempting to create a new bot user (logic)...");
  try {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const botEmail = `bot_${Date.now()}_${randomSuffix}@example.com`;
    // Generate a strong, unique password (though it won't be used for login)
    const botPassword = `strongPassword${Date.now()}${randomSuffix}`;

    const userRecord = await authAdmin.createUser({
      email: botEmail,
      password: botPassword,
      disabled: false, // Ensure the account is enabled
    });

    const generatedMentionName = generateAnonymousName(userRecord.uid);

    // Randomly select an industry for the bot
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
      tags: [] as string[], // Bots start with no tags
      // Random established year (e.g., within the last 10 years)
      established: String(
        new Date().getFullYear() - Math.floor(Math.random() * 10),
      ),
      verified: true, // Bot accounts are considered "verified" by the system
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
      `Bot user ${userRecord.uid} (${generatedMentionName})` +
      `created successfully (logic).`,
    );

    return {
      userId: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
    };
  } catch (error) {
    logger.error("Error creating bot user (logic):", error);
    return null;
  }
}

// --- Helper Function for Bot to Create a Post ---
async function _createBotPostLogic(): Promise<{
  postId: string;
  botUserId: string;
  botMentionName: string;
} | null> {
  logger.info("Attempting to create a new bot post (logic)...");
  try {
    // Fetch up to 50 bot users
    const botUsersSnapshot = await dbAdmin
      .collection("users")
      .where("isBotAccount", "==", true)
      .limit(50)
      .get();

    if (botUsersSnapshot.empty) {
      logger.warn(
        "No bot users found in Firestore. Cannot create a bot post.",
      );
      return null;
    }

    const botUsers = botUsersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];

    if (!randomBot.id || !randomBot.mentionName) {
      logger.error(
        "Selected bot user is invalid or missing mentionName.",
        randomBot,
      );
      return null;
    }

    // Generate varied post content
    const sampleQuestions = [
      `What are the latest trends in ${randomBot.industry || "my industry"}?`,
      `Seeking collaborators for a new project in ${randomBot.mentionName}'s area.`,
      `Best practices for supply chain management in ${randomBot.industry || "manufacturing"}?`,
      `How is AI transforming the ${randomBot.industry || "tech"} sector? #AI #Innovation`,
      `Looking for insights on market entry strategies. @${randomBot.mentionName} any ideas?`,
      `Discussing the impact of sustainability on business models. #Sustainability`,
      `Need advice on scaling a startup. What are key challenges? #Startup`,
      `Exploring new technologies for remote work efficiency. #FutureOfWork`,
    ];
    const sampleDescriptions = [
      "Looking for detailed insights and real-world examples. " +
      "All contributions appreciated!",
      "This is an exciting new venture and we are looking for partners " +
      "with expertise in development and marketing.",
      "We are trying to optimize our logistics and reduce costs. " +
      "What strategies have worked for you?",
      "Focusing on machine learning applications and data analytics. " +
      "Share your thoughts!",
      "Specifically interested in targeting new demographics " +
      "and regions. Open to all suggestions.",
      "How can businesses integrate sustainable practices without " +
      "compromising profitability?",
      "What are the common pitfalls to avoid when growing a company " +
      "from 10 to 100 employees?",
      "Virtual collaboration tools, project management software, " +
      "and communication platforms - what's working best?",
    ];
    const sampleTagsPool = [
      ["Tech", "Innovation"], ["Collaboration", "Projects"],
      ["Logistics", "SupplyChain"], ["AI", "FutureTech"],
      ["Strategy", "MarketEntry"], ["Sustainability", "Business"],
      ["Startup", "Growth"], ["RemoteWork", "Productivity"],
      ["Finance"], ["Healthcare"], ["Education"], ["Marketing"],
    ];

    // Select detailed sector info for the post
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
    const subSectorName = postSubSector?.name || null;
    const industryName = postIndustry?.name || null;


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
      ratingScore: Math.random() * 2 + 3, // Random score between 3.0 and 5.0
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [] as string[],
      mentionedUserIds: [] as string[],
      requestType: "post" as const,
      // Fields for help requests are null for bot posts
      descriptionDetails: null,
      descriptionTried: null,
      descriptionOutcome: null,
      maxBudget: null,
      deadline: null,
    };

    const postRef = await dbAdmin.collection("posts").add(newPostData);
    logger.info(
      `Bot user ${randomBot.id} (${randomBot.mentionName}) ` +
      `created post ${postRef.id} (logic).`,
    );

    return {
      postId: postRef.id,
      botUserId: randomBot.id,
      botMentionName: randomBot.mentionName,
    };
  } catch (error) {
    logger.error("Error creating bot post (logic):", error);
    return null;
  }
}


// --- HTTP-Triggered Cloud Functions ---
export const createBotUser = onRequest(async (request, response) => {
  logger.info("createBotUser HTTP function triggered.");
  const result = await _createBotUserLogic();
  if (result) {
    response.send({
      message: "Bot user created successfully!", ...result,
    });
  } else {
    response.status(500).send({error: "Failed to create bot user."});
  }
});

export const createBotPost = onRequest(async (request, response) => {
  logger.info("createBotPost HTTP function triggered.");
  const result = await _createBotPostLogic();
  if (result) {
    response.send({
      message: "Bot post created successfully!", ...result,
    });
  } else {
    response.status(500).send({error: "Failed to create bot post."});
  }
});

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

// --- Pub/Sub-Triggered Cloud Function for Scheduled Activity ---
const BOT_ACTIVITY_TOPIC_NAME = "bot-activity-tick"; // Or from environment variables

export const scheduledBotActivity = onMessagePublished(
  BOT_ACTIVITY_TOPIC_NAME,
  async (event) => {
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
        "Scheduled bot activity: Decided to do nothing this time.",
      );
    }
    return null; // Indicate successful processing of the Pub/Sub message
  },
);
