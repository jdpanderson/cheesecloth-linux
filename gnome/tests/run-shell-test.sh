#!/bin/sh
set -eu

exec runuser -u tester -- env XDG_RUNTIME_DIR="$PWD/target/gnome-runtime" LIBGL_ALWAYS_SOFTWARE=1 \
    DBUS_SYSTEM_BUS_ADDRESS=unix:path=/run/dbus/system_bus_socket \
    dbus-run-session -- gnome-shell-test-tool --headless gnome/tests/shell.gjs.mjs
