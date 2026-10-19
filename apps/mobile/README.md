# Lagani mobile

Flutter **3.47.0**, Dart **3.13.0**, Android target/compile SDK **36**. The lock file pins package versions. The app starts with a skippable investor introduction and five destinations: Home, Explore, Portfolio, Activity and Profile.

## Run

Start the root API/database first. Then:

```sh
flutter pub get --enforce-lockfile
adb reverse tcp:4000 tcp:4000
flutter run --dart-define=API_URL=http://127.0.0.1:4000/api
```

The reverse tunnel is preferred for local authentication, which deliberately requires loopback requests. For public read-only exploration an emulator can reach the host at 10.0.2.2. Debug builds permit local HTTP; release code rejects a non-HTTPS API URL. Never expose the local development mailbox externally.

## Check

```sh
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug --dart-define=API_URL=http://127.0.0.1:4000/api
```

Unit/widget tests cover exact paisa formatting, invalid inputs, Nepal time, localization parity, skippable introduction, five-tab sign-in gate, Nepali dark mode at 200% text scale, and deliberate quote acknowledgments. They use a fake API boundary and do not establish native device integration. See ../../docs/TEST-RESULTS.md for measured status.

## Release

The temporary application ID is `dev.lagani.lagani`. Choose the permanent ID before first publication. The optional ignored `android/key.properties` contains storeFile, storePassword, keyAlias and keyPassword. Provision an upload key securely outside this repository. Without it release artifacts are unsigned; a debug key is never substituted. Use an operator-controlled HTTPS endpoint with hosted identity before internal testing:

```sh
flutter build appbundle --release --dart-define=API_URL=https://YOUR-API/api
```

See ../../docs/PLAY-RELEASE.md. Native Android execution, 16 KB alignment, merged permissions and performance require checks on the produced artifact. iOS scaffolding is included but needs macOS/Xcode verification.

## Storage and features

Tokens use platform secure storage. Preferences and public discovery cache use shared preferences. Private document bytes are not intentionally cached. The server remains authoritative for quotes, balances, deadlines, commitments and share issuance. English/Nepali resource files are in assets/l10n; dynamic backend errors and fictional business narratives currently retain their supplied language. Fluent review is still needed.
