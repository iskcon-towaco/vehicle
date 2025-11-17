const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Check if user is an admin
 */
async function isAdmin(uid) {
  if (!uid) return false;

  try {
    const snapshot = await admin
      .database()
      .ref(`admins/${uid}`)
      .once("value");
    return snapshot.exists();
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Redact sensitive information
 */
function redactName(name) {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) =>
      word.length > 0 ? word[0] + "*".repeat(Math.min(word.length - 1, 3)) : ""
    )
    .join(" ");
}

function redactPhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length <= 4) return "****";
  return "*".repeat(cleaned.length - 4) + cleaned.slice(-4);
}

/**
 * Get all records with proper redaction based on user role
 */
exports.getRecords = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to access records."
    );
  }

  try {
    const userIsAdmin = await isAdmin(context.auth.uid);
    const snapshot = await admin
      .database()
      .ref("records")
      .once("value");
    const records = [];

    snapshot.forEach((childSnapshot) => {
      const record = childSnapshot.val();

      // Redact sensitive data for non-admin users
      if (!userIsAdmin) {
        record.ownerName = redactName(record.ownerName);
        record.phoneNumber = redactPhone(record.phoneNumber);
      }

      records.push(record);
    });

    // Sort by creation date (newest first)
    records.sort((a, b) => b.createdAt - a.createdAt);

    return { records, isAdmin: userIsAdmin };
  } catch (error) {
    console.error("Error fetching records:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to fetch records."
    );
  }
});

/**
 * Get a single record by ID with proper redaction
 */
exports.getRecord = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated."
    );
  }

  const { recordId } = data;
  if (!recordId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Record ID is required."
    );
  }

  try {
    const userIsAdmin = await isAdmin(context.auth.uid);
    const snapshot = await admin
      .database()
      .ref(`records/${recordId}`)
      .once("value");

    if (!snapshot.exists()) {
      throw new functions.https.HttpsError("not-found", "Record not found.");
    }

    const record = snapshot.val();

    // Redact sensitive data for non-admin users
    if (!userIsAdmin) {
      record.ownerName = redactName(record.ownerName);
      record.phoneNumber = redactPhone(record.phoneNumber);
    }

    return { record, isAdmin: userIsAdmin };
  } catch (error) {
    console.error("Error fetching record:", error);
    throw new functions.https.HttpsError("internal", "Failed to fetch record.");
  }
});

/**
 * Admin login - verify credentials and return custom token
 */
exports.adminLogin = functions.https.onCall(async (data, context) => {
  const { username, password } = data;

  if (!username || !password) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Username and password are required."
    );
  }

  try {
    // Get admin credentials from database
    const credSnapshot = await admin
      .database()
      .ref("config/adminCredentials")
      .once("value");
    const credentials = credSnapshot.val();

    if (!credentials) {
      throw new functions.https.HttpsError(
        "not-found",
        "Admin credentials not configured."
      );
    }

    // Simple hash function (matches client-side)
    function hashPassword(pwd) {
      let hash = 0;
      for (let i = 0; i < pwd.length; i++) {
        const char = pwd.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    }

    const hashedPassword = hashPassword(password);

    // Verify credentials
    if (
      username !== credentials.username ||
      hashedPassword !== credentials.password
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Invalid credentials."
      );
    }

    // Get or create admin user
    let userRecord;
    const email = `${username}@temple.local`;

    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        // Create admin user
        userRecord = await admin.auth().createUser({
          email: email,
          password: password,
          displayName: "Admin",
        });

        // Add to admins list
        await admin
          .database()
          .ref(`admins/${userRecord.uid}`)
          .set({
            username: username,
            email: email,
            createdAt: Date.now(),
          });
      } else {
        throw error;
      }
    }

    // Create custom token
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    return {
      token: customToken,
      uid: userRecord.uid,
      isAdmin: true,
    };
  } catch (error) {
    console.error("Admin login error:", error);
    throw new functions.https.HttpsError("internal", "Login failed.");
  }
});
