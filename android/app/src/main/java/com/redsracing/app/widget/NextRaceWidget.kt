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
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
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
            refreshAndRerender(context, appWidgetManager)
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

        /**
         * Fetch the latest schedule, persist the next race, then re-render any
         * widget instances currently on the home screen.
         */
        private fun refreshAndRerender(
            context: Context,
            appWidgetManager: AppWidgetManager
        ) {
            val race = try {
                fetchNextRace()
            } catch (e: IOException) {
                null
            } catch (e: JSONException) {
                null
            } catch (e: IllegalArgumentException) {
                null
            }
            if (race != null) {
                saveCache(context, race)
            }
            val freshIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, NextRaceWidget::class.java)
            )
            for (id in freshIds) {
                renderFromCache(context, appWidgetManager, id)
            }
        }

        fun renderFromCache(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_next_race)
            val race = readCache(context)
            applyRaceToViews(views, race)
            views.setOnClickPendingIntent(
                R.id.widget_root,
                buildSchedulePendingIntent(context, appWidgetId)
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        /**
         * Decide which rendering state to use (loading / live / countdown) and
         * write the matching values into the RemoteViews.
         */
        private fun applyRaceToViews(views: RemoteViews, race: RaceInfo?) {
            if (race == null) {
                writeLoadingState(views)
                return
            }
            val target = parseScheduleDate(race.isoDate)
            if (target == null) {
                writeRaceMetadata(views, race, prettyDate = "")
                writeCountdownChips(views, days = "--", hours = "--", minutes = "--")
                return
            }
            val remainingMs = target.time - System.currentTimeMillis()
            writeRaceMetadata(views, race, prettyDate = prettyDate(target))
            if (remainingMs <= 0) {
                writeCountdownChips(views, days = "LIVE", hours = "", minutes = "")
            } else {
                val days = TimeUnit.MILLISECONDS.toDays(remainingMs)
                val hours = TimeUnit.MILLISECONDS.toHours(remainingMs) % 24
                val minutes = TimeUnit.MILLISECONDS.toMinutes(remainingMs) % 60
                writeCountdownChips(
                    views,
                    days = days.toString(),
                    hours = hours.toString(),
                    minutes = minutes.toString()
                )
            }
        }

        private fun writeLoadingState(views: RemoteViews) {
            views.setTextViewText(R.id.widget_track, "Tap to refresh")
            views.setTextViewText(R.id.widget_subtitle, "Loading…")
            views.setTextViewText(R.id.widget_date, "")
            writeCountdownChips(views, days = "--", hours = "--", minutes = "--")
        }

        private fun writeRaceMetadata(
            views: RemoteViews,
            race: RaceInfo,
            prettyDate: String
        ) {
            views.setTextViewText(R.id.widget_track, race.track.ifEmpty { race.name })
            views.setTextViewText(R.id.widget_subtitle, race.location)
            views.setTextViewText(R.id.widget_date, prettyDate)
        }

        private fun writeCountdownChips(
            views: RemoteViews,
            days: String,
            hours: String,
            minutes: String
        ) {
            views.setTextViewText(R.id.widget_days, days)
            views.setTextViewText(R.id.widget_hours, hours)
            views.setTextViewText(R.id.widget_minutes, minutes)
        }

        /** Build the tap-to-open-schedule PendingIntent for a widget instance. */
        private fun buildSchedulePendingIntent(
            context: Context,
            appWidgetId: Int
        ): PendingIntent {
            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                data = Uri.parse("https://redsracing.org/schedule.html")
                putExtra("rr_target", "schedule")
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            return PendingIntent.getActivity(context, appWidgetId, openIntent, flags)
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
            } catch (_: IllegalArgumentException) {
                null
            }
        }

        /** Parse one race entry; returns null if any required field is missing. */
        private fun parseRace(json: JSONObject): Pair<Long, RaceInfo>? {
            val iso = json.optString("date").orEmpty()
            if (iso.isEmpty()) return null
            val parsed = parseScheduleDate(iso) ?: return null
            val name = json.optString("eventName").orEmpty()
            val track = json.optString("track").orEmpty()
            val city = json.optString("city").orEmpty()
            val state = json.optString("state").orEmpty()
            val loc = listOf(city, state).filter { it.isNotEmpty() }.joinToString(", ")
            return parsed.time to RaceInfo(
                name = name.ifEmpty { track },
                track = track,
                location = loc,
                isoDate = iso
            )
        }

        fun fetchNextRace(): RaceInfo? {
            val raw = httpGet(SCHEDULE_URL) ?: return null
            val json = JSONObject(raw)
            val seasons = json.optJSONArray("seasons") ?: return null
            val now = System.currentTimeMillis()
            var bestRace: RaceInfo? = null
            var bestTs: Long = Long.MAX_VALUE
            for (i in 0 until seasons.length()) {
                val races = seasons.optJSONObject(i)?.optJSONArray("races") ?: continue
                for (j in 0 until races.length()) {
                    val entry = races.optJSONObject(j) ?: continue
                    val parsed = parseRace(entry) ?: continue
                    val ts = parsed.first
                    if (ts > now && ts < bestTs) {
                        bestTs = ts
                        bestRace = parsed.second
                    }
                }
            }
            return bestRace
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
            } catch (_: IOException) {
                null
            } finally {
                connection?.disconnect()
            }
        }
    }
}
