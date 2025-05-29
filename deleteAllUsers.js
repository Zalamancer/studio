// deleteAllUsers.js
// Place this script in a temporary folder, NOT inside functions/src
// Run with: node deleteAllUsers.js

const admin = require('firebase-admin');

// ----- IMPORTANT: CONFIGURE THIS SECTION -----
// 1. Download your service account key JSON file from Firebase Project Settings > Service accounts
// 2. Place it in the same directory as this script (or update the path).
// 3. RENAME 'path/to/your/serviceAccountKey.json' to your actual file name.
const serviceAccount = require('./serviceAccountKey.json'); // <--- UPDATE THIS PATH

// Set these to true ONLY when you are absolutely ready to delete.
// START WITH BOTH AS FALSE TO TEST THE LISTING PART.
const REALLY_DELETE_AUTH_USERS = false;
const REALLY_DELETE_FIRESTORE_USERS_COLLECTION_DOCS = false;
// -------------------------------------------

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
  process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

async function listAllAuthUsers(nextPageToken) {
  const userRecords = [];
  let pageToken = nextPageToken;
  let count = 0;
  console.log("Fetching Auth users (1000 at a time)...");
  do {
    process.stdout.write(`Fetched ${count} users so far...\r`);
    const listUsersResult = await auth.listUsers(1000, pageToken);
    listUsersResult.users.forEach((userRecord) => {
      userRecords.push(userRecord);
      count++;
    });
    pageToken = listUsersResult.pageToken;
  } while (pageToken);
  console.log(`\nFinished fetching. Total Auth users found: ${userRecords.length}`);
  return userRecords;
}

async function deleteAllAuthUsersBatch(uids) {
  if (!REALLY_DELETE_AUTH_USERS) {
    console.warn("REALLY_DELETE_AUTH_USERS is false. Skipping actual deletion of Auth users.");
    uids.forEach(uid => console.log(`Would delete Auth UID: ${uid}`));
    return { successCount: 0, failureCount: uids.length };
  }
  console.log(`Attempting to delete batch of ${uids.length} Auth users...`);
  try {
    const deleteUsersResult = await auth.deleteUsers(uids);
    console.log(`Successfully deleted ${deleteUsersResult.successCount} Auth users in this batch.`);
    if (deleteUsersResult.failureCount > 0) {
      console.error(`Failed to delete ${deleteUsersResult.failureCount} Auth users in this batch:`);
      deleteUsersResult.errors.forEach((err) => {
        console.error(`  Error for UID ${err.uid}: ${err.error.message}`);
      });
    }
    return deleteUsersResult;
  } catch (error) {
    console.error(`Error during batch deletion of Auth users:`, error);
    return { successCount: 0, failureCount: uids.length, errors: uids.map(uid => ({uid, error})) };
  }
}

async function deleteAllFirestoreDocsInCollection(collectionPath) {
  console.log(`Fetching all documents from '${collectionPath}' collection in Firestore...`);
  const collectionRef = db.collection(collectionPath);
  let totalDocsFound = 0;
  let totalDocsSuccessfullyDeleted = 0;

  async function deleteQueryBatch(query, resolve, reject) {
    try {
      const snapshot = await query.get();
      totalDocsFound += snapshot.size;
      process.stdout.write(`Found ${totalDocsFound} total documents in '${collectionPath}' so far...\r`);

      if (snapshot.empty) {
        // No more documents to delete
        resolve();
        return;
      }

      if (!REALLY_DELETE_FIRESTORE_USERS_COLLECTION_DOCS) {
        console.warn(`\nREALLY_DELETE_FIRESTORE_USERS_COLLECTION_DOCS is false. Skipping actual deletion of Firestore documents from '${collectionPath}'.`);
        snapshot.docs.forEach(doc => console.log(`Would delete Firestore doc: ${collectionPath}/${doc.id}`));
        resolve(); // Resolve without deleting if the flag is false
        return;
      }

      // Delete documents in a batch
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      totalDocsSuccessfullyDeleted += snapshot.size;
      process.stdout.write(`Deleted ${totalDocsSuccessfullyDeleted} documents from '${collectionPath}' so far...\r`);

      // Recurse on the next process tick, to avoid exploding the stack.
      process.nextTick(() => {
        deleteQueryBatch(query, resolve, reject);
      });
    } catch (error) {
      reject(error);
    }
  }

  return new Promise((resolve, reject) => {
    // Initial query to find documents
    deleteQueryBatch(collectionRef.limit(500), resolve, reject) // Firestore batch limit is 500
      .catch(reject);
  }).then(() => {
    console.log(`\nFinished fetching/processing documents from '${collectionPath}'. Total found: ${totalDocsFound}. Total successfully deleted (if enabled): ${totalDocsSuccessfullyDeleted}.`);
  });
}


async function main() {
  console.warn("--- SCRIPT TO DELETE ALL USERS ---");
  console.warn("!!! THIS IS A DESTRUCTIVE OPERATION. MAKE SURE YOU HAVE BACKUPS AND KNOW WHAT YOU ARE DOING !!!");
  console.warn(`REALLY_DELETE_AUTH_USERS is set to: ${REALLY_DELETE_AUTH_USERS}`);
  console.warn(`REALLY_DELETE_FIRESTORE_USERS_COLLECTION_DOCS is set to: ${REALLY_DELETE_FIRESTORE_USERS_COLLECTION_DOCS}`);
  
  if (!REALLY_DELETE_AUTH_USERS && !REALLY_DELETE_FIRESTORE_USERS_COLLECTION_DOCS) {
    console.log("\nBoth deletion flags are false. The script will list users/documents but NOT delete anything.");
    console.log("To enable deletion, set the respective constants at the top of this script to true.");
  }

  // Step 1: Delete from Firestore 'users' collection
  console.log("\n--- Processing Firestore 'users' collection ---");
  await deleteAllFirestoreDocsInCollection('users').catch(err => {
    console.error("Error during Firestore 'users' collection processing:", err);
  });

  // Step 2: Delete from Firebase Authentication
  console.log("\n--- Processing Firebase Authentication users ---");
  try {
    const authUserRecords = await listAllAuthUsers();
    if (authUserRecords.length > 0) {
      const uidsToDelete = authUserRecords.map(user => user.uid);
      const batchSize = 1000; // Max UIDs per deleteUsers call
      let totalSuccessfullyDeleted = 0;
      let totalFailed = 0;

      for (let i = 0; i < uidsToDelete.length; i += batchSize) {
        const batchUids = uidsToDelete.slice(i, i + batchSize);
        const result = await deleteAllAuthUsersBatch(batchUids);
        totalSuccessfullyDeleted += result.successCount;
        totalFailed += result.failureCount;
      }
      console.log(`\nFirebase Authentication: Total ${totalSuccessfullyDeleted} users successfully deleted. Total ${totalFailed} users failed to delete.`);
    } else if (REALLY_DELETE_AUTH_USERS) {
      console.log("No users found in Firebase Authentication to delete.");
    }
  } catch (error) {
    console.error("Error processing Firebase Authentication users:", error);
  }

  console.log("\n--- Script finished ---");
}

main().catch(err => {
  console.error("Unhandled error in main execution:", err);
  process.exit(1);
});
