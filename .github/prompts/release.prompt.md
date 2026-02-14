---
description: 'Automate release process: sync versions, commit, tag, and push'
tools:
  - execute/getTerminalOutput
  - execute/runInTerminal
  - read/terminalLastCommand
  - read/terminalSelection
  - execute/runInTerminal
  - edit/editFiles
  - read/readFile
---

# Release Automation

Automate the release process for Kanso Tab Manager Chrome Extension.

## Workflow

1. **Read current versions** from `package.json` and `src/manifest.json`

2. **Ask for the new version** with the current version as hint:
   - Show: "Current version: X.X.X. Enter new version:"
   - Validate it follows semver format (e.g., 0.1.0, 1.0.0, 2.3.4)

3. **Update version in both files**:
   - Update `"version"` field in `package.json`
   - Update `"version"` field in `src/manifest.json`

4. **Stage and commit changes**:
   - Run: `git add package.json src/manifest.json`
   - Run: `git commit -m "chore: release v{VERSION}"`

5. **Create and push tag**:
   - Run: `git tag v{VERSION}`
   - Run: `git push origin main --tags`

6. **Confirm success** with the release URL:
   - Show: "Release v{VERSION} pushed! GitHub Actions will create the release."
   - Provide link to check workflow status

## Output Expectations

- Both `package.json` and `src/manifest.json` have matching versions
- Git commit with message `chore: release vX.X.X`
- Git tag `vX.X.X` created and pushed
- GitHub Actions workflow triggered to create the release
