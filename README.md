# Linux packages

Debian and Arch Linux packages for
[cheesecloth](https://github.com/jdpanderson/cheesecloth). Both build
cheesecloth from source and install the binary, the systemd unit
`cheesecloth.service`, and `/etc/default/cheesecloth` for the daemon's
options. The unit and the options file come from cheesecloth.

## Install

Take a package from the CI run's **Artifacts**:

- `cheesecloth_<version>_amd64.deb` or `cheesecloth_<version>_arm64.deb` for
  Debian 13 (trixie) or later:

  ```sh
  sudo apt install ./cheesecloth_<version>_amd64.deb
  ```

- `cheesecloth-<version>-x86_64.pkg.tar.zst` for Arch Linux:

  ```sh
  sudo pacman -U cheesecloth-<version>-x86_64.pkg.tar.zst
  ```

Then set the options in `/etc/default/cheesecloth` and start the service:

```sh
sudo systemctl enable --now cheesecloth
```

This repository makes no releases yet. Until it does, cheesecloth's own
releases carry its Debian and Arch packages.

## Building by hand

### Debian

The build runs in a cheesecloth checkout at the pinned commit, with this
repository's `debian/` in place of any `debian/` it has. It needs `cargo` and
`rustc` 1.95 or later (on Debian 13, from trixie-backports) and network
access, because cargo downloads the crates that `Cargo.lock` names.

```sh
git clone https://github.com/jdpanderson/cheesecloth.git
git -C cheesecloth checkout <commit from cheesecloth.json>
rm -rf cheesecloth/debian
cp -r debian cheesecloth/
cd cheesecloth
dpkg-buildpackage -us -uc -b
```

The package is written beside the checkout.

### Arch

```sh
cd arch
makepkg -si
```

`makepkg` fetches the commit in `_commit` from GitHub. To build from a local
checkout that has that commit:

```sh
CHEESECLOTH_REPO=file://$(realpath ../../cheesecloth) makepkg -si
```

## The pin file

`cheesecloth.json` names the cheesecloth commit that the packages build:

```json
{ "commit": "<full commit SHA-1>" }
```

To move the pin, change it in three places, which CI checks against each
other:

1. `commit` in `cheesecloth.json`;
2. `_commit` in `arch/PKGBUILD`, and `pkgver` if the version at that commit
   changed (reset `pkgrel` to 1 when it does);
3. `debian/changelog`, with a new entry if the version changed, such as
   `0.4.0-1`.

A packaging change with no new cheesecloth version raises the revision:
`pkgrel` in the PKGBUILD, and a new `debian/changelog` entry such as
`0.4.0-2`.

When cheesecloth tags a release, the pin will name that release in place of a
commit. Before a package release, the pin must name a release. For work that
spans both repositories, change cheesecloth first and merge it, then pin that
commit here.

## Weak points

- **The Debian build downloads crates.** `debian/rules` lets cargo fetch the
  crates from crates.io, so the package does not build without network
  access, as Debian's own build servers require. Getting into Debian would
  need the crates packaged or vendored.
- **No Arch package for aarch64.** The PKGBUILD allows it, but there is no
  Arch container for arm64 to build it in CI.
- **Builds from a commit pin are not releases.** Their version is the last
  cheesecloth version, even when the commit is newer.

## Signing

Arch packages are signed when they are released. For now, cheesecloth's
release job does this; see its `docs/SIGNING.md`. Signing moves here with the
first release from this repository.
