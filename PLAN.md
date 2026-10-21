# Plan – KI-Finanz-Radar

Stand: 21.10.2026. Jeder Meilenstein wird lokal getestet und erst nach OK veröffentlicht.

## Geprüfte Grundlagen (21.10.2026)

| Bereich | Ergebnis |
|---|---|
| News-Feeds | 38 von 46 getesteten Feeds liefern aktuelle Meldungen (Liste unten) |
| Kurse Hauptquelle | Yahoo-Chart-Abfrage liefert Indizes und Xetra-ETFs (z. B. `^GDAXI`, `EUNL.DE`). Inoffiziell, kann auf GitHub-Servern blockiert werden |
| Kurse Ausweichquelle | Stooq-CSV antwortet nicht mehr (404) → Ersatz wird in M4 gesucht (Kandidaten: Twelve Data, Finnhub, Alpha Vantage – alle mit Gratis-Schlüssel) |
| Wechselkurse | EZB-Referenzkurse (offiziell, ohne Schlüssel) ✅ |
| Bitcoin | CoinGecko (ohne Schlüssel) ✅ |
| Wetter Freiburg | Open-Meteo (ohne Schlüssel) ✅ |
| Push | ntfy.sh erreichbar ✅ |
| KI | Gemini → Groq → Mistral → OpenRouter, alle ohne Kreditkarte |

### Funktionierende Feeds
- **Wirtschaft DE:** Handelsblatt (Schlagzeilen, Finanzen), tagesschau Wirtschaft, FAZ Finanzen, Spiegel Wirtschaft, manager magazin, n-tv Wirtschaft, finanzen.net
- **Wirtschaft US:** CNBC (Top News, Markets), MarketWatch, Reuters (über Google News)
- **KI & Tech:** heise, heise KI, t3n, golem, The Verge, TechCrunch (+ AI, Venture), Ars Technica
- **KI-Firmen:** OpenAI, Anthropic (über Google News), Google AI, Google DeepMind, NVIDIA Blog + Newsroom, Hugging Face
- **Startups:** Crunchbase News, Gründerszene, deutsche-startups.de
- **Zentralbanken/Aufsicht:** EZB, Fed, Bundesbank, SEC Pressemitteilungen, SEC EDGAR 8-K
- **ETF:** iShares (über Google News)
- **Krypto:** Cointelegraph, CoinDesk

### Noch ohne Feed (Ersatz suchen)
tagesschau Börse, Yahoo Finance News, Destatis, Eurostat, deutsche Ad-hoc-Meldungen (EQS/DGAP), justETF

## Reichen die Gratis-Grenzen?

| Dienst | Grenze (gratis) | Bedarf (geschätzt) | Reicht? |
|---|---|---|---|
| GitHub Actions | öffentliches Repo: unbegrenzte Minuten | 96 Läufe/Tag × 1–2 Min. | ✅ |
| GitHub Pages | ca. 10 Veröffentlichungen/Stunde, 1 GB Seite, 100 GB Datenverkehr/Monat | 4/Stunde, wenige MB | ✅ |
| Gemini (Flash) | ca. 250–1.500 Anfragen/Tag | ca. 40–80/Tag (Vorfilter + 20–25 Meldungen pro Anfrage) | ✅ |
| Groq / Mistral / OpenRouter | ca. 1.000 / sehr viel / 50 pro Tag | nur bei Gemini-Ausfall | ✅ |
| ntfy.sh | großzügig | wenige Nachrichten/Tag | ✅ |
| Open-Meteo, EZB, CoinGecko | großzügig | 1 Abruf je Lauf | ✅ |
| Bilder (Nano Banana) | voraussichtlich nicht dauerhaft gratis per API | – | ⚠️ in M6 prüfen, sonst Symbolbilder |

**Repo klein halten:** Meldungen werden nicht alle 15 Minuten in die Hauptgeschichte committet, sondern in einen eigenen Daten-Zweig, der regelmäßig zusammengefasst wird. Meldungen älter als 30 Tage werden gelöscht.

## Meilensteine

### M1 – Grundgerüst lokal (Version 0.1)
- Projektaufbau mit Node.js, Quellenliste `quellen.json` (zum Start 8–10 Feeds)
- Abruf mit eigenem User-Agent, Fehler einer Quelle stoppt nichts
- Vorfilter ohne KI: Dubletten raus, Stichwort-Ausschlussliste
- Einfache PWA: Reiter „Live-Ticker“ (Liste) und „Wichtig“ (noch leer), deutsche Zeit
- Sicherheit von Anfang an: HTML-Bereinigung, Content Security Policy, nur https-Links, noindex
- Automatische Tests (Node-eigener Testrunner, keine Zusatzpakete)
- **Du prüfst:** App lokal im Browser öffnen

### M2 – KI-Filter
- Gemini-Schlüssel in Google AI Studio anlegen (Anleitung Schritt für Schritt)
- Festes JSON-Format, Prüfung aller Werte, Schutz vor Prompt Injection
- Relevanz 1–10, Kategorie, Schlagwörter, Stimmung; ab 7 ausführliche Analyse
- Ausweichkette Groq → Mistral → OpenRouter (Konten anlegen)
- **Du prüfst:** Reiter „Wichtig“ mit echten Analysen

### M3 – Online gehen (= Version 1)
- Repo `KI-Finanz-Radar` auf GitHub anlegen, Schlüssel in GitHub Secrets
- Abruf alle 15 Minuten per GitHub Actions (minimale Rechte, auf SHA gepinnt)
- Veröffentlichung über GitHub Pages; Secret Scanning, Push Protection, Dependabot an
- **Du prüfst:** App auf PC und Android installieren

### M4 – Kurse und Kopfzeile
- Große Werteliste (Variante B), Ausweich-Kursquelle, letzte Kurse mit Zeitstempel
- Mini-Kursübersicht ▲/▼, Watchlist-Import nur lokal (Name + ISIN), Markierung > 3 %
- Kopfzeile: Datum, KW, Uhr mit Sekunden, Wetter Freiburg, Börsenstatus Xetra/NYSE mit Countdown, Marktstimmung, „Stand: vor X Min.“

### M5 – Mehr Quellen und Funktionen
- Alle ~38 Feeds + Ersatz für fehlende (Ad-hoc, Destatis, Eurostat)
- Filter, Suche, Themen, Branchen-Radar, Merken, Termin-Kalender (pflegbare Datei)

### M6 – Benachrichtigungen und Überblicke
- ntfy-Push bei Relevanz 9–10 und bei Abruf-Ausfall
- Tagesüberblick (morgens), Wochenrückblick (sonntags)
- Entscheidung Bilder: Nano Banana nur wenn wirklich gratis, sonst Symbolbilder

### M7 – Design und Komfort
- Hell/Dunkel + 3 Farbthemen, Kontrast in jedem Thema getestet
- Ideen-Liste + „Ideen an Claude Code übergeben“
- Backup Export/Import, Update-Hinweis, Versionsnummer + „Was ist neu“

### M8 – Wartung und Abschluss
- Wöchentlicher Selbstcheck mit Ampel-Bericht und ntfy-Nachricht (hält Actions aktiv)
- Seite „Wartung“ mit Button „Wartung starten“ (Wartungs-Prompt)
- README auf Deutsch, „Was tun, wenn …“, Monats-Checkliste
- Sicherheitsprüfung des ganzen Projekts

## Offene Punkte zum Prüfen
- Yahoo-Kurse: Nutzungsbedingungen und Erreichbarkeit von GitHub aus prüfen; sonst offizielle Gratis-API als Hauptquelle
- Google-News-RSS (für Reuters, Anthropic, iShares): nur sparsam nutzen, Ersatz suchen
- Feed-Parser: eigener kleiner Parser oder eine Bibliothek (nur nach OK)
