/**
 * Authentication Manager - Handles admin login and role-based access control
 * Uses Firebase Authentication for secure user management
 */
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.auth = firebase.auth();
    this.configRef = database.ref("config/adminCredentials");
    this.isInitialized = false;

    // Default admin credentials (will be saved to Firebase on first use)
    this.adminCredentials = {
      username: "admin",
      password: this.hashPassword("admin123"), // Default password
    };

    // Initialize authentication
    this.initialize();
  }

  /**
   * Initialize authentication system
   */
  async initialize() {
    try {
      // Load credentials from Firebase
      await this.loadCredentialsFromFirebase();

      // Listen for auth state changes
      this.auth.onAuthStateChanged(async (user) => {
        if (user) {
          // Check if user is admin
          await this.checkAdminStatus(user.uid);
        } else {
          // Sign in anonymously for regular users
          await this.auth.signInAnonymously();
        }
        this.isInitialized = true;
      });
    } catch (error) {
      console.error("Auth initialization error:", error);
      // Fallback to anonymous auth
      await this.auth.signInAnonymously();
      this.isInitialized = true;
    }
  }

  /**
   * Check if user is an admin
   * @param {string} uid - User ID
   */
  async checkAdminStatus(uid) {
    try {
      const snapshot = await database.ref(`admins/${uid}`).once("value");
      if (snapshot.exists()) {
        this.currentUser = {
          uid: uid,
          role: "admin",
          username: snapshot.val().username || "admin",
          loginTime: Date.now(),
        };
      } else {
        this.currentUser = {
          uid: uid,
          role: "user",
        };
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      this.currentUser = {
        uid: uid,
        role: "user",
      };
    }
  }

  /**
   * Load admin credentials from Firebase
   */
  async loadCredentialsFromFirebase() {
    try {
      const snapshot = await this.configRef.once("value");
      if (snapshot.exists()) {
        this.adminCredentials = snapshot.val();
        console.log("Admin credentials loaded from Firebase");
      } else {
        // First time setup - save default credentials to Firebase
        await this.saveCredentialsToFirebase();
        console.log("Default admin credentials saved to Firebase");
      }
    } catch (error) {
      console.error("Error loading credentials from Firebase:", error);
    }
  }

  /**
   * Save admin credentials to Firebase
   */
  async saveCredentialsToFirebase() {
    try {
      await this.configRef.set(this.adminCredentials);
      console.log("Admin credentials saved to Firebase");
    } catch (error) {
      console.error("Error saving credentials to Firebase:", error);
      throw error;
    }
  }

  /**
   * Simple hash function for password (client-side only)
   * Note: This is basic security. For production, use proper backend authentication
   * @param {string} password - Password to hash
   * @returns {string} Hashed password
   */
  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Authenticate user with Firebase
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<boolean>} True if authentication successful
   */
  async login(username, password) {
    try {
      const hashedPassword = this.hashPassword(password);

      // Verify credentials match stored credentials
      if (
        username !== this.adminCredentials.username ||
        hashedPassword !== this.adminCredentials.password
      ) {
        return false;
      }

      // Sign in with Firebase (create user if doesn't exist)
      const email = `${username}@temple.local`;

      try {
        // Try to sign in
        const credential = await this.auth.signInWithEmailAndPassword(
          email,
          password
        );

        // Ensure user is in admins list
        await database.ref(`admins/${credential.user.uid}`).set({
          username: username,
          email: email,
          createdAt: Date.now(),
        });

        await this.checkAdminStatus(credential.user.uid);
        return true;
      } catch (error) {
        if (error.code === "auth/user-not-found") {
          // Create new admin user
          const credential = await this.auth.createUserWithEmailAndPassword(
            email,
            password
          );

          // Add to admins list
          await database.ref(`admins/${credential.user.uid}`).set({
            username: username,
            email: email,
            createdAt: Date.now(),
          });

          await this.checkAdminStatus(credential.user.uid);
          return true;
        }
        throw error;
      }
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }

  /**
   * Log out current user and sign in anonymously
   */
  async logout() {
    try {
      this.currentUser = null;
      // Sign out and then sign in anonymously
      await this.auth.signOut();
      await this.auth.signInAnonymously();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  /**
   * Check if user is logged in as admin
   * @returns {boolean} True if admin is logged in
   */
  isAdmin() {
    return this.currentUser && this.currentUser.role === "admin";
  }

  /**
   * Get current user
   * @returns {Object|null} Current user object or null
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Wait for authentication to be initialized
   * @returns {Promise<void>}
   */
  async waitForInit() {
    if (this.isInitialized) return;

    return new Promise((resolve) => {
      const checkInit = setInterval(() => {
        if (this.isInitialized) {
          clearInterval(checkInit);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Change admin password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} Promise that resolves to true if password changed successfully
   */
  async changePassword(currentPassword, newPassword) {
    if (!this.isAdmin()) {
      return false;
    }

    const hashedCurrent = this.hashPassword(currentPassword);
    if (hashedCurrent !== this.adminCredentials.password) {
      return false;
    }

    this.adminCredentials.password = this.hashPassword(newPassword);
    await this.saveCredentialsToFirebase();
    return true;
  }

  /**
   * Check if this is first time setup (using default password)
   * @returns {boolean} True if using default password
   */
  isDefaultPassword() {
    return this.adminCredentials.password === this.hashPassword("admin123");
  }
}
