# Releasing

Two GitHub Actions workflows back this repo:

- **CI** (`.github/workflows/ci.yml`) - runs `tsc` and the Jest suite on every PR and
  every push to `main`. No secrets, nothing to configure.
- **Release** (`.github/workflows/release.yml`) - produces a build artifact via
  [EAS Build](https://docs.expo.dev/build/introduction/) on a `v*` tag or a manual
  run. The EAS build stays inert (no-op with a note) until the secrets below exist, so
  it is safe to keep even before the account is set up. A second job generates the API
  reference (TypeDoc) and uploads it as the `shiftly-api-docs` artifact - it needs
  no secret, so every tag or manual run ships the docs regardless of EAS.

## One-time setup for release builds

1. **Create an Expo account** and, from `app/`, link the project:

   ```bash
   cd app
   npx eas init
   ```

   This writes an EAS project id into `app.json` (`expo.extra.eas.projectId`). Commit that.

2. **Create an Expo access token** at https://expo.dev/settings/access-tokens and add
   it as a repo secret named `EXPO_TOKEN`, either way:

   - **GitHub UI:** Settings -> Secrets and variables -> Actions -> **Secrets** tab ->
     New repository secret -> name `EXPO_TOKEN`, paste the token. Direct link for this
     repo: https://github.com/pzverkov/shiftly-rn/settings/secrets/actions
     (note: the **Secrets** tab, not Variables - a token is a secret).
   - **CLI:** `gh secret set EXPO_TOKEN --body "<the token>"`

   That is the only secret the build needs. Nothing is stored in the repo - the token
   lives in GitHub settings. The `release` workflow reads it and skips the build cleanly
   when it is absent (the skip step prints this same path in the run summary), so it is
   safe to leave wired before the token exists. Do not commit a placeholder value: a bad
   token turns the clean skip into a failing build.

3. **Signing keys - let EAS manage them (recommended).** On the first Android build
   EAS generates and stores the keystore for you; on the first iOS build it manages
   the distribution certificate and provisioning profile. Nothing to put in the repo.
   To inspect or rotate them:

   ```bash
   cd app
   npx eas credentials
   ```

   To supply your **own** Android keystore instead, upload it with `eas credentials`
   (kept in EAS, never committed) rather than adding it to GitHub secrets.

## Platform notes

- **Android** is the default artifact - the `preview` profile builds an installable
  APK (`eas.json`). A tag push or a manual run with `platform: android` produces it.
- **iOS** needs a paid Apple Developer account for any distributable build. Once
  `eas credentials` has the certificate and profile, run the `release` workflow
  manually with `platform: ios` (or `all`). It is not built by default because a tag
  push cannot supply Apple credentials that do not exist yet.

## Cutting a release

- **On a tag:** `git tag v1.2.0 && git push origin v1.2.0` - builds Android `preview`.
- **On demand:** Actions tab -> Release -> Run workflow -> pick the platform.

Builds run on Expo's servers; the workflow submits with `--no-wait` and the link to
the running build appears in the job log. Download the artifact from the EAS build
page when it finishes.

## Building locally instead

No account or CI needed for a local check:

```bash
cd app
npx eas build --platform android --profile preview --local   # needs Android SDK
```

## API reference

The release workflow builds it, but it is a one-liner locally too:

```bash
cd app
npm run docs   # renders the logic layers' JSDoc into docs/api (git-ignored)
```
