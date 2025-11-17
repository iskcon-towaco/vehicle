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
      // Load credentials from Firebase
      await this.loadCredentialsFromFirebase();

      // Try to enable Firebase Auth
      try {
        // Listen for auth state changes first
        this.auth.onAuthStateChanged(async (user) => {
          if (user) {
            // User is signed in (either anonymous or email/password)
            await this.checkAdminStatus(user.uid);
          } else {
            // No user signed in, sign in anonymously
            try {
              await this.auth.signInAnonymously();
            } catch (anonError) {
              console.error("Anonymous sign-in failed:", anonError);
            }
          }
          this.isInitialized = true;
        });

        // Try to sign in anonymously to test if auth is enabled
        await this.auth.signInAnonymously();
        this.authEnabled = true;
        console.log(
          "✅ Firebase Authentication enabled (Anonymous + Email/Password)"
        );
      } catch (authError) {
        // Firebase Auth not enabled - use compatibility mode
        console.warn(
          "⚠️ Firebase Authentication not enabled. Running in compatibility mode."
        );
        console.warn(
          "   Enable Firebase Auth for better security. See QUICK_START_SECURITY.md"
        );

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
      } else {
        await this.saveCredentialsToFirebase();
      }
    } catch (error) {
      console.error("Error loading credentials:", error);
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

      // Verify credentials match stored credentials
      if (
        username !== this.adminCredentials.username ||
        hashedPassword !== this.adminCredentials.password
      ) {
        return false;
      }

      if (this.authEnabled) {
        // Use Firebase Authentication with Email/Password
        const email = `${username}@temple.local`;

        try {
          // Try to sign in with existing account
          const credential = await this.auth.signInWithEmailAndPassword(
            email,
            password
          );

          // Mark user as admin in database
          await database.ref(`admins/${credential.user.uid}`).set({
            username: username,
            email: email,
            createdAt: Date.now(),
          });

          await this.checkAdminStatus(credential.user.uid);
          return true;
        } catch (error) {
          if (
            error.code === "auth/user-not-found" ||
            error.code === "auth/wrong-password"
          ) {
            // Create new admin user account
            try {
              const credential = await this.auth.createUserWithEmailAndPassword(
                email,
                password
              );

              // Mark user as admin in database
              await database.ref(`admins/${credential.user.uid}`).set({
                username: username,
                email: email,
                createdAt: Date.now(),
              });

              await this.checkAdminStatus(credential.user.uid);
              console.log("✅ Admin account created in Firebase");
              return true;
            } catch (createError) {
              console.error("Error creating admin account:", createError);
              throw createError;
            }
          }
          throw error;
        }
      } else {
        // Compatibility mode - local session only
        this.currentUser = {
          uid: "local-admin",
          role: "admin",
          username: username,
          loginTime: Date.now(),
        };
        this.saveLocalSession();
        return true;
      }
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
