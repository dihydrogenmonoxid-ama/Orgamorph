# Theory: topologies and metrics

[Deutsch](theorie.md) · English

Orgamorph overlays two views of an organization: the **formal line** (who reports to whom) and **actual collaboration** (who works with whom on projects and topics, who informs whom). All metrics describe structures; none of them is a judgement.

## Three views of one graph

| View | Layout | Shows |
|---|---|---|
| Org chart | Reingold–Tilford (tidy tree) | hierarchy, levels, spans of control |
| Star network | balloon layout | the same hierarchy from the centre; projects drawn as coloured minimum spanning trees |
| Network | force-directed (springs and repulsion), fixed seed | collaboration: units sharing many projects move closer together |

Org chart and star network are **the same tree in two layouts**; the animated transition makes this visible.

## Metrics

All metrics refer to the current filter.

- **Depth** and **width per level**.
- **Span of control**: number of direct subordinate units; min/median/max and a hint above a configurable value (default 7). A guideline, not a norm.
- **Interfaces**: pairs of units from **different areas** (subtrees below first-level units, or below the focus unit) connected by a shared project or a relation.
- **Meshedness**: `M = (E − (n − k)) / (n(n−1)/2 − (n − k))` with `n` nodes, `E` distinct undirected edges (line, collaboration, relations) and `k` connected components. `M = 0` is a pure tree, `M = 1` means everyone is connected to everyone.

## Outlook (phase 2)

Betweenness centrality (Brandes 2001), articulation points and failure simulation, brokerage roles after Gould & Fernandez (1989): coordinator, consultant, gatekeeper, representative and liaison. Organigraph templates after Mintzberg & Van der Heyden (1999).

## References

See the [German version](theorie.md#quellen).
