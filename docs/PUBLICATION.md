# Publish A Verified Update

Distribution repository: `adityas1731/frame.`. The separate development repository stays private. Normal push/PR CI has a read-only token and cannot publish. No workflow installs updates on a Jellyfin server.

## Prepare The Draft

Finish the build, corresponding-source review, disposable installation test and release records described in [Workflow](WORKFLOW.md). Push the reviewed branch, check its CI, integrate it into `main` after review and check main CI. Never push secrets, local reports or Internal builds.

These commands assume the seven assets already match `release/<version>.json`. Fill in exact values:

```powershell
$version = '<four-part version>'
$revision = '<full final main commit>'
$sha256 = '<verified Release ZIP SHA-256>'
$assets = '<absolute directory containing the seven assets>'

# Local verification and inventory. No GitHub writes.
node publication/stage.mjs $assets $version $revision "STAGE frame. $version $revision $sha256" plan

# Deliberate upload to a new unpublished draft. Never replaces an existing version.
node publication/stage.mjs $assets $version $revision "STAGE frame. $version $revision $sha256" upload
```

Check the printed draft ID, target commit, seven asset names and independently downloaded SHA-256 values. Keep the exact binary, source mapping, dependency sources, license and notices together. Do not substitute a later CI build.

## Verify On GitHub

In **Actions → frame. publication → Run workflow**, choose `main` and enter:

| Input | Value |
| --- | --- |
| mode | `verify` |
| draft | Exact unpublished draft ID |
| version | `$version` above |
| revision | `$revision` above |
| sha256 | `$sha256` above |
| confirmation | `VERIFY frame. <version> <revision> <sha256>` |

Wait for success. The result must report **`remoteWrites: 0`**, and the publish job must be skipped. Confirm the draft is still unpublished. Stop on a checksum, source, licensing or compatibility mismatch.

GitHub requires push-capable access to read drafts. This owner-started, main-only job has a temporary Contents-write token, but verify mode rejects mutation requests. This is a code guard, not an independently enforced reviewer gate.

## Publish And Update The Catalog

Only after explicit approval of the exact version, revision and checksum, run the same workflow with `mode: publish` and confirmation:

```text
PUBLISH frame. <version> <revision> <sha256>
```

This publishes the existing draft, verifies all seven assets anonymously, then adds the version to `plugin-catalog/manifest.json`. Previous catalog versions remain available. Publishing and catalog activation happen together in this mode. Do not run it unless both are approved.

Check the published release, anonymous ZIP download and catalog:

```text
https://raw.githubusercontent.com/adityas1731/frame./plugin-catalog/manifest.json
```

The catalog uses Jellyfin's MD5 package checksum. The release receipt and `SHA256SUMS` use SHA-256. Both must match the same ZIP. Confirm discovery and installation in disposable Jellyfin before recommending the update to users.

If a step fails after draft publication, the release may already be public while the catalog is unchanged. Inspect before retrying. Do not delete releases, replace published bytes or reuse that version for a correction.

Manual workflow initiation is not enforced second-person approval. Ordinary pushes and successful CI cannot publish; someone with workflow-editing permissions can still change those controls. No paid GitHub feature is required.
