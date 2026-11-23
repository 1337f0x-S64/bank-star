# DEPENDENCY RFC: Native Plugin Security Footprint & Permission Scope

- **RFC ID**: RFC-001
- **Title**: Initial Native Dependency Governance & Threat Analysis
- **Author**: Developer B (Co-authored by Developer A)
- **Status**: APPROVED
- **Date**: 2026-11-21
- **Course**: COP3655: Cross-Platform Mobile Application Development (Fall 2026)
- **Capstone Standards**: Section 4.0 (Red-Team Security Audit) & Section 5.0 (Dependency Governance)
- **SRS Alignment**: FR-32, FR-33, Section 4.3, Section 5.0 (NFR-01, NFR-02, NFR-03, NFR-04)

---

## 1. Executive Summary & Governance Mandate

In strict compliance with **Section 5.0 of the COP3655 Capstone Specification** and **SRS FR-33**, all external native plugins integrated into the Personal Finance Monitor (PFM) must undergo formal architectural review prior to inclusion. The application is an offline-first financial system handling sensitive dual-currency expense records (USD and NIO).

This RFC establishes the security baseline, native OS permission footprint, hardware cryptographic requirements, and threat model analysis for the four (4) core native plugins:
1. `expo-sqlite` (configured with `useSQLCipher: true`)
2. `expo-secure-store`
3. `expo-crypto`
4. `expo-local-authentication`

---

## 2. Plugin Threat & Security Footprint Analysis

### 2.1 `expo-sqlite` (SQLCipher AES-256 Engine)

#### A. Purpose & Integration Scope
Provides local relational database storage for user expenses, categories, exchange rates, and app configuration settings. In accordance with SRS NFR-01 and Capstone Section 4.0, plaintext SQLite is strictly prohibited; the database must run with full-database encryption via SQLCipher.

- **Config Plugin**: Enabled via `app.json` config plugin `["expo-sqlite", { "useSQLCipher": true }]`.
- **Target Runtime**: Custom Expo Development Build (`npx expo run:android` / `npx expo run:ios`). *Note: SQLCipher native compilation is not supported in stock Expo Go.*

#### B. OS Permission Footprint
| Platform | Declared Permissions | Runtime Permission Prompt | Scope & Sandboxing |
| :--- | :--- | :--- | :--- |
| **Android** | None | None | Application internal storage (`/data/user/0/<package-id>/databases/`). Isolated by Linux UID/GID. |
| **iOS** | None | None | Application sandbox container (`NSApplicationSupportDirectory` / `NSDocumentDirectory`). Protected by iOS data protection classes. |

*Crucial Security Property*: `android.permission.INTERNET` is **NOT** requested or granted for sqlite. Database storage is strictly confined to the local filesystem sandbox.

#### C. Threat Model & Attack Vectors
1. **Physical Device Theft / Cold Storage Extraction**: An attacker gaining physical access to the device extracts raw SQLite database files via file browsing, unrooted file extractors, or ADB backup.
   - *Mitigation*: The entire database file (pages, headers, free lists) is encrypted at rest using AES-256-CBC with individual per-page HMAC integrity checks (SHA1/SHA512).
2. **Plaintext Fallback Vulnerability**: If the encryption key or SQLCipher module fails to load, standard SQLite implementations may transparently open or create an unencrypted database.
   - *Mitigation*: Fail-closed initialization check. The application executes `PRAGMA cipher_version;` immediately upon opening the connection. If the returned version string is null, empty, or undefined, the app aborts execution immediately, displays a fatal security lock screen, and destroys in-memory handles.
3. **SQL Injection**: Malicious input strings crafted to alter queries and leak records or bypass validation.
   - *Mitigation*: Zero string-concatenated SQL queries allowed. All database access in `src/data/repositories/` must use parameterized SQL (`?` placeholders).

---

### 2.2 `expo-secure-store` (Hardware Key Storage)

#### A. Purpose & Integration Scope
Provides hardware-backed, cryptographically isolated key-value storage exclusively dedicated to persisting the 256-bit AES encryption key for the SQLCipher database.

- **API Interface**: `setItemAsync(key, value, options)`, `getItemAsync(key, options)`, `deleteItemAsync(key, options)`.

#### B. OS Permission Footprint
| Platform | Native Backing Mechanism | OS Permission Required | Hardware Enclave |
| :--- | :--- | :--- | :--- |
| **Android** | Android KeyStore + `EncryptedSharedPreferences` (AES-256-GCM) | None | Supported via Trusted Execution Environment (TEE) / StrongBox Keymaster. |
| **iOS** | Apple Keychain Services (`kSecClassGenericPassword`) | None | Protected by Apple Secure Enclave Processor (SEP). |

#### C. Threat Model & Attack Vectors
1. **ADB Backup / iCloud Key Leakage**: Keys extracted from automated device backups to cloud storage or local developer backups.
   - *Mitigation*: 
     - iOS: Keychain items configured with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`. This attribute explicitly prevents keychain items from syncing to iCloud or migrating across device backups.
     - Android: Android manifest must enforce `android:allowBackup="false"` to prevent `adb backup` extraction.
2. **Reverse Engineering / Binary Decompilation**: An attacker decompiles the mobile APK/IPA to search for hardcoded strings, symmetric keys, or obfuscated secrets.
   - *Mitigation*: Zero static keys in source code. The 256-bit key is generated randomly at runtime upon first boot and committed immediately to `expo-secure-store`.
3. **Memory Inspection & Log Leakage**: Sensitive cryptographic keys logged during debugging or caught in unhandled error stack traces.
   - *Mitigation*: Constitutional mandate prohibiting passing keys to `console.log`, crash reporters, or React component state. Key handles are scoped strictly to `src/data/security/KeyManager.js`.

---

### 2.3 `expo-crypto` (CSPRNG Key Generation)

#### A. Purpose & Integration Scope
Supplies cryptographically secure pseudo-random number generation (CSPRNG) to generate the initial 256-bit symmetric database key when the application is launched for the first time.

- **API Interface**: `Crypto.getRandomBytesAsync(32)` (or `Crypto.getRandomValues(new Uint8Array(32))`).

#### B. OS Permission Footprint
| Platform | Native Entropy Source | OS Permissions Required |
| :--- | :--- | :--- |
| **Android** | `java.security.SecureRandom` (backed by Linux `/dev/urandom` / hardware TRNG) | None |
| **iOS** | `SecRandomCopyBytes` (Apple CommonCrypto security layer) | None |

#### C. Threat Model & Attack Vectors
1. **Weak PRNG Entropy**: If keys were generated using `Math.random()`, seed states could be reverse-engineered or predicted, compromising the entire AES-256 keyspace.
   - *Mitigation*: Mandatory use of native platform CSPRNG (`expo-crypto`). The random generator leverages OS kernel hardware entropy pools (thermal noise, interrupts, clock drift).
2. **Key Collision / Predictable Seeds**: Repeating seeds across device reboots or app clones.
   - *Mitigation*: 256 bits (32 bytes) of full native entropy ensures collision probability of $2^{-256}$, providing mathematical resistance against rainbow tables and quantum or brute-force search attacks.

---

### 2.4 `expo-local-authentication` (Hardware Biometric Gate)

#### A. Purpose & Integration Scope
Gates financial data viewing behind mandatory OS biometric authentication (Fingerprint, Touch ID, Face ID, Android BiometricPrompt). Provides non-destructive fallback to device passcode authentication or local viewing disclaimers.

- **API Interface**: `hasHardwareAsync()`, `isEnrolledAsync()`, `authenticateAsync(options)`.

#### B. OS Permission Footprint
| Platform | Declared Permission | Scope & Configuration |
| :--- | :--- | :--- |
| **Android** | `android.permission.USE_BIOMETRIC`<br>`android.permission.USE_FINGERPRINT` | Standard system biometric dialog. Scoped strictly to system-managed `BiometricPrompt`. |
| **iOS** | `NSFaceIDUsageDescription` in `Info.plist` | Explains to the user why biometric access is requested (e.g., *"Authenticate to access your encrypted financial data"*). |

#### C. Threat Model & Attack Vectors
1. **Biometric Data Exfiltration**: Malicious software or vulnerabilities attempting to capture, intercept, or export user facial embeddings or fingerprint bitmaps.
   - *Mitigation*: In strict compliance with **SRS FR-25**, zero biometric templates or raw sensor data are accessible to or stored by the application. All biometric comparison occurs exclusively inside the isolated hardware processor (Apple Secure Enclave / Android TEE). The application receives only a signed cryptographic boolean result from the OS.
2. **Denial of Service (Biometric Sensor Failure / Lockout)**: If a physical device has no biometric sensor, sensor failure, or unenrolled credentials, the user might be permanently locked out of their financial data.
   - *Mitigation*: Non-destructive fallback flow. When biometric authentication returns `error: 'not_enrolled'` or `error: 'hardware_unavailable'`, the application transitions safely to device passcode fallback or displays the local access disclaimer, preventing data loss or unrecoverable lockout.
3. **Application Lifecycle Bypass (Backgrounding & Resume)**: An attacker opens the app while it resides in the background task switcher without triggering biometric re-authentication.
   - *Mitigation*: An `AppState` listener monitors transitions between `background` and `active`. When transitioning to active, if biometric lock is enabled in settings, the application immediately displays `BiometricGateScreen` and resets cached unlocked state.

---

## 3. Dependency Governance Matrix

| Plugin | Version Spec | Permissions Declared | Hardware Enclave Dependent | Offline Capable | Red-Team Audit Rating |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `expo-sqlite` | ~15.x / Latest SDK 58 | None | No (Software Crypto via SQLCipher native library) | 100% Offline | PASS (Fail-closed PRAGMA check) |
| `expo-secure-store` | Latest SDK 58 | None | Yes (TEE / Secure Enclave) | 100% Offline | PASS (No plaintext keys) |
| `expo-crypto` | Latest SDK 58 | None | Yes (Hardware TRNG / OS CSPRNG) | 100% Offline | PASS (High entropy) |
| `expo-local-authentication` | Latest SDK 58 | `USE_BIOMETRIC`, `NSFaceIDUsageDescription` | Yes (OS BiometricPrompt / Secure Enclave) | 100% Offline | PASS (Zero template capture) |

---

## 4. Codebase Architecture Rules & Prohibitions

1. **No Network Access For Persistence**: Neither `expo-sqlite` nor `expo-secure-store` may be combined with remote replication without an explicit future RFC.
2. **Fail-Closed Verification**: Every database initialization routine must execute:
   ```javascript
   const result = await db.getFirstAsync('PRAGMA cipher_version;');
   if (!result || !result.cipher_version) {
     throw new Error('FATAL: SQLCipher verification failed. Database cannot be opened in plaintext.');
   }
   ```
3. **Decoupled Architecture**: UI components (`.jsx`) MUST NOT import or call `expo-sqlite`, `expo-secure-store`, or `expo-crypto`. Interactions with these dependencies are strictly restricted to `src/data/database/`, `src/data/repositories/`, and `src/data/security/`.
