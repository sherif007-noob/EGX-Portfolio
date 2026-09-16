import 'dotenv/config';
import { runFirestoreSupabaseMigration } from '../src/services/firestoreSupabaseMigrationServer';

const required = [
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'FIREBASE_ADMIN_OWNER_UID',
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing migration environment variables: ${missing.join(', ')}`);
}

if (!process.env.SUPABASE_SECRET_KEY!.startsWith('sb_secret_')) {
  throw new Error('SUPABASE_SECRET_KEY must be a current Supabase secret key (sb_secret_...).');
}

runFirestoreSupabaseMigration({
  confirm: true,
  onProgress: (event) => console.log(`[migration] ${event.phase}: ${event.message}`),
})
  .then((result) => {
    if (!result.reconciliation.passed) {
      console.error('Migration completed with reconciliation mismatches. Do not switch the application to Supabase.');
      process.exitCode = 1;
      return;
    }
    console.log('Migration completed and reconciliation passed.');
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
