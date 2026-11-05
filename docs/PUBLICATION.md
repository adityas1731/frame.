# Release Publication

Development and its audit evidence stay in the private repository. This public repository receives a reviewed source export, not development history. Its CI token is read-only and cannot publish. No cross-repository token or publishing secret is stored in normal CI.

1. Review private CI, the binary hash, public source mapping and complete dependency-source supplement. Record the exact public revision and asset checksums.
2. After explicit approval, transfer only the selected assets into an unpublished draft on this repository using the local staging helper. The maintainer uses their existing GitHub CLI sign-in. Default staging mode is a plan with no writes.
3. Manually dispatch publication in verify mode against that draft. Supply version, draft ID, exact public revision, binary checksum and VERIFY frame. <version> <public revision> <checksum>. This uses a read-only token.
4. After explicit public-release approval, manually run publish mode on main with the corresponding PUBLISH confirmation. Only this conditional job gets a short-lived contents-write token. It never changes repository visibility.
5. The job verifies draft assets and source mapping before publishing. It checks anonymous binary/source/dependency downloads before updating the stable plugin-catalog branch. Conflicts fail closed. Never replace published bytes.

The public repository must be approved and created separately. Its exact requested name is frame. GitHub acceptance of the trailing dot must be checked at creation without silently choosing another name. Current preparation creates no GitHub repository or public endpoint.

Manual initiation is an operating control, not enforced independent reviewer approval. Anyone allowed to edit workflows can change that control. No paid GitHub feature or unprotected deployment environment is used.

Local staging syntax is node publication/stage.mjs <asset directory> <version> <public revision> <confirmation> plan. Upload mode requires STAGE frame. <version> <public revision> <binary checksum> and separate owner approval. A failed upload leaves a draft; it does not publish or update the catalog.

The release and catalog updates are separate GitHub operations. If anonymous verification or a later API call fails after release publication, the catalog stays unchanged but the release may already be public. Stop and inspect it before retrying. The workflow never automatically deletes an exposed release or rewrites an existing catalog version.

The local HTTP rehearsal covers staging and the publication API sequence. Hosted Actions, public downloads and a real QR/phone installation still require separate approval and testing after the repository exists.
