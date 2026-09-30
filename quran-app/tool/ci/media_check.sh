#!/usr/bin/env bash
# Runs integration_test/media_notification_test.dart on the connected
# emulator. At each phase (the test drops MEDIA_PHASE_<name> in its files
# dir) it records what Android shows: the app's notifications, its media
# session and foreground service. Output: media-report.txt.
set -u
PKG=net.hussainkanaan.quran_app
OUT=media-report.txt
: > "$OUT"
adb logcat -c
flutter test integration_test/media_notification_test.dart -d emulator-5554 > test.log 2>&1 &
PID=$!

for phase in 1_first_play 2_paused 3_resumed 4_stopped 5_second_play; do
  until adb shell run-as $PKG ls files 2>/dev/null | grep -q "MEDIA_PHASE_$phase"; do
    if ! kill -0 $PID 2>/dev/null; then echo "test ended before $phase" >> "$OUT"; break 2; fi
    sleep 1
  done
  {
    echo "=================== $phase ($(date -u +%T))"
    echo "--- notification records for $PKG"
    adb shell dumpsys notification --noredact | grep -E "NotificationRecord\(.*$PKG|pkg=$PKG|channel=|mediaSession|FLAG_FOREGROUND|flags=" | grep -A3 "$PKG" | head -40
    echo "--- media session"
    adb shell dumpsys media_session | grep -A12 "$PKG/" | grep -E "$PKG|active=|state=|metadata" | head -12
    echo "--- foreground service"
    adb shell dumpsys activity services $PKG | grep -E "ServiceRecord|isForeground|foregroundId|foregroundNoti" | head -8
    echo "--- notification permission"
    adb shell dumpsys package $PKG | grep -E "POST_NOTIFICATIONS" | head -2
  } >> "$OUT"
done

wait $PID
STATUS=$?
echo "=================== test exit $STATUS" >> "$OUT"
echo "--- test output" >> "$OUT"
tail -25 test.log >> "$OUT"
echo "--- logcat (media / notifications / errors for $PKG)" >> "$OUT"
adb logcat -d | grep -E "quran_app|AudioService|audioservice|NotificationService|AndroidRuntime|FATAL" | tail -120 >> "$OUT"
cat "$OUT"
exit $STATUS
