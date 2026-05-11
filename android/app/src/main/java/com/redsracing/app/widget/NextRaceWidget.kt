package com.redsracing.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.widget.RemoteViews
import com.redsracing.app.MainActivity
import com.redsracing.app.R
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Home-screen widget that shows a countdown to the next RedsRacing race.
 *
 * Data source: https://redsracing.org/data/schedule.json (already hosted).
 *
 * Refresh strategy:
 *   - System invokes onUpdate() once per `updatePeriodMillis` from the
 *     widget-info XML (every 30 minutes — the minimum Android allows).
 *   - Each onUpdate spawns a background thread that pulls schedule.json,
 *     finds the next future race, caches it in SharedPreferences, and
 *     re-renders all widget instances.
 *   - Tap behavior opens the schedule page inside the app via a deep
 *     intent ("rr_target=schedule").
 */
class NextRaceWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Render cached values right away so the user sees something fast.
        for (id in appWidgetIds) {
            renderFromCache(context, appWidgetManager, id)
        }
        // Then refresh asynchronously to update the countdown / race data.
        thread(start = true, isDaemon = true, name = "NextRaceWidget-fetch") {
            try {
                val race = fetchNextRace()
                if (race != null) {
                    saveCache(context, race)
                }
            } catch (t: Throwable) {
                // Swallow — keep prior cached values rather than blanking the widget.
            }
            // Re-render after the fetch attempt (with new or existing cache).
            val freshIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, NextRaceWidget::class.java)
            )
            for (id in freshIds) {
                renderFromCache(context, appWidgetManager, id)
            }
        }
    }

    companion object {
        private const val PREFS = "rr_widget_next_race"
        private const val KEY_RACE_NAME = "race_name"
        private const val KEY_RACE_TRACK = "race_track"
        private const val KEY_RACE_LOC = "race_loc"
        private const val KEY_RACE_DATE_ISO = "race_date_iso"
        private const val KEY_LAST_FETCH = "last_fetch_ms"

        private const val SCHEDULE_URL = "https://redsracing.org/data/schedule.json"

        fun prefs(context: Context): SharedPreferences =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        data class RaceInfo(
            val name: String,
            val track: String,
            val location: String,
            val isoDate: String
        )

        fun saveCache(context: Context, race: RaceInfo) {
            prefs(context).edit()
                .putString(KEY_RACE_NAME, race.name)
                .putString(KEY_RACE_TRACK, race.track)
                .putString(KEY_RACE_LOC, race.location)
                .putString(KEY_RACE_DATE_ISO, race.isoDate)
                .putLong(KEY_LAST_FETCH, System.currentTimeMillis())
                .apply()
        }

        fun readCache(context: Context): RaceInfo? {
            val p = prefs(context)
            val iso = p.getString(KEY_RACE_DATE_ISO, null) ?: return null
            return RaceInfo(
                name = p.getString(KEY_RACE_NAME, "Next Race") ?: "Next Race",
                track = p.getString(KEY_RACE_TRACK, "") ?: "",
                location = p.getString(KEY_RACE_LOC, "") ?: "",
                isoDate = iso
            )
        }

        fun renderFromCache(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_next_race)
            val race = readCache(context)
            if (race == null) {
                views.setTextViewText(R.id.widget_track, "Tap to refresh")
                views.setTextViewText(R.id.widget_subtitle, "Loading…")
                views.setTextViewText(R.id.widget_days, "--")
                views.setTextViewText(R.id.widget_hours, "--")
                views.setTextViewText(R.id.widget_minutes, "--")
                views.setTextViewText(R.id.widget_date, "")
            } else {
                val target = parseScheduleDate(race.isoDate)
                if (target == null) {
                    views.setTextViewText(R.id.widget_track, race.track.ifEmpty { race.name })
                    views.setTextViewText(R.id.widget_subtitle, race.location)
                    views.setTextViewText(R.id.widget_days, "--")
                    views.setTextViewText(R.id.widget_hours, "--")
                    views.setTextViewText(R.id.widget_minutes, "--")
                    views.setTextViewText(R.id.widget_date, "")
                } else {
                    val remainingMs = target.time - System.currentTimeMillis()
                    if (remainingMs <= 0) {
                        views.setTextViewText(R.id.widget_track, race.track.ifEmpty { race.name })
                        views.setTextViewText(R.id.widget_subtitle, race.location)
                        views.setTextViewText(R.id.widget_days, "LIVE")
                        views.setTextViewText(R.id.widget_hours, "")
                        views.setTextViewText(R.id.widget_minutes, "")
                        views.setTextViewText(R.id.widget_date, race.isoDate)
                    } else {
                        val days = TimeUnit.MILLISECONDS.toDays(remainingMs)
                        val hours = TimeUnit.MILLISECONDS.toHours(remainingMs) % 24
                        val minutes = TimeUnit.MILLISECONDS.toMinutes(remainingMs) % 60
                        views.setTextViewText(R.id.widget_track, race.track.ifEmpty { race.name })
                        views.setTextViewText(R.id.widget_subtitle, race.location)
                        views.setTextViewText(R.id.widget_days, days.toString())
                        views.setTextViewText(R.id.widget_hours, hours.toString())
                        views.setTextViewText(R.id.widget_minutes, minutes.toString())
                        views.setTextViewText(R.id.widget_date, prettyDate(target))
                    }
                }
            }

            // Tap -> open the schedule page inside the app.
            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                data = Uri.parse("https://redsracing.org/schedule.html")
                putExtra("rr_target", "schedule")
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            val pi = PendingIntent.getActivity(context, appWidgetId, openIntent, flags)
            views.setOnClickPendingIntent(R.id.widget_root, pi)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun prettyDate(date: Date): String {
            val fmt = SimpleDateFormat("MMM d", Locale.getDefault())
            return fmt.format(date)
        }

        /**
         * Schedule entries use a yyyy-MM-dd local date. We interpret that as the
         * race day at noon local time so countdown values feel right (a race "on
         * the 18th" should show 0 days remaining on the morning of the 18th).
         */
        private fun parseScheduleDate(iso: String): Date? {
            return try {
                val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                fmt.timeZone = TimeZone.getDefault()
                val d = fmt.parse(iso) ?: return null
                val cal = Calendar.getInstance().apply {
                    time = d
                    set(Calendar.HOUR_OF_DAY, 12)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                cal.time
            } catch (_: Throwable) {
                null
            }
        }

        fun fetchNextRace(): RaceInfo? {
            val raw = httpGet(SCHEDULE_URL) ?: return null
            val json = JSONObject(raw)
            val seasons = json.optJSONArray("seasons") ?: return null
            val now = System.currentTimeMillis()
            var best: RaceInfo? = null
            var bestTs: Long = Long.MAX_VALUE
            for (i in 0 until seasons.length()) {
                val season = seasons.optJSONObject(i) ?: continue
                val races = season.optJSONArray("races") ?: continue
                for (j in 0 until races.length()) {
                    val race = races.optJSONObject(j) ?: continue
                    val iso = race.optString("date").orEmpty()
                    if (iso.isEmpty()) continue
                    val parsed = parseScheduleDate(iso) ?: continue
                    val ts = parsed.time
                    if (ts <= now) continue
                    if (ts < bestTs) {
                        bestTs = ts
                        val name = race.optString("eventName").orEmpty()
                        val track = race.optString("track").orEmpty()
                        val city = race.optString("city").orEmpty()
                        val state = race.optString("state").orEmpty()
                        val loc = listOf(city, state).filter { it.isNotEmpty() }
                            .joinToString(", ")
                        best = RaceInfo(
                            name = name.ifEmpty { track },
                            track = track,
                            location = loc,
                            isoDate = iso
                        )
                    }
                }
            }
            return best
        }

        private fun httpGet(urlStr: String): String? {
            var connection: HttpURLConnection? = null
            return try {
                val url = URL(urlStr)
                connection = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 8000
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("Cache-Control", "no-cache")
                }
                val code = connection.responseCode
                if (code in 200..299) connection.inputStream.bufferedReader().readText()
                else null
            } catch (_: Throwable) {
                null
            } finally {
                connection?.disconnect()
            }
        }
    }
}
