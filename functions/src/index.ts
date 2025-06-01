
// functions/src/index.ts
/* eslint-disable max-len */
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {onMessagePublished} from "firebase-functions/v2/pubsub";
import * as admin from "firebase-admin";
import {GoogleGenerativeAI} from "@google/generative-ai";

// Corrected import for generateAnonymousName
import {generateAnonymousName} from "./utils/pseudonymUtils";
// Corrected import for detailedSectorsData
import {detailedSectorsData, findIndustryByName} from "./data/sectorData"; // Added findIndustryByName
import type {
  SectorWithSubSectors,
  SubSector,
  Industry,
} from "./data/sectorTypes"; // Ensure this path and types are correct

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
  logger.info("Firebase Admin SDK initialized.");
} else {
  logger.info("Firebase Admin SDK already initialized.");
}

// Export Firestore and Auth admin instances
export const dbAdmin = admin.firestore();
export const authAdmin = admin.auth();

interface BotUser { // Used as return type for _createBotUserLogic
  userId: string;
  email: string;
  mentionName: string;
  industry: string; // This is the key field for categorization
}

// Base profile structure for bot users as stored/retrieved from Firestore
interface BotProfileBase {
  uid?: string; // uid is set, but when mapping doc.id, we use id.
  id?: string; // Added for clarity when mapping doc.id
  email?: string;
  mentionName?: string;
  mentionNameLowercase?: string; // For uniqueness check
  industry?: string; // Main categorization field
  sectorName?: string;
  subSectorName?: string | null;
  industryName?: string | null; // More specific NAICS industry title
  naicsCode?: string | null;
  // Add other fields from UserProfileData if used in bot logic
}


interface BotPostDetails {
  postId: string;
  botUserId: string;
  botMentionName: string;
}

interface BotCommentDetails {
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
  return !userDoc.data()?.isBotAccount;
}

/**
 * Helper function to find a unique mention name for bots.
 * @param {string} basePrefix The prefix for the bot name (e.g., "Bot").
 * @param {number} initialSuffix The initial random suffix.
 * @param {number} maxAttempts Max attempts to find a unique name.
 * @return {Promise<string>} A unique mention name.
 */
async function findUniqueBotMentionName(
  basePrefix: string,
  initialSuffix: number,
  maxAttempts: number = 10
): Promise<string> {
  let attempt = 0;
  let currentSuffix = initialSuffix;
  let candidateName = `${basePrefix}${currentSuffix}`;
  let candidateNameLower = candidateName.toLowerCase();

  while (attempt < maxAttempts) {
    const usersRef = dbAdmin.collection("users");
    const q = usersRef.where("mentionNameLowercase", "==", candidateNameLower).limit(1);
    const snapshot = await q.get();

    if (snapshot.empty) {
      return candidateName; // Found unique
    }

    attempt++;
    if (attempt >= maxAttempts) {
      logger.error(`[findUniqueBotMentionName] Max attempts reached for prefix ${basePrefix}. Using fallback.`);
      // Fallback: append timestamp to make it highly unique
      return `${basePrefix}${initialSuffix}_${Date.now().toString().slice(-5)}`;
    }
    // Generate a new suffix for the next attempt
    currentSuffix = Math.floor(1000 + Math.random() * 9000); // New 4-digit suffix
    candidateName = `${basePrefix}${currentSuffix}`;
    candidateNameLower = candidateName.toLowerCase();
  }
  // Should ideally not be reached if maxAttempts > 0
  return `${basePrefix}${initialSuffix}_fallback_${Date.now().toString().slice(-3)}`;
}


/**
 * Core logic to create a bot user account with randomized details.
 * @return {Promise<BotUser | null>} An object with bot user details or null.
 */
async function _createBotUserLogic(targetIndustryName?: string): Promise<BotUser | null> {
  const functionName = "_createBotUserLogic";
  logger.info(`[${functionName}] Attempting to create new bot user. Target: ` +
        (targetIndustryName || "Random"));
  try {
    const initialRandomSuffix = Math.floor(1000 + Math.random() * 9000); // Start with a 4-digit suffix
    const botEmail = `bot_${Date.now()}_${initialRandomSuffix}@example.com`;
    const botPassword = `strongPassword${Date.now()}${initialRandomSuffix}`;

    const userRecord = await authAdmin.createUser({
      email: botEmail,
      password: botPassword,
      disabled: false,
    });

    // Ensure unique mentionName for the bot
    const uniqueMentionName = await findUniqueBotMentionName("Bot", initialRandomSuffix);

    let industryForBot: string;
    let selectedSector: SectorWithSubSectors | undefined;
    let selectedSubSector: SubSector | null = null;
    let selectedIndustry: Industry | null = null;

    if (targetIndustryName) {
        const foundIndustryDetails = findIndustryByName(targetIndustryName);
        if (foundIndustryDetails) {
            selectedIndustry = foundIndustryDetails.industry;
            selectedSubSector = foundIndustryDetails.subSector;
            selectedSector = foundIndustryDetails.sector;
            industryForBot = selectedIndustry?.name || selectedSubSector?.name || selectedSector?.name || targetIndustryName;
        } else {
            logger.warn(`[${functionName}] Target industry "${targetIndustryName}" not ` +
                "found. Assigning to random industry.");
            // Fallback to random if targetIndustryName is not found
            selectedSector = detailedSectorsData[Math.floor(Math.random() * detailedSectorsData.length)];
            if (selectedSector.subSectors && selectedSector.subSectors.length > 0) {
                selectedSubSector = selectedSector.subSectors[Math.floor(Math.random() * selectedSector.subSectors.length)];
            }
            if (selectedSubSector && selectedSubSector.industries && selectedSubSector.industries.length > 0) {
                selectedIndustry = selectedSubSector.industries[Math.floor(Math.random() * selectedSubSector.industries.length)];
            }
            industryForBot = selectedIndustry?.name || selectedSubSector?.name || selectedSector?.name || "General Business";
        }
    } else {
        selectedSector = detailedSectorsData[Math.floor(Math.random() * detailedSectorsData.length)];
        if (selectedSector.subSectors && selectedSector.subSectors.length > 0) {
            selectedSubSector = selectedSector.subSectors[Math.floor(Math.random() * selectedSector.subSectors.length)];
        }
        if (selectedSubSector && selectedSubSector.industries && selectedSubSector.industries.length > 0) {
            selectedIndustry = selectedSubSector.industries[Math.floor(Math.random() * selectedSubSector.industries.length)];
        }
        industryForBot = selectedIndustry?.name || selectedSubSector?.name || selectedSector?.name || "General Business";
    }


    const userProfileData: BotProfileBase = { // Use BotProfileBase for stricter typing
      uid: userRecord.uid,
      email: botEmail,
      mentionName: uniqueMentionName,
      mentionNameLowercase: uniqueMentionName.toLowerCase(),
      industry: industryForBot,
      description:
        `This is an automated bot account for the ` +
        `${industryForBot} ` +
        `industry, known as ${uniqueMentionName}.`,
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
      sectorName: selectedSector?.name || null,
      subSectorName: selectedSubSector?.name || null,
      industryName: selectedIndustry?.name || null,
      naicsCode: selectedIndustry?.code || selectedSubSector?.code || selectedSector?.code || null,
    };

    await dbAdmin.collection("users").doc(userRecord.uid).set(userProfileData);
    logger.info(
      `[${functionName}] Bot user ${userRecord.uid} (${uniqueMentionName}) ` +
      `for industry "${userProfileData.industry}" created successfully.`,
    );

    return {
      userId: userRecord.uid,
      email: botEmail,
      mentionName: uniqueMentionName,
      industry: userProfileData.industry!,
    };
  } catch (error) {
    logger.error(`[${functionName}] Error:`, error);
    return null;
  }
}

/**
 * Core logic to create a bot post.
 * @return {Promise<BotPostDetails | null>} Post details or null on error.
 */
async function _createBotPostLogic(): Promise<BotPostDetails | null> {
  const functionName = "_createBotPostLogic";
  logger.info(`[${functionName}] Attempting to create a new bot post...`);

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    logger.error(
      `[${functionName}] GEMINI_API_KEY missing. ` +
      "Cannot generate post content.",
    );
    return null;
  }

  try {
    const botUsersSnapshot = await dbAdmin
      .collection("users")
      .where("isBotAccount", "==", true)
      .limit(50)
      .get();

    let randomBot: BotProfileBase; // Use the defined interface
    if (botUsersSnapshot.empty) {
      logger.warn(
        `[${functionName}] No bot users found. Creating a new one for post.`,
      );
      const newBot = await _createBotUserLogic(); // Gets a random industry by default
      if (!newBot) {
        logger.error(
          `[${functionName}] Failed to create new bot. Aborting post creation.`,
        );
        return null;
      }
      const newBotProfile = await dbAdmin.collection("users").doc(newBot.userId).get();
      if (!newBotProfile.exists) {
        logger.error(`[${functionName}] Failed to fetch profile for newly created bot ${newBot.userId}. Aborting post.`);
        return null;
      }
      randomBot = {id: newBot.userId, ...(newBotProfile.data() as Partial<BotProfileBase>)} as BotProfileBase;
    } else {
      const botUsers = botUsersSnapshot.docs.map((doc) =>
        ({id: doc.id, ...(doc.data() as Partial<BotProfileBase>)} as BotProfileBase));
      randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];
    }

    if (!randomBot || !randomBot.id || !randomBot.mentionName) {
      logger.error(
        `[${functionName}] Selected bot user invalid or missing key fields.`,
        randomBot,
      );
      return null;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({model: "gemini-1.5-flash-latest"});

    // Use the bot's 'industry' field for the prompt, or fallback to specific NAICS fields if 'industry' is too general
    const postCreationIndustryContext = randomBot.industry || randomBot.industryName || randomBot.subSectorName || randomBot.sectorName || "General Business";


    const prompt =
      `Generate a unique and relevant question and a detailed description for a ` +
      `forum post in the field of ${postCreationIndustryContext}. The user, ` +
      `${randomBot.mentionName}, is seeking insights. Output should be JSON: ` +
      `{"question": "string", "descriptionDetails": "string", ` +
      `"descriptionTried": "string (optional)", ` +
      `"descriptionOutcome": "string (optional)"}. ` +
      `Ensure content is professional and distinct. Max 150 chars for question, ` +
      `300 for descriptionDetails. Keep tried/outcome concise if provided.`;

    let generatedContent = {
      question: "",
      descriptionDetails: "",
      descriptionTried: "",
      descriptionOutcome: "",
    };

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
        if (typeof generatedContent.question !== "string" ||
            typeof generatedContent.descriptionDetails !== "string") {
          throw new Error("Parsed JSON for post has invalid content fields.");
        }
      } catch (parseError) {
        logger.error(
          `[${functionName}] Failed to parse Gemini response for post:`,
          jsonString,
          parseError,
        );
        generatedContent.question = `Question for ${postCreationIndustryContext} (ParseError)`;
        generatedContent.descriptionDetails =
          `Details for ${postCreationIndustryContext}. (Content parse failed)`;
      }
    } catch (error) {
      logger.error(
        `[${functionName}] Error calling Gemini API for post:`, error,
      );
      generatedContent.question = `Question for ${postCreationIndustryContext} (API Error)`;
      generatedContent.descriptionDetails =
        `Seeking insights in ${postCreationIndustryContext}. (Content gen failed)`;
    }

    const sampleTagsPool = [
      ["Tech", "Innovation"], ["Collaboration", "Projects"],
      ["Logistics", "SupplyChain"], ["AI", "FutureTech"],
      ["Strategy", "MarketEntry"], ["Sustainability", "Business"],
      ["Startup", "Growth"], ["RemoteWork", "Productivity"],
      ["Finance"], ["Healthcare"], ["Education"], ["Marketing"],
      ["Legal"], ["Product"],
    ];

    const newPostData: any = {
      userId: randomBot.id,
      question: generatedContent.question.substring(0, 200),
      descriptionDetails: generatedContent.descriptionDetails.substring(0, 500),
      descriptionTried: generatedContent.descriptionTried?.substring(0, 300) || null,
      descriptionOutcome: generatedContent.descriptionOutcome?.substring(0, 300) || null,
      tags: sampleTagsPool[Math.floor(Math.random() * sampleTagsPool.length)],
      sector: randomBot.sectorName || "General",
      subSector: randomBot.subSectorName || null,
      industry: randomBot.industryName || null, // More specific NAICS industry title
      naicsCode: randomBot.naicsCode || null,
      ratingScore: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [],
      mentionedUserIds: [],
      requestType: (Math.random() < 0.3) ? "help_request" : "post" as const,
      commentCount: 0,
    };
    if (newPostData.requestType === "help_request") {
      newPostData.maxBudget = Math.floor(Math.random() * 5000) + 100;
      if (Math.random() < 0.5) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + (Math.floor(Math.random() * 30) + 7));
        newPostData.deadline = admin.firestore.Timestamp.fromDate(futureDate);
      } else {
        newPostData.deadline = null;
      }
    } else {
      newPostData.maxBudget = null;
      newPostData.deadline = null;
    }

    const postRef = await dbAdmin.collection("posts").add(newPostData);
    logger.info(
      `[${functionName}] Bot user ${randomBot.id} (${randomBot.mentionName}) ` +
      `created post ${postRef.id} in industry "${postCreationIndustryContext}".`,
    );

    return {
      postId: postRef.id,
      botUserId: randomBot.id,
      botMentionName: randomBot.mentionName || generateAnonymousName(randomBot.id),
    };
  } catch (error) {
    logger.error(`[${functionName}] Error:`, error);
    return null;
  }
}

/**
 * Core logic to create a bot comment.
 * @param {string} [postId] Optional ID of the post to comment on.
 * @return {Promise<BotCommentDetails | null>} Comment details or null.
 */
async function _createBotCommentLogic(
  postId?: string,
): Promise<BotCommentDetails | null> {
  const functionName = "_createBotCommentLogic";
  logger.info(
    `[${functionName}] Attempting bot comment. Target post: ` +
    `${postId || "auto-select"}`,
  );

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    logger.error(
      `[${functionName}] GEMINI_API_KEY missing. Cannot generate comment.`,
    );
    return null;
  }

  let targetPostId = postId;
  let postData: admin.firestore.DocumentData | undefined;
  let postDocRef: admin.firestore.DocumentReference;

  try {
    if (!targetPostId) {
      logger.info(
        `[${functionName}] No postId, finding post with few comments.`,
      );
      const postsSnapshot = await dbAdmin
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
      postDocRef = postsSnapshot.docs[0].ref;
      logger.info(
        `[${functionName}] Selected post ${targetPostId} for commenting.`,
      );
    } else {
      postDocRef = dbAdmin.collection("posts").doc(targetPostId);
      const postDoc = await postDocRef.get();
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

    const postIndustry = postData.industry || postData.subSector || postData.sector || "General Business";
    const originalPosterId = postData.userId;

    let commentingBot: BotUser | null = null;
    const botUsersSnapshot = await dbAdmin
      .collection("users")
      .where("isBotAccount", "==", true)
      .get();

    if (!botUsersSnapshot.empty) {
      const availableBots = botUsersSnapshot.docs
        .map((doc) => ({id: doc.id, ...(doc.data() as Partial<BotProfileBase>)} as BotProfileBase))
        .filter((bot) => bot.id !== originalPosterId);

      if (availableBots.length > 0) {
        const botsInIndustry = availableBots.filter(
          (b) => b.industry === postIndustry, // Using the bot's 'industry' field
        );
        const selectedBotData = botsInIndustry.length > 0 ?
          botsInIndustry[Math.floor(Math.random() * botsInIndustry.length)] :
          availableBots[Math.floor(Math.random() * availableBots.length)];
        
        commentingBot = {
            userId: selectedBotData.id!,
            mentionName: selectedBotData.mentionName || generateAnonymousName(selectedBotData.id!),
            email: selectedBotData.email || `bot_${selectedBotData.id}@example.com`,
            industry: selectedBotData.industry || "General Business",
        };
      }
    }

    if (!commentingBot) {
      logger.info(
        `[${functionName}] No suitable existing bot for post ${targetPostId}.` +
        ` Creating new one targeting industry: ${postIndustry}.`,
      );
      const newBotUser = await _createBotUserLogic(postIndustry); // Target post's industry
      if (newBotUser && newBotUser.userId !== originalPosterId) {
        commentingBot = newBotUser;
      } else if (newBotUser && newBotUser.userId === originalPosterId) {
        logger.warn(`[${functionName}] New bot created is OP for post ` +
        `${targetPostId}. Cannot comment. Trying again with random industry.`);
        const fallbackBot = await _createBotUserLogic(); // Random industry
         if (fallbackBot && fallbackBot.userId !== originalPosterId) {
            commentingBot = fallbackBot;
        } else {
            logger.error(`[${functionName}] Fallback bot creation also failed or was OP.`);
            return null;
        }
      } else {
        logger.error(
          `[${functionName}] Failed to create new bot for comment. Aborting.`,
        );
        return null;
      }
    }

    if (!commentingBot || !commentingBot.mentionName) {
      logger.error(`[${functionName}] Commenting bot invalid or missing ` +
      `mentionName. Aborting.`);
      return null;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({model: "gemini-1.5-flash-latest"});
    const commentPrompt =
      "Generate a relevant, insightful comment for a forum post. " +
      `Post title: "${postData.question}". Description: ` +
      `"${postData.descriptionDetails}". Comment from user ` +
      `"${commentingBot.mentionName}" in ${commentingBot.industry || "General"} `+
      "industry. Output JSON: {\"commentText\": \"string\"}. Keep it concise.";

    let generatedComment = {commentText: ""};
    try {
      const result = await model.generateContent(commentPrompt);
      const response = await result.response;
      const textFromGemini = response.text();
      logger.info(
        `[${functionName}] Raw Gemini response for comment on post ` +
        `${targetPostId}:`,
        textFromGemini,
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
      mentionName: commentingBot.mentionName,
      text: generatedComment.commentText,
      postId: targetPostId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), // For comments as well
      replies: [], // Assuming comments can have replies, but bots don't start them
      likeCount: 0,
      parentCommentId: null,
      mentionedUserIds: [],
    };

    const commentRef = await postDocRef.collection("comments")
      .add(newCommentData);
    await postDocRef.update({
      commentCount: admin.firestore.FieldValue.increment(1),
    });

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
 * Firestore trigger for bot replies to new messages.
 */
export const onNewMessageReplyWithBot = onDocumentWritten(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const functionName = "onNewMessageReplyWithBot";
    logger.info(
      `[${functionName}] Triggered for msg ${event.params.messageId} in ` +
      `conv ${event.params.conversationId}.`,
      {snapshotExists: !!event.data},
    );

    if (!event.data?.after.exists || event.data.before.exists) {
      logger.info(`[${functionName}] Not a new message creation. Exiting.`);
      return;
    }
    const newMessage = event.data.after.data();
    if (!newMessage) {
      logger.info(`[${functionName}] New message data undefined. Exiting.`);
      return;
    }

    logger.info(`[${functionName}] Full newMessage data:`, newMessage);

    if (newMessage.isBotMessage === true) {
      logger.info(`[${functionName}] Message is from a bot. No reply needed.`);
      return;
    }

    const senderId = newMessage.senderId as string;
    const messageText = newMessage.text as string;
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
        `[${functionName}] No bot recipient or sender not real user. ` +
        "No reply needed.",
        {botRecipientId, senderIsRealUser: senderIsUser},
      );
      return;
    }
    logger.info(
      `[${functionName}] Real user ${senderId} sent msg to bot ` +
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
        .orderBy("timestamp", "desc")
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
          `[${functionName}] Generated bot reply empty. Not sending.`,
        );
        return;
      }

      const botMessageData = {
        senderId: botRecipientId,
        text: botReplyText,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isBotMessage: true,
        read: false,
        replyToMessageId: null,
        repliedToTextSnippet: null,
        conversationId: conversationId,
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
 * Firestore trigger to auto-accept bot connection requests.
 */
export const autoAcceptBotConnectionRequests = onDocumentWritten(
  "mutuals/{connectionId}",
  async (event) => {
    const functionName = "autoAcceptBotConnectionRequests";
    logger.info(
      `[${functionName}] Triggered for connection ${event.params.connectionId}`,
      {rawEventDataExists: !!event.data},
    );

    if (!event.data?.after.exists || event.data.before.exists) {
      logger.info(
        `[${functionName}] Not a new connection doc, or not a create. Exiting.`,
      );
      return;
    }
    const connectionData = event.data.after.data();
    const connectionRef = event.data.after.ref;

    if (!connectionData || connectionData.status !== "pending") {
      logger.info(
        `[${functionName}] Conn not "pending" or data missing. Exiting.`,
      );
      return;
    }

    const {requesterId, userIds} = connectionData as {
      requesterId: string;
      userIds: string[];
    };
    if (!requesterId || !Array.isArray(userIds) || userIds.length !== 2) {
      logger.error(
        `[${functionName}] Invalid connection data structure.`, connectionData,
      );
      return;
    }

    const recipientId = userIds.find((id: string) => id !== requesterId);

    if (recipientId && (await isBotUser(recipientId))) {
      logger.info(
        `[${functionName}] Request for bot user ${recipientId} found. Accepting.`,
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
        `[${functionName}] Recipient not bot or ID missing. No action.`,
      );
    }
  },
);

/**
 * HTTP-triggered function to create a bot user.
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
 * HTTP-triggered function to create a bot post.
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
 * HTTP-triggered function to create a bot comment.
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
 * PubSub-triggered function for random bot activity.
 * @param {any} event The Pub/Sub message event.
 * @return {Promise<null>}
 */
export const scheduledBotActivity = onMessagePublished(
  BOT_ACTIVITY_TOPIC_NAME,
  async (event) => {
    const functionName = "scheduledBotActivity";
    logger.info(
      `[${functionName}] Triggered by Pub/Sub message:`, event,
    );

    const shouldAct = Math.random() < 0.7;
    if (!shouldAct) {
      logger.info(`[${functionName}] Decided to do nothing this time.`);
      return null;
    }

    const actionType = Math.random();
    if (actionType < 0.15) {
      logger.info(`[${functionName}] Decided to create a bot user.`);
      await _createBotUserLogic(); // Random industry by default
    } else if (actionType < 0.60) {
      logger.info(`[${functionName}] Decided to create a bot post.`);
      await _createBotPostLogic();
    } else {
      logger.info(
        `[${functionName}] Decided to create a bot comment.`,
      );
      const commentResult = await _createBotCommentLogic();
      if (!commentResult) {
        logger.info(
          `[${functionName}] Comment creation failed (e.g., no posts). ` +
          "Attempting to create a post instead as fallback.",
        );
        await _createBotPostLogic();
      }
    }
    return null;
  },
);
// Ensure newline at end of file
import {onDocumentWritten} from "firebase-functions/v2/firestore"; // Corrected import


    
