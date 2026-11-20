# Orgamorph

**From org chart to network.**
See how your organization really works: units, topics, interfaces.

[Deutsch](README.md) · English

<!-- TODO: Animated GIF: the org chart turns into a star network, projects overlay in colour -->

---

Every organization has an org chart. It shows who reports to whom.
What it doesn't show: who works with whom on what, where departments depend on each other, and where everything converges.

Real work happens across the lines: in projects, working groups, committees and cross-cutting tasks. That is where friction, coordination effort and dependencies arise. And that is exactly what the org chart leaves out.

**Orgamorph makes it visible.** You enter your structure as usual, add projects and topics, and with one click the org chart turns into a network. You see where things concentrate, who is connected to whom, and which units hold many threads at once.

## What Orgamorph does

**Capture your organization without drawing**

- Organizational units with name, short name, type and area of responsibility
- Head of unit with function, function code, and optionally position number and name
- Clear parent–child structure: executive level, departments, divisions, sections, staff units
- Fast keyboard entry or import from Excel (XLSX) or CSV, with a ready-made template

**Overlay projects, topics and relations**

- Projects, working groups, committees and cross-cutting tasks with a time span (from–to or permanent)
- Participating units, as lead or contributor, picked straight from the structure
- Relations beyond the line: who reports to whom, who gives functional direction, who informs whom

**Three views of the same organization**

- **Org chart:** the formal structure, cleanly laid out
- **Star network:** the same structure seen from its centre. The transition is animated so you can see it is the same organization.
- **Network:** collaboration as it is lived. The more projects two units share, the closer they move and the stronger their link.

**Look where it matters**

- Focus on one area: "only department 1 and its divisions", optionally with its external contacts
- Reference date: which projects were running on 1 March?
- Metrics: span of control, interfaces, project involvement per unit, degree of interconnection

**Export**

- PDF on A4 or A3, automatically fitted, with title block and legend
- SVG for further editing, PNG for slides
- Names and position numbers are hidden in every export by default

## Get started in one minute

1. Download `orgamorph-vX.Y.Z.html` from [Releases](../../releases).
2. Double-click it.
3. Done.

No installation, no server, no account, no cloud. Orgamorph is a single HTML file that runs in your browser, offline included.

Two examples are bundled: a city administration following the KGSt administrative structure plan and a simple company. For your own structure there is an Excel template with an example sheet and a blank sheet.

## Your data stays with you

Orgamorph sends nothing. No telemetry, no analytics, no external fonts or libraries. The app is locked down so that it cannot open a network connection at all.

Your work is stored in a file (`*.orgamorph.json`) that you keep wherever you like: a project folder, a network drive, a Git repository. Every change is saved automatically, and `Ctrl+Z` undoes any step.

| Browser         | Saving                                                     |
| --------------- | ---------------------------------------------------------- |
| Chrome, Edge    | Choose a location once, then autosave straight to the file |
| Firefox, Safari | Autosave in the browser, plus "Save as file" via download  |

## Who it's for

- **Leaders** who want to see how their area is intertwined with others
- **Organizational development and public sector reform**, to show the current state and discuss changes
- **Project and programme managers**, to see stakeholders and interfaces at a glance
- **Fire, rescue and civil protection services**, to map command staff structures and links to partner organizations
- **Consulting, teaching and study**, to make organization theory tangible

## Background

Organizations have long been networks. The question is not _whether_ we work in networks, but _how well_. Orgamorph builds on established concepts:

- **Network topologies:** star, tree, line, partial and full mesh, with their trade-offs between resilience and coordination effort
- **Organigraphs** by Mintzberg & Van der Heyden (1999): think of organizations as chains, hubs and webs, not just boxes
- **Brokerage roles** by Gould & Fernandez (1989): coordinator, gatekeeper, representative, consultant, liaison. Whoever relays, filters or bridges information has influence, with or without a formal title. (Planned for version 0.2.)

More in [docs/theory.en.md](docs/theory.en.md).

## Privacy and co-determination

Orgamorph is meant for structures: units and positions. Names are always optional. If you record real people or analyse individuals, observe the GDPR and involve your works council or staff council early. This is not legal advice.

## Status and roadmap

Orgamorph is in development. Version 0.1 is in preparation.

- **0.1:** data entry, three views, projects and relations, filters, metrics, PDF/SVG/PNG
- **0.2–0.4:** bottlenecks and critical units, failure simulation ("what if this unit drops out?"), brokerage roles after Gould & Fernandez
- **Later:** allocation of responsibilities with deputies, target/actual comparison, timeline

See the [CHANGELOG](CHANGELOG.md) for all changes.

## Build it yourself

Requires Node.js (current LTS).

```bash
git clone https://github.com/<github-user>/orgamorph.git
cd orgamorph
npm ci
npm run build      # creates dist/orgamorph.html
```

Open `dist/orgamorph.html` directly in your browser. During development, `npm run watch` rebuilds on every change; just reload the page. No server needed.

## Contributing

Feedback, bug reports and ideas are welcome, especially from practitioners in public administration, business and emergency services. Please use the [issues](../../issues). For code contributions: [Conventional Commits](https://www.conventionalcommits.org/), architecture decisions in [docs/adr](docs/adr/README.md).

## Licence

[EUPL-1.2](LICENSE), the open source licence of the European Union. It is equally valid in all official EU languages.
