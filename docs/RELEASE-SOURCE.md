# Release Source

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
