
// functions/src/index.ts
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {dbAdmin, authAdmin} from "./admin"; // Use local admin import
import {generateAnonymousName} from "./utils/pseudonymUtils";

// Initialize Firebase Admin SDK - This should ideally be done once.
// If admin.apps.length is 0, it means it hasn't been initialized yet.
// The check in admin.ts might handle this, but ensure it's robust.
// For Cloud Functions, admin.initializeApp() without arguments works when deployed.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// ========== helloWorld Function ==========
export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});


// ========== createBotUser Function ==========
export const createBotUser = onRequest(async (req, res) => {
  logger.info("createBotUser function called - V3 (ColorAnimalNumber names)");

  try {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const botEmail = `bot_${Date.now()}_${randomSuffix}@example.com`;
    const botPassword = `strongPassword${Date.now()}${randomSuffix}`;

    const userRecord = await authAdmin.createUser({
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
    // Generate the ColorAnimalNumber mentionName
    const generatedMentionName = generateAnonymousName(userRecord.uid);

    const userProfileData = {
      uid: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName, // Use the generated ColorAnimalNumber name
      industry: randomIndustry,
      description: `This is an automated bot account for the ${randomIndustry} industry, known as ${generatedMentionName}.`,
      descriptionVisibility: "everyone" as const,
      tags: [], // Bots start with no specific tags
      established: String(
        new Date().getFullYear() - Math.floor(Math.random() * 10),
      ),
      verified: true, // Bots can be marked as verified by the system
      isBotAccount: true,
      // Omitted fields: actualDisplayName, avatarUrl, companyName,
      // contactEmail, contactPhone, location
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await dbAdmin.collection("users").doc(userRecord.uid).set(userProfileData);
    logger.info(
      `Bot user ${userRecord.uid} (${generatedMentionName})` +
      " created successfully with lean profile and ColorAnimalNumber name."
    );

    // Corrected response message
    res.status(200).send({
      message: "Bot user created successfully!",
      userId: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName,
    });
  } catch (error: any) {
    logger.error("Error in createBotUser:", error);
    res.status(500).send({
      error: "Failed to create bot user",
      details: (error as Error).message || "Unknown error",
    });
  }
});

// ========== createBotPost Function ==========
export const createBotPost = onRequest(async (req, res) => {
  logger.info("createBotPost function called - V2");
  try {
    const botUsersSnapshot = await dbAdmin
      .collection("users")
      .where("isBotAccount", "==", true)
      .limit(50) // Consider how many bot users you might have
      .get();

    if (botUsersSnapshot.empty) {
      logger.warn("No bot users found. Cannot create a post.");
      res.status(404).send({
        error: "No bot users available to create a post.",
      });
      return;
    }

    const botUsers = botUsersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any), // Cast to any or define a BotUser type
    }));

    const randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];

    if (!randomBot || !randomBot.id || !randomBot.mentionName) {
      logger.error(
        "Selected random bot is invalid or missing mentionName.", randomBot,
      );
      res.status(500).send({error: "Failed to select a valid bot user."});
      return;
    }

    const sampleQuestions = [
      "What are the best B2B lead generation strategies for 2024?",
      "How can AI be leveraged to improve supply chain efficiency?",
      "Seeking collaborators for a new SaaS product in the fintech space.",
      "What are common pitfalls when scaling a remote team globally?",
      "Insights on sustainable manufacturing practices for SMEs?",
      `Any ${randomBot.industry || "experts"} available for a quick chat?`,
      `Looking for advice on entering the ${
        randomBot.industry || "new"
      } market.`,
    ];

    const sampleDescriptions = [
      "Exploring innovative ways to connect with B2B clients.",
      "Developing an AI model for logistics optimization.",
      `Project: Disrupting payments. User: ${randomBot.mentionName}`,
      "Challenges with remote team culture and productivity.",
      "Implementing greener solutions in production lines.",
      `User ${randomBot.mentionName} from the ${
        randomBot.industry || "general"
      } sector needs advice.`,
      `User ${randomBot.mentionName} is exploring the ${
        randomBot.industry || "new"
      } market.`,
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

    // Use the bot's actual industry if available, otherwise default
    const postSector = randomBot.industry || "General Business";
    const botRating = Math.floor(Math.random() * 3) + 2; // 2-4 stars

    const newPostData = {
      userId: randomBot.id,
      question: sampleQuestions[index],
      description: sampleDescriptions[index],
      tags: sampleTags[index] || ["General"],
      sector: postSector,
      businessType: randomBot.industry || "Bot Industry",
      safetyIndicator: "Medium" as const,
      ratingScore: botRating, // Use the calculated bot rating
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [],
      mentionedUserIds: [],
      requestType: "post" as const,
      // Explicitly null for fields not used by 'post' type bots
      descriptionDetails: null,
      descriptionTried: null,
      descriptionOutcome: null,
      maxBudget: null,
      deadline: null,
      subSector: null, // Bots post to general sectors for now
      industry: null,
      naicsCode: null, // Can be refined later if bots need specific NAICS
    };

    const postDocRef = await dbAdmin.collection("posts").add(newPostData);

    logger.info(
      `Bot user ${randomBot.id} (${randomBot.mentionName}) ` +
      `created a new post: ${postDocRef.id}`,
    );

    res.status(200).send({
      message: "Bot post created successfully!",
      postId: postDocRef.id,
      botUserId: randomBot.id,
      botMentionName: randomBot.mentionName,
    });
  } catch (error: any) {
    logger.error("Error in createBotPost:", error);
    res.status(500).send({
      error: "Failed to create bot post",
      details: (error as Error).message || "Unknown error",
    });
  }
});
