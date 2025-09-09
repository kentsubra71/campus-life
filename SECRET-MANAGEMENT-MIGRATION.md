# CRITICAL: Secret Management Migration Plan

## Current Risk Assessment
🔴 **CRITICAL VULNERABILITIES IDENTIFIED**:
1. API keys potentially exposed in client bundle
2. Environment files may be committed to Git
3. No centralized secret rotation
4. Hardcoded secrets in Cloud Functions

## Immediate Actions Required (< 24 hours)

### 1. Audit Current Secret Exposure

```bash
# CRITICAL: Check for secrets in Git history
git log --patch | grep -i "api.key\|secret\|password\|token" > secret_audit.txt

# Check for secrets in current codebase
grep -r -i "api.key\|secret\|password\|token" src/ --include="*.ts" --include="*.tsx" > current_secrets.txt

# Check environment files
find . -name "*.env*" -o -name "*.config.*" | xargs grep -l "=" > env_files.txt
```

### 2. Google Secret Manager Setup

```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create service account for Secret Manager
gcloud iam service-accounts create secret-manager-accessor \
    --display-name="Secret Manager Accessor"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:secret-manager-accessor@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 3. Migrate Critical Secrets

```bash
# Create secrets in Secret Manager
echo -n "YOUR_PAYPAL_CLIENT_ID" | gcloud secrets create paypal-client-id --data-file=-
echo -n "YOUR_PAYPAL_CLIENT_SECRET" | gcloud secrets create paypal-client-secret --data-file=-
echo -n "YOUR_PAYPAL_WEBHOOK_SECRET" | gcloud secrets create paypal-webhook-secret --data-file=-
echo -n "YOUR_FIREBASE_PRIVATE_KEY" | gcloud secrets create firebase-private-key --data-file=-

# For Firebase Cloud Functions
echo -n "YOUR_ENCRYPTION_KEY" | gcloud secrets create app-encryption-key --data-file=-
```

## Updated Environment Configuration

### functions/.env.example
```bash
# CRITICAL: Example only - never commit actual values
PAYPAL_ENVIRONMENT=sandbox
FIREBASE_PROJECT_ID=your-project-id
ENCRYPTION_ALGORITHM=aes-256-gcm

# All secrets should be in Google Secret Manager:
# - paypal-client-id
# - paypal-client-secret  
# - paypal-webhook-secret
# - firebase-private-key
# - app-encryption-key
```

### Secure Cloud Function Configuration

```typescript
// functions/src/config/secrets.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretClient = new SecretManagerServiceClient();
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

interface SecretCache {
  [key: string]: { value: string; expiry: number };
}

const secretCache: SecretCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSecret(secretName: string): Promise<string> {
  const cacheKey = secretName;
  const now = Date.now();
  
  // Check cache first
  if (secretCache[cacheKey] && secretCache[cacheKey].expiry > now) {
    return secretCache[cacheKey].value;
  }
  
  try {
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name });
    
    if (!version.payload?.data) {
      throw new Error(`Secret ${secretName} has no data`);
    }
    
    const secretValue = version.payload.data.toString();
    
    // Cache the secret
    secretCache[cacheKey] = {
      value: secretValue,
      expiry: now + CACHE_TTL,
    };
    
    return secretValue;
    
  } catch (error) {
    console.error(`Failed to get secret ${secretName}:`, error);
    throw new Error(`Failed to retrieve secret: ${secretName}`);
  }
}

// Preload critical secrets on cold start
export async function preloadSecrets(): Promise<void> {
  const criticalSecrets = [
    'paypal-client-id',
    'paypal-client-secret',
    'paypal-webhook-secret',
  ];
  
  await Promise.all(
    criticalSecrets.map(secret => 
      getSecret(secret).catch(err => 
        console.error(`Failed to preload ${secret}:`, err)
      )
    )
  );
}
```

## Client-Side Security Configuration

### src/config/environment.ts
```typescript
// CRITICAL: Client-side configuration - NO SECRETS
interface Environment {
  firebase: {
    apiKey: string; // This is safe to expose (it's not a secret)
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  paypal: {
    environment: 'sandbox' | 'live';
    // CLIENT_ID only (not secret) - loaded from Expo config
  };
  api: {
    baseUrl: string;
  };
}

// Load from Expo config (expo-constants)
import Constants from 'expo-constants';

export const environment: Environment = {
  firebase: {
    apiKey: Constants.expoConfig?.extra?.firebaseApiKey || '',
    authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || '',
    projectId: Constants.expoConfig?.extra?.firebaseProjectId || '',
    storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || '',
    messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || '',
    appId: Constants.expoConfig?.extra?.firebaseAppId || '',
  },
  paypal: {
    environment: (Constants.expoConfig?.extra?.paypalEnvironment as 'sandbox' | 'live') || 'sandbox',
  },
  api: {
    baseUrl: Constants.expoConfig?.extra?.apiBaseUrl || '',
  },
};

// Validation
const requiredFields = [
  'firebase.apiKey',
  'firebase.authDomain', 
  'firebase.projectId',
];

for (const field of requiredFields) {
  const value = field.split('.').reduce((obj, key) => obj?.[key], environment);
  if (!value) {
    throw new Error(`Missing required environment variable: ${field}`);
  }
}
```

### app.config.js (Expo configuration)
```javascript
// CRITICAL: Only non-secret values here
export default {
  expo: {
    name: "Campus Life",
    slug: "campus-life",
    // ... other config
    extra: {
      // These are NOT secrets - safe to include in client bundle
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      paypalEnvironment: process.env.EXPO_PUBLIC_PAYPAL_ENVIRONMENT,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    }
  }
};
```

## CI/CD Security Integration

### .github/workflows/security-scan.yml
```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: TruffleHog OSS
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
          extra_args: --debug --only-verified
          
      - name: GitGuardian scan
        uses: GitGuardian/ggshield-action@v1
        env:
          GITGUARDIAN_API_KEY: ${{ secrets.GITGUARDIAN_API_KEY }}
        with:
          args: secret scan path .
          
  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Audit dependencies
        run: npm audit --audit-level high
        
      - name: Check for known vulnerabilities
        run: npx audit-ci --high
```

## Secret Rotation Plan

### 1. Immediate Rotation (Next 48 hours)
- [ ] PayPal API credentials
- [ ] Firebase service account keys
- [ ] Any exposed API keys in Git history

### 2. Automated Rotation Setup
```typescript
// Cloud Function for automatic secret rotation
export const rotateSecrets = functions.pubsub
  .schedule('0 2 * * 0') // Weekly at 2 AM on Sunday
  .onRun(async (context) => {
    // Rotate non-critical secrets weekly
    await rotatePayPalWebhookSecret();
    await rotateEncryptionKeys();
    
    console.log('Secrets rotated successfully');
  });
```

## Monitoring & Alerting

### 1. Secret Usage Monitoring
```typescript
// Monitor secret access patterns
export const logSecretAccess = (secretName: string, userId?: string) => {
  console.log(JSON.stringify({
    event: 'secret_access',
    secret_name: secretName,
    user_id: userId,
    timestamp: new Date().toISOString(),
    source_ip: req.ip, // If available
  }));
};
```

### 2. Alerts for Suspicious Activity
- Failed secret access attempts > 5/minute
- Secret access outside normal hours
- Secret access from unusual IP ranges
- Multiple failed authentication attempts

## Cleanup Checklist

### Immediate (< 24 hours)
- [ ] Remove all `.env` files from Git history
- [ ] Rotate all potentially exposed secrets
- [ ] Update all hardcoded secrets in Cloud Functions
- [ ] Implement Secret Manager integration
- [ ] Test all integrations with new secret management

### Short-term (< 1 week)
- [ ] Implement automated secret scanning in CI/CD
- [ ] Set up secret rotation schedule
- [ ] Configure monitoring and alerting
- [ ] Document secret management procedures
- [ ] Train team on new secret management practices

### Security Testing
- [ ] Verify no secrets in client bundle
- [ ] Test secret rotation procedures
- [ ] Validate Cloud Function access to secrets
- [ ] Confirm monitoring and alerting work
- [ ] Penetration test secret management implementation