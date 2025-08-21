import { auth } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateEmail } from 'firebase/auth';

/**
 * Create a new Firebase Auth account for a staff member
 */
export const createStaffAuthAccount = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email.toLowerCase(), password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Error creating Firebase Auth account:', error);
    return { success: false, error: error.message, code: error.code };
  }
};

/**
 * Check if an email is already in use in Firebase Auth
 */
export const checkEmailAvailability = async (email) => {
  try {
    // Try to create a temporary account to check availability
    const tempPassword = 'TempPassword123!';
    const userCredential = await createUserWithEmailAndPassword(auth, email.toLowerCase(), tempPassword);
    
    // If successful, delete the temporary account
    await userCredential.user.delete();
    
    return { available: true };
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      return { available: false, error: 'Email already in use' };
    }
    return { available: false, error: error.message };
  }
};

/**
 * Generate a secure password for staff members
 */
export const generateSecurePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * Get instructions for staff member email update
 */
export const getEmailUpdateInstructions = (oldEmail, newEmail) => {
  return {
    title: 'Email Update Instructions',
    steps: [
      `1. Login with your OLD email: ${oldEmail}`,
      `2. Go to your profile settings`,
      `3. Update your email address to: ${newEmail}`,
      `4. Use the new email for future logins`
    ],
    note: 'Firebase Auth requires you to be logged in to change your email address.',
    alternative: 'Contact your admin if you need immediate access with the new email.'
  };
};
