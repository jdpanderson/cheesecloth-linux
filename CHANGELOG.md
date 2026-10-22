# Changelog

All notable changes to the Linux packages are listed here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). A release
names the cheesecloth version it packages plus a package revision, such as
`0.4.0-2`.

## [Unreleased]

### Changed

- The State column in the GNOME Peers window shows a light for each member:
  green when traffic flows, yellow while the path is being set up, orange
  when the path has had no handshake for over 200 seconds, and red when
  there is no path. Its tooltip names the state and says what it means.
  Sorting by State puts problems first. The line that explained the states
  below the table is gone.
- In the GNOME Peers window, the Invite button is a "+" button at the right,
  as add buttons are in other GNOME apps. Its tooltip says what it does, and
  the Join window says to press it.
- The GNOME Invite window is larger. It shows the invite token in a box
  that scrolls by itself, so the window no longer needs to scroll.

## [0.5.0-beta.4-1] - 2026-10-22

### Changed

- The packages build cheesecloth 0.5.0-beta.4. It has a Windows fix, and
  nothing that changes the packages on Linux.
- The package builds compile the GNOME extension from its TypeScript source
  with the distribution's compiler. The compiled JavaScript is no longer
  committed.

## [0.5.0-beta.3-1] - 2026-10-21

### Changed

- The packages build cheesecloth 0.5.0-beta.3. It has a Windows fix and code
  cleanups, and nothing that changes the packages on Linux.

## [0.5.0-beta.2-1] - 2026-10-21

### Changed

- The packages build cheesecloth 0.5.0-beta.2. It has dependency updates and
  a Windows fix, and nothing that changes the packages on Linux.

## [0.5.0-beta.1-1] - 2026-10-15

### Added

- Member permissions in the GNOME app. The Invite window has a checkbox for
  each permission, Admin, Voter and Relay, all on by default. The Status
  window and join approvals show the permissions, and the Peers window has a
  Permissions column with an icon for each.

### Changed

- The packages build cheesecloth 0.5.0-beta.1, which adds member
  permissions. Its local API and agreed state differ from 0.5.0-beta.0:
  rebuild existing networks.
- On a member without the admin permission, the GNOME app has no Invite
  button, no Remove item for peers and no Approvals item in the panel menu.
- The Role column in the GNOME Peers window shows an icon for each role,
  so a member that is an acceptor and a relay shows both. Each icon has a
  tooltip that names it.

## [0.5.0-beta.0-6] - 2026-10-15

### Changed

- The Status and Peers items in the GNOME panel menu show an icon.
- The GNOME panel menu headers have more space around the dot, such as
  "Cheesecloth  •  Connected".

## [0.5.0-beta.0-5] - 2026-10-14

### Changed

- The GNOME panel menu starts with two lines instead of three. The first
  line shows "Cheesecloth" and the state, such as "Cheesecloth • Connected".

## [0.5.0-beta.0-4] - 2026-10-14

### Fixed

- The Cheesecloth icon in the GNOME panel is now the same size as the other
  panel icons. Before, it had empty space around it and sat too high.

## [0.5.0-beta.0-3] - 2026-10-14

### Changed

- The GNOME Peers window shows peers in a table. You can sort and resize its
  columns.
- The GNOME panel uses the Cheesecloth icon from the macOS and Windows apps.

### Fixed

- The section buttons in the GNOME Status window now work when you click
  their text, and show the normal pointer.
- Create Network and Join Network close and open Status when they succeed.
- The Status window refreshes after you leave the network.
- Long node and network IDs in Status are shortened in the middle to fit.
  The tooltip shows the full ID.

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
