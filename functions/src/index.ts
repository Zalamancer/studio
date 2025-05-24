
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { generateAnonymousName } from "./utils/pseudonymUtils"; // Assuming this is correctly set up

// Initialize Firebase Admin SDK.
// When deployed to Firebase, the SDK automatically discovers service account credentials.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export Firestore and Auth admin instances
export const dbAdmin = admin.firestore();
export const authAdmin = admin.auth();

// Example Cloud Function (Keep this if you still use it)
export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

export const createBotUser = onRequest(async (request, response) => {
  try {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const botEmail = `bot_${Date.now()}_${randomSuffix}@example.com`;
    const botPassword = `strongPassword${Date.now()}${randomSuffix}`;

    logger.info(`Attempting to create bot user with email: ${botEmail}`);

    const userRecord = await authAdmin.createUser({
      email: botEmail,
      password: botPassword,
      disabled: false, // Ensure the bot account is enabled
    });

    logger.info("Successfully created new Firebase Auth user:", userRecord.uid);

    const newMentionName = generateAnonymousName(userRecord.uid);
    const industries = ["Tech", "Retail", "Healthcare", "Finance", "Manufacturing", "Education"];
    const randomIndustry = industries[Math.floor(Math.random() * industries.length)];

    const userProfileData = {
      uid: userRecord.uid,
      email: botEmail,
      mentionName: newMentionName,
      companyName: `Bot Business ${randomSuffix}`,
      actualDisplayName: null,
      industry: randomIndustry,
      avatarUrl: null,
      description: `This is an automated bot account for ${randomIndustry}.`,
      descriptionVisibility: "everyone",
      tags: [],
      location: null,
      established: String(new Date().getFullYear() - Math.floor(Math.random() * 10)), // Random year in last 10 years
      contactEmail: null,
      contactPhone: null,
      verified: true, // Bots can be marked as verified for testing
      isBotAccount: true, // Crucial flag
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(), // Simulate recent login
    };

    await dbAdmin.collection("users").doc(userRecord.uid).set(userProfileData);
    logger.info("Successfully created Firestore profile for bot user:", userRecord.uid);

    response.status(200).send({
      message: "Bot user created successfully!",
      userId: userRecord.uid,
      email: botEmail,
      mentionName: newMentionName,
    });
  } catch (error) {
    logger.error("Error creating bot user:", error);
    response.status(500).send({ error: "Failed to create bot user", details: error });
  }
});

// --- New Function: createBotPost ---
const sampleQuestions = [
  "What are the best strategies for B2B lead generation in the SaaS industry?",
  "Seeking collaborators for a new sustainable packaging solution.",
  "How can AI be leveraged to improve supply chain efficiency?",
  "Looking for insights on remote team management best practices.",
  "What are the upcoming trends in renewable energy tech?",
  "Need advice on marketing a new mobile application effectively.",
];

const sampleDescriptions = [
  "Our team is exploring innovative approaches to enhance customer engagement and drive growth. We're particularly interested in data-driven strategies and would love to connect with experts in this field.",
  "We have developed a prototype for a new eco-friendly material and are looking for partners in manufacturing and distribution. Open to discussing pilot projects.",
  "Focused on optimizing logistics through AI and machine learning. Interested in tools or partnerships that can help reduce costs and improve delivery times.",
  "As a fully remote company, we're constantly looking for ways to improve team collaboration, productivity, and well-being. What tools or methodologies have worked for you?",
  "Researching the latest advancements in solar panel technology and battery storage. Seeking discussions on grid integration and policy implications.",
  "Launching a new productivity app for small businesses. Looking for creative marketing strategies to reach our target audience and build a strong user base.",
];

const sampleTags = ["Tech", "Marketing", "Sustainability", "AI", "Logistics", "RemoteWork", "SaaS", "MobileApp", "RenewableEnergy"];
const sampleSectors = ["Information", "Manufacturing", "Professional, Scientific, and Technical Services", "Transportation and Warehousing", "Utilities"];

export const createBotPost = onRequest(async (request, response) => {
  logger.info("createBotPost function triggered.");
  try {
    // 1. Find bot users
    const botsSnapshot = await dbAdmin.collection("users").where("isBotAccount", "==", true).limit(50).get();
    if (botsSnapshot.empty) {
      logger.warn("No bot users found in Firestore. Cannot create a post.");
      response.status(404).send({ error: "No bot users available to create a post." });
      return;
    }

    const botUsers = botsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const randomBot = botUsers[Math.floor(Math.random() * botUsers.length)];
    logger.info(`Selected bot user '${randomBot.id}' to create a post.`);

    // 2. Generate post content
    const question = sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)];
    const description = sampleDescriptions[Math.floor(Math.random() * sampleDescriptions.length)];
    
    // Select 1 to 3 random tags
    const numTags = Math.floor(Math.random() * 3) + 1;
    const tags: string[] = [];
    const availableTagsCopy = [...sampleTags];
    for (let i = 0; i < numTags; i++) {
      if (availableTagsCopy.length === 0) break;
      const randomIndex = Math.floor(Math.random() * availableTagsCopy.length);
      tags.push(availableTagsCopy.splice(randomIndex, 1)[0]);
    }

    const sector = sampleSectors[Math.floor(Math.random() * sampleSectors.length)];

    // For simplicity, bots will have a 0 rating score on posts initially
    // Or you could fetch their actual average if reviews were simulated for bots
    const ratingScore = 0;

    const newPostData = {
      userId: randomBot.id,
      question,
      description,
      tags,
      sector,
      subSector: null, // Bots can post to general sectors for now
      industry: null,
      naicsCode: sector, // Or derive more specific NAICS if sector mapping is robust
      businessType: "Bot Business",
      safetyIndicator: "Medium",
      ratingScore,
      requestType: "post",
      mentionedUserIds: [], // Bots won't mention for now, can be added later
      imageUrls: [],       // Bots won't upload images for now
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    logger.info("Generated post data:", newPostData);

    // 3. Add post to Firestore
    const postRef = await dbAdmin.collection("posts").add(newPostData);
    logger.info(`Bot post created successfully with ID: ${postRef.id} by user ${randomBot.id}`);

    response.status(200).send({
      message: "Bot post created successfully!",
      postId: postRef.id,
      botUserId: randomBot.id,
    });
  } catch (error) {
    logger.error("Error creating bot post:", error);
    response.status(500).send({ error: "Failed to create bot post", details: error });
  }
});
