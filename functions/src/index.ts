// functions/src/index.ts
/* eslint-disable object-curly-spacing, comma-spacing, indent */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {onMessagePublished} from "firebase-functions/v2/pubsub";
import {generateAnonymousName} from "./utils/pseudonymUtils";
import {detailedSectorsData, findIndustryByName} from "./data/sectorData";
import {SectorWithSubSectors, SubSector, Industry} from "./data/sectorTypes"; // Import types from sectorTypes.ts
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onDocumentWritten } from "firebase-functions/v2/firestore"; // Import for Firestore triggers

logger.info("Functions index.ts started");

import {auth, db} from "./admin"; // Use aliased imports

interface BotUser {
    userId: string;
    email: string;
    mentionName: string;
    industry: string; // Added for easier querying
}

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
 * @return {Promise<BotUser | null>} An object with bot user details or null on error.
 */
async function _createBotUserLogic(targetIndustryName?: string): Promise<BotUser | null> {
  logger.info(`Attempting to create a new bot user. Target industry: ${targetIndustryName || "Random"}`);
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
    let industryName = "General Business"; // Initialize with a default, type is inferred
    let selectedSector: SectorWithSubSectors | undefined;
    let selectedSubSector: SubSector | null = null;
    let selectedIndustry: Industry | null = null;

    if (targetIndustryName) {
      const foundIndustry = findIndustryByName(targetIndustryName);
      if (foundIndustry) {
        selectedIndustry = foundIndustry.industry;
        selectedSubSector = foundIndustry.subSector;
        selectedSector = foundIndustry.sector;
        industryName = selectedIndustry?.name || selectedSubSector?.name || selectedSector?.name || targetIndustryName;
      } else {
        logger.warn(`Target industry "${targetIndustryName}" not found. Assigning to "General Business".`);
        // industryName is already "General Business" by default initialization
      }
    } else { // If no targetIndustryName, pick a random one
        selectedSector = detailedSectorsData[
            Math.floor(Math.random() * detailedSectorsData.length)
        ];
        if (selectedSector.subSectors.length > 0) {
            selectedSubSector = selectedSector.subSectors[
                Math.floor(Math.random() * selectedSector.subSectors.length)
            ];
        }
        if (selectedSubSector && selectedSubSector.industries.length > 0) {
            selectedIndustry = selectedSubSector.industries[
                Math.floor(Math.random() * selectedSubSector.industries.length)
            ];
        }
        industryName = selectedIndustry?.name || selectedSubSector?.name || selectedSector?.name || "General Business";
    }
    // Ensure industryName has a value (it should due to initialization and logic above)
    if (!industryName) {
        logger.warn("Industry name ended up empty, defaulting to General Business. This should not happen.");
        industryName = "General Business";
    }


    const userProfileData = {
      uid: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
      industry: industryName, // Now guaranteed to be assigned
      description: `This is an automated bot account for the ${industryName} industry, known as ${generatedMentionName}.`,
      descriptionVisibility: "everyone" as const,
      tags: [] as string[],
      established: String(new Date().getFullYear() - Math.floor(Math.random() * 10)),
      verified: true,
      isBotAccount: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(userRecord.uid).set(userProfileData);
    logger.info(`Bot user ${userRecord.uid} (${generatedMentionName}) for industry "${industryName}" created successfully.`);

    return {
      userId: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
      industry: industryName,
    };
  } catch (error) {
    logger.error("_createBotUserLogic error:", error);
    return null;
  }
}

/**
 * Core logic to select a random bot user and create a post on their behalf.
 * @return {Promise<{postId: string, botUserId: string, botMentionName: string} | null>} An object with post details or null on error.
 */
async function _createBotPostLogic(): Promise<{postId: string; botUserId: string; botMentionName: string;} | null> {
  logger.info("Attempting to create a new bot post (logic)....");
  const API_KEY = process.env.GEMINI_API_KEY;
  try {
    const botUsersSnapshot = await db
      .collection("users")
      .where("isBotAccount", "==", true)
      .limit(50) // Get a decent pool of bot users
      .get();

    let randomBot;
    if (botUsersSnapshot.empty) {
      logger.warn("No bot users found. Creating a new one for the post.");
      const newBot = await _createBotUserLogic(); // Create a bot with a random industry
      if (!newBot) {
        logger.error("Failed to create a new bot for posting. Aborting post creation.");
        return null;
      }
      // Simulate a snapshot with the new bot to proceed
      randomBot = { id: newBot.userId, mentionName: newBot.mentionName, industry: newBot.industry };
    } else {
        const botUsers = botUsersSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as { mentionName?: string; industry?: string }),
        }));
        randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];
    }

    if (!randomBot || !randomBot.id || !randomBot.mentionName) {
      logger.error("Selected bot user is invalid or missing key fields (id, mentionName).", randomBot);
      return null;
    }

    // Determine post sector/industry based on the bot's industry or pick random if bot has none
    let postIndustryName = randomBot.industry;
    let pSector: SectorWithSubSectors | undefined; let pSubSector: SubSector | null = null; let pIndustry: Industry | null = null;

    if (postIndustryName) {
        const foundPIndustry = findIndustryByName(postIndustryName);
        if (foundPIndustry) {
            pIndustry = foundPIndustry.industry;
            pSubSector = foundPIndustry.subSector;
            pSector = foundPIndustry.sector;
        }
    }
    // If bot's industry is generic or not found, pick a random one for the post
    if (!pIndustry) {
        pSector = detailedSectorsData[Math.floor(Math.random() * detailedSectorsData.length)];
        if (pSector.subSectors.length > 0) {
            pSubSector = pSector.subSectors[Math.floor(Math.random() * pSector.subSectors.length)];
        }
        if (pSubSector && pSubSector.industries.length > 0) {
            pIndustry = pSubSector.industries[Math.floor(Math.random() * pSubSector.industries.length)];
        }
        postIndustryName = pIndustry?.name || pSubSector?.name || pSector?.name || "General Business";
    }

    const naicsCode = pIndustry?.code || pSubSector?.code || pSector?.code;
    const sectorName = pSector?.name;
    const subSectorName = pSubSector?.name || null;
    const industryNameDisplay = pIndustry?.name || postIndustryName; // Use specific industry name if available

    if (!API_KEY) {
      logger.error("GEMINI_API_KEY environment variable not set. Cannot generate post content.");
      return null;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `Generate a unique and relevant question and a detailed description for a forum post in the field of ${industryNameDisplay}. The user is an account and is looking for insights. The output should be a JSON object with "question" (string) and "description" (string) fields. Ensure the content is appropriate for a professional networking platform and is different from previous generations.`;

    let generatedContent = { question: "", description: "" };
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      logger.info("Raw Gemini API response for post:", text);
      let jsonString = text.trim();
      const markdownMatch = jsonString.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
      if (markdownMatch && markdownMatch[1]) {
        jsonString = markdownMatch[1].trim();
      }
      try {
        generatedContent = JSON.parse(jsonString);
        if (typeof generatedContent.question !== "string" || typeof generatedContent.description !== "string") {
          throw new Error("Parsed JSON for post has invalid content.");
        }
      } catch (parseError) {
        logger.error("Failed to parse Gemini response for post as JSON:", jsonString, parseError);
        generatedContent.question = `Generated question for ${industryNameDisplay} (Parsing Error)`;
        generatedContent.description = `Generated description for ${industryNameDisplay}. Failed to parse detailed content from AI.`;
      }
    } catch (error) {
      logger.error("Error calling Gemini API for post:", error);
      generatedContent.question = `Question related to ${industryNameDisplay} (API Error)`;
      generatedContent.description = `Seeking insights in the field of ${industryNameDisplay}. (Content generation failed)`;
    }

    const sampleTagsPool = [["Tech", "Innovation"], ["Collaboration", "Projects"], ["Logistics", "SupplyChain"], ["AI", "FutureTech"], ["Strategy", "MarketEntry"], ["Sustainability", "Business"], ["Startup", "Growth"], ["RemoteWork", "Productivity"], ["Finance"], ["Healthcare"], ["Education"], ["Marketing"], ["Legal"], ["Product"],];

    const newPostData = {
      userId: randomBot.id,
      question: generatedContent.question,
      description: generatedContent.description,
      tags: sampleTagsPool[Math.floor(Math.random() * sampleTagsPool.length)],
      sector: sectorName,
      subSector: subSectorName,
      industry: industryNameDisplay, // Store the determined industry name
      naicsCode: naicsCode,
      businessType: randomBot.industry || "General Business",
      safetyIndicator: "Medium" as const,
      ratingScore: Math.random() * 2 + 3,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [] as string[],
      mentionedUserIds: [] as string[],
      requestType: "post" as const,
      descriptionDetails: null, descriptionTried: null, descriptionOutcome: null, maxBudget: null, deadline: null,
      commentCount: 0, // Initialize comment count
    };

    const postRef = await db.collection("posts").add(newPostData);
    logger.info(`Bot user ${randomBot.id} (${randomBot.mentionName}) created post ${postRef.id} in industry "${industryNameDisplay}".`);
    return { postId: postRef.id, botUserId: randomBot.id, botMentionName: randomBot.mentionName };
  } catch (error) {
    logger.error("_createBotPostLogic error:", error);
    return null;
  }
}

/**
 * Core logic to create a bot comment on a post.
 * @param {string} postId The ID of the post to comment on.
 * @return {Promise<BotComment | null>} An object with comment details or null on error.
 */
async function _createBotCommentLogic(postId: string): Promise<BotComment | null> {
  logger.info(`Attempting to create a new bot comment for post ${postId} (logic)...`);
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    logger.error("GEMINI_API_KEY environment variable not set. Cannot generate comment content.");
    return null;
  }

  try {
    const postRef = db.collection("posts").doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      logger.error(`Post with ID ${postId} not found. Cannot create comment.`);
      return null;
    }

    const postData = postDoc.data() as { question: string, description: string, industry?: string, userId: string };
    const postIndustry = postData.industry || "General Business";
    const originalPosterId = postData.userId;

    // Find or create a bot user in the post's industry, avoiding self-commenting
    let commentingBot: BotUser | null = null;
    const botUsersSnapshot = await db.collection("users")
                                   .where("isBotAccount", "==", true)
                                   .where("industry", "==", postIndustry)
                                   .get();

    if (!botUsersSnapshot.empty) {
        const availableBots = botUsersSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as { id: string, mentionName: string, industry: string, userId: string }))
            .filter((bot) => bot.id !== originalPosterId); // Exclude the original poster

        if (availableBots.length > 0) {
            const randomBotData = availableBots[Math.floor(Math.random() * availableBots.length)];
            commentingBot = { userId: randomBotData.id, mentionName: randomBotData.mentionName, email: "", industry: randomBotData.industry }; // email is not strictly needed here
        }
    }

    if (!commentingBot) {
      logger.info(`No existing bot found in industry "${postIndustry}" (excluding OP) to comment on post ${postId}. Creating a new one.`);
      const newBotUser = await _createBotUserLogic(postIndustry);
      if (newBotUser && newBotUser.userId !== originalPosterId) {
        commentingBot = newBotUser;
      } else if (newBotUser && newBotUser.userId === originalPosterId) {
        logger.warn(`Newly created bot for industry "${postIndustry}" is the same as original poster ${originalPosterId}. Attempting to create a different one.`);
        // Try creating another bot, hoping for a different UID to break any unlikely loop if the only bot is the OP.
        const alternativeBot = await _createBotUserLogic(postIndustry);
        if (alternativeBot && alternativeBot.userId !== originalPosterId) {
            commentingBot = alternativeBot;
        } else {
            logger.error(`Failed to create a suitable distinct bot for industry "${postIndustry}" to comment on post ${postId}. Aborting comment.`);
            return null;
        }
      } else {
        logger.error(`Failed to create a new bot for industry "${postIndustry}" to comment on post ${postId}. Aborting comment.`);
        return null;
      }
    }

    if (!commentingBot) {
        logger.error(`Could not secure a commenting bot for post ${postId}.`);
        return null;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `Generate a relevant and insightful comment for a forum post. The post title is "${postData.question}" and the description is "${postData.description}". The comment should be from the perspective of a user in the ${postIndustry} industry. The output should be a JSON object with a single field: "commentText" (string). Keep the comment concise and engaging.`;

    let generatedComment: { commentText: string } = { commentText: "" }; // Gemini is expected to return commentText
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const textFromGemini = response.text(); // Renamed to avoid conflict with frontend 'text' field
      logger.info(`Raw Gemini API response for comment on post ${postId}:`, textFromGemini);
      let jsonString = textFromGemini.trim();
      const markdownMatch = jsonString.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
      if (markdownMatch && markdownMatch[1]) {
        jsonString = markdownMatch[1].trim();
      }
      try {
        generatedComment = JSON.parse(jsonString);
        if (typeof generatedComment.commentText !== "string") { // Still checking for commentText from Gemini
          throw new Error("Parsed JSON for comment has invalid content or missing commentText field.");
        }
      } catch (parseError) {
        logger.error(`Failed to parse Gemini response for comment on post ${postId} as JSON:`, jsonString, parseError);
        generatedComment.commentText = `Interesting point regarding ${postData.question}. (Parsing Error)`;
      }
    } catch (error) {
      logger.error(`Error calling Gemini API for comment on post ${postId}:`, error);
      generatedComment.commentText = `Thanks for sharing this post about ${postData.question}. (API Error)`;
    }

    const newCommentData = {
      userId: commentingBot.userId,
      mentionName: commentingBot.mentionName, // For backend context
      text: generatedComment.commentText, // Frontend expects 'text'
      postId: postId, // For backend context / subcollection path
      timestamp: admin.firestore.FieldValue.serverTimestamp(), // Frontend expects 'timestamp'
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), // For backend context
      replies: [], // For future expansion
      likeCount: 0, // Frontend expects 'likeCount'
      parentCommentId: null, // For future expansion
      // Optional fields from frontend type (Comment) not set here: likedBy, mentionedUserIds
    };

    const commentRef = await postRef.collection("comments").add(newCommentData);
    // Atomically increment comment count on the post
    await postRef.update({ commentCount: admin.firestore.FieldValue.increment(1) });

    logger.info(`Bot user ${commentingBot.userId} (${commentingBot.mentionName}) created comment ${commentRef.id} on post ${postId}.`);
    return {
      commentId: commentRef.id,
      postId: postId,
      commentingUserId: commentingBot.userId,
      commentingUserMentionName: commentingBot.mentionName,
    };
  } catch (error) {
    logger.error(`_createBotCommentLogic error for post ${postId}:`, error);
    return null;
  }
}

/**
 * Firestore trigger that listens for new messages and generates a bot reply if applicable.
 * Assumes messages are stored in a top-level "conversations" collection,
 * with each document being a conversation, containing a "messages" subcollection.
 * Message documents should have at least:
 * - senderId: string (UID of the sender)
 * - text: string (message content)
 * - createdAt: Timestamp
 * - (Optionally) recipientId: string (UID of the recipient, if it's a 1-on-1, or for context)
 * - (Optionally) isBotMessage: boolean (to mark messages sent by this function)
 */
export const onNewMessageReplyWithBot = onDocumentWritten(
    "conversations/{conversationId}/messages/{messageId}",
    async (event) => {
        logger.info(`onNewMessageReplyWithBot triggered for message ${event.params.messageId} in conversation ${event.params.conversationId}`, event);

        // Check if it's a create event (new message)
        if (!event.data?.after.exists || event.data.before.exists) {
            logger.info("Not a new message, exiting.");
            return;
        }

        const newMessage = event.data.after.data();
        if (!newMessage) {
            logger.info("New message data is undefined, exiting.");
            return;
        }

        // Prevent bot from replying to its own messages or other bot messages
        if (newMessage.isBotMessage === true) {
            logger.info("Message is from a bot, no reply needed.");
            return;
        }

        const senderId = newMessage.senderId;
        const messageText = newMessage.text;
        const conversationId = event.params.conversationId;

        // Determine the recipient(s) of this message.
        // This logic HIGHLY depends on your conversation/message data structure.
        // Example: Assuming a `participants` array on the conversation document,
        // or a `recipientId` on the message if it's a direct message.
        // For this example, we'll assume a `participants` array in the conversation doc.
        const conversationRef = db.collection("conversations").doc(conversationId);
        const conversationDoc = await conversationRef.get();
        if (!conversationDoc.exists) {
            logger.error(`Conversation document ${conversationId} not found.`);
            return;
        }
        const conversationData = conversationDoc.data();
        const participants = conversationData?.participants as string[]; // Array of user IDs

        if (!participants || participants.length === 0) {
            logger.error(`No participants found for conversation ${conversationId}.`);
            return;
        }

        // Identify if a bot is part of this conversation and is not the sender
        let botRecipientId: string | null = null;
        for (const userId of participants) {
            if (userId !== senderId && await isBotUser(userId)) {
                botRecipientId = userId;
                break;
            }
        }

        // If no bot recipient or sender is not a real user, exit
        if (!botRecipientId || !(await isRealUser(senderId))) {
            logger.info("No bot recipient or sender is not a real user. No reply needed.", { botRecipientId, senderId });
            return;
        }
        logger.info(`Real user ${senderId} sent a message to bot ${botRecipientId}.`);


        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            logger.error("GEMINI_API_KEY environment variable not set. Cannot generate bot reply.");
            return;
        }

        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        // Get some context from the conversation (e.g., last few messages)
        // This part needs to be adapted to your actual message structure and how you want to fetch context
        let recentMessagesText = "";
        try {
            const messagesSnapshot = await conversationRef.collection("messages")
                .orderBy("createdAt", "desc")
                .limit(5) // Get last 5 messages for context
                .get();
            messagesSnapshot.docs.reverse().forEach((doc) => { // reverse to get chronological order for prompt
                const msgData = doc.data();
                recentMessagesText += `${msgData.senderId === botRecipientId ? "Bot" : "User"}: ${msgData.text}
`;
            });
        } catch (err) {
            logger.error("Error fetching recent messages for context:", err);
        }


        const prompt = `You are a helpful assistant. A user said: "${messageText}".
The conversation history is:
${recentMessagesText}
Respond to the user's last message ("${messageText}") in a concise and helpful way. Keep your reply very short, ideally one sentence.`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const botReplyText = response.text().trim();

            // Further ensure brevity if needed
            if (botReplyText.split(" ").length > 20) { // Arbitrary limit, adjust as needed
                 // Attempt to shorten it more if it's too long, e.g. take first sentence or use a more aggressive prompt.
                 // For simplicity here, we'll just log a warning or truncate.
                 logger.warn("Bot reply was a bit long, consider refining the prompt or shortening logic.", { originalLength: botReplyText.split(" ").length });
                 // A simple truncation:
                 // botReplyText = botReplyText.split('. ').slice(0, 1).join('. ') + '.';
            }


            if (!botReplyText) {
                logger.warn("Generated bot reply is empty. Not sending.");
                return;
            }

            // Add the bot's reply to the conversation
            const botMessageData = {
                senderId: botRecipientId,
                text: botReplyText,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isBotMessage: true, // Mark this as a message from the bot
                // Add any other fields your message objects usually have
                // e.g., recipientId (could be senderId of the original message)
            };

            await conversationRef.collection("messages").add(botMessageData);
            logger.info(`Bot ${botRecipientId} replied to user ${senderId} in conversation ${conversationId}: "${botReplyText}"`);
        } catch (error) {
            logger.error("Error generating or sending bot reply:", error);
        }
    }
);


/**
 * Firestore trigger that listens for new connection requests in the 'mutuals' collection.
 * If the request is for a bot user and is in 'pending' status, it automatically accepts it.
 * Assumes 'mutuals' collection with documents containing:
 * - requesterId: string (UID of the user initiating the request)
 * - userIds: string[] (array of two UIDs involved in the connection)
 * - status: string ("pending", "connected", etc.)
 * - requestedAt: Timestamp
 * - connectedAt: Timestamp (to be set when status becomes "connected")
 */
export const autoAcceptBotConnectionRequests = onDocumentWritten(
  "mutuals/{connectionId}",
  async (event) => {
    logger.info(`autoAcceptBotConnectionRequests triggered for connection ${event.params.connectionId}`, event);

    // Check if it's a new document creation with a 'pending' status
    if (!event.data?.after.exists || event.data.before.exists) {
      logger.info("Not a new connection document, or not a create event, exiting.");
      return;
    }

    const connectionData = event.data.after.data();
    const connectionRef = event.data.after.ref;

    if (!connectionData || connectionData.status !== "pending") {
      logger.info("Connection is not in 'pending' status or data is missing, exiting.");
      return;
    }

    const { requesterId, userIds } = connectionData;

    // Find the recipient user ID (the one not matching the requesterId)
    const recipientId = userIds.find((id: string) => id !== requesterId);

    if (recipientId && await isBotUser(recipientId)) {
      logger.info(`Request for bot user ${recipientId} found. Automatically accepting connection.`);
      await connectionRef.update({
        status: "connected",
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(`Connection ${event.params.connectionId} status updated to 'connected' for bot ${recipientId}.`);
    } else {
      logger.info("Recipient is not a bot user or recipientId is missing, no action needed.");
    }
  }
);
/**
 * HTTP-triggered function to create a new bot user.
 */
export const createBotUser = onRequest(async (req, res) => {
  logger.info("createBotUser HTTP function triggered.");
  // Allow specifying industry via query parameter for testing
  const targetIndustry = req.query.industry as string | undefined;
  const result = await _createBotUserLogic(targetIndustry);
  if (result) {
    res.status(200).send({ message: "Bot user created successfully!", ...result });
  } else {
    res.status(500).send({ error: "Failed to create bot user." });
  }
});

/**
 * HTTP-triggered function to create a new bot post.
 */
export const createBotPost = onRequest(async (req, res) => {
  logger.info("createBotPost HTTP function triggered.");
  const result = await _createBotPostLogic();
  if (result) {
    res.status(200).send({ message: "Bot post created successfully!", ...result });
  } else {
    res.status(500).send({ error: "Failed to create bot post." });
  }
});

/**
 * HTTP-triggered function to create a new bot comment.
 * If postId is not provided, it finds the post with the least comments.
 */
export const createBotComment = onRequest(async (req, res) => {
  logger.info("createBotComment HTTP function triggered.");
  let postId = req.body.postId || req.query.postId as string | undefined;

  if (!postId) {
    logger.info("Post ID not provided. Attempting to find post with the least comments.");
    try {
      const postsSnapshot = await db.collection("posts")
                                    .orderBy("commentCount", "asc")
                                    .limit(1)
                                    .get();
      if (!postsSnapshot.empty) {
        postId = postsSnapshot.docs[0].id;
        logger.info(`Found post ${postId} with the least comments.`);
      } else {
        logger.warn("No posts found in the database to comment on.");
        res.status(404).send({ error: "No posts found to comment on." });
        return;
      }
    } catch (error) {
      logger.error("Error fetching post with least comments:", error);
      res.status(500).send({ error: "Failed to find a post to comment on." });
      return;
    }
  }

  // Validate again in case it was found but somehow invalid
  if (!postId || typeof postId !== "string") {
    logger.error("Post ID became invalid or was not found.");
    res.status(500).send({ error: "Internal error determining post ID or no post found." });
    return;
  }

  const result = await _createBotCommentLogic(postId);
  if (result) {
    res.status(200).send({ message: `Bot comment created successfully for post ${postId}!`, ...result });
  } else {
    res.status(500).send({ error: `Failed to create bot comment for post ${postId}.` });
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
 * PubSub-triggered function that randomly decides to create a bot user, post, or comment.
 */
export const scheduledBotActivity = onMessagePublished(
  BOT_ACTIVITY_TOPIC_NAME,
  async (event) => {
    logger.info("scheduledBotActivity triggered by Pub/Sub message:", event);

    const shouldAct = Math.random() < 0.8; // 80% chance to perform any action

    if (shouldAct) {
      const actionType = Math.random();
      if (actionType < 0.15) { // 15% chance to create a user
        logger.info("Scheduled bot activity: Decided to create a bot user.");
        await _createBotUserLogic();
      } else if (actionType < 0.70) { // 55% chance to create a post (0.15 to 0.70)
        logger.info("Scheduled bot activity: Decided to create a bot post.");
        await _createBotPostLogic();
      } else { // 30% chance to create a comment (0.70 to 1.0)
        logger.info("Scheduled bot activity: Decided to create a bot comment on the least commented post.");
        // Find the post with the least comments
        try {
            const postsSnapshot = await db.collection("posts")
                                          .orderBy("commentCount", "asc")
                                          .limit(1)
                                          .get();
            if (!postsSnapshot.empty) {
                const leastCommentedPostId = postsSnapshot.docs[0].id;
                await _createBotCommentLogic(leastCommentedPostId);
            } else {
                logger.info("Scheduled bot activity: No posts found to comment on. Will try creating a post instead.");
                await _createBotPostLogic(); // Fallback
            }
        } catch (error) {
            logger.error("Scheduled bot activity: Error finding least commented post:", error);
            // Optionally, fallback to creating a post or do nothing
            await _createBotPostLogic();
        }
      }
    } else {
      logger.info("Scheduled bot activity: Decided to do nothing this time.");
    }
    return null;
  }
);
