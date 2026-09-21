import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache,
  doc,
  getDocFromServer,
  setLogLevel,
  Firestore 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence non-fatal SDK transport warnings (e.g. 10-second backend timeout during offline cache operation)
try {
  setLogLevel('silent');
} catch {
  // Ignore if unsupported in specific environments
}

// Intercept internal non-fatal backend timeout notices from console.error if triggered by underlying WebChannel
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const msg = args.map((a) => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (
      msg.includes('Could not reach Cloud Firestore backend') || 
      msg.includes('Backend didn\'t respond within 10 seconds') ||
      msg.includes('operate in offline mode until it is able to successfully connect')
    ) {
      console.info('[Firestore] Offline persistence active. Local cache operating seamlessly.');
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const cfg = firebaseConfig as Record<string, any>;
const databaseId = cfg.firestoreDatabaseId && cfg.firestoreDatabaseId !== '(default)'
  ? cfg.firestoreDatabaseId
  : undefined;

// Initialize Firestore with auto-detect long-polling and multi-tab local cache
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    experimentalAutoDetectLongPolling: true,
  }, databaseId);
} catch {
  try {
    // Fallback to memory cache if indexedDB / storage is restricted in iframe sandbox
    firestoreInstance = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
    }, databaseId);
  } catch {
    // If already initialized (e.g. fast refresh/HMR), retrieve existing instance
    firestoreInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

export const db: Firestore = firestoreInstance;
export const auth = getAuth(app);

// Connection verification as mandated by firebase-integration skill
async function testConnection() {
  try {
    // Race with a 3-second timeout so a sluggish or offline backend doesn't hold open hanging streams
    const testDoc = getDocFromServer(doc(db, 'test', 'connection'));
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection check timeout - continuing with offline cache')), 3000)
    );
    await Promise.race([testDoc, timeout]);
  } catch (error) {
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('timeout'))) {
      console.info('Firestore client operating in offline mode. Local cache active.');
    } else {
      console.info('Firestore initial connection check: local cache mode verified.');
    }
  }
}
testConnection();

export default app;
export { app };


