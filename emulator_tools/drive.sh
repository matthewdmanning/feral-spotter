#!/bin/sh
# Dump the current screen and print its text + content-desc nodes.
#
#   sh drive.sh              # just dump and list
#   sh drive.sh "Some Label" # tap that *text* first, then dump
#
# The listing is how you read app state during a drive — pair it with the
# [nav] lines in the Metro log. Don't reach for screenshots.
#
# The optional tap argument goes through tap_text.py, which is the unreliable
# one (see tapd.sh) — use it only when a control has no content-desc, and
# verify you landed where you meant to. For anything with a content-desc,
# use tapd.sh instead.
#
# PYTHONIOENCODING=utf-8 is required: dumps routinely contain characters the
# Windows console's cp1252 default cannot encode (arrows, the middot in cat
# row labels), and python exits non-zero mid-listing without it.
#
# MSYS_NO_PATHCONV=1 stops Git Bash rewriting /sdcard/wd.xml into a Windows
# path, which makes adb pull fail.
if [ -n "$1" ]; then python tap_text.py "$1" || exit 1; sleep 2; fi
MSYS_NO_PATHCONV=1 adb shell uiautomator dump /sdcard/wd.xml >/dev/null 2>&1
MSYS_NO_PATHCONV=1 adb pull /sdcard/wd.xml window_dump.xml >/dev/null 2>&1
PYTHONIOENCODING=utf-8 python -c "
import re
d=open('window_dump.xml',encoding='utf-8').read()
print('TEXT:', [t for t in re.findall(r'text=\"([^\"]+)\"',d) if t.strip()])
print('DESC:', [c for c in re.findall(r'content-desc=\"([^\"]+)\"',d) if c.strip()])
"
