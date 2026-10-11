# Linux packages

Debian and Arch Linux packages for
[cheesecloth](https://github.com/jdpanderson/cheesecloth). Both build
cheesecloth from source and install the binary, the systemd unit
`cheesecloth.service`, and `/etc/default/cheesecloth` for the daemon's
options. The unit and the options file come from cheesecloth.

## Install

Take a package from this repository's
[releases](https://github.com/jdpanderson/cheesecloth-linux/releases), or
from a CI run's **Artifacts**:

- `cheesecloth_<version>_amd64.deb` or `cheesecloth_<version>_arm64.deb` for
  Debian 13 (trixie) or later:

  ```sh
  sudo apt install ./cheesecloth_<version>_amd64.deb
  ```

  GitHub does not allow `~` in a file name, so a pre-release such as
  `0.4.0~pre0-1` has a `.` there in its release file name:
  `cheesecloth_0.4.0.pre0-1_amd64.deb`. The package's version is still
  `0.4.0~pre0-1`.

- `cheesecloth-<version>-x86_64.pkg.tar.zst` for Arch Linux. Released
  packages are signed; trust the key once, as described in
  [Signing](#signing), then install from the release URL:

  ```sh
  sudo pacman -U https://github.com/jdpanderson/cheesecloth-linux/releases/download/<tag>/<package>.pkg.tar.zst
  ```

Then set the options in `/etc/default/cheesecloth` and start the service:

```sh
sudo systemctl enable --now cheesecloth
```

## Building by hand

### Debian

The build runs in a cheesecloth checkout at the pinned release tag (or
commit), with this repository's `debian/` in place of any `debian/` it has.
It needs `cargo` and `rustc` 1.95 or later (on Debian 13, from
trixie-backports) and network access, because cargo downloads the crates that
`Cargo.lock` names.

```sh
git clone --branch v<release from cheesecloth.pin> https://github.com/jdpanderson/cheesecloth.git
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

`makepkg` fetches the tag or commit in `_ref` from GitHub. To build from a
local checkout that has it:

```sh
CHEESECLOTH_REPO=file://$(realpath ../../cheesecloth) makepkg -si
```

## The pin file

`cheesecloth.pin` names what the packages build. Its format is set in
cheesecloth's `docs/REPOSITORIES.md`. This repository builds from source, so
a release pin lists no binaries:

```toml
release = "0.4.0"
```

For work that spans both repositories, the pin may name a commit instead.
Change cheesecloth first and merge it, then pin that commit here:

```toml
commit = "<40-character commit id>"
```

A package release needs a release pin.

To move the pin, change it in three places, which CI checks against each
other:

1. `cheesecloth.pin`;
2. in `arch/PKGBUILD`, `_ref` (`tag=v<release>` or `commit=<commit id>`) and
   `pkgver`; reset `pkgrel` to 1 when `pkgver` changes;
3. `debian/changelog`, with a new entry such as `0.4.0-1`.

The versions follow the release, or the version in cheesecloth's
`Cargo.toml` for a commit pin. A release with a suffix, such as `0.4.0pre0`,
must sort before the plain version: it is `0.4.0~pre0` for Debian and
`0.4.0pre0` for Arch.

A packaging change with no new cheesecloth version raises the revision:
`pkgrel` in the PKGBUILD, and a new `debian/changelog` entry such as
`0.4.0-2`. The two revisions must match.

## Releasing

1. Pin a cheesecloth release, as described above.
2. Add the release to `CHANGELOG.md`.
3. Merge to `main`, then tag `main` as `v<release>-<revision>` and push the
   tag, such as `v0.4.0-1`:

   ```sh
   git tag v0.4.0-1 && git push origin v0.4.0-1
   ```

CI checks that the tag matches the pin and the package versions, builds and
checks the packages, signs the Arch packages and publishes a GitHub release
with a `SHA256SUMS` file. A release with a suffix, such as `0.4.0pre0`, is
published as a pre-release.

## Signing

Released Arch packages are signed with a GPG key. `pacman -U <url>` downloads
`<url>.sig` and refuses the package if that file is missing or does not match
a trusted key. Debian packages are not signed.

The **Publish release** job signs the packages. It runs only for tags. The key
is used only in that job, so jobs that run cargo build scripts never see it.
If the `ARCH_SIGNING_KEY` secret is not set, the job fails: a release is never
published without signatures.

### Trust the key

Do this once on each machine that installs the package:

```sh
sudo pacman-key --add arch/signing-key.asc
sudo pacman-key --lsign-key <fingerprint>
```

### Create the key

Create a dedicated key with no passphrase. Use a temporary GPG home so the key
never enters your own keyring:

```sh
export GNUPGHOME=$(mktemp -d)
gpg --batch --passphrase '' --quick-gen-key \
  'cheesecloth packages <janderson@janderson.ca>' ed25519 sign never
```

Commit the public key as `arch/signing-key.asc`:

```sh
gpg --armor --export > arch/signing-key.asc
```

Store the private key as the `ARCH_SIGNING_KEY` repository secret, and note
the fingerprint. Users need it to trust the key:

```sh
gpg --armor --export-secret-keys | gh secret set ARCH_SIGNING_KEY
gpg --fingerprint
```

Delete the temporary GPG home. The secret is now the only copy of the private
key:

```sh
rm -rf "$GNUPGHOME"
unset GNUPGHOME
```

### Replace the key

The key has no passphrase, so the GitHub secret is its only protection. If the
secret may have leaked, or to rotate the key:

1. Create a new key as described above. Replace `arch/signing-key.asc` and
   the `ARCH_SIGNING_KEY` secret.
2. On each machine, remove the old key and trust the new one:

   ```sh
   sudo pacman-key --delete <old fingerprint>
   sudo pacman-key --add arch/signing-key.asc
   sudo pacman-key --lsign-key <new fingerprint>
   ```

Packages signed with the old key no longer install after the old key is
removed.

## Weak points

- **The Debian build downloads crates.** `debian/rules` lets cargo fetch the
  crates from crates.io, so the package does not build without network
  access, as Debian's own build servers require. Getting into Debian would
  need the crates packaged or vendored.
- **No Arch package for aarch64.** The PKGBUILD allows it, but there is no
  Arch container for arm64 to build it in CI.
- **Builds from a commit pin are not releases.** Their version is the
  cheesecloth version at that commit, even when the commit is newer than the
  release with that version.
- **A release pin names a tag.** Nothing here checks which commit the tag
  points to, so a moved tag would change what the packages build.
