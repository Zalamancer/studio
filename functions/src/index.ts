// functions/src/index.ts
/* eslint-disable object-curly-spacing, comma-spacing, indent */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {onMessagePublished} from "firebase-functions/v2/pubsub";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {GoogleGenerativeAI} from "@google/generative-ai";

import * as admin from "firebase-admin";
// Corrected: Import 'generateAnonymousName' from the local utility
// Commented out as it's not used in the simplified/debugged createBotUser
// import {generateAnonymousName} from "./utils/pseudonymUtils";
import {detailedSectorsData, findIndustryByName} from "./data/sectorData";
import type {
  SectorWithSubSectors,
  SubSector,
  Industry,
} from "./data/sectorTypes";

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export Firestore and Auth admin instances
export const dbAdmin = admin.firestore();
export const authAdmin = admin.auth();

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
  const userDoc = await dbAdmin.collection("users").doc(userId).get();
  if (!userDoc.exists) return false;
  return userDoc.data()?.isBotAccount === true;
}

/**
 * Helper function to check if a user is a real user.
 * @param {string} userId The ID of the user to check.
 * @return {Promise<boolean>} True if the user is a real user, false otherwise.
 */
async function isRealUser(userId: string): Promise<boolean> {
  const userDoc = await dbAdmin.collection("users").doc(userId).get();
  if (!userDoc.exists) return false;
  // Assuming real users don't have isBotAccount or it's false
  return !userDoc.data()?.isBotAccount;
}


/**
 * Core logic to create a bot user account with randomized details.
 * Saves the user to Firebase Auth and their profile to Firestore.
 * @param {string} [targetIndustryName] Optional name of the industry for the
 * bot.
 * @return {Promise<BotUser | null>} An object with bot user details or null on
 * error.
 */
async function _createBotUserLogic(
  targetIndustryName?: string,
): Promise<BotUser | null> {
  const functionName = "_createBotUserLogic";
  logger.info(
    `[${functionName}] Attempting to create new bot user. Target: ` +
      (targetIndustryName || "Random"),
  );

  try {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const botEmail = `bot_${Date.now()}_${randomSuffix}@example.com`;
    const botPassword = `strongPassword${Date.now()}${randomSuffix}`;

    const userRecord = await authAdmin.createUser({
      email: botEmail,
      password: botPassword,
      disabled: false,
    });
    // Use generateAnonymousName for bots
    // Make sure to import it: import {generateAnonymousName} from "./utils/pseudonymUtils";
    // For now, this import is commented out above as generateAnonymousName might not be needed if always using Bot prefix
    // const generatedMentionName = generateAnonymousName(userRecord.uid);
    const generatedMentionName = `Bot${randomSuffix}`; // Simplified for now

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
          `[${functionName}] Target industry "${targetIndustryName}" not ` +
            "found. Assigning to \"General Business\".",
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
        `[${functionName}] Industry name ended up empty, defaulting to ` +
        "General Business. This should not happen.",
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
      tags: [],
      established: String(
        new Date().getFullYear() - Math.floor(Math.random() * 10),
      ),
      verified: true,
      isBotAccount: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      // Fields to omit: actualDisplayName, avatarUrl, companyName,
      // contactEmail, contactPhone, location
    };

    await dbAdmin.collection("users").doc(userRecord.uid).set(userProfileData);
    logger.info(
      `[${functionName}] Bot user ${userRecord.uid} (${generatedMentionName}) ` +
      `for industry "${industryName}" created successfully.`,
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
 * @return {Promise<{postId: string, botUserId: string,
 * botMentionName: string} | null>} An object with post details or null on
 * error.
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
    const botUsersSnapshot = await dbAdmin
      .collection("users")
      .where("isBotAccount", "==", true)
      .limit(50)
      .get();

    let randomBot: {
      id: string;
      mentionName?: string;
      industry?: string;
      // Add other fields from UserProfileData if needed
    };

    if (botUsersSnapshot.empty) {
      logger.warn(
        `[${functionName}] No bot users found. Creating a new one for post.`,
      );
      const newBot = await _createBotUserLogic();
      if (!newBot) {
        logger.error(
          `[${functionName}] Failed to create new bot for posting. Aborting.`,
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
        ...(doc.data() as {mentionName?: string; industry?: string}),
      }));
      randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];
    }

    if (!randomBot || !randomBot.id || !randomBot.mentionName) {
      logger.error(
        `[${functionName}] Selected bot user invalid or missing key fields.`,
        randomBot,
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

    const naicsCode = pIndustry?.code || pSubSector?.code || pSector?.code;
    const sectorName = pSector?.name;
    const subSectorName = pSubSector?.name || null; // Can be null
    const industryNameDisplay = pIndustry?.name || postIndustryName;

    if (!API_KEY) {
      logger.error(
        `[${functionName}] GEMINI_API_KEY missing. Cannot gen post content.`,
      );
      return null;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({model: "gemini-1.5-flash-latest"});
    const prompt =
      `Generate a unique and relevant question and a detailed description ` +
      `for a forum post in the field of ${industryNameDisplay}. The user, ` +
      `${randomBot.mentionName}, is seeking insights. Output should be JSON: ` +
      `{"question": "string", "description": "string"}. Ensure content is ` +
      "professional and distinct.";

    let generatedContent = {question: "", description: ""};
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
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
          `[${functionName}] Failed to parse Gemini response for post:`,
          jsonString,
          parseError,
        );
        generatedContent.question =
          `Generated question for ${industryNameDisplay} (ParseError)`;
        generatedContent.description =
          `Generated description for ${industryNameDisplay}. ` +
          "Failed to parse detailed content from AI.";
      }
    } catch (error) {
      logger.error(`[${functionName}] Error calling Gemini API for post:`, error);
      generatedContent.question =
        `Question related to ${industryNameDisplay} (API Error)`;
      generatedContent.description =
        `Seeking insights in ${industryNameDisplay}. (Content gen failed)`;
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
      sector: sectorName,
      subSector: subSectorName, // Can be null
      industry: industryNameDisplay, // Can be null if only sector/subsector
      naicsCode: naicsCode,
      businessType: randomBot.industry || "General Business",
      safetyIndicator: "Medium" as const,
      ratingScore: 0, // Bots won't have ratings initially
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [],
      mentionedUserIds: [],
      requestType: "post" as const,
      descriptionDetails: null,
      descriptionTried: null,
      descriptionOutcome: null,
      maxBudget: null,
      deadline: null,
      commentCount: 0,
    };

    const postRef = await dbAdmin.collection("posts").add(newPostData);
    logger.info(
      `[${functionName}] Bot user ${randomBot.id} (${randomBot.mentionName}) ` +
      `created post ${postRef.id} in industry "${industryNameDisplay}".`,
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
 * @param {string} [postId] Optional ID of the post to comment on. If not
 * provided, a post with few comments will be chosen.
 * @return {Promise<BotComment | null>} An object with comment details or null.
 */
async function _createBotCommentLogic(
  postId?: string,
): Promise<BotComment | null> {
  const functionName = "_createBotCommentLogic";
  logger.info(
    `[${functionName}] Attempting bot comment. Target post: ` +
    `${postId || "auto-select"}`,
  );
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    logger.error(
      `[${functionName}] GEMINI_API_KEY missing. Cannot gen comment.`,
    );
    return null;
  }

  let targetPostId = postId;
  let postData: admin.firestore.DocumentData | undefined;
  let postRef: admin.firestore.DocumentReference;

  try {
    if (!targetPostId) {
      logger.info(
        `[${functionName}] No postId, finding post with few comments.`,
      );
      const postsSnapshot = await dbAdmin
        .collection("posts")
        .orderBy("commentCount", "asc") // Ensure this index exists
        .limit(1)
        .get();
      if (postsSnapshot.empty) {
        logger.warn(`[${functionName}] No posts found to comment on.`);
        return null;
      }
      targetPostId = postsSnapshot.docs[0].id;
      postData = postsSnapshot.docs[0].data();
      postRef = postsSnapshot.docs[0].ref;
      logger.info(
        `[${functionName}] Selected post ${targetPostId} for commenting.`,
      );
    } else {
      postRef = dbAdmin.collection("posts").doc(targetPostId);
      const postDoc = await postRef.get();
      if (!postDoc.exists) {
        logger.error(
          `[${functionName}] Post ${targetPostId} not found for comment.`,
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
    // Fetch bots, prefer ones in the same industry, ensure not OP
    const botUsersSnapshot = await dbAdmin
      .collection("users")
      .where("isBotAccount", "==", true)
      .get();

    if (!botUsersSnapshot.empty) {
      const availableBots = botUsersSnapshot.docs
        .map((doc) => ({id: doc.id, ...doc.data()}) as // Cast to include id
          {id: string; mentionName: string; industry: string; userId: string})
        .filter((bot) => bot.id !== originalPosterId); // Exclude OP

      if (availableBots.length > 0) {
        const botsInIndustry = availableBots.filter(
          (b) => b.industry === postIndustry,
        );
        const selectedBotData = botsInIndustry.length > 0 ?
          botsInIndustry[Math.floor(Math.random() * botsInIndustry.length)] :
          availableBots[Math.floor(Math.random() * availableBots.length)];
        commentingBot = {
          userId: selectedBotData.id,
          mentionName: selectedBotData.mentionName,
          email: "", // Not needed for this operation
          industry: selectedBotData.industry,
        };
      }
    }

    if (!commentingBot) {
      logger.info(
        `[${functionName}] No existing bot for post ${targetPostId}. Creating.`,
      );
      const newBotUser = await _createBotUserLogic(postIndustry); // Target industry
      if (newBotUser && newBotUser.userId !== originalPosterId) {
        commentingBot = newBotUser;
      } else if (newBotUser && newBotUser.userId === originalPosterId) {
        logger.warn(
          `[${functionName}] New bot is OP for post ${targetPostId}. Try another.`,
        );
        const altBot = await _createBotUserLogic(postIndustry);
        if (altBot && altBot.userId !== originalPosterId) {
          commentingBot = altBot;
        } else {
          logger.error(
            `[${functionName}] Failed to create distinct bot. Aborting comment.`,
          );
          return null;
        }
      } else {
        logger.error(
          `[${functionName}] Failed to create new bot for comment. Aborting.`,
        );
        return null;
      }
    }

    if (!commentingBot) { // Should be populated by now
      logger.error(`[${functionName}] Commenting bot is null. Aborting.`);
      return null;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({model: "gemini-1.5-flash-latest"});
    const commentPrompt =
      "Generate a relevant, insightful comment for a forum post. " +
      `Post title: "${postData.question}". Description: ` +
      `"${postData.description}". Comment from user ` +
      `${commentingBot.mentionName} in ${postIndustry} industry. ` +
      "Output JSON: {\"commentText\": \"string\"}. Keep it concise.";

    let generatedComment = {commentText: ""};
    try {
      const result = await model.generateContent(commentPrompt);
      const response = await result.response;
      const textFromGemini = response.text();
      logger.info(
        `[${functionName}] Raw Gemini response for comment on post ` +
        `${targetPostId}:`, textFromGemini,
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
          parseError,
        );
        generatedComment.commentText =
          `Interesting point on "${postData.question}". (Parse Error)`;
      }
    } catch (error) {
      logger.error(
        `[${functionName}] Error calling Gemini API for comment:`, error,
      );
      generatedComment.commentText =
        `Thanks for sharing about "${postData.question}". (API Error)`;
    }

    const newCommentData = {
      userId: commentingBot.userId,
      mentionName: commentingBot.mentionName, // From BotUser interface
      text: generatedComment.commentText,
      postId: targetPostId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), // For consistency
      replies: [],
      likeCount: 0,
      parentCommentId: null,
      mentionedUserIds: [],
    };

    const commentRef = await postRef.collection("comments").add(newCommentData);
    await postRef.update({commentCount: admin.firestore.FieldValue.increment(1)});

    logger.info(
      `[${functionName}] Bot user ${commentingBot.userId} ` +
      `(${commentingBot.mentionName}) created comment ${commentRef.id} ` +
      `on post ${targetPostId}.`,
    );
    return {
      commentId: commentRef.id,
      postId: targetPostId,
      commentingUserId: commentingBot.userId,
      commentingUserMentionName: commentingBot.mentionName,
    };
  } catch (error) {
    logger.error(
      `[${functionName}] Error creating bot comment for post ` +
      `${targetPostId || "unknown"}:`, error,
    );
    return null;
  }
}


/**
 * Firestore trigger that listens for new messages and generates a bot reply.
 */
export const onNewMessageReplyWithBot = onDocumentWritten(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const functionName = "onNewMessageReplyWithBot";
    logger.info(
      `[${functionName}] Triggered for msg ${event.params.messageId} ` +
        `in conv ${event.params.conversationId}. Event data:`,
      event.data, // Log the whole event.data for context
    );

    // Check if it's a new message creation event
    if (!event.data?.after.exists || event.data.before.exists) {
      logger.info(`[${functionName}] Not a new message creation. Exiting.`);
      return;
    }

    const newMessage = event.data.after.data();
    if (!newMessage) {
      logger.info(`[${functionName}] New message data is undefined. Exiting.`);
      return;
    }

    // Prevent bot from replying to its own messages or other bot messages
    if (newMessage.isBotMessage === true) {
      logger.info(
        `[${functionName}] Message is from a bot (isBotMessage=true). ` +
          "No reply needed.",
      );
      return;
    }

    const senderId = newMessage.senderId;
    const messageText = newMessage.text;
    const conversationId = event.params.conversationId;

    if (!senderId || !messageText) {
      logger.error(
        `[${functionName}] Missing senderId or text for message ` +
          `${event.params.messageId}.`,
        {senderIdExists: !!senderId, textExists: !!messageText},
      );
      return;
    }

    const conversationRef = dbAdmin.collection("conversations")
      .doc(conversationId);
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      logger.error(
        `[${functionName}] Conversation doc ${conversationId} not found.`,
      );
      return;
    }
    const conversationData = conversationDoc.data();
    const participants = conversationData?.participants as string[] | undefined;

    if (!participants || participants.length === 0) {
      logger.error(
        `[${functionName}] No participants for conv ${conversationId}.`,
      );
      return;
    }

    let botRecipientId: string | null = null;
    for (const userId of participants) {
      if (userId !== senderId && (await isBotUser(userId))) {
        botRecipientId = userId;
        break;
      }
    }

    const senderIsUser = await isRealUser(senderId);
    if (!botRecipientId || !senderIsUser) {
      logger.info(
        `[${functionName}] No bot recipient or sender not a real user. ` +
          "No reply needed.",
        {botRecipientId, senderIsRealUser: senderIsUser},
      );
      return;
    }

    logger.info(
      `[${functionName}] Real user ${senderId} sent message to bot ` +
        `${botRecipientId}. Preparing reply.`,
    );

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      logger.error(
        `[${functionName}] GEMINI_API_KEY missing. Cannot gen bot reply.`,
      );
      return;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({model: "gemini-1.5-flash-latest"});

    let recentMessagesText = "";
    try {
      const messagesSnapshot = await conversationRef.collection("messages")
        .orderBy("timestamp", "desc") // Corrected to 'timestamp'
        .limit(5)
        .get();
      messagesSnapshot.docs.reverse().forEach((doc) => {
        const msgData = doc.data();
        recentMessagesText +=
          `${msgData.senderId === botRecipientId ? "Bot" : "User"}: ` +
          `${msgData.text}\n`;
      });
    } catch (err) {
      logger.error(
        `[${functionName}] Error fetching recent messages for context:`, err,
      );
    }

    const prompt =
      "You are a helpful assistant. A user said: " + `"${messageText}".\n` +
      `The conversation history is:\n${recentMessagesText}\n` +
      `Respond to the user's last message ("${messageText}") concisely. ` +
      "Keep your reply very short, ideally one or two sentences.";
    logger.info(
      `[${functionName}] Prompt for Gemini (first 150 chars): ` +
      `"${prompt.substring(0, 150)}..."`,
    );

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const botReplyText = response.text().trim();
      logger.info(`[${functionName}] Gemini generated reply: "${botReplyText}"`);

      if (!botReplyText) {
        logger.warn(
          `[${functionName}] Generated bot reply is empty. Not sending.`,
        );
        return;
      }

      const botMessageData = {
        senderId: botRecipientId, // Bot sends the message
        text: botReplyText,
        timestamp: admin.firestore.FieldValue.serverTimestamp(), // USE TIMESTAMP HERE
        isBotMessage: true, // *** CRUCIAL: Mark as bot message ***
        read: false,
        replyToMessageId: null,
        repliedToTextSnippet: null,
        conversationId: conversationId, // Include conversationId
      };

      logger.info(
        `[${functionName}] Saving bot message data for conv ` +
          `${conversationId}:`, botMessageData,
      );

      await conversationRef.collection("messages").add(botMessageData);
      logger.info(
        `[${functionName}] Bot ${botRecipientId} replied to user ${senderId} ` +
        `in conv ${conversationId}: "${botReplyText}"`,
      );

      // Update conversation's last message details
      await conversationRef.update({
        lastMessage: botReplyText,
        lastMessageSenderId: botRecipientId,
        lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(
        `[${functionName}] Updated conv ${conversationId} last message.`,
      );
    } catch (error) {
      logger.error(
        `[${functionName}] Error generating or sending bot reply:`, error,
      );
    }
  },
);

/**
 * Firestore trigger that auto-accepts connection requests for bot users.
 */
export const autoAcceptBotConnectionRequests = onDocumentWritten(
  "mutuals/{connectionId}",
  async (event) => {
    const functionName = "autoAcceptBotConnectionRequests";
    logger.info(
      `[${functionName}] Triggered for connection ${event.params.connectionId}`,
      {rawEventDataExists: !!event.data},
    );
    const eventData = event.data;

    if (!eventData?.after.exists || eventData.before.exists) {
      logger.info(
        `[${functionName}] Not a new connection document, or not a create. ` +
          "Exiting.",
      );
      return;
    }

    const connectionData = eventData.after.data();
    const connectionRef = eventData.after.ref;

    if (!connectionData || connectionData.status !== "pending") {
      logger.info(
        `[${functionName}] Connection not "pending" or data missing. Exiting.`,
      );
      return;
    }

    const {requesterId, userIds} = connectionData as {
      requesterId: string;
      userIds: string[];
    };
    if (!requesterId || !Array.isArray(userIds) || userIds.length !== 2) {
      logger.error(
        `[${functionName}] Invalid connection data structure.`,
        connectionData,
      );
      return;
    }

    const recipientId = userIds.find((id: string) => id !== requesterId);

    if (recipientId && (await isBotUser(recipientId))) {
      logger.info(
        `[${functionName}] Request for bot user ${recipientId} found. ` +
          "Automatically accepting.",
      );
      await connectionRef.update({
        status: "connected",
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(
        `[${functionName}] Connection ${event.params.connectionId} status ` +
          `updated to 'connected' for bot ${recipientId}.`,
      );
    } else {
      logger.info(
        `[${functionName}] Recipient not a bot or ID missing. No action.`,
      );
    }
  },
);


// --- HTTP-Triggered Functions ---

/**
 * HTTP-triggered function to create a new bot user.
 */
export const createBotUser = onRequest(async (req, res) => {
  const functionName = "createBotUser (HTTP)";
  logger.info(`[${functionName}] Triggered.`);
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
 */
export const createBotPost = onRequest(async (req, res) => {
  const functionName = "createBotPost (HTTP)";
  logger.info(`[${functionName}] Triggered.`);
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
 */
export const createBotComment = onRequest(async (req, res) => {
  const functionName = "createBotComment (HTTP)";
  logger.info(`[${functionName}] Triggered.`);
  const postId = (req.query.postId || req.body?.postId) as string | undefined;
  const result = await _createBotCommentLogic(postId);
  if (result) {
    res.status(200).send({
      message: "Bot comment created successfully for post " +
                `${result.postId}!`,
      ...result,
    });
  } else {
    res.status(500).send({error: "Failed to create bot comment."});
  }
});

/**
 * Simple test endpoint.
 */
export const helloWorld = onRequest((req, res) => {
  logger.info("Hello logs!", {structuredData: true});
  res.send("Hello from Firebase!");
});


const BOT_ACTIVITY_TOPIC_NAME = "bot-activity-tick";

/**
 * PubSub-triggered function that randomly decides to perform bot activity.
 */
export const scheduledBotActivity = onMessagePublished(
  BOT_ACTIVITY_TOPIC_NAME,
  async (event) => {
    const functionName = "scheduledBotActivity";
    logger.info(
      `[${functionName}] Triggered by Pub/Sub message:`, event,
    );

    const shouldAct = Math.random() < 0.7; // 70% chance to perform any action
    if (!shouldAct) {
      logger.info(`[${functionName}] Decided to do nothing this time.`);
      return null;
    }

    const actionType = Math.random();
    if (actionType < 0.15) { // 15% chance to create a user
      logger.info(`[${functionName}] Decided to create a bot user.`);
      await _createBotUserLogic();
    } else if (actionType < 0.60) { // 45% chance to create a post
      logger.info(`[${functionName}] Decided to create a bot post.`);
      await _createBotPostLogic();
    } else { // 40% chance to create a comment
      logger.info(
        `[${functionName}] Decided to create a bot comment.`,
      );
      // _createBotCommentLogic will find a post with few comments if none specified
      const commentResult = await _createBotCommentLogic();
      if (!commentResult) {
        logger.info(
          `[${functionName}] Comment creation failed (e.g., no posts). ` +
          "Attempting to create a post instead as fallback.",
        );
        await _createBotPostLogic(); // Fallback if no post to comment on
      }
    }
    return null;
  },
);
// Ensure newline at end of file
