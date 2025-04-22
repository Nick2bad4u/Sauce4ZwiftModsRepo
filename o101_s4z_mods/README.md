A better nearby riders MOD for Sauce for Zwift™
===========

You need to place this Sauce for Zwift "Mod" into this directory ~/Documents/SauceMods/O101


Changelog for 0.0.3

* Nearby riders window
- name fix for longer names and event badges (pushing flag out of view)
- custom header text
- marked riders filter

* Overview window
- this one is new!

Changelog for 0.0.7

* Added elevation window

Changelog for 0.1.0

* The previous should be 0.1.0 (new feature => 0.++x.0)
* Added overview 2 window (livedata, totalsdata, eventdata)

npm install --save-dev @electron/rebuild
.\node_modules\.bin\electron-rebuild.cmd
https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules

# Electron's version.
SET npm_config_target=1.2.3
# The architecture of your machine
SET npm_config_arch=x64
SET npm_config_target_arch=x64
# Download headers for Electron.
SET npm_config_disturl=https://electronjs.org/headers
# Tell node-pre-gyp that we are building for Electron.
SET npm_config_runtime=electron
# Tell node-pre-gyp to build module from source code.
SET npm_config_build_from_source=true
# Install all dependencies, and store cache to ~/.electron-gyp.
HOME=~/.electron-gyp npm install