import WidgetKit
import SwiftUI

/// MARK: - Data model

struct NextRaceEntry: TimelineEntry {
    let date: Date
    let raceName: String
    let track: String
    let location: String
    let raceDate: Date?
    let status: Status

    enum Status {
        case ok
        case loading
        case noUpcoming
        case error
    }
}

/// MARK: - Timeline provider
///
/// The widget fetches `https://redsracing.org/data/schedule.json` directly and
/// caches the next future race in the shared App Group container (see
/// `WidgetConfig.appGroup`). WidgetKit asks for new timelines roughly every
/// 30–60 minutes; we also schedule explicit refreshes so the countdown stays
/// fresh.

struct NextRaceProvider: TimelineProvider {

    func placeholder(in context: Context) -> NextRaceEntry {
        NextRaceEntry(
            date: Date(),
            raceName: "Loading…",
            track: "RedsRacing",
            location: "",
            raceDate: nil,
            status: .loading
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (NextRaceEntry) -> Void) {
        if let cached = NextRaceCache.read() {
            completion(cached.toEntry(now: Date()))
            return
        }
        completion(
            NextRaceEntry(
                date: Date(),
                raceName: "Next Race",
                track: "Tap to refresh",
                location: "",
                raceDate: nil,
                status: .loading
            )
        )
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextRaceEntry>) -> Void) {
        Task {
            let race = await ScheduleService.fetchNextRace() ?? NextRaceCache.read()
            if let race = race {
                NextRaceCache.write(race)
            }

            let now = Date()
            // Provide a handful of entries over the next hour so the countdown
            // ticks down without needing to network-refresh constantly.
            var entries: [NextRaceEntry] = []
            for minuteOffset in stride(from: 0, through: 60, by: 5) {
                let stamp = now.addingTimeInterval(TimeInterval(minuteOffset * 60))
                entries.append(
                    race?.toEntry(now: stamp)
                    ?? NextRaceEntry(
                        date: stamp,
                        raceName: "RedsRacing",
                        track: "No upcoming race",
                        location: "",
                        raceDate: nil,
                        status: .noUpcoming
                    )
                )
            }

            // Ask WidgetKit for a fresh timeline in 30 min so we re-poll the
            // schedule.json endpoint.
            let next = now.addingTimeInterval(30 * 60)
            completion(Timeline(entries: entries, policy: .after(next)))
        }
    }
}

/// MARK: - View

struct NextRaceWidgetView: View {
    var entry: NextRaceEntry

    @Environment(\.widgetFamily) private var family

    var body: some View {
        ZStack {
            backgroundGradient
            content
                .padding(14)
        }
        // iOS 17+: widget background API
        .containerBackground(for: .widget) {
            backgroundGradient
        }
    }

    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color(red: 0.04, green: 0.07, blue: 0.14),
                Color(red: 0.01, green: 0.02, blue: 0.06)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    @ViewBuilder
    private var content: some View {
        switch entry.status {
        case .loading, .error:
            placeholderView
        case .noUpcoming:
            noUpcomingView
        case .ok:
            okView
        }
    }

    private var headerRow: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color(red: 0.97, green: 1.0, blue: 0.0))
                .frame(width: 8, height: 8)
            Text("NEXT RACE")
                .font(.system(size: 11, weight: .heavy))
                .foregroundColor(Color(red: 0.97, green: 1.0, blue: 0.0))
                .kerning(1.5)
            Spacer()
            if let date = entry.raceDate {
                Text(date, format: .dateTime.month(.abbreviated).day())
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.gray)
            }
        }
    }

    private var okView: some View {
        VStack(alignment: .leading, spacing: 6) {
            headerRow
            Text(entry.track.isEmpty ? entry.raceName : entry.track)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.white)
                .lineLimit(1)
            Text(entry.location)
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(Color(white: 0.78))
                .lineLimit(1)
            Spacer(minLength: 4)
            chipsRow
        }
    }

    private var chipsRow: some View {
        let remaining = entry.raceDate.map { max(0, $0.timeIntervalSince(entry.date)) } ?? 0
        let days = Int(remaining / 86400)
        let hours = Int((remaining.truncatingRemainder(dividingBy: 86400)) / 3600)
        let minutes = Int((remaining.truncatingRemainder(dividingBy: 3600)) / 60)
        return HStack(spacing: 6) {
            chip(value: days == 0 && remaining == 0 ? "LIVE" : "\(days)", label: days == 0 && remaining == 0 ? "" : "DAYS", accent: true)
            chip(value: "\(hours)", label: "HRS")
            chip(value: "\(minutes)", label: "MIN")
        }
    }

    private func chip(value: String, label: String, accent: Bool = false) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(accent ? Color(red: 0.97, green: 1.0, blue: 0.0) : .white)
            if !label.isEmpty {
                Text(label)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundColor(.gray)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(red: 0.06, green: 0.10, blue: 0.19))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(Color(red: 0.12, green: 0.16, blue: 0.27), lineWidth: 1)
                )
        )
    }

    private var placeholderView: some View {
        VStack(alignment: .leading, spacing: 6) {
            headerRow
            Text("Loading…")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.white)
            Text("Tap to refresh")
                .font(.system(size: 12))
                .foregroundColor(.gray)
            Spacer()
        }
    }

    private var noUpcomingView: some View {
        VStack(alignment: .leading, spacing: 6) {
            headerRow
            Text("No upcoming race")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.white)
            Text("Check back soon")
                .font(.system(size: 12))
                .foregroundColor(.gray)
            Spacer()
        }
    }
}

/// MARK: - Widget configuration

@main
struct RedsRacingWidget: Widget {
    let kind: String = "RedsRacingNextRaceWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextRaceProvider()) { entry in
            NextRaceWidgetView(entry: entry)
        }
        .configurationDisplayName("Next Race")
        .description("Live countdown to the next RedsRacing race. Tap to open the schedule.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}
