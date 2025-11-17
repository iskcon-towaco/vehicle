# ISKCON Towaco - Vehicle License Plate System

A mobile-friendly web application to help temple visitors manage parking and contact vehicle owners when needed.

## Overview

This system allows temple visitors to register their vehicle information and search for vehicles by license plate number, while keeping personal information secure and private.

## The Problem We Solve

- **Parking Space Issues**: Visitors often occupy 2 spaces to avoid being blocked in
- **Communication Gap**: No easy way to contact vehicle owners when blocked
- **Privacy Concerns**: Previous solutions (Google Docs) exposed personal information publicly

## Features

### For All Users

- ✅ Register vehicle with license plate, name, and phone number
- ✅ Search vehicles by license plate number
- ✅ OCR support - take a photo and automatically read plate number
- ✅ Mobile-friendly responsive design
- ✅ Privacy protection - names and phones are redacted for non-admins

### For Admins

- ✅ View full contact information
- ✅ Search by owner name
- ✅ Delete outdated records
- ✅ Change admin password
- ✅ Configure OCR API settings

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla JS)
- **Database**: Firebase Realtime Database
- **Authentication**: Firebase Authentication (Anonymous + Email/Password)
- **OCR**: Tesseract.js (with optional Plate Recognizer API)
- **Hosting**: GitHub Pages

## Quick Start

### Prerequisites

- Firebase project set up
- GitHub account for hosting

### Setup

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd vehicle-plate-system
   ```

2. **Configure Firebase**

   - Update `firebase-config.js` with your Firebase credentials
   - Get credentials from: Firebase Console → Project Settings → Your apps

3. **Deploy Firebase Rules**

   - Go to Firebase Console → Realtime Database → Rules
   - Copy contents of `database.rules.json`
   - Paste and click "Publish"

4. **Enable Firebase Authentication**

   - Go to Firebase Console → Authentication
   - Enable "Anonymous" sign-in method
   - Enable "Email/Password" sign-in method

5. **Deploy to GitHub Pages**
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push origin main
   ```
   - Enable GitHub Pages in repository settings
   - Select branch: main
   - Your app will be live at: `https://yourusername.github.io/repo-name/`

## Default Admin Credentials

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **IMPORTANT**: Change the default password after first login!

## Usage

### For Regular Users

1. Open the app on your mobile device
2. Take a photo of your license plate (optional - OCR will read it)
3. Verify/enter your plate number
4. Add your name and phone number
5. Submit

To find a vehicle:

1. Enter the license plate number in search
2. View the vehicle information (name and phone are partially hidden)
3. Contact an admin if you need to reach the owner

### For Admins

1. Click "Admin Login"
2. Enter credentials
3. After login:
   - See full names and phone numbers
   - Delete outdated entries
   - Search by owner name
   - Change password in Settings

## File Structure

```
vehicle-plate-system/
├── index.html              # Main HTML file
├── styles.css              # Responsive styles
├── firebase-config.js      # Firebase configuration
├── auth-compat.js          # Authentication manager
├── storage.js              # Database operations
├── app.js                  # Main application logic
├── ui.js                   # UI rendering
├── form.js                 # Form handling & OCR
├── search.js               # Search functionality
├── config.js               # Configuration UI
├── database.rules.json     # Firebase security rules
└── README.md               # This file
```

## Security

### Current Security Level: Medium

**What's Protected:**

- ✅ Data is redacted in the UI for non-admins
- ✅ Only authenticated users can write/modify data
- ✅ Admin features require login
- ✅ Firebase security rules enforce access control

**What's Not Protected:**

- ⚠️ Determined users can bypass UI redaction via browser console
- ⚠️ All data is downloaded to every user's browser

**Is This Acceptable?**
For a temple parking coordination app with trusted users: **Yes**

- Similar security to shared Google Docs
- Appropriate for the use case
- Balances convenience with reasonable privacy

### For Maximum Security

If you need server-side data redaction, you can deploy Cloud Functions (not included in this simplified version).

## Firebase Rules

The app uses these Firebase Realtime Database rules:

```json
{
  "rules": {
    "records": {
      ".read": true,
      ".write": "auth != null",
      ".indexOn": ["plateNumber"]
    },
    "admins": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null"
      }
    },
    "config": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

## Troubleshooting

### Records Not Loading

1. Check Firebase Console → Realtime Database → Rules are deployed
2. Verify Firebase Authentication is enabled (Anonymous + Email/Password)
3. Check browser console (F12) for errors
4. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Admin Login Not Working

1. Make sure you're using correct credentials (default: admin/admin123)
2. Check browser console for error messages
3. Try resetting password in Firebase Console → Realtime Database → config/adminCredentials

### OCR Not Working

1. OCR uses Tesseract.js by default (works offline)
2. For better accuracy, get a free API key from [Plate Recognizer](https://platerecognizer.com)
3. Add API key in Settings after logging in as admin

## Browser Support

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

This is a community project for ISKCON Towaco temple. Contributions are welcome!

## License

This project is open source and available for use by other temples or organizations.

## Support

For issues or questions, please open an issue on GitHub or contact the temple administration.

---

**Built with care for the ISKCON Towaco community** 🙏
