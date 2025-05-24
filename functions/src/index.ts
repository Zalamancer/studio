
// functions/src/index.ts
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {generateAnonymousName} from "./utils/pseudonymUtils"; // Ensure this is used

// Initialize Firebase Admin SDK
// This is done once per function instance.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export Firestore and Auth admin instances
// These are initialized with the global admin app instance.
export const dbAdmin = admin.firestore();
export const authAdmin = admin.auth();

// ========== helloWorld Function ==========
// This is a simple example function, keep it for basic testing.
export const helloWorld = onRequest((req, res) => {
  logger.info("Hello logs!", {structuredData: true});
  res.send("Hello from Firebase!");
});


// ========== createBotUser Function ==========
// Creates a new bot user in Firebase Authentication and Firestore.
export const createBotUser = onRequest(async (req, res) => {
  logger.info("createBotUser function called - V3 (ColorAnimalNumber names)");

  try {
    // Generate random elements for email and password to ensure uniqueness
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const botEmail = `bot_${Date.now()}_${randomSuffix}@example.com`;
    const botPassword = `strongPassword${Date.now()}${randomSuffix}`;

    // Create the Firebase Authentication user
    const userRecord = await authAdmin.createUser({
      email: botEmail,
      password: botPassword,
      disabled: false, // Ensure the bot account is enabled
    });

    const industries = [
      "Tech", "Retail", "Healthcare", "Finance",
      "Manufacturing", "Education", "Other",
    ];
    const randomIndustry = industries[
      Math.floor(Math.random() * industries.length)
    ];

    // Generate the "ColorAnimalNumber" mentionName using the utility
    const generatedMentionName = generateAnonymousName(userRecord.uid);

    // Define the user profile data to be stored in Firestore
    // Only include essential fields for bots
    const userProfileData = {
      uid: userRecord.uid,
      email: botEmail,
      mentionName: generatedMentionName, // Use the ColorAnimalNumber name
      industry: randomIndustry,
      description: `This is an automated bot account for the ${randomIndustry} industry, known as ${generatedMentionName}.`,
      descriptionVisibility: "everyone" as const,
      tags: [], // Bots start with no specific tags
      established: String(
        new Date().getFullYear() - Math.floor(Math.random() * 10),
      ), // Random established year
      verified: true, // Bots can be marked as verified by the system
      isBotAccount: true,
      // Omitted fields: actualDisplayName, avatarUrl, companyName,
      // contactEmail, contactPhone, location
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save the user profile data to Firestore
    await dbAdmin.collection("users").doc(userRecord.uid).set(userProfileData);

    logger.info(
      `Bot user ${userRecord.uid} (${generatedMentionName}) created successfully with lean profile and ColorAnimalNumber name.`,
    );

    // Send a success response
    res.status(200).send({
      message: "Bot user created successfully!", // Corrected message
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
// Creates a new post authored by a randomly selected bot user.
export const createBotPost = onRequest(async (req, res) => {
  logger.info("createBotPost function called - V2");
  try {
    // Fetch up to 50 bot users from Firestore
    const botUsersSnapshot = await dbAdmin
      .collection("users")
      .where("isBotAccount", "==", true)
      .limit(50)
      .get();

    if (botUsersSnapshot.empty) {
      logger.warn("No bot users found. Cannot create a post.");
      res.status(404).send({
        error: "No bot users available to create a post.",
      });
      return;
    }

    // Map Firestore documents to user objects
    const botUsers = botUsersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any), // Cast to any or define a BotUser type
    }));

    // Select a random bot user
    const randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];

    // Ensure the selected bot is valid and has a mentionName
    if (!randomBot || !randomBot.id || !randomBot.mentionName) {
      logger.error(
        "Selected random bot is invalid or missing mentionName.", randomBot,
      );
      res.status(500).send({error: "Failed to select a valid bot user."});
      return;
    }

    // Sample data for creating posts
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
    const postSector = randomBot.industry || "General Business";
    const botRating = Math.floor(Math.random() * 3) + 2; // 2-4 stars

    // Data for the new post
    const newPostData = {
      userId: randomBot.id,
      question: sampleQuestions[index],
      description: sampleDescriptions[index],
      tags: sampleTags[index] || ["General"],
      sector: postSector,
      businessType: randomBot.industry || "Bot Industry",
      safetyIndicator: "Medium" as const,
      ratingScore: botRating,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      imageUrls: [], // Bots won't upload images for now
      mentionedUserIds: [], // Bots won't mention users for now
      requestType: "post" as const,
      // Explicitly null for fields not used by 'post' type bots
      descriptionDetails: null,
      descriptionTried: null,
      descriptionOutcome: null,
      maxBudget: null,
      deadline: null,
      subSector: null,
      industry: null,
      naicsCode: null,
    };

    // Add the new post to Firestore
    const postDocRef = await dbAdmin.collection("posts").add(newPostData);

    logger.info(
      `Bot user ${randomBot.id} (${randomBot.mentionName}) ` +
      `created a new post: ${postDocRef.id}`,
    );

    // Send a success response
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
