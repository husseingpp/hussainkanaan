#!/usr/bin/env bash
# Runs integration_test/media_notification_test.dart on the connected
# emulator and, at each MEDIA_PHASE marker, records what Android shows:
# the app's notifications and its media session. Output: media-report.txt.
set -u
PKG=net.hussainkanaan.quran_app
OUT=media-report.txt
: > "$OUT"
adb logcat -c
flutter test integration_test/media_notification_test.dart -d emulator-5554 > test.log 2>&1 &
PID=$!

for phase in 1_first_play 2_paused 3_resumed 4_stopped 5_second_play; do
  until adb logcat -d | grep -q "MEDIA_PHASE_$phase"; do
    if ! kill -0 $PID 2>/dev/null; then echo "test ended before $phase" | tee -a "$OUT"; break 2; fi
    sleep 2
  done
  sleep 6
  {
    echo "=================== $phase"
    echo "--- notifications posted by $PKG"
    adb shell dumpsys notification --noredact | grep -A25 "pkg=$PKG" | head -80
    echo "--- media sessions"
    adb shell dumpsys media_session | grep -B2 -A14 "$PKG" | head -60
    echo "--- foreground services"
    adb shell dumpsys activity services $PKG | grep -iE "isForeground|foregroundId|ServiceRecord" | head -10
  } >> "$OUT"
done

wait $PID
STATUS=$?
echo "=================== test exit $STATUS" >> "$OUT"
echo "--- test output" >> "$OUT"
tail -40 test.log >> "$OUT"
echo "--- logcat (audio_service / errors)" >> "$OUT"
adb logcat -d | grep -iE "audioservice|audio_service|MediaSession|flutter|AndroidRuntime|Notification" | grep -v "MEDIA_PHASE" | tail -150 >> "$OUT"
cat "$OUT"
exit $STATUS
