# Changelog

All notable changes to the Linux packages are listed here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). A release
names the cheesecloth version it packages plus a package revision, such as
`0.4.0-2`.

## [Unreleased]

## [0.5.0-beta.0-2] - 2026-10-14

### Added

- Support GNOME Shell 51.

### Changed

- Rename the GNOME extension to `cheesecloth-gnome@janderson.ca`. After
  upgrading, enable it again under the new name.

## [0.5.0-beta.0-1] - 2026-10-13

The first test release of the GNOME desktop packages, built with cheesecloth
0.5.0-beta.0.

### Changed

- Write the GNOME UI in TypeScript and package the compiled JavaScript.

### Added

- A GNOME Shell indicator and GTK management windows in a separate Debian
  and Arch package.
- The extension package creates the `cheesecloth` operator group and enables
  local API access for its members.

## [0.4.0-1] - 2026-10-11

### Changed

- The packages build cheesecloth 0.4.0.

## [0.4.0pre0-1] - 2026-10-11

A test of the release process. It packages cheesecloth 0.4.0pre0.

### Changed

- The Debian package and the PKGBUILD moved here from the cheesecloth
  repository, with their history. They still build cheesecloth from source.
- The Debian package uses the `3.0 (quilt)` format and has its own revision.
  A pre-release sorts before its release, such as `0.4.0~pre0-1`.
- The PKGBUILD builds a fixed cheesecloth tag or commit from GitHub, in place
  of the checkout it sat in.
- Releases and Arch package signing moved here, with the same signing key.
  A Debian pre-release has `.` in place of `~` in its release file name,
  because GitHub does not allow `~`.

### Added

- `cheesecloth.pin`, the cheesecloth release or commit that the packages
  build.
- CI builds the Debian package for arm64 too, and installs both packages
  after it builds them.
