/**
 * Authentication Manager - Compatibility Mode
 * Works with or without Firebase Authentication enabled
 */
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.auth = firebase.auth();
    this.configRef = database.ref("config/adminCredentials");
    this.isInitialized = false;
    this.authEnabled = false;

    // Default admin credentials
    this.adminCredentials = {
      username: "admin",
      password: this.hashPassword("admin123"),
    };

    // Initialize authentication
    this.initialize();
  }

  /**
   * Initialize authentication system with fallback
   */
  async initialize() {
    try {
      // Try to enable Firebase Auth FIRST (before loading credentials)
      try {
        console.log("🔄 Initializing Firebase Authentication...");

        // Set up auth state listener
        this.auth.onAuthStateChanged(async (user) => {
          console.log(
            "Auth state changed:",
            user ? `User ${user.uid}` : "No user"
          );
          if (user) {
            // User is signed in - NOW we can load credentials
            try {
              await this.loadCredentialsFromFirebase();
            } catch (credError) {
              console.warn(
                "Could not load credentials, using defaults:",
                credError.message
              );
            }
            // Check if user is admin
            await this.checkAdminStatus(user.uid);
          } else {
            // No user signed in, sign in anonymously
            try {
              console.log("Signing in anonymously...");
              await this.auth.signInAnonymously();
            } catch (anonError) {
              console.error("Anonymous sign-in failed:", anonError);
              this.isInitialized = true;
            }
          }
          if (!this.isInitialized) {
            this.isInitialized = true;
            console.log("✅ Authentication initialized");
          }
        });

        // Try to sign in anonymously to test if auth is enabled
        try {
          await this.auth.signInAnonymously();
          this.authEnabled = true;
          console.log(
            "✅ Firebase Authentication enabled (Anonymous + Email/Password)"
          );
        } catch (anonError) {
          // Anonymous auth failed - continue without it
          console.warn(
            "⚠️ Anonymous authentication failed, continuing without auth"
          );
          console.warn("   Error:", anonError.code);
          this.authEnabled = false;
          this.currentUser = {
            uid: "local-user",
            role: "user",
          };
          this.isInitialized = true;
        }

        // Wait a bit for auth state to settle
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (authError) {
        // Firebase Auth not enabled - use compatibility mode
        console.warn(
          "⚠️ Firebase Authentication not enabled. Running in compatibility mode."
        );
        console.error("Auth error details:", authError);

        this.authEnabled = false;
        this.loadLocalSession(); // Load any saved local session
        if (!this.currentUser) {
          this.currentUser = {
            uid: "local-user",
            role: "user",
          };
        }
        this.isInitialized = true;
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      // Fallback to compatibility mode
      this.authEnabled = false;
      this.loadLocalSession(); // Load any saved local session
      if (!this.currentUser) {
        this.currentUser = {
          uid: "local-user",
          role: "user",
        };
      }
      this.isInitialized = true;
    }
  }

  /**
   * Check if user is an admin
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
        console.log("✅ Admin credentials loaded from Firebase");
      } else {
        console.log("ℹ️ No credentials in Firebase, using defaults");
        // Try to save defaults
        try {
          await this.saveCredentialsToFirebase();
        } catch (saveError) {
          console.warn(
            "Could not save default credentials:",
            saveError.message
          );
        }
      }
    } catch (error) {
      console.warn("Could not load credentials from Firebase, using defaults");
      console.log("Default credentials: username='admin', password='admin123'");
      // Keep using the default credentials set in constructor
    }
  }

  /**
   * Save admin credentials to Firebase
   */
  async saveCredentialsToFirebase() {
    try {
      await this.configRef.set(this.adminCredentials);
    } catch (error) {
      console.error("Error saving credentials:", error);
    }
  }

  /**
   * Hash password
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
   * Login - works with or without Firebase Auth
   */
  async login(username, password) {
    try {
      const hashedPassword = this.hashPassword(password);

      console.log("🔐 Login attempt:");
      console.log("  Provided username:", username);
      console.log("  Expected username:", this.adminCredentials.username);
      console.log("  Provided password hash:", hashedPassword);
      console.log("  Expected password hash:", this.adminCredentials.password);
      console.log(
        "  Match:",
        username === this.adminCredentials.username &&
          hashedPassword === this.adminCredentials.password
      );

      // Verify credentials match stored credentials
      if (
        username !== this.adminCredentials.username ||
        hashedPassword !== this.adminCredentials.password
      ) {
        console.error("❌ Login failed: credentials don't match");
        return false;
      }

      console.log("✅ Credentials verified");

      // Use local admin mode (no Firebase auth needed)
      // Firebase Email/Password auth is problematic, so we skip it
      console.log("Using local admin mode");
      this.currentUser = {
        uid: "local-admin",
        role: "admin",
        username: username,
        loginTime: Date.now(),
      };
      this.saveLocalSession();
      console.log("✅ Admin login successful (local mode)");
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      this.currentUser = null;

      if (this.authEnabled) {
        await this.auth.signOut();
        await this.auth.signInAnonymously();
      } else {
        // Compatibility mode
        this.currentUser = {
          uid: "local-user",
          role: "user",
        };
        this.clearLocalSession();
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  /**
   * Check if user is admin
   */
  isAdmin() {
    return this.currentUser && this.currentUser.role === "admin";
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Wait for initialization
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
   * Change password
   */
  async changePassword(currentPassword, newPassword) {
    if (!this.isAdmin()) {
      return false;
    }

    const hashedCurrent = this.hashPassword(currentPassword);
    if (hashedCurrent !== this.adminCredentials.password) {
      return false;
    }

    // Update password hash in database
    this.adminCredentials.password = this.hashPassword(newPassword);
    await this.saveCredentialsToFirebase();

    // If using Firebase Auth, also update the Firebase user password
    if (this.authEnabled && this.auth.currentUser) {
      try {
        await this.auth.currentUser.updatePassword(newPassword);
        console.log("✅ Firebase user password updated");
      } catch (error) {
        console.warn("Could not update Firebase user password:", error);
        // This is okay - the database password is updated, which is what matters
      }
    }

    return true;
  }

  /**
   * Check if using default password
   */
  isDefaultPassword() {
    return this.adminCredentials.password === this.hashPassword("admin123");
  }

  /**
   * Save session to localStorage (compatibility mode)
   */
  saveLocalSession() {
    if (!this.authEnabled && this.currentUser) {
      localStorage.setItem(
        "localAdminSession",
        JSON.stringify(this.currentUser)
      );
    }
  }

  /**
   * Load session from localStorage (compatibility mode)
   */
  loadLocalSession() {
    if (!this.authEnabled) {
      const session = localStorage.getItem("localAdminSession");
      if (session) {
        try {
          this.currentUser = JSON.parse(session);
        } catch (e) {
          console.error("Failed to load session:", e);
        }
      }
    }
  }

  /**
   * Clear local session
   */
  clearLocalSession() {
    localStorage.removeItem("localAdminSession");
  }
}
