# 0012 Repository und Versionsverwaltung

Status: vorgeschlagen

Orgamorph liegt in einem eigenen Repository (`https://github.com/dihydrogenmonoxid-ama/Orgamorph`). `dist/`, Testergebnisse, lokale Konfiguration und eigene Organisationsdaten werden nicht versioniert (`.gitignore`). release-please erzeugt Releases mit `orgamorph-vX.Y.Z.html` als einzigem Auslieferungsartefakt.
