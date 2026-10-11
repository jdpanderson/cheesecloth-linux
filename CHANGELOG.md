# Changelog

All notable changes to the Linux packages are listed here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). A release
names the cheesecloth version it packages plus a package revision, such as
`0.4.0-2`.

## [Unreleased]

### Changed

- The Debian package and the PKGBUILD moved here from the cheesecloth
  repository, with their history. They still build cheesecloth from source.
- The Debian package uses the `3.0 (quilt)` format and has its own revision,
  starting at `0.3.0-1`.
- The PKGBUILD builds a fixed cheesecloth commit from GitHub, in place of the
  checkout it sat in.

### Added

- `cheesecloth.pin`, the cheesecloth commit that the packages build.
- CI builds the Debian package for arm64 too, and installs both packages
  after it builds them.
