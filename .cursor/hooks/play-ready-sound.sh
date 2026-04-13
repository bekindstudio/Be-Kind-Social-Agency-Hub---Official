#!/bin/bash

# Cursor hook payload is not needed for this action.
cat >/dev/null

SOUND_FILE="${CURSOR_HOOK_SOUND_FILE:-/System/Library/Sounds/Glass.aiff}"

if command -v afplay >/dev/null 2>&1 && [ -f "$SOUND_FILE" ]; then
  afplay "$SOUND_FILE" >/dev/null 2>&1 &
fi

exit 0
