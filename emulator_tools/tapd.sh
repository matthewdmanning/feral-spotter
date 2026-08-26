#!/bin/sh
# Dump the current screen, then tap a node by its content-desc.
#
#   sh tapd.sh "Continue Observation" [settle-seconds]
#
# Prefer this over tap_text.py. tap_text.py locates the *last clickable
# ancestor before* the matching text, which silently targets a neighbouring
# control on screens where buttons share a container — it hit CANCEL instead
# of CLEAR on the Clear Draft dialog, and an abandon control instead of
# Confirm on annotate. tap_desc.py matches bounds on the node itself.
#
# The dump has to be re-pulled before every tap: tap_desc.py reads
# window_dump.xml off disk, so chaining taps against a stale dump taps
# wherever the *previous* screen had that node, or fails outright.
#
# MSYS_NO_PATHCONV=1 is required under Git Bash, which otherwise rewrites
# /sdcard/wd.xml into a Windows path and makes adb pull fail with
# "failed to stat remote object 'C:/Program Files/Git/sdcard/wd.xml'".
MSYS_NO_PATHCONV=1 adb shell uiautomator dump /sdcard/wd.xml >/dev/null 2>&1
MSYS_NO_PATHCONV=1 adb pull /sdcard/wd.xml window_dump.xml >/dev/null 2>&1
python tap_desc.py "$1"
sleep "${2:-2}"
