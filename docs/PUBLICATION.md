# Release Publication

`adityas1731/frame.` contains the clean source export and distribution workflows. It is currently private, with an unpublished `v1.0.3` draft. The `plugin-catalog` branch does not exist yet. Development history and operational evidence stay in the separate private development repository.

Normal push and pull-request CI has a read-only token, no publishing secrets and no publication step. Successful CI cannot publish a release or update the catalog.

## Verify A Draft

1. Record the exact version, final repository commit and approved binary SHA-256. Check the release receipt, corresponding source, dependency sources, notices and compatibility.
2. Stage only the receipt's seven assets in an unpublished draft. The local staging helper uses the maintainer's existing GitHub CLI sign-in. Its default `plan` mode makes no writes. Never replace an existing published asset.
3. Set the draft's target to the reviewed repository commit. Retain its exact tag, name and unpublished status when updating draft metadata.
4. Manually dispatch **frame. publication** on `main` in `verify` mode. Supply the draft ID, version, exact revision, checksum and `VERIFY frame. <version> <revision> <checksum>`.
5. Confirm verification passed, reported `remoteWrites: 0` and skipped the publish job. Recheck the repository is private, the draft unpublished and all seven asset hashes unchanged.

GitHub requires push-capable access to read unpublished drafts. The owner-started, main-only verification job therefore has a short-lived Contents-write token. Verification rejects REST mutation methods and returns before publication writes. This is a code-level guard, not a read-only credential. Never copy a maintainer token into CI to bypass draft access.

The local six-test rehearsal and hosted draft verification have passed. Anonymous downloads remain untested while the repository and draft are private.

## Publish After Approval

Public launch needs separate approval for the repository visibility change, exact draft publication and catalog activation. Before changing visibility, review everything that will be exposed: clean Git history, source, screenshots, workflow files, logs, run metadata and existing release attachments. Keep the development repository private.

After approval, make only the distribution repository public. Then manually dispatch **frame. publication** on `main` in `publish` mode with the approved version, revision, draft ID, SHA-256 and `PUBLISH frame. <version> <revision> <checksum>`.

The publish job runs only for the owner on `main`, with publish mode selected and a public repository. It has a short-lived Contents-write token. It rechecks provenance, licenses, package hashes and catalog compatibility, publishes the draft, checks anonymous downloads of all seven files, then updates `plugin-catalog/manifest.json`. It never changes repository visibility itself.

The stable catalog URL is `https://raw.githubusercontent.com/adityas1731/frame./plugin-catalog/manifest.json`. Check it and the installable version after activation. Keep older compatible catalog versions and their immutable assets available for updates and rollback.

Release publication and catalog updates are separate GitHub operations. If anonymous verification or a later API call fails after publication, the release may already be public while the catalog stays unchanged. Stop and inspect before retrying. Do not automatically delete releases or replace published bytes.

Manual initiation is not enforced independent reviewer approval. Workflow editors can change these controls. No paid feature or unprotected approval environment is used.
