import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const resolvedFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
};

const resolvedFirestoreDatabaseId =
  import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;

const app = getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig);
export const db = getFirestore(app, resolvedFirestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account',
});

let persistencePromise: Promise<void> | null = null;

export function ensureAuthPersistence(): Promise<void> {
  if (!persistencePromise) {
    persistencePromise = setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('Não foi possível definir persistência local do Firebase Auth:', err);
    });
  }
  return persistencePromise;
}

ensureAuthPersistence();

function extractFirebaseErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  const msg = error instanceof Error ? error.message : String(error || '');
  const match = msg.match(/auth\/[a-z0-9-]+/i);
  return match ? match[0].toLowerCase() : '';
}

export function mapFirebaseAuthError(error: unknown): string {
  const code = extractFirebaseErrorCode(error);
  const currentHostname =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'este domínio';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `O domínio "${currentHostname}" não está autorizado no Firebase Authentication. Adicione "${currentHostname}" em Firebase Console → Projeto "${resolvedFirebaseConfig.projectId}" → Authentication → Settings → Authorized domains.`;
    case 'auth/popup-closed-by-user':
      return 'A janela de login do Google foi fechada antes da conclusão. Tente novamente.';
    case 'auth/cancelled-popup-request':
      return 'Já existe uma janela de autenticação aberta. Conclua o acesso ou tente novamente.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de login do Google. Libere os popups para este site e tente novamente.';
    case 'auth/operation-not-allowed':
      return 'O login com Google está desativado no Firebase Authentication deste projeto.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'A chave de API do Firebase configurada neste ambiente é inválida.';
    case 'auth/network-request-failed':
      return 'Falha de comunicação com os servidores do Google/Firebase. Verifique sua conexão e tente novamente.';
    case 'auth/account-exists-with-different-credential':
      return 'Este e-mail já está cadastrado com outro método de acesso.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada no Firebase Authentication.';
    default: {
      const rawMessage = error instanceof Error ? error.message : String(error || '');
      return rawMessage
        ? `Não foi possível entrar com o Google (${code || 'erro de autenticação'}): ${rawMessage}`
        : 'Não foi possível autenticar com a conta Google. Tente novamente.';
    }
  }
}

export async function signInWithGoogle(): Promise<
  { method: 'popup'; user: User } | { method: 'redirect' }
> {
  await ensureAuthPersistence();
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return { method: 'popup', user: credential.user };
  } catch (error) {
    const code = extractFirebaseErrorCode(error);
    const isTopLevelWindow = typeof window !== 'undefined' && window.self === window.top;
    if (
      isTopLevelWindow &&
      (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment')
    ) {
      await signInWithRedirect(auth, googleProvider);
      return { method: 'redirect' };
    }
    throw error;
  }
}

export async function consumeGoogleRedirectResult(): Promise<{
  user: User | null;
  errorMessage: string | null;
}> {
  try {
    await ensureAuthPersistence();
    const result = await getRedirectResult(auth);
    return { user: result?.user ?? null, errorMessage: null };
  } catch (error) {
    return { user: null, errorMessage: mapFirebaseAuthError(error) };
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Verifique a configuração do Firebase: o cliente está offline.');
    }
  }
}

testConnection();
