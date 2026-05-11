import Foundation

/// Mirrors the Android widget's data fetch logic so both apps stay in sync.
/// Fetches https://redsracing.org/data/schedule.json, picks the next race in
/// the future, and exposes a small persisted cache for offline rendering.

struct CachedRace: Codable {
    let raceName: String
    let track: String
    let location: String
    let isoDate: String       // yyyy-MM-dd
    let fetchedAt: Date
}

extension CachedRace {
    /// Map a cached race to a renderable timeline entry. `now` controls the
    /// timestamp on the entry (used for the countdown computation in the view).
    func toEntry(now: Date) -> NextRaceEntry {
        let parsed = ScheduleService.parseLocalDate(isoDate)
        return NextRaceEntry(
            date: now,
            raceName: raceName,
            track: track,
            location: location,
            raceDate: parsed,
            status: parsed == nil ? .error : .ok
        )
    }
}

/// MARK: - Cache (App Group so the main app and widget can share)

enum WidgetConfig {
    /// IMPORTANT: This App Group ID must be added in Xcode's Signing &
    /// Capabilities for BOTH the main RedsRacing target AND the widget target.
    /// If you change it here, update both targets.
    static let appGroup = "group.com.redsracing.app.shared"
}

enum NextRaceCache {
    private static let key = "rr_widget_next_race_v1"

    static func defaults() -> UserDefaults? {
        UserDefaults(suiteName: WidgetConfig.appGroup) ?? UserDefaults.standard
    }

    static func read() -> CachedRace? {
        guard let data = defaults()?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(CachedRace.self, from: data)
    }

    static func write(_ race: CachedRace) {
        guard let encoded = try? JSONEncoder().encode(race) else { return }
        defaults()?.set(encoded, forKey: key)
    }
}

/// MARK: - Network + parsing

enum ScheduleService {
    static let scheduleURL = URL(string: "https://redsracing.org/data/schedule.json")!

    static func fetchNextRace() async -> CachedRace? {
        var request = URLRequest(url: scheduleURL,
                                 cachePolicy: .reloadIgnoringLocalCacheData,
                                 timeoutInterval: 8)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode) else {
                return nil
            }
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            guard let seasons = json?["seasons"] as? [[String: Any]] else { return nil }

            let now = Date()
            var best: (date: Date, race: CachedRace)?

            for season in seasons {
                guard let races = season["races"] as? [[String: Any]] else { continue }
                for race in races {
                    guard let iso = race["date"] as? String,
                          let parsed = parseLocalDate(iso),
                          parsed > now else { continue }

                    if best == nil || parsed < best!.date {
                        let name = (race["eventName"] as? String) ?? ""
                        let track = (race["track"] as? String) ?? ""
                        let city = (race["city"] as? String) ?? ""
                        let state = (race["state"] as? String) ?? ""
                        let loc = [city, state].filter { !$0.isEmpty }.joined(separator: ", ")
                        best = (
                            parsed,
                            CachedRace(
                                raceName: name.isEmpty ? track : name,
                                track: track,
                                location: loc,
                                isoDate: iso,
                                fetchedAt: Date()
                            )
                        )
                    }
                }
            }
            return best?.race
        } catch {
            return nil
        }
    }

    /// Parse a yyyy-MM-dd string as the local-time "race day", normalized to
    /// 12 PM local so countdowns feel right (a race "on the 18th" should show
    /// 0 days remaining on the morning of the 18th, not the night before).
    static func parseLocalDate(_ iso: String) -> Date? {
        let fmt = DateFormatter()
        fmt.calendar = Calendar(identifier: .gregorian)
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone.current
        fmt.dateFormat = "yyyy-MM-dd"
        guard let day = fmt.date(from: iso) else { return nil }
        var comps = Calendar.current.dateComponents([.year, .month, .day], from: day)
        comps.hour = 12
        comps.minute = 0
        comps.second = 0
        return Calendar.current.date(from: comps)
    }
}
