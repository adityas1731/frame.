# Release Source

The reviewed 1.0.3.0 plugin was built from revision `89283d3a9c582906667e2c3a56ffb72d28ae0b13`. Its binary SHA-256 is `98d16e024c6823e6af950e87c216eaf63642cb049fb524467db0c3b7b78d2973`.

This repository starts with a clean source export, not imported development history. The release receipt maps the original build revision to the public source snapshot, source archive and dependency-source checksums. All frontend and native implementation inputs are checked against the reviewed revision. Only distribution/build metadata, documentation and a machine-specific test address are changed. Private operational reports and production deployment helpers are excluded.

The historical binary remains unchanged. Rebuilds embed current Git provenance, so byte-for-byte identity with that historical ZIP is not claimed. Do not replace it with a rebuild carrying the same version. A runtime change requires a new release version and approval.

The original SOURCE.md inside the historical plugin points at its original development location. Use the public matching-source and dependency-source links supplied with this release instead. Future binaries can embed the public repository URL.
