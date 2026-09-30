# Test-build signing key

`quran-test.jks` signs the sideloaded test APKs that CI publishes, so each
new build installs as an update over the previous one (Android refuses an
update signed with a different key; CI runners otherwise make a fresh debug
key every run).

The password is in `android/app/build.gradle.kts` and this key is public:
anyone could sign an APK that updates over a test install. That is acceptable
only for test builds. **Before any store release**, create a private upload key,
keep it in GitHub Actions secrets (or a local, uncommitted
`android/key.properties`), and sign releases with that instead.
