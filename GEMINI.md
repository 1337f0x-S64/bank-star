# Mobile Systems Constitution (CLAUDE.md / GEMINI.md)

1. PATTERN: Enforce Reactive MVVM pattern ONLY. Never place network or database logic inside UI views (.jsx).
2. JS DEFENSIVE SAFETY: Validate numeric types at runtime (Number.isInteger()); zero floating-point math for money.
3. RESILIENCE: Wrap all async/network calls in try/catch with automatic local database fallback.
4. KEYSTORE PROTECTION: Use iOS Keychain / Android KeyStore (expo-secure-store). ZERO plain-text keys in code, logs, or disk.
5. LIFECYCLE DISPOSAL: Explicitly dispose of streams, timers, listeners, and controllers in useEffect cleanup returns on view pop.

---

## 1. Architectural Mandate: Reactive MVVM Pattern
- **UI Views (`src/presentation/screens/*.jsx`, `src/presentation/components/*.jsx`)**:
  - Pure presentation only.
  - MUST NOT execute SQL queries, database calls, or direct network requests.
  - Bind reactively to ViewModels for state, actions, and events.
  - Handle 4 explicit screen states: `Loading`, `Success`, `Error`, and `Offline`.
- **ViewModels (`src/presentation/viewmodels/*.js`)**:
  - Encapsulate screen presentation logic, UI state management, and command handlers.
  - Consume Domain Services and Repositories; expose reactive state (hooks / observable state) to Views.
- **Domain Layer (`src/domain/`)**:
  - `models/`: Frozen data contracts, schemas, and runtime validation.
  - `services/`: Business logic, currency calculations, summary aggregations, and business rule coordination.
  - `calculations/`: Pure mathematical computations with zero side effects.
- **Data Layer (`src/data/`)**:
  - `database/`: Encrypted SQLite (SQLCipher) client initialization and lifecycle.
  - `repositories/`: Data access abstraction with parameterized queries and atomic transaction rollbacks.
  - `migrations/`: Versioned schema definitions and migration scripts managed via `PRAGMA user_version`.
  - `security/`: Hardware-backed keystore integration (`expo-secure-store`), key generation (`expo-crypto`), and biometric authentication (`expo-local-authentication`).

## 2. JavaScript Defensive Safety & Integer Minor-Unit Math
- **Runtime Type Validation**: All numerical amounts and inputs MUST be validated at runtime using `Number.isInteger()`.
- **Zero Floating-Point Drift**: All currency values (USD and NIO) MUST be stored, calculated, and manipulated strictly in integer minor units (cents / centavos).
- **Domain Math Constraints**:
  - Conversion between major and minor units: `toMinorUnits(dollars) => Math.round(val * 100)`.
  - Display formatting: `toMajorUnits(minor) => (minor / 100).toFixed(2)`.
  - Precondition checks: Throw explicit errors if `!Number.isInteger(amountMinor) || amountMinor < 0`.
- **Currency Isolation**: USD and NIO amounts must never be combined without explicit exchange rate conversion with timestamp and direction metadata.

## 3. Resilience & Offline-First Guarantees
- **Zero-Connectivity First**: All core persistence, calculations, summaries, and conversion operations must function 100% offline (Airplane Mode compliant).
- **Network Call Isolation**: All asynchronous or network calls (e.g. future rate refresh) MUST be wrapped in `try/catch` blocks.
- **Fail-Safe Fallback**: Any network failure or timeout must automatically fallback to local cached database storage without crashing or throwing unhandled null exceptions.
- **Fail-Closed Security**: Missing encryption keys, tampered databases, or empty `PRAGMA cipher_version` MUST immediately fail closed with a secure error screen rather than falling back to unencrypted plaintext.

## 4. Hardware KeyStore Protection & Zero Plain-Text Secrets
- **Key Isolation**: Database encryption keys MUST be stored exclusively in platform hardware:
  - iOS: Keychain Services (`kSecClassGenericPassword`, device-only accessibility).
  - Android: Android KeyStore (`EncryptedSharedPreferences`).
- **Cryptographic Randomness**: New database keys MUST be generated using native CSPRNG (`expo-crypto`), 256-bit entropy.
- **Zero Secrets**: Plaintext keys, passwords, or raw secrets are STRICTLY PROHIBITED in source code, commit history, build assets, configuration files, or `console.log` statements.
- **Red-Team Compliance**: Codebase must pass static AST and regex scans for leaked credentials or unencrypted SQLite operations.

## 5. Lifecycle Disposal & Memory Leak Prevention
- **View-Pop Cleanup**: Every `useEffect` hook that registers event listeners, timers, intervals, streams, or asynchronous controllers MUST provide an explicit return cleanup function.
- **Subscription Management**: Database observers, AppState listeners, and navigation listeners must be cleanly unregistered when a screen unmounts or navigates out of stack.
- **Rotation Resilience**: Screens must survive orientation changes (portrait <-> landscape) and app backgrounding/resuming without duplicating listeners or crashing.
- **Safe State Updates**: Asynchronous callbacks and promises must verify component mount status or utilize AbortController to prevent "Can't perform a React state update on an unmounted component" errors.
