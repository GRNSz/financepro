import { S, setS, load, save, q, registerSaveCallback, initState } from './state.js';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';


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
    window.addDevLog?.('Initializing Firebase...', 'info');
    window.firebase.initializeApp(firebaseConfig);
    db = window.firebase.firestore();
    auth = window.firebase.auth();
    console.log('Firebase initialized successfully!');
    window.addDevLog?.('Firebase initialized successfully!', 'success');
    
    const isTauri = typeof window.__TAURI__ !== 'undefined' || typeof window.__TAURI_INTERNALS__ !== 'undefined';
    const hasPendingRedirect = localStorage.getItem('firebase_pending_redirect') === 'true';

    window.addDevLog?.(`Environment check: isTauri=${isTauri}, hasPendingRedirect=${hasPendingRedirect}`, 'info');

    if (isTauri && hasPendingRedirect) {
      window.addDevLog?.('Tauri environment & pending redirect detected. Calling getRedirectResult...', 'info');
      window.showGlobalLoader?.("Concluindo login...");
      auth.getRedirectResult()
        .then(result => {
          if (result && result.user) {
            window.addDevLog?.(`Google redirect authenticated successfully: ${result.user.email} (${result.user.uid})`, 'success');
            console.log('Successfully authenticated via Google redirect inside Tauri:', result.user);
          } else {
            window.addDevLog?.('getRedirectResult resolved but returned null (no redirect user credential found).', 'warn');
          }
          localStorage.removeItem('firebase_pending_redirect');
        })
        .catch(err => {
          window.addDevLog?.(`getRedirectResult error: ${err.message}`, 'error');
          console.error('Failed to get redirect result:', err);
          localStorage.removeItem('firebase_pending_redirect');
          window.hideGlobalLoader?.();
          alert('Falha ao concluir autenticação por redirecionamento: ' + err.message);
        })
        .finally(() => {
          window.hideGlobalLoader?.();
        });
    }
    
    auth.onAuthStateChanged(user => {
      if (user) {
        window.addDevLog?.(`onAuthStateChanged: User logged in: ${user.email} (${user.uid})`, 'info');
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
        window.addDevLog?.('onAuthStateChanged: No user logged in (user is null)', 'info');
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
    window.addDevLog?.(`Firebase init crash: ${e.message}`, 'error');
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
    const isCapacitor = !!window.Capacitor && window.Capacitor.isNative;
    if (isCapacitor) {
      FirebaseAuthentication.signInWithGoogle()
        .then(result => {
          if (result && result.credential && result.credential.idToken) {
            const credential = window.firebase.auth.GoogleAuthProvider.credential(result.credential.idToken);
            return auth.signInWithCredential(credential);
          } else {
            throw new Error('ID Token não retornado pelo provedor Google.');
          }
        })
        .catch(err => {
          console.error('Native Google Sign-in failed:', err);
          window.hideGlobalLoader?.();
          alert('Falha no login com Google nativo: ' + err.message);
        });
      return;
    }
    
    const isTauri = typeof window.__TAURI__ !== 'undefined' || typeof window.__TAURI_INTERNALS__ !== 'undefined';
    const provider = new window.firebase.auth.GoogleAuthProvider();

    if (isTauri) {
      console.log('Running in Tauri. Starting external browser Google Sign-in flow...');
      window.addDevLog?.('Running in Tauri. Starting external browser Google Sign-in...', 'info');
      window.showGlobalLoader?.("Aguardando login no seu navegador de internet...");

      // Gerar um ID de sessão único e randômico
      const sessionId = 'tauri_login_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Definir a URL ponte. Em desenvolvimento usa localhost:5173, em produção usa o domínio principal.
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isDev ? 'http://localhost:5173' : 'https://financeos-d033a.firebaseapp.com';
      
      const configParams = `&apiKey=${encodeURIComponent(firebaseConfig.apiKey)}` +
        `&authDomain=${encodeURIComponent(firebaseConfig.authDomain)}` +
        `&projectId=${encodeURIComponent(firebaseConfig.projectId)}` +
        `&storageBucket=${encodeURIComponent(firebaseConfig.storageBucket || '')}` +
        `&messagingSenderId=${encodeURIComponent(firebaseConfig.messagingSenderId || '')}` +
        `&appId=${encodeURIComponent(firebaseConfig.appId || '')}` +
        `&measurementId=${encodeURIComponent(firebaseConfig.measurementId || '')}`;

      const redirectUrl = `${baseUrl}/tauri-auth.html?sessionId=${sessionId}${configParams}`;

      window.addDevLog?.(`Session ID: ${sessionId}. Opening URL (config params hidden in logs for security)`, 'info');

      // Escutar credenciais na sessão do Firestore
      const sessionRef = db.collection('login_sessions').doc(sessionId);
      const unsubscribeSession = sessionRef.onSnapshot(doc => {
        if (doc.exists) {
          const data = doc.data();
          if (data && data.idToken) {
            window.addDevLog?.('Google credential token received from Firestore bridge!', 'success');
            window.showGlobalLoader?.("Autenticando sessão no aplicativo...");

            // Cancela inscrição
            unsubscribeSession();
            
            const cBtn = document.getElementById('loader-cancel-btn');
            if (cBtn) cBtn.remove();

            // Reconstrói a credencial Google
            const credential = window.firebase.auth.GoogleAuthProvider.credential(data.idToken, data.accessToken || null);
            
            // Loga no Firebase do aplicativo
            auth.signInWithCredential(credential)
              .then(result => {
                window.addDevLog?.(`Successfully authenticated via bridge: ${result.user.email}`, 'success');
                sessionRef.delete().catch(err => console.error('Error deleting session document:', err));
              })
              .catch(err => {
                window.addDevLog?.(`Failed to sign in with bridge credential: ${err.message}`, 'error');
                console.error(err);
                alert('Erro ao concluir o login: ' + err.message);
              })
              .finally(() => {
                window.hideGlobalLoader?.();
              });
          }
        }
      }, err => {
        window.addDevLog?.(`Firestore session listener error: ${err.message}`, 'error');
        console.error(err);
      });

      // Adicionar botão Cancelar ao loader
      const loaderContainer = document.querySelector('#global-loader .loader-container');
      let cancelBtn = document.getElementById('loader-cancel-btn');
      if (loaderContainer && !cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'loader-cancel-btn';
        cancelBtn.innerText = 'Cancelar';
        cancelBtn.style.background = 'transparent';
        cancelBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        cancelBtn.style.color = '#ff7675';
        cancelBtn.style.padding = '6px 16px';
        cancelBtn.style.borderRadius = '8px';
        cancelBtn.style.marginTop = '16px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.fontSize = '13px';
        cancelBtn.style.transition = 'all 0.2s';
        cancelBtn.addEventListener('click', () => {
          unsubscribeSession();
          window.hideGlobalLoader?.();
          cancelBtn.remove();
          window.addDevLog?.('Bridge login cancelled by user.', 'info');
        });
        loaderContainer.appendChild(cancelBtn);
      }

      // Timeout de segurança de 3 minutos
      const timeoutId = setTimeout(() => {
        unsubscribeSession();
        window.hideGlobalLoader?.();
        const cBtn = document.getElementById('loader-cancel-btn');
        if (cBtn) cBtn.remove();
        window.addDevLog?.('Bridge login timed out after 3 minutes.', 'warn');
      }, 180000);

      // Invocar o comando do Rust para abrir o browser padrão
      if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
        window.__TAURI__.core.invoke('open_external_url', { url: redirectUrl })
          .catch(err => {
            window.addDevLog?.(`Rust open_external_url failed: ${err}`, 'error');
            console.error('Failed to open external url via Rust command:', err);
            window.open(redirectUrl, '_blank');
          });
      } else {
        window.addDevLog?.('window.__TAURI__ or invoke function not found. Using window.open fallback.', 'warn');
        window.open(redirectUrl, '_blank');
      }

      return;
    }

    auth.signInWithPopup(provider)
      .catch(err => {
        console.error('Google Sign-in failed:', err);
        window.hideGlobalLoader?.();
        if (err.code === 'auth/popup-blocked') {
          alert('O popup de login foi bloqueado pelo seu navegador. Por favor, libere popups para esta página ou faça login utilizando e-mail e senha.');
        } else {
          alert('Falha na autenticação do Google: ' + err.message);
        }
      });
  } else {
    window.hideGlobalLoader?.();
    alert('Configurações do Firebase ausentes no arquivo .env! Adicione VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc. no .env para habilitar o Google Login.');
  }
}

export function loginWithEmail(email, password, isSignUp = false) {
  if (auth) {
    if (isSignUp) {
      auth.createUserWithEmailAndPassword(email, password)
        .catch(err => {
          console.error('Sign-up failed:', err);
          window.hideGlobalLoader?.();
          alert('Erro ao criar conta: ' + err.message);
        });
    } else {
      auth.signInWithEmailAndPassword(email, password)
        .catch(err => {
          console.error('Sign-in failed:', err);
          window.hideGlobalLoader?.();
          alert('Erro ao fazer login: ' + err.message);
        });
    }
  } else {
    window.hideGlobalLoader?.();
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
    
    const syncCard = q('#profile-sync-card');
    if (syncCard) syncCard.style.display = 'none';
    
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
  if (!db) {
    window.addDevLog?.('syncWithFirestore called but db is null.', 'error');
    return;
  }
  window.addDevLog?.(`syncWithFirestore: Starting sync for uid=${uid}`, 'info');
  window.showGlobalLoader?.("Sincronizando dados com a Nuvem...");
  const docRef = db.collection('users').doc(uid);
  firebaseUnsub = docRef.onSnapshot(doc => {
    window.addDevLog?.(`Firestore onSnapshot event triggered. Doc exists: ${doc.exists}`, 'info');
    window.hideGlobalLoader?.();
    if (doc.exists) {
      const remoteData = doc.data();
      console.log('Data loaded from Firestore:', remoteData);
      window.addDevLog?.(`Data loaded from Firestore successfully. accounts=${remoteData.accounts?.length || 0}, transactions=${remoteData.transactions?.length || 0}`, 'success');
      try {
        setS(remoteData);
        window.addDevLog?.('Local state updated from Firestore successfully.', 'success');
      } catch (err) {
        window.addDevLog?.(`Failed to update local state (setS failed): ${err.message}`, 'error');
      }
      syncCallbacks.forEach(cb => {
        try { cb(); } catch (e) { window.addDevLog?.(`Sync callback crash: ${e.message}`, 'error'); }
      });
    } else {
      console.log('No data found in Firestore. Creating document with current local state.');
      window.addDevLog?.('No document found in Firestore. Uploading current local state to cloud...', 'warn');
      docRef.set(S)
        .then(() => {
          window.addDevLog?.('Firestore document created successfully with local state!', 'success');
          console.log('Firestore document created successfully with local state!');
          syncCallbacks.forEach(cb => {
            try { cb(); } catch (e) { window.addDevLog?.(`Sync callback crash: ${e.message}`, 'error'); }
          });
        })
        .catch(err => {
          window.addDevLog?.(`Error creating Firestore document: ${err.message}`, 'error');
          console.error('Error creating firestore doc:', err);
        });
    }
  }, err => {
    window.hideGlobalLoader?.();
    window.addDevLog?.(`Firestore subscription error (onSnapshot failed): ${err.message}`, 'error');
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
  const syncCard = q('#profile-sync-card');
  if (syncCard) {
    syncCard.style.display = currentUser.isAnonymous ? 'none' : 'block';
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

export function deleteAccountAndData() {
  const clearLocalStorageAndReset = () => {
    localStorage.removeItem('financeos_guest_user');
    localStorage.removeItem('financeos_v4');
    localStorage.removeItem('financeos_pin_code');
    localStorage.removeItem('financeos_pin_enabled');
    localStorage.removeItem('financeos_stealth');
    localStorage.removeItem('financeos_stealth_activated');
    localStorage.removeItem('financeos_notifications');
    localStorage.removeItem('financeos_gcal_sync');
    
    // Reset state to empty
    setS(initState());
    save();
    
    currentUser = null;
    guestUser = null;
    
    if (firebaseUnsub) {
      firebaseUnsub();
      firebaseUnsub = null;
    }
    
    const syncCard = q('#profile-sync-card');
    if (syncCard) syncCard.style.display = 'none';
    
    const loginScreen = q('#login-screen');
    if (loginScreen) loginScreen.style.display = 'flex';
    
    authCallbacks.forEach(cb => cb(null));
  };

  // 1. If not authenticated or is anonymous (Guest/Local)
  if (!auth || !currentUser || currentUser.isAnonymous) {
    clearLocalStorageAndReset();
    return Promise.resolve();
  }

  // 2. Firebase User
  const uidToDelete = currentUser.uid;
  const userObj = auth.currentUser;
  
  if (firebaseUnsub) {
    firebaseUnsub();
    firebaseUnsub = null;
  }
  
  // A. First delete Firestore document
  return db.collection('users').doc(uidToDelete).delete()
    .then(() => {
      console.log('Firestore user data deleted successfully.');
      // B. Then delete Auth account
      return userObj.delete();
    })
    .then(() => {
      console.log('Auth user deleted successfully.');
      // C. Clear local state and redirect
      clearLocalStorageAndReset();
    })
    .catch(err => {
      console.error('Error in deleteAccountAndData:', err);
      // Re-throw to handle in main.js
      throw err;
    });
}
