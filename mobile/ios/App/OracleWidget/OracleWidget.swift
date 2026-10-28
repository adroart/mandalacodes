import SwiftUI
import WidgetKit

struct OracleWidgetCard: Decodable {
    let number: Int
    let name: String
    let gift: String
    let lines: [Bool]
}
struct OracleWidgetTransition: Decodable {
    let at: Double
    let gate: Int
}
struct OracleWidgetData: Decodable {
    let version: Int
    let validFrom: Double
    let validUntil: Double
    let cards: [OracleWidgetCard]
    let transitions: [OracleWidgetTransition]

    static func load() -> OracleWidgetData? {
        guard let url = Bundle.main.url(forResource: "oracle-widget", withExtension: "json"),
              let bytes = try? Data(contentsOf: url),
              let data = try? JSONDecoder().decode(OracleWidgetData.self, from: bytes),
              data.version == 1, data.validUntil > data.validFrom,
              data.cards.count == 64, !data.transitions.isEmpty else { return nil }
        return data
    }
    func card(at date: Date) -> OracleWidgetCard? {
        let time = date.timeIntervalSince1970
        guard time >= validFrom, time < validUntil,
              let transition = transitions.last(where: { $0.at <= time }) else { return nil }
        return cards.first(where: { $0.number == transition.gate })
    }
}
struct OracleWidgetEntry: TimelineEntry {
    let date: Date
    let card: OracleWidgetCard?
}
struct OracleWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> OracleWidgetEntry {
        OracleWidgetEntry(date: Date(), card: OracleWidgetData.load()?.cards.first)
    }
    func getSnapshot(in context: Context, completion: @escaping (OracleWidgetEntry) -> Void) {
        let now = Date()
        completion(OracleWidgetEntry(date: now, card: OracleWidgetData.load()?.card(at: now)))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<OracleWidgetEntry>) -> Void) {
        let now = Date()
        guard let data = OracleWidgetData.load() else {
            completion(Timeline(entries: [OracleWidgetEntry(date: now, card: nil)], policy: .after(now.addingTimeInterval(86400))))
            return
        }
        var entries = [OracleWidgetEntry(date: now, card: data.card(at: now))]
        // Future entries keep the correct gate available without network access.
        for change in data.transitions where change.at > now.timeIntervalSince1970 && change.at < data.validUntil {
            let date = Date(timeIntervalSince1970: change.at)
            entries.append(OracleWidgetEntry(date: date, card: data.card(at: date)))
        }
        let expiry = Date(timeIntervalSince1970: data.validUntil)
        if expiry > now { entries.append(OracleWidgetEntry(date: expiry, card: nil)) }
        completion(Timeline(entries: entries, policy: .after(max(expiry, now).addingTimeInterval(86400))))
    }
}
private struct HexagramView: View {
    let lines: [Bool]
    let color: Color
    var body: some View {
        VStack(spacing: 5) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, solid in
                HStack(spacing: 7) {
                    Capsule().fill(color)
                    if !solid { Capsule().fill(color) }
                }.frame(height: 5)
            }
        }
        .accessibilityHidden(true)
    }
}
struct OracleWidgetView: View {
    var entry: OracleWidgetEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    private var paper: Color { scheme == .dark ? Color(red:0.09,green:0.07,blue:0.05) : Color(red:0.96,green:0.94,blue:0.90) }
    private var ink: Color { scheme == .dark ? Color(red:0.94,green:0.91,blue:0.85) : Color(red:0.16,green:0.13,blue:0.10) }
    private var bronze: Color { scheme == .dark ? Color(red:0.81,green:0.68,blue:0.45) : Color(red:0.51,green:0.36,blue:0.16) }
    var body: some View {
        content
            .foregroundStyle(ink)
            .widgetURL(URL(string: entry.card.map { "oracle://card/\($0.number)" } ?? "oracle://home"))
            .modifier(OracleWidgetBackground(color:paper))
    }
    @ViewBuilder private var content: some View {
        if let card = entry.card {
            VStack(alignment:.leading,spacing:8) {
                HStack {
                    Text("TODAY’S CODE").font(.system(size:10,weight:.semibold,design:.rounded)).tracking(1)
                    Spacer(minLength:4)
                    Text(String(card.number)).font(.system(size:14,weight:.semibold,design:.serif))
                }.foregroundStyle(bronze)
                if family == .systemMedium {
                    HStack(alignment:.center,spacing:20) {
                        HexagramView(lines:card.lines,color:bronze).frame(width:60)
                        VStack(alignment:.leading,spacing:6) {
                            Text(card.name).font(.system(size:25,weight:.medium,design:.serif)).lineLimit(2).minimumScaleFactor(0.8)
                            Text(card.gift).font(.system(size:14,weight:.regular,design:.serif)).foregroundStyle(bronze).lineLimit(2)
                        }
                        Spacer(minLength:0)
                    }.frame(maxHeight:.infinity)
                } else {
                    HStack(alignment:.top,spacing:10) {
                        HexagramView(lines:card.lines,color:bronze).frame(width:34).padding(.top,2)
                        Text(card.name).font(.system(size:19,weight:.medium,design:.serif)).lineLimit(3).minimumScaleFactor(0.8)
                    }.frame(maxHeight:.infinity,alignment:.center)
                    Text(card.gift).font(.system(size:12,design:.serif)).foregroundStyle(bronze).lineLimit(1)
                }
            }
            .accessibilityElement(children:.combine)
            .accessibilityLabel("Today's code, \(card.number), \(card.name). Gift: \(card.gift). Open reading.")
        } else {
            VStack(alignment:.leading,spacing:10) {
                Text("ORACLE").font(.system(size:11,weight:.semibold,design:.rounded)).tracking(1).foregroundStyle(bronze)
                Text("Update Oracle").font(.system(size:22,weight:.medium,design:.serif))
                Text("Install the latest app for fresh dates.").font(.system(size:12)).foregroundStyle(ink.opacity(0.8))
            }.frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.leading)
        }
    }
}
private struct OracleWidgetBackground: ViewModifier {
    let color: Color
    @ViewBuilder func body(content: Content) -> some View {
        if #available(iOS 17.0, *) { content.containerBackground(color,for:.widget) }
        else { content.padding(16).background(color) }
    }
}
@main
struct OracleWidget: Widget {
    let kind = "OracleTodaysCode"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind:kind,provider:OracleWidgetProvider()) { entry in OracleWidgetView(entry:entry) }
            .configurationDisplayName("Today's Code")
            .description("The current solar code, with its hexagram and gift. Tap to read.")
            .supportedFamilies([.systemSmall,.systemMedium])
    }
}
