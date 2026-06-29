# Daily Time-Range Box (MT5)

`DailyTimeRangeBox.mq5` is a MetaTrader 5 **indicator** that draws a box on the
chart for the same time window **every day** — by default from **23:57 to 01:01**
— so you can quickly see the price difference (the range and net move) across
that window.

The window is allowed to **cross midnight** (end time earlier than start time),
which is exactly the 23:57 → 01:01 case.

## What the box shows

- **Left / right edges** — the start (23:57) and end (01:01) of the window.
- **Top / bottom edges** — the highest high and lowest low reached inside the
  window (the price range).
- **Label** (optional) — the net price change from the start price to the end
  price, shown in price units and in points, e.g. `+0.00123 (+123 pts)`.

## Install

1. In MT5 open **File → Open Data Folder**.
2. Copy `DailyTimeRangeBox.mq5` into **`MQL5/Indicators/`**.
3. In **MetaEditor**, open the file and press **F7** (Compile).
4. Back in MT5, refresh the *Navigator* and drag **DailyTimeRangeBox** onto a
   chart.

## Inputs

| Input            | Default       | Meaning                                    |
|------------------|---------------|--------------------------------------------|
| `InpStartHour`   | `23`          | Window start hour (0–23)                    |
| `InpStartMin`    | `57`          | Window start minute (0–59)                  |
| `InpEndHour`     | `1`           | Window end hour (0–23)                       |
| `InpEndMin`      | `1`           | Window end minute (0–59)                     |
| `InpMaxDays`     | `60`          | How many recent days to draw (0 = all)      |
| `InpBoxColor`    | `DodgerBlue`  | Box border / fill color                      |
| `InpFill`        | `true`        | Fill the box                                 |
| `InpBack`        | `true`        | Draw behind the candles                      |
| `InpBorderWidth` | `1`           | Border line width                            |
| `InpShowLabel`   | `true`        | Show the price-difference label              |
| `InpLabelColor`  | `White`       | Label text color                             |
| `InpLabelSize`   | `8`           | Label font size                              |

## Notes

- **Times are broker/server time**, not your local time. If your broker server
  is on a different timezone, adjust the start/end hours accordingly.
- For the box to contain candles inside 23:57–01:01, use a low timeframe
  (M1 is ideal). On higher timeframes there may be no bars between 23:57 and
  01:01, so the box can look empty or be skipped.
- The indicator only draws objects; it does not place trades or add buffers.
