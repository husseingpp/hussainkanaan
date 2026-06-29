//+------------------------------------------------------------------+
//|                                         DailyTimeRangeBox.mq5     |
//|  Draws a box on the chart for a fixed time window every day,     |
//|  e.g. from 23:57 to 01:01, so you can see the price difference   |
//|  (range / net move) across that window.                          |
//|                                                                  |
//|  The window may cross midnight (end time earlier than start      |
//|  time), which is exactly the 23:57 -> 01:01 case.               |
//+------------------------------------------------------------------+
#property copyright "Hussein Kanaan"
#property version   "1.00"
#property indicator_chart_window
#property indicator_plots 0

//--- inputs -----------------------------------------------------------
input int    InpStartHour   = 23;            // Window start hour (0-23)
input int    InpStartMin    = 57;            // Window start minute (0-59)
input int    InpEndHour     = 1;             // Window end hour (0-23)
input int    InpEndMin      = 1;             // Window end minute (0-59)
input int    InpMaxDays     = 60;            // How many days back to draw
input color  InpBoxColor    = clrDodgerBlue; // Box border / fill color
input bool   InpFill        = true;          // Fill the box
input bool   InpBack        = true;          // Draw behind price
input int    InpBorderWidth = 1;             // Border width
input bool   InpShowLabel   = true;          // Show price-difference label
input color  InpLabelColor  = clrWhite;      // Label text color
input int    InpLabelSize   = 8;             // Label font size

//--- globals ----------------------------------------------------------
const string OBJ_PREFIX = "DTRB_";           // unique prefix for our objects
int          g_startTod;                     // start time-of-day in minutes
int          g_endTod;                       // end time-of-day in minutes
bool         g_crossMidnight;                // does the window cross midnight?

//+------------------------------------------------------------------+
//| Initialization                                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   g_startTod      = InpStartHour * 60 + InpStartMin;
   g_endTod        = InpEndHour   * 60 + InpEndMin;
   g_crossMidnight = (g_endTod <= g_startTod);   // e.g. 23:57 -> 01:01
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Cleanup                                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0, OBJ_PREFIX);
   ChartRedraw();
  }

//+------------------------------------------------------------------+
//| Is the given time-of-day (minutes) inside the window?            |
//+------------------------------------------------------------------+
bool InWindow(const int tod)
  {
   if(g_crossMidnight)
      return(tod >= g_startTod || tod <= g_endTod);
   return(tod >= g_startTod && tod <= g_endTod);
  }

//+------------------------------------------------------------------+
//| Draw / update one session box                                    |
//+------------------------------------------------------------------+
void DrawBox(const datetime t1, const datetime t2,
             const double hi,   const double lo,
             const double pStart, const double pEnd)
  {
   string name = OBJ_PREFIX + (string)t1;

   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_RECTANGLE, 0, t1, hi, t2, lo);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN,     true);
     }
   ObjectSetInteger(0, name, OBJPROP_TIME,  0, t1);
   ObjectSetInteger(0, name, OBJPROP_TIME,  1, t2);
   ObjectSetDouble (0, name, OBJPROP_PRICE, 0, hi);
   ObjectSetDouble (0, name, OBJPROP_PRICE, 1, lo);
   ObjectSetInteger(0, name, OBJPROP_COLOR,   InpBoxColor);
   ObjectSetInteger(0, name, OBJPROP_WIDTH,   InpBorderWidth);
   ObjectSetInteger(0, name, OBJPROP_FILL,    InpFill);
   ObjectSetInteger(0, name, OBJPROP_BACK,    InpBack);

   if(!InpShowLabel)
      return;

   //--- price difference label (net move start -> end) -------------
   string lname = OBJ_PREFIX + "lbl_" + (string)t1;
   double diff  = pEnd - pStart;
   double pts   = diff / _Point;
   string txt   = StringFormat("%s%.*f  (%+.0f pts)",
                               (diff >= 0 ? "+" : ""), _Digits, diff, pts);

   if(ObjectFind(0, lname) < 0)
     {
      ObjectCreate(0, lname, OBJ_TEXT, 0, t2, hi);
      ObjectSetInteger(0, lname, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, lname, OBJPROP_HIDDEN,     true);
      ObjectSetInteger(0, lname, OBJPROP_ANCHOR, ANCHOR_LEFT_LOWER);
     }
   ObjectSetInteger(0, lname, OBJPROP_TIME,  0, t2);
   ObjectSetDouble (0, lname, OBJPROP_PRICE, 0, hi);
   ObjectSetString (0, lname, OBJPROP_TEXT,  txt);
   ObjectSetInteger(0, lname, OBJPROP_COLOR, InpLabelColor);
   ObjectSetInteger(0, lname, OBJPROP_FONTSIZE, InpLabelSize);
  }

//+------------------------------------------------------------------+
//| Main calculation                                                 |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
  {
   if(rates_total < 2)
      return(rates_total);

   //--- clear and rebuild (cheap for a few dozen boxes) ------------
   ObjectsDeleteAll(0, OBJ_PREFIX);

   MqlDateTime dt;
   bool     inSession = false;
   datetime sStart = 0, sEnd = 0;
   double   sHigh = 0, sLow = 0, sPriceStart = 0, sPriceEnd = 0;
   int      drawn = 0;

   //--- walk bars oldest -> newest --------------------------------
   for(int i = 0; i < rates_total; i++)
     {
      TimeToStruct(time[i], dt);
      int  tod    = dt.hour * 60 + dt.min;
      bool inWin  = InWindow(tod);

      if(inWin)
        {
         if(!inSession)
           {
            // open a new session
            inSession   = true;
            sStart      = time[i];
            sHigh       = high[i];
            sLow        = low[i];
            sPriceStart = open[i];   // price at the start of the window
           }
         else
           {
            if(high[i] > sHigh) sHigh = high[i];
            if(low[i]  < sLow)  sLow  = low[i];
           }
         sEnd      = time[i];
         sPriceEnd = close[i];       // price at the (current) end of window
        }
      else if(inSession)
        {
         // window just closed -> finalize this session
         inSession = false;
         if(drawn < InpMaxDays || InpMaxDays <= 0)
           {
            DrawBox(sStart, sEnd, sHigh, sLow, sPriceStart, sPriceEnd);
            drawn++;
           }
        }
     }

   //--- finalize the still-forming session at the chart's edge -----
   if(inSession && (drawn < InpMaxDays || InpMaxDays <= 0))
      DrawBox(sStart, sEnd, sHigh, sLow, sPriceStart, sPriceEnd);

   //--- keep only the most recent InpMaxDays boxes -----------------
   if(InpMaxDays > 0)
      TrimOldBoxes();

   ChartRedraw();
   return(rates_total);
  }

//+------------------------------------------------------------------+
//| Remove boxes older than InpMaxDays (keep newest)                 |
//+------------------------------------------------------------------+
void TrimOldBoxes()
  {
   // Collect rectangle start times, then delete the oldest extras.
   int total = ObjectsTotal(0, 0, OBJ_RECTANGLE);
   if(total <= InpMaxDays)
      return;

   // simple selection: find and delete oldest until within limit
   while(true)
     {
      int      cnt = 0;
      datetime oldest = 0;
      string   oldestName = "";
      for(int i = 0; i < ObjectsTotal(0, -1, -1); i++)
        {
         string nm = ObjectName(0, i);
         if(StringFind(nm, OBJ_PREFIX) != 0)            continue;
         if(StringFind(nm, OBJ_PREFIX + "lbl_") == 0)   continue; // skip labels
         cnt++;
         datetime t0 = (datetime)ObjectGetInteger(0, nm, OBJPROP_TIME, 0);
         if(oldestName == "" || t0 < oldest)
           {
            oldest     = t0;
            oldestName = nm;
           }
        }
      if(cnt <= InpMaxDays || oldestName == "")
         break;
      ObjectDelete(0, oldestName);
      ObjectDelete(0, OBJ_PREFIX + "lbl_" + (string)oldest);
     }
  }
//+------------------------------------------------------------------+
