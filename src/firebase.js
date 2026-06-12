import { S, setS, load, save, q, registerSaveCallback, initState } from './state.js';


export let firebaseConfig = null;
export let db = null;
export let auth = null;
export let firebaseUnsub = null;
export let currentUser = null; // { uid, email, name, photoURL, isAnonymous, providerId }
export let guestUser = null;

let syncCallbacks = [];
let authCallbacks = [];

export function registerSyncCallback(cb) {
  syncCallbacks.push(cb);
}

export function registerAuthCallback(cb) {
  authCallbacks.push(cb);
}

export function loadFirebaseConfig() {
  try {
    const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const envDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
    const envDatabase = import.meta.env.VITE_FIREBASE_DATABASE_URL;
    const envProject = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    const envBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
    const envSender = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
    const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;
    const envMeasurement = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
    
    if (envKey && envKey.trim() !== '') {
      firebaseConfig = {
        apiKey: envKey,
        authDomain: envDomain,
        databaseURL: envDatabase,
        projectId: envProject,
        storageBucket: envBucket,
        messagingSenderId: envSender,
        appId: envAppId,
        measurementId: envMeasurement
      };
      return;
    }
    
    const raw = localStorage.getItem('financeos_firebase_config');
    if (raw) firebaseConfig = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading firebase config', e);
  }
}

export function saveFirebaseConfig(config) {
  if (config) {
    localStorage.setItem('financeos_firebase_config', JSON.stringify(config));
    firebaseConfig = config;
  } else {
    localStorage.removeItem('financeos_firebase_config');
    firebaseConfig = null;
  }
}

export function initFirebase() {
  if (firebaseUnsub) {
    firebaseUnsub();
    firebaseUnsub = null;
  }
  
  if (window.firebase && window.firebase.apps.length > 0) {
    window.firebase.apps.forEach(app => app.delete());
  }

  if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.log('Firebase not configured. Running in Local/Simulated Mode.');
    db = null;
    auth = null;
    return false;
  }

  try {
    window.firebase.initializeApp(firebaseConfig);
    db = window.firebase.firestore();
    auth = window.firebase.auth();
    console.log('Firebase initialized successfully!');
    
    auth.onAuthStateChanged(user => {
      if (user) {
        currentUser = {
          uid: user.uid,
          email: user.email || 'sem-email@financeos.app',
          name: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || null,
          isAnonymous: user.isAnonymous,
          providerId: user.providerData && user.providerData[0] ? user.providerData[0].providerId : 'password'
        };
        
        const loginScreen = q('#login-screen');
        if (loginScreen) loginScreen.style.display = 'none';
        
        updateUserProfileUI();
        syncWithFirestore(user.uid);
        authCallbacks.forEach(cb => cb(currentUser));
      } else {
        currentUser = null;
        if (!guestUser) {
          const loginScreen = q('#login-screen');
          if (loginScreen) loginScreen.style.display = 'flex';
        }
        authCallbacks.forEach(cb => cb(null));
      }
    });
    return true;
  } catch (e) {
    console.error('Failed to initialize Firebase:', e);
    db = null;
    auth = null;
    return false;
  }
}

export function checkGuestLogin(cbUpdateUI) {
  try {
    const raw = localStorage.getItem('financeos_guest_user');
    if (raw) {
      guestUser = JSON.parse(raw);
      currentUser = guestUser;
      
      const loginScreen = q('#login-screen');
      if (loginScreen) loginScreen.style.display = 'none';
      
      updateUserProfileUI();
      load();
      if (cbUpdateUI) cbUpdateUI();
      authCallbacks.forEach(cb => cb(currentUser));
    } else {
      if (!auth) {
        const loginScreen = q('#login-screen');
        if (loginScreen) loginScreen.style.display = 'flex';
      }
    }
  } catch (e) {
    console.error(e);
  }
}

export function loginWithGoogle() {
  if (auth) {
    const provider = new window.firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .catch(err => {
        console.error('Google Sign-in failed:', err);
        alert('Falha na autenticação do Google: ' + err.message);
      });
  } else {
    alert('Configurações do Firebase ausentes no arquivo .env! Adicione VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc. no .env para habilitar o Google Login.');
  }
}

export function loginWithEmail(email, password, isSignUp = false) {
  if (auth) {
    if (isSignUp) {
      auth.createUserWithEmailAndPassword(email, password)
        .catch(err => {
          console.error('Sign-up failed:', err);
          alert('Erro ao criar conta: ' + err.message);
        });
    } else {
      auth.signInWithEmailAndPassword(email, password)
        .catch(err => {
          console.error('Sign-in failed:', err);
          alert('Erro ao fazer login: ' + err.message);
        });
    }
  } else {
    alert('Configurações do Firebase ausentes no arquivo .env! Adicione as chaves no .env para habilitar login por E-mail/Senha.');
  }
}

export function loginAsGuest(cbUpdateUI) {
  console.log('Logging in as guest...');
  const mockUser = {
    uid: 'guest_user_local',
    email: 'local@financeos.app',
    name: 'Visitante Local',
    photoURL: null,
    isAnonymous: true,
    providerId: 'anonymous'
  };
  
  localStorage.setItem('financeos_guest_user', JSON.stringify(mockUser));
  guestUser = mockUser;
  currentUser = mockUser;
  
  const loginScreen = q('#login-screen');
  if (loginScreen) loginScreen.style.display = 'none';
  
  updateUserProfileUI();
  load();
  if (cbUpdateUI) cbUpdateUI();
  authCallbacks.forEach(cb => cb(currentUser));
}

export function sendPasswordReset(email) {
  if (auth) {
    return auth.sendPasswordResetEmail(email)
      .then(() => {
        alert('E-mail de redefinição de senha enviado com sucesso! Verifique sua caixa de entrada.');
      })
      .catch(err => {
        console.error('Password reset failed:', err);
        alert('Erro ao enviar e-mail de redefinição: ' + err.message);
        throw err;
      });
  } else {
    alert('Configurações do Firebase ausentes! Não foi possível enviar o e-mail de recuperação.');
    return Promise.reject(new Error('Firebase not initialized'));
  }
}

export function updateUserDisplayName(newName) {
  if (auth && auth.currentUser) {
    return auth.currentUser.updateProfile({ displayName: newName })
      .then(() => {
        currentUser.name = newName;
        updateUserProfileUI();
        save();
        alert('Nome atualizado com sucesso!');
      })
      .catch(err => {
        console.error('Failed to update display name:', err);
        alert('Erro ao atualizar nome: ' + err.message);
        throw err;
      });
  } else if (guestUser) {
    guestUser.name = newName;
    currentUser.name = newName;
    localStorage.setItem('financeos_guest_user', JSON.stringify(guestUser));
    updateUserProfileUI();
    alert('Nome do visitante atualizado com sucesso!');
    return Promise.resolve();
  } else {
    alert('Usuário não autenticado.');
    return Promise.reject(new Error('User not authenticated'));
  }
}

export function updateUserPassword(newPassword) {
  if (auth && auth.currentUser) {
    return auth.currentUser.updatePassword(newPassword)
      .then(() => {
        alert('Senha atualizada com sucesso!');
      })
      .catch(err => {
        console.error('Failed to update password:', err);
        alert('Erro ao atualizar senha: ' + err.message);
        throw err;
      });
  } else {
    alert('Alteração de senha não disponível para este tipo de login.');
    return Promise.reject(new Error('Function not available'));
  }
}

export function signOutUser() {
  const resetAndNavigate = () => {
    currentUser = null;
    guestUser = null;
    localStorage.removeItem('financeos_guest_user');
    if (firebaseUnsub) {
      firebaseUnsub();
      firebaseUnsub = null;
    }
    // Reset local state to blank on sign out
    setS(initState());
    save();
    
    const loginScreen = q('#login-screen');
    if (loginScreen) loginScreen.style.display = 'flex';
    authCallbacks.forEach(cb => cb(null));
  };

  if (auth && currentUser && !currentUser.isAnonymous) {
    auth.signOut()
      .then(resetAndNavigate)
      .catch(err => {
        console.error('Sign-out failed:', err);
        resetAndNavigate();
      });
  } else {
    resetAndNavigate();
  }
}

export function syncWithFirestore(uid) {
  if (!db) return;
  const docRef = db.collection('users').doc(uid);
  firebaseUnsub = docRef.onSnapshot(doc => {
    if (doc.exists) {
      const remoteData = doc.data();
      console.log('Data loaded from Firestore:', remoteData);
      setS(remoteData);
      syncCallbacks.forEach(cb => cb());
    } else {
      console.log('No data found in Firestore. Creating document with empty/default state.');
      const cleanState = initState();
      setS(cleanState);
      save();
      docRef.set(cleanState)
        .then(() => console.log('Firestore document created!'))
        .catch(err => console.error('Error creating firestore doc:', err));
    }
  }, err => {
    console.error('Firestore subscription error:', err);
  });
}

export function updateUserProfileUI() {
  if (!currentUser) return;
  const nameEl = q('#userName');
  const emailEl = q('#userEmail');
  const providerEl = q('#userProvider');
  const avatarEl = q('#userAvatar');
  
  if (nameEl) nameEl.textContent = currentUser.name;
  if (emailEl) emailEl.textContent = currentUser.email;
  
  if (providerEl) {
    if (currentUser.isAnonymous) {
      providerEl.textContent = 'Modo Convidado';
      providerEl.style.background = 'var(--s3)';
      providerEl.style.color = 'var(--tx2)';
    } else {
      const prov = currentUser.providerId || 'E-mail';
      providerEl.textContent = prov === 'google.com' ? 'Google OAuth' : 'Conta Firebase';
      providerEl.style.background = 'var(--acg)';
      providerEl.style.color = 'var(--acl)';
    }
  }
  
  if (avatarEl) {
    if (currentUser.photoURL) {
      avatarEl.innerHTML = `<img src="${currentUser.photoURL}" alt="Avatar">`;
    } else {
      const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '👤';
      avatarEl.textContent = initial;
    }
  }

  // Configure Profile Edit Inputs
  const passGroup = q('#profile-pass-group');
  if (passGroup) {
    if (currentUser.isAnonymous || currentUser.providerId === 'google.com') {
      passGroup.style.display = 'none';
    } else {
      passGroup.style.display = 'flex';
    }
  }
  const nameInput = q('#profile-name-input');
  if (nameInput) {
    nameInput.value = currentUser.name || '';
  }
}

// Hook state save to sync with firestore
registerSaveCallback((state) => {
  if (db && currentUser && !currentUser.isAnonymous) {
    db.collection('users').doc(currentUser.uid).set(state)
      .then(() => console.log('Saved to Firestore successfully'))
      .catch(err => console.error('Error saving to Firestore:', err));
  }
});
