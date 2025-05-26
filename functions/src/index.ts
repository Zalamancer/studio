// functions/src/index.ts
/* eslint-disable @typescript-eslint/no-unused-vars */
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {onMessagePublished} from "firebase-functions/v2/pubsub";
import {GoogleGenerativeAI} from "@google/generative-ai";

import {generateAnonymousName} from "./utils/pseudonymUtils";
import {detailedSectorsData, findIndustryByName}from "./data/sectorData";
import type {
  SectorWithSubSectors,
  SubSector,
  Industry,
} from "./data/sectorTypes";

// Initialize Firebase Admin SDK
// This is done once globally.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export Firestore and Auth admin instances
export const db = admin.firestore(); // Changed from dbAdmin for consistency
export const auth = admin.auth(); // Changed from authAdmin for consistency


/**
 * @interface BotUser
 * @description Defines the structure for a bot user's details.
 */
interface BotUser {
  userId: string;
  email: string;
  mentionName: string;
  industry: string;
}

/**
 * @interface BotComment
 * @description Defines the structure for a bot comment's details.
 */
interface BotComment {
  commentId: string;
  postId: string;
  commentingUserId: string;
  commentingUserMentionName: string;
}

/**
 * Helper function to check if a user is a bot.
 * @param {string} userId The ID of the user to check.
 * @return {Promise<boolean>} True if the user is a bot, false otherwise.
 */
async function isBotUser(userId: string): Promise<boolean> {
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) return false;
  return userDoc.data()?.isBotAccount === true;
}

/**
 * Helper function to check if a user is a real user.
 * @param {string} userId The ID of the user to check.
 * @return {Promise<boolean>} True if the user is a real user, false otherwise.
 */
async function isRealUser(userId: string): Promise<boolean> {
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) return false;
  // Assuming real users don't have isBotAccount or it's false
  return !userDoc.data()?.isBotAccount;
}

/**
 * Core logic to create a bot user account with randomized details.
 * Saves the user to Firebase Auth and their profile to Firestore.
 * @param {string} [targetIndustryName] Optional name of the industry for the bot.
 * @return {Promise<BotUser | null>} An object with bot user details or null.
 */
async function _createBotUserLogic(
  targetIndustryName?: string
): Promise<BotUser | null> {
  const functionName = "_createBotUserLogic";
  logger.info(
    `[${functionName}] Attempting to create a new bot user. ` +
    `Target industry: ${targetIndustryName || "Random"}`
  );
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

    let industryName = "General Business";
    let selectedSector: SectorWithSubSectors | undefined;
    let selectedSubSector: SubSector | null = null;
    let selectedIndustry: Industry | null = null;

    if (targetIndustryName) {
      const foundIndustry = findIndustryByName(targetIndustryName);
      if (foundIndustry) {
        selectedIndustry = foundIndustry.industry;
        selectedSubSector = foundIndustry.subSector;
        selectedSector = foundIndustry.sector;
        industryName =
          selectedIndustry?.name ||
          selectedSubSector?.name ||
          selectedSector?.name ||
          targetIndustryName;
      } else {
        logger.warn(
          `[${functionName}] Target industry "${targetIndustryName}" not found. ` +
          "Assigning to \"General Business\"."
        );
      }
    } else {
      selectedSector =
        detailedSectorsData[
          Math.floor(Math.random() * detailedSectorsData.length)
        ];
      if (selectedSector.subSectors.length > 0) {
        selectedSubSector =
          selectedSector.subSectors[
            Math.floor(Math.random() * selectedSector.subSectors.length)
          ];
      }
      if (selectedSubSector && selectedSubSector.industries.length > 0) {
        selectedIndustry =
          selectedSubSector.industries[
            Math.floor(Math.random() * selectedSubSector.industries.length)
          ];
      }
      industryName =
        selectedIndustry?.name ||
        selectedSubSector?.name ||
        selectedSector?.name ||
        "General Business";
    }
    if (!industryName) {
      logger.warn(
        `[${functionName}] Industry name ended up empty, ` +
        "defaulting to General Business. This should not happen."
      );
      industryName = "General Business";
    }

    const userProfileData = {
      uid: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
      industry: industryName,
      description:
        `This is an automated bot account for the ${industryName} ` +
        `industry, known as ${generatedMentionName}.`,
      descriptionVisibility: "everyone" as const,
      tags: [] as string[],
      established: String(
        new Date().getFullYear() - Math.floor(Math.random() * 10)
      ),
      verified: true,
      isBotAccount: true, // Mark as bot account
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(userRecord.uid).set(userProfileData);
    logger.info(
      `[${functionName}] Bot user ${userRecord.uid} (${generatedMentionName}) ` +
      `for industry "${industryName}" created successfully.`
    );

    return {
      userId: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
      industry: industryName,
    };
  } catch (error) {
    logger.error(`[${functionName}] Error:`, error);
    return null;
  }
}

/**
 * Core logic to select a random bot user and create a post on their behalf.
 * @return {Promise<{postId: string, botUserId: string, botMentionName: string} | null>}
 * An object with post details or null on error.
 */
async function _createBotPostLogic(): Promise<{
    postId: string;
    botUserId: string;
    botMentionName: string;
  } | null> {
  const functionName = "_createBotPostLogic";
  logger.info(`[${functionName}] Attempting to create a new bot post...`);
  const API_KEY = process.env.GEMINI_API_KEY;

  try {
    const botUsersSnapshot = await db
      .collection("users")
      .where("isBotAccount", "==", true)
      .limit(50)
      .get();

    let randomBot: {
      id: string;
      mentionName?: string;
      industry?: string;
    };

    if (botUsersSnapshot.empty) {
      logger.warn(
        `[${functionName}] No bot users found. ` +
        "Creating a new one for the post."
      );
      const newBot = await _createBotUserLogic();
      if (!newBot) {
        logger.error(
          `[${functionName}] Failed to create a new bot for posting. ` +
          "Aborting post creation."
        );
        return null;
      }
      randomBot = {
        id: newBot.userId,
        mentionName: newBot.mentionName,
        industry: newBot.industry,
      };
    } else {
      const botUsers = botUsersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as { mentionName?: string; industry?: string }),
      }));
      randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];
    }

    if (!randomBot || !randomBot.id || !randomBot.mentionName) {
      logger.error(
        `[${functionName}] Selected bot user is invalid or missing key fields.`,
        randomBot
      );
      return null;
    }

    let postIndustryName = randomBot.industry;
    let pSector: SectorWithSubSectors | undefined;
    let pSubSector: SubSector | null = null;
    let pIndustry: Industry | null = null;

    if (postIndustryName) {
      const foundPIndustry = findIndustryByName(postIndustryName);
      if (foundPIndustry) {
        pIndustry = foundPIndustry.industry;
        pSubSector = foundPIndustry.subSector;
        pSector = foundPIndustry.sector;
      }
    }

    if (!pIndustry) {
      pSector =
        detailedSectorsData[
          Math.floor(Math.random() * detailedSectorsData.length)
        ];
      if (pSector.subSectors.length > 0) {
        pSubSector =
          pSector.subSectors[
            Math.floor(Math.random() * pSector.subSectors.length)
          ];
      }
      if (pSubSector && pSubSector.industries.length > 0) {
        pIndustry =
          pSubSector.industries[
            Math.floor(Math.random() * pSubSector.industries.length)
          ];
      }
      postIndustryName =
        pIndustry?.name ||
        pSubSector?.name ||
        pSector?.name ||
        "General Business";
    }

    const naicsCode = pIndustry?.code || pSubSector?.code || pSector?.code; // Can be null
    const sectorName = pSector?.name; // Can be null
    const subSectorName = pSubSector?.name || null; // Can be null
    const industryNameDisplay = pIndustry?.name || postIndustryName;

    if (!API_KEY) {
      logger.error(
        `[${functionName}] GEMINI_API_KEY environment variable not set. ` +
        "Cannot generate post content."
      );
      return null;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({model: "gemini-1.5-flash-latest"});
    const prompt =
      `Generate a unique and relevant question and a detailed description ` +
      `for a forum post in the field of ${industryNameDisplay}. The user ` +
      `is an account and is looking for insights. The output should be a JSON ` +
      `object with "question" (string) and "description" (string) fields. ` +
      `Ensure the content is appropriate for a professional networking ` +
      `platform and is different from previous generations.`;

    let generatedContent = {question: "", description: ""};
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      logger.info(`[${functionName}] Raw Gemini API response for post:`, text);
      let jsonString = text.trim();
      const markdownMatch = jsonString.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
      if (markdownMatch && markdownMatch[1]) {
        jsonString = markdownMatch[1].trim();
      }
      try {
        generatedContent = JSON.parse(jsonString);
        if (
          typeof generatedContent.question !== "string" ||
          typeof generatedContent.description !== "string"
        ) {
          throw new Error("Parsed JSON for post has invalid content.");
        }
      } catch (parseError) {
        logger.error(
          `[${functionName}] Failed to parse Gemini response for post as JSON:`,
          jsonString,
          parseError
        );
        generatedContent.question =
          `Generated question for ${industryNameDisplay} (Parsing Error)`;
        generatedContent.description =
          `Generated description for ${industryNameDisplay}. ` +
          "Failed to parse detailed content from AI.";
      }
    } catch (error) {
      logger.error(`[${functionName}] Error calling Gemini API for post:`, error);
      generatedContent.question =
        `Question related to ${industryNameDisplay} (API Error)`;
      generatedContent.description =
        `Seeking insights in the field of ${industryNameDisplay}. ` +
        "(Content generation failed)";
    }

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
      question: generatedContent.question,
      description: generatedContent.description,
      tags: sampleTagsPool[Math.floor(Math.random() * sampleTagsPool.length)],
      sector: sectorName, // This is SectorWithSubSectors.name, can be undefined
      subSector: subSectorName, // This is SubSector.name, can be null
      industry: industryNameDisplay, // This is Industry.name or a fallback
      naicsCode: naicsCode, // Can be null
      businessType: randomBot.industry || "General Business",
      safetyIndicator: "Medium" as const,
      ratingScore: 0, // Bots won't have ratings initially
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [] as string[],
      mentionedUserIds: [] as string[],
      requestType: "post" as const,
      descriptionDetails: null,
      descriptionTried: null,
      descriptionOutcome: null,
      maxBudget: null,
      deadline: null,
      commentCount: 0,
    };

    const postRef = await db.collection("posts").add(newPostData);
    logger.info(
      `[${functionName}] Bot user ${randomBot.id} (${randomBot.mentionName}) ` +
      `created post ${postRef.id} in industry "${industryNameDisplay}".`
    );
    return {
      postId: postRef.id,
      botUserId: randomBot.id,
      botMentionName: randomBot.mentionName,
    };
  } catch (error) {
    logger.error(`[${functionName}] Error:`, error);
    return null;
  }
}

/**
 * Core logic to create a bot comment on a post.
 * @param {string} [postId] Optional ID of the post to comment on. If not provided,
 * a post with few comments will be selected.
 * @return {Promise<BotComment | null>} An object with comment details or null on error.
 */
async function _createBotCommentLogic(
  postId?: string
): Promise<BotComment | null> {
  const functionName = "_createBotCommentLogic";
  logger.info(
    `[${functionName}] Attempting to create bot comment. Target post: ${postId || "auto-select"}`
  );
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    logger.error(
      `[${functionName}] GEMINI_API_KEY missing. Cannot generate comment.`
    );
    return null;
  }

  let targetPostId = postId;
  let postData: admin.firestore.DocumentData | undefined;

  try {
    if (!targetPostId) {
      logger.info(
        `[${functionName}] No postId provided, finding post with few comments.`
      );
      const postsSnapshot = await db
        .collection("posts")
        .orderBy("commentCount", "asc")
        .limit(1)
        .get();
      if (postsSnapshot.empty) {
        logger.warn(`[${functionName}] No posts found to comment on.`);
        return null;
      }
      targetPostId = postsSnapshot.docs[0].id;
      postData = postsSnapshot.docs[0].data();
      logger.info(
        `[${functionName}] Selected post ${targetPostId} for commenting.`
      );
    } else {
      const postDoc = await db.collection("posts").doc(targetPostId).get();
      if (!postDoc.exists) {
        logger.error(
          `[${functionName}] Post ${targetPostId} not found.`
        );
        return null;
      }
      postData = postDoc.data();
    }

    if (!postData || !targetPostId) {
      logger.error(`[${functionName}] Post data or ID is missing.`);
      return null;
    }

    const postIndustry = postData.industry || "General Business";
    const originalPosterId = postData.userId;

    let commentingBot: BotUser | null = null;
    const botUsersSnapshot = await db
      .collection("users")
      .where("isBotAccount", "==", true)
      .get(); // Fetch all bots, then filter

    if (!botUsersSnapshot.empty) {
      const availableBots = botUsersSnapshot.docs
        .map((doc) => ({id: doc.id, ...doc.data()}) as
          { id: string; mentionName: string; industry: string; userId: string })
        .filter((bot) => bot.id !== originalPosterId); // Exclude OP

      if (availableBots.length > 0) {
        const botsInIndustry = availableBots.filter(
          (b) => b.industry === postIndustry
        );
        if (botsInIndustry.length > 0) {
          const randomBotData =
            botsInIndustry[Math.floor(Math.random() * botsInIndustry.length)];
          commentingBot = {
            userId: randomBotData.id,
            mentionName: randomBotData.mentionName,
            email: "", // Not strictly needed here
            industry: randomBotData.industry,
          };
        } else {
          // Fallback: pick any bot not the OP
          const randomBotData =
            availableBots[Math.floor(Math.random() * availableBots.length)];
          commentingBot = {
            userId: randomBotData.id,
            mentionName: randomBotData.mentionName,
            email: "",
            industry: randomBotData.industry,
          };
        }
      }
    }

    if (!commentingBot) {
      logger.info(
        `[${functionName}] No existing bot to comment on post ${targetPostId} ` +
        `(excluding OP or any bot if only OP is a bot). Creating a new one.`
      );
      const newBotUser = await _createBotUserLogic(postIndustry);
      if (newBotUser && newBotUser.userId !== originalPosterId) {
        commentingBot = newBotUser;
      } else if (newBotUser && newBotUser.userId === originalPosterId) {
        logger.warn(
          `[${functionName}] Newly created bot is same as OP. ` +
          "Attempting one more time."
        );
        const altBot = await _createBotUserLogic(postIndustry);
        if (altBot && altBot.userId !== originalPosterId) {
          commentingBot = altBot;
        } else {
          logger.error(
            `[${functionName}] Failed to create a distinct bot. Aborting.`
          );
          return null;
        }
      } else {
        logger.error(
          `[${functionName}] Failed to create new bot for comment. Aborting.`
        );
        return null;
      }
    }
    if (!commentingBot) { // Should be redundant, but as a safeguard
      logger.error(
        `[${functionName}] Could not secure a commenting bot.`
      );
      return null;
    }


    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({model: "gemini-1.5-flash-latest"});
    const commentPrompt =
      `Generate a relevant and insightful comment for a forum post. ` +
      `The post title is "${postData.question}" and the description is ` +
      `"${postData.description}". The comment should be from the ` +
      `perspective of a user in the ${postIndustry} industry. The output ` +
      `should be a JSON object with a single field: "commentText" (string). ` +
      `Keep the comment concise and engaging.`;

    let generatedComment = {commentText: ""};
    try {
      const result = await model.generateContent(commentPrompt);
      const response = await result.response;
      const textFromGemini = response.text();
      logger.info(
        `[${functionName}] Raw Gemini API response for comment on post ` +
        `${targetPostId}:`, textFromGemini
      );
      let jsonString = textFromGemini.trim();
      const markdownMatch = jsonString.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
      if (markdownMatch && markdownMatch[1]) {
        jsonString = markdownMatch[1].trim();
      }
      try {
        generatedComment = JSON.parse(jsonString);
        if (typeof generatedComment.commentText !== "string") {
          throw new Error("Parsed JSON for comment invalid or missing field.");
        }
      } catch (parseError) {
        logger.error(
          `[${functionName}] Failed to parse Gemini response for comment:`,
          jsonString,
          parseError
        );
        generatedComment.commentText =
          `Interesting point on "${postData.question}". (Parse Error)`;
      }
    } catch (error) {
      logger.error(
        `[${functionName}] Error calling Gemini API for comment:`, error
      );
      generatedComment.commentText =
        `Thanks for sharing this post about "${postData.question}". (API Error)`;
    }

    const newCommentData = {
      userId: commentingBot.userId,
      mentionName: commentingBot.mentionName,
      text: generatedComment.commentText,
      postId: targetPostId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      replies: [],
      likeCount: 0,
      parentCommentId: null,
    };

    const postRef = db.collection("posts").doc(targetPostId);
    const commentRef = await postRef.collection("comments").add(newCommentData);
    await postRef.update({commentCount: admin.firestore.FieldValue.increment(1)});

    logger.info(
      `[${functionName}] Bot user ${commentingBot.userId} ` +
      `(${commentingBot.mentionName}) created comment ${commentRef.id} ` +
      `on post ${targetPostId}.`
    );
    return {
      commentId: commentRef.id,
      postId: targetPostId,
      commentingUserId: commentingBot.userId,
      commentingUserMentionName: commentingBot.mentionName,
    };
  } catch (error) {
    logger.error(
      `[${functionName}] Error creating bot comment logic for post ` +
      `${targetPostId || "unknown"}:`, error
    );
    return null;
  }
}


/**
 * HTTP-triggered function to create a new bot user.
 * @param {Request} req The HTTP request object.
 * @param {Response} res The HTTP response object.
 * @return {Promise<void>} A promise that resolves when the function is complete.
 */
export const createBotUser = onRequest(async (req, res) => {
  logger.info("[createBotUser] HTTP function triggered.");
  const targetIndustry = req.query.industry as string | undefined;
  const result = await _createBotUserLogic(targetIndustry);
  if (result) {
    res.status(200).send({
      message: "Bot user created successfully!",
      ...result,
    });
  } else {
    res.status(500).send({error: "Failed to create bot user."});
  }
});

/**
 * HTTP-triggered function to create a new bot post.
 * @param {Request} req The HTTP request object.
 * @param {Response} res The HTTP response object.
 * @return {Promise<void>} A promise that resolves when the function is complete.
 */
export const createBotPost = onRequest(async (req, res) => {
  logger.info("[createBotPost] HTTP function triggered.");
  const result = await _createBotPostLogic();
  if (result) {
    res.status(200).send({
      message: "Bot post created successfully!",
      ...result,
    });
  } else {
    res.status(500).send({error: "Failed to create bot post."});
  }
});

/**
 * HTTP-triggered function to create a new bot comment.
 * Optionally accepts a 'postId' in query or body to target a specific post.
 * If no 'postId' is provided, it comments on a post with few comments.
 * @param {Request} req The HTTP request object.
 * @param {Response} res The HTTP response object.
 * @return {Promise<void>} A promise that resolves when the function is complete.
 */
export const createBotComment = onRequest(async (req, res) => {
  logger.info("[createBotComment] HTTP function triggered.");
  const postId = (req.query.postId || req.body?.postId) as string | undefined;
  const result = await _createBotCommentLogic(postId);
  if (result) {
    res.status(200).send({
      message: `Bot comment created successfully for post ${result.postId}!`,
      ...result,
    });
  } else {
    res.status(500).send({error: "Failed to create bot comment."});
  }
});

/**
 * Simple test endpoint.
 * @param {Request} req The HTTP request object.
 * @param {Response} res The HTTP response object.
 * @return {void} Sends a simple response.
 */
export const helloWorld = onRequest((req, res) => {
  logger.info("Hello logs!", {structuredData: true});
  res.send("Hello from Firebase!");
});


const BOT_ACTIVITY_TOPIC_NAME = "bot-activity-tick";

/**
 * PubSub-triggered function that randomly decides to create a bot user, post, or comment.
 * @param {any} event The Pub/Sub message event.
 * @return {Promise<null>} A promise that resolves when the function is complete.
 */
export const scheduledBotActivity = onMessagePublished(
  BOT_ACTIVITY_TOPIC_NAME,
  async (event) => {
    logger.info(
      "[scheduledBotActivity] Triggered by Pub/Sub message:", event
    );

    const shouldAct = Math.random() < 0.7; // 70% chance to perform any action
    if (!shouldAct) {
      logger.info("[scheduledBotActivity] Decided to do nothing this time.");
      return null;
    }

    const actionType = Math.random();
    if (actionType < 0.15) { // 15% chance to create a user
      logger.info("[scheduledBotActivity] Decided to create a bot user.");
      await _createBotUserLogic();
    } else if (actionType < 0.60) { // 45% chance to create a post
      logger.info("[scheduledBotActivity] Decided to create a bot post.");
      await _createBotPostLogic();
    } else { // 40% chance to create a comment
      logger.info(
        "[scheduledBotActivity] Decided to create a bot comment " +
        "on a post with few comments."
      );
      const commentResult = await _createBotCommentLogic(); // Will find a post
      if (!commentResult) {
        logger.info(
          "[scheduledBotActivity] Comment creation failed (e.g., no posts). " +
          "Attempting to create a post instead."
        );
        await _createBotPostLogic(); // Fallback to creating a post
      }
    }
    return null;
  }
);

/**
 * Firestore trigger that listens for new messages and generates a bot reply if applicable.
 * @param {any} event The Firestore event object.
 * @return {Promise<void>} A promise that resolves when the function is complete.
 */
export const onNewMessageReplyWithBot = onDocumentWritten(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const functionName = "onNewMessageReplyWithBot";
    logger.info(
      `[${functionName}] Triggered for msg ${event.params.messageId} ` +
      `in conv ${event.params.conversationId}`,
      {rawEventDataExists: !!event.data}
    );

    if (!event.data?.after.exists || event.data.before.exists) {
      logger.info(`[${functionName}] Not a new message, exiting.`);
      return;
    }

    const newMessage = event.data.after.data();
    if (!newMessage) {
      logger.info(`[${functionName}] New message data is undefined, exiting.`);
      return;
    }
    logger.info(`[${functionName}] New message data:`, newMessage);


    if (newMessage.isBotMessage === true) {
      logger.info(
        `[${functionName}] Message is from a bot, no reply needed.`
      );
      return;
    }

    const senderId = newMessage.senderId;
    const messageText = newMessage.text;
    const conversationId = event.params.conversationId;

    if (!senderId || !messageText || !conversationId) {
        logger.error(
          `[${functionName}] Missing senderId, messageText, or conversationId.`,
          {senderId, messageTextPresent: !!messageText, conversationId}
        );
        return;
    }
    logger.info(`[${functionName}] Processing message from sender: ${senderId}`);


    const conversationRef = db.collection("conversations").doc(conversationId);
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      logger.error(
        `[${functionName}] Conversation document ${conversationId} not found.`
      );
      return;
    }
    const conversationData = conversationDoc.data();
    const participants = conversationData?.participants as string[];

    if (!participants || participants.length === 0) {
      logger.error(
        `[${functionName}] No participants found for conversation ${conversationId}.`
      );
      return;
    }
    logger.info(
      `[${functionName}] Conversation participants:`, participants.join(", ")
    );


    let botRecipientId: string | null = null;
    for (const userId of participants) {
      if (userId !== senderId && await isBotUser(userId)) {
        botRecipientId = userId;
        logger.info(
          `[${functionName}] Found bot recipient: ${botRecipientId}`
        );
        break;
      }
    }

    const senderIsRealUser = await isRealUser(senderId);
    if (!botRecipientId || !senderIsRealUser) {
      logger.info(
        `[${functionName}] No bot recipient found or sender is not a real user. ` +
        "No reply needed.",
        {botRecipientId, senderIsRealUser}
      );
      return;
    }
    logger.info(
      `[${functionName}] Real user ${senderId} sent a message to bot ` +
      `${botRecipientId}. Preparing reply.`
    );


    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      logger.error(
        `[${functionName}] GEMINI_API_KEY missing. Cannot generate reply.`
      );
      return;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({model: "gemini-1.5-flash-latest"});

    let recentMessagesText = "";
    try {
      const messagesSnapshot = await conversationRef
        .collection("messages")
        .orderBy("timestamp", "desc") // Corrected from createdAt
        .limit(5)
        .get();
      messagesSnapshot.docs.reverse().forEach((doc) => {
        const msgData = doc.data();
        recentMessagesText +=
          `${msgData.senderId === botRecipientId ? "Bot" : "User"}: ` +
          `${msgData.text}\n`;
      });
      logger.info(
        `[${functionName}] Fetched recent messages for context:`,
        recentMessagesText
      );
    } catch (err) {
      logger.error(
        `[${functionName}] Error fetching recent messages for context:`, err
      );
    }

    const prompt =
      `You are a helpful assistant. A user said: "${messageText}".\n` +
      `The conversation history is:\n${recentMessagesText}\n` +
      `Respond to the user's last message ("${messageText}") in a concise ` +
      `and helpful way. Keep your reply very short, ideally one sentence.`;
    logger.info(`[${functionName}] Prompt for Gemini: "${prompt.substring(0, 150)}..."`);


    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const botReplyText = response.text().trim();
      logger.info(`[${functionName}] Gemini generated reply: "${botReplyText}"`);

      if (!botReplyText) {
        logger.warn(`[${functionName}] Generated bot reply is empty. Not sending.`);
        return;
      }

      const botMessageData = {
        senderId: botRecipientId, // Bot sends the message
        text: botReplyText,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isBotMessage: true,
        read: false, // Important: new messages are unread
        replyToMessageId: null, // Bots aren't replying in context here yet
        repliedToTextSnippet: null,
        conversationId: conversationId, // Ensure this is set
      };
      logger.info(`[${functionName}] Saving bot message data:`, botMessageData);


      await conversationRef.collection("messages").add(botMessageData);
      logger.info(
        `[${functionName}] Bot ${botRecipientId} replied to user ${senderId} ` +
        `in conversation ${conversationId}: "${botReplyText}"`
      );

      // Update conversation's last message details
      await conversationRef.update({
          lastMessage: botReplyText,
          lastMessageSenderId: botRecipientId,
          lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(`[${functionName}] Updated conversation ${conversationId} last message.`);

    } catch (error) {
      logger.error(
        `[${functionName}] Error generating or sending bot reply:`, error
      );
    }
  }
);


/**
 * Firestore trigger that automatically accepts connection requests for bot users.
 * @param {any} event The Firestore event object.
 * @return {Promise<void>} A promise that resolves when the function is complete.
 */
export const autoAcceptBotConnectionRequests = onDocumentWritten(
  "mutuals/{connectionId}",
  async (event) => {
    const functionName = "autoAcceptBotConnectionRequests";
    logger.info(
      `[${functionName}] Triggered for connection ${event.params.connectionId}`,
      {rawEventDataExists: !!event.data}
    );

    if (!event.data?.after.exists || event.data.before.exists) {
      logger.info(
        `[${functionName}] Not a new connection document, or not a create event. Exiting.`
      );
      return;
    }

    const connectionData = event.data.after.data();
    const connectionRef = event.data.after.ref;

    if (!connectionData || connectionData.status !== "pending") {
      logger.info(
        `[${functionName}] Connection not 'pending' or data missing. Exiting.`
      );
      return;
    }

    const {requesterId, userIds} = connectionData;
    if (!requesterId || !Array.isArray(userIds) || userIds.length !== 2) {
        logger.error(
          `[${functionName}] Invalid connection data structure.`,
          connectionData
        );
        return;
    }

    const recipientId = userIds.find((id: string) => id !== requesterId);

    if (recipientId && await isBotUser(recipientId)) {
      logger.info(
        `[${functionName}] Request for bot user ${recipientId} found. ` +
        "Automatically accepting."
      );
      await connectionRef.update({
        status: "connected",
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(
        `[${functionName}] Connection ${event.params.connectionId} status ` +
        `updated to 'connected' for bot ${recipientId}.`
      );
    } else {
      logger.info(
        `[${functionName}] Recipient is not a bot or ID missing. No action.`
      );
    }
  }
);
// Ensure newline at end of file
