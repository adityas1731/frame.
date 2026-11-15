# Release Source

## 1.0.7.0

Build revision: `86237846566959e33046d848ec3643eea8629a2a`. Release ZIP: `frame-jellyfin-1.0.7.0-release-ecb83d6bc1c3.zip`, SHA-256 `ecb83d6bc1c3083bc24922c5df3d321ea472b80974e6ae2fa90c7eac32eac673`. Two fresh Windows checkouts produced identical bytes.

Matching source: `frame-source-1.0.7.0-public-5db19692ec0f.zip`, SHA-256 `5db19692ec0f46a69e5c19fdeb9377eae1ba6c897a5ff0c68fc5cc9e8efb92dc`. It contains all 402 tracked files at the build revision; the source map records 250 implementation/build inputs, including the new package-manifest helper. Dependency locks and notices are unchanged apart from the application version.

Both frontend profiles passed 491 tests, TypeScript, host policies and resource checks. Package validation rejects a public package with auto-update disabled. On disposable Jellyfin 12.3, the real Update Plugins scheduled task skipped unmodified 1.0.6.0, automatically installed 1.0.7.0 after the legacy flag was enabled, and retained automatic updates after restart. A repeated task completed without reinstalling the current version. The seven-asset publication rehearsal passed without skips. Existing published versions remain unchanged.

## 1.0.6.0

Build revision: `2d6da50ff9059135a33b3d5dc8ae009e9a1abcf8`. The approved Release ZIP is `frame-jellyfin-1.0.6.0-release-a16015d91ef9.zip`, SHA-256 `a16015d91ef91ed81dfefe5be8ff7dbd0f056909e28581c14b98eb299e2c1298`.

The matching source archive is `frame-source-1.0.6.0-public-7eb287ffc198.zip`, SHA-256 `7eb287ffc19859dea988beb60632b6d653a41bc420c42005c3121fb9a4bbc45d`. It contains all 398 tracked files at the build revision. `release/source-files-1.0.6.0.json` records 232 implementation/build inputs; the package also records a fingerprint of the complete source tree. Release records are committed after the build to avoid self-referencing archive hashes.

Two fresh Windows checkouts with Node 24.18.0 and .NET 10.0.403 produced identical ZIP bytes. A package from an existing build directory differed because a generated target-framework attribute file had old line endings; it was not selected for publication. Use a clean checkout when reproducing this release. The dependency lock and notices are unchanged, so this release retains the dependency-source supplement documented below.

Validation: both frontend profiles passed 491 tests, TypeScript and resource isolation checks; host policies passed; all seven asset-backed publication tests passed. Disposable Jellyfin 12.3 installed 1.0.4.0 through a test catalogue, upgraded to the exact 1.0.6.0 payload, and passed restart, authentication/logout, Frame resources and original Jellyfin Web checks. No production server or real media was used. Physical Safari testing is not claimed.

## Historical 1.0.3.0

The approved Windows-built 1.0.3.0 plugin comes from revision `89283d3a9c582906667e2c3a56ffb72d28ae0b13`. Its SHA-256 is:

```text
98d16e024c6823e6af950e87c216eaf63642cb049fb524467db0c3b7b78d2973
```

The matching source archive is `frame-source-1.0.3.0-public-359d52cf0a6d.zip`, SHA-256 `359d52cf0a6d7f29113fa8932a4d0f9cdfd03aaabfd899033e1ffcd83a538f1f`. Its 343 files match clean export snapshot `3d3ceef31c71fd4f1d9e3b81818e73af34c83ebc`.

The dependency supplement is `frame-dependency-sources-1.0.3.0-7ef872415794.zip`, SHA-256 `7ef872415794883385bd0dd17824cdf3037904327b2be2ec1d5e282177841970`. Both archives, the GPL license and third-party notices are attached beside the binary in release `v1.0.3`.

This repository has independent history. It does not import private development commits or reports. `release/source-files.json` maps 205 implementation/build inputs to the reviewed implementation. The release receipt records the binary, source, dependency checksums and Jellyfin ABI. Later repository commits update CI, publication tooling and documentation without replacing those archives or changing application inputs.

The source ZIP omits the receipt, source map and catalog to avoid self-referencing archive hashes. Those three distribution files are in this repository. The ZIP contains the application source and build instructions. See [BUILDING.md](BUILDING.md).

Rebuilds record their current Git revision and may differ by platform. They are not substitutes for the approved Windows ZIP. Byte-for-byte identity with that historical package is not claimed. A runtime change requires a new version and approval.

The historical plugin's embedded `SOURCE.md` points to its original development location. Use the matching source and dependency archives attached to `v1.0.3` instead. They remain unchanged through this documentation cleanup.
