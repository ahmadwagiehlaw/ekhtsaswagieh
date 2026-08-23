import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { auth, db, USERS_DIRECTORY_REF } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); // { role: 'super_admin'|'consultant'|'employee', tenantId: '...' }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Fetch user data from directory
        try {
          const userDocRef = doc(USERS_DIRECTORY_REF, user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            if (data.banned) {
              await signOut(auth);
              setCurrentUser(null);
              setUserData(null);
              setLoading(false);
              return;
            }
            setUserData({ ...data, uid: user.uid });
          } else {
            // Fallback: If no directory entry, but email matches Super Admin
            const superAdminEmail = import.meta.env.VITE_SUPER_ADMIN_EMAIL;
            if (superAdminEmail && user.email === superAdminEmail) {
              const defaultSuperAdminData = { role: 'super_admin', tenantId: 'tenant_main', email: user.email };
              await setDoc(userDocRef, defaultSuperAdminData);
              setUserData(defaultSuperAdminData);
            } else {
              setUserData({ role: 'unknown', tenantId: 'unknown' });
            }
          }
        } catch (error) {
          console.error("Error fetching user directory data:", error);
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const signup = async (email, password, role, tenantId) => {
    // Note: Creating a user here logs them in automatically in the browser.
    // This function should be used carefully (e.g., when a consultant signs up with an invite code).
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create directory entry
    await setDoc(doc(USERS_DIRECTORY_REF, user.uid), {
      email: user.email,
      role: role,
      tenantId: tenantId
    });
    
    return userCredential;
  };

  const changePassword = async (newPassword) => {
    if (!currentUser) throw new Error("No user logged in");
    return updatePassword(currentUser, newPassword);
  };

  const value = {
    currentUser,
    userData,
    loading,
    login,
    logout,
    signup,
    changePassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
