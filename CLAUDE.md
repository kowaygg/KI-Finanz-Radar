# CLAUDE.md – Wirtschaft & KI Radar

Diese Datei ist das Gedächtnis des Projekts. Jede neue Claude-Code-Sitzung liest sie zuerst.
Teil A = Auftrag (Originalprompt des Nutzers, unverändert). Teil A2 = freigegebene Ergänzungen (gehen Teil A vor). Teil B = Projektstand (wird laufend gepflegt).

> **Datenschutz-Regel:** Die Watchlist (nur Name + ISIN) steht NIEMALS in dieser Datei, im Code oder im Repo.
> Sie liegt nur lokal in `watchlist.local.json` (steht in `.gitignore`) bzw. wird in der App importiert.

---

## Teil A – Auftrag (Originalprompt, Stand 21.10.2026)

```text
Du bist ein erfahrener Softwareentwickler und Sicherheitsexperte. Baue mit mir Schritt für Schritt die App "Wirtschaft & KI Radar". Ich bin kein Programmierer – erkläre jeden Schritt einfach und auf Deutsch. Mein PC: Windows-Laptop mit schwacher Hardware (kein Docker, keine schweren lokalen Programme). Alles muss KOMPLETT KOSTENLOS sein.

ZIEL
Ein persönlicher Nachrichtendienst für die komplette Wirtschaft, Börse und KI-Entwicklung. Zweck: alles im Blick haben, was für Investitionen in Unternehmen, Startups, ETFs, Fonds und Einzelaktien relevant ist. Die App sammelt automatisch die wichtigsten News, filtert sie, analysiert sie mit KI und zeigt sie übersichtlich an. Ich will nicht selbst auf X oder Nachrichtenseiten suchen. Nur Informationen, keine Kauf-/Verkaufsempfehlungen.

0. ARBEITSREGELN FÜR DICH (CLAUDE CODE)
- Lies zuerst den ganzen Prompt. Bei Widersprüchen oder Unklarheiten nachfragen statt raten.
- Lege diesen kompletten Prompt als Datei CLAUDE.md im Projekt an und halte sie aktuell (Ziel, Entscheidungen, Aufbau, offene Punkte), damit jede neue Sitzung (Updates, Wartung) sofort weiß, worum es geht.
- Arbeite nur im Projektordner. Lösche, verschiebe oder ändere nichts außerhalb davon.
- Vor jedem Befehl, der etwas installiert, löscht oder Systemeinstellungen ändert: kurz erklären und auf mein OK warten.
- Prüfe selbstständig, welche Skills, Plugins, MCP-Server oder Bibliotheken helfen (z. B. Frontend-Design, Web-Recherche, Tests, Deployment). Nur aus offiziellen und vertrauenswürdigen Quellen (offizielle Anthropic-Skills/-Plugins, bekannte GitHub-Projekte mit vielen Nutzern und aktiver Pflege). Sag mir vorher: Was ist es, wofür, kostenlos ja/nein. Installiere erst nach meinem OK.
- So wenige Abhängigkeiten wie möglich, Versionen fest angeben (keine "latest").
- Git von Anfang an, mit sinnvollen Commits, damit wir jederzeit zurückkönnen.
- Wenn du etwas nicht sicher weißt (z. B. ob ein Feed oder eine Gratis-Stufe noch existiert): prüfen statt raten.

1. APP-FORM
- Progressive Web App (PWA) mit eigenem App-Symbol
- Installierbar auf Windows-Desktop und Handy-Startbildschirm (Android und iPhone), öffnet sich wie eine normale App ohne Browserleiste
- Funktioniert auf PC und Handy gleich gut, modernes, übersichtliches Design
- Offline: zuletzt geladene News bleiben lesbar
- Alle Zeiten in deutscher Zeit (Europe/Berlin), deutsches Datumsformat
- Erkläre mir am Ende genau, wie ich die App auf PC, Android und iPhone installiere

2. QUELLEN (nur seriös und legal per RSS/API)
- Wirtschaft & Börse: z. B. Handelsblatt, tagesschau Wirtschaft, Reuters, CNBC
- KI & Tech: z. B. Heise, The Verge, TechCrunch, offizielle Blogs von OpenAI, Anthropic, Google, Nvidia
- Pflichtmitteilungen: SEC EDGAR (RSS), deutsche Ad-hoc-Meldungen
- Startups & Finanzierungsrunden: z. B. Crunchbase News, TechCrunch Venture, deutsche Startup-Portale
- Zentralbanken & Konjunktur: EZB, Fed, Destatis, Eurostat
- ETF-Anbieter: iShares, Vanguard, Xtrackers (neue ETFs, Indexänderungen)
- Personen und Institutionen: Musk, Trump, Altman, Huang, Zuckerberg, EZB, Fed – nur über News-Quellen (X/Twitter-API ist nicht kostenlos, also nicht nutzen)
- Kursdaten für DAX, S&P 500, Nasdaq, MSCI World, Gold, Bitcoin, Ölpreis, Euro/Dollar und meine Watchlist:
  - Eine Hauptquelle UND eine Ausweichquelle (z. B. yfinance wird auf GitHub-Servern manchmal blockiert, Alpha Vantage hat enge Tageslimits)
  - Fällt eine Quelle aus: letzte bekannte Kurse mit Zeitstempel anzeigen, nicht abstürzen
- Termine (Zinsentscheide, Quartalszahlen, Konjunkturdaten): kostenlose, legale Quelle suchen; wenn keine zuverlässige existiert, die wichtigsten Termine als pflegbare Datei anlegen
- Starte mit ca. 20–40 hochwertigen Feeds; schlag mir die besten vor, prüfe, ob jeder Feed wirklich funktioniert, und rechne vor, wie viele das Gratis-Kontingent schafft
- Quellen in einer einfachen Liste, die ich ohne Programmierkenntnisse erweitern kann
- Nutzungsbedingungen beachten: kein Scraping, wo verboten; Abrufe mit vernünftigem Abstand und eigenem User-Agent
- Urheberrecht: keine kompletten Artikel speichern oder anzeigen – nur Überschrift, eigene KI-Zusammenfassung und Link zur Quelle

3. FILTER
- Jede Meldung bekommt per KI eine Relevanz-Bewertung von 1–10; im Reiter "Wichtig" angezeigt ab 7 (Schwelle einstellbar)
- Doppelte Meldungen zum gleichen Ereignis werden zu einer zusammengefasst (mit allen Quellenlinks)
- Kein Clickbait, keine Werbung, keine Gerüchte ohne Quelle

4. ZWEI REITER
- "Live-Ticker": ALLE neuen Meldungen beim Abruf, neueste oben, nur Überschrift, Zeit, Quelle, Kategorie (ohne KI-Analyse, spart Kontingent), mit Hinweis "X neue Meldungen"
- "Wichtig": nur KI-gefilterte Meldungen ab Relevanzschwelle mit vollständiger Analyse
- Erkläre mir, wie oft der Live-Ticker kostenlos realistisch aktualisiert werden kann (GitHub Actions: ca. alle 5–15 Minuten, oft verzögert). Zusätzlicher Live-Abruf beim Öffnen der App nur, wenn ohne Proxy-Kosten und sicher möglich; sonst weglassen.

5. DARSTELLUNG JEDER WICHTIGEN MELDUNG
- Datum und Uhrzeit
- Kategorie: Wirtschaft, Börse, KI, Tech, Politik mit Marktbezug, Unternehmen, Startups & Finanzierungsrunden
- Thema-Schlagwörter (z. B. Nvidia, Zinsen, Zölle)
- Überschrift + Zusammenfassung in 3–5 Stichpunkten auf Deutsch
- Relevanz-Wert und Stimmung (positiv / neutral / negativ)
- Betroffene Aktien, ETFs und Branchen; Treffer mit meiner Watchlist hervorheben
- KI-Einschätzung: mögliche Auswirkungen auf Märkte, Branchen und Aktien, Zeithorizont (kurzfristig/langfristig), Sicherheit der Einschätzung (niedrig/mittel/hoch)
  - Historische Vergleiche nur, wenn gut belegt – lieber weglassen als raten, keine erfundenen Zahlen
  - Klar als KI-Einschätzung kennzeichnen; anzeigen, welches KI-Modell analysiert hat
- Link zur Originalquelle
- Hinweis: keine Anlageberatung

6. FUNKTIONEN DER APP
- Startseite mit Top-News des Tages und Mini-Kursübersicht (steigend grün ▲, fallend rot ▼)
- Filter nach Kategorie, Thema, Datum und Relevanz, plus Suchfunktion
- Watchlist für meine ETFs, Fonds und Aktien mit Kursverlauf und passenden News; Markierung bei starken Kursbewegungen (z. B. mehr als 3 % an einem Tag)
- Branchen-Radar: welche Branchen gerade viele positive/negative Meldungen haben
- Tagesüberblick (morgens) und Wochenrückblick (sonntags) als eigene Seiten
- Termin-Kalender für wichtige Ereignisse
- News speichern/merken
- Statusanzeige mit deutlicher Warnung, wenn der Abruf länger als 3 Stunden nicht lief
- Push-Benachrichtigung bei Relevanz 9–10, nur wenn kostenlos möglich. Normales Web-Push braucht einen Server – prüfe kostenlose Wege (z. B. ntfy.sh), erkläre Vor- und Nachteile und was auf Android und iPhone nötig ist

7. KOPFZEILE (übersichtlich, klar strukturiert, tabellarisch/stichpunktartig, nicht erschlagend; auf dem Handy nur das Wichtigste, Rest per Antippen ausklappbar)
- Wochentag, Datum, Kalenderwoche (ISO), Uhrzeit live mit Sekunden (Gerätezeit, automatisch mit Atomuhren abgeglichen; Europe/Berlin)
- Aktuelles Wetter in Freiburg im Breisgau (Temperatur, Symbol, Tageshöchst/-tiefst) über eine kostenlose Quelle ohne Schlüssel, z. B. Open-Meteo; bei Ausfall ausblenden statt abstürzen
- Börsenstatus Xetra und NYSE: offen/geschlossen mit Countdown bis Öffnung bzw. Schließung (Feiertage beachten)
- Nächster wichtiger Termin aus dem Kalender (z. B. "Morgen 14:15 EZB-Zinsentscheid")
- Zähler neuer Meldungen im Reiter "Wichtig"
- Marktstimmung auf einen Blick: Pfeil/Farbe aus DAX und S&P 500
- Watchlist heute: Tagesentwicklung in %, Hinweis bei Bewegungen über 3 %
- "Stand: vor X Min." (letzter erfolgreicher Abruf)
- Ganz rechts oben: Design-Umschalter (siehe Abschnitt 8)

8. DESIGN & LESBARKEIT (sehr wichtig)
- Ganz rechts oben ein übersichtliches Symbol (z. B. Sonne/Mond) zum schnellen Umschalten zwischen Hell- und Dunkelmodus
- Zusätzlich 3 weitere gut aussehende Farbthemen (dein Vorschlag), per Klick schnell wechselbar
- KEIN automatischer Wechsel nach Tageszeit oder Systemeinstellung: Das gewählte Thema bleibt fest, bis ich es selbst ändere
- In jedem Thema Farben so anpassen, dass alles gut lesbar ist (hoher Kontrast für Text, Kurse, Symbole); jedes Thema darauf testen
- Kursbewegungen immer zusätzlich mit Pfeilen ▲/▼, nicht nur über Farbe
- Auswahl lokal speichern, bleibt bei Updates erhalten

9. BILDER ZU WICHTIGEN MELDUNGEN (OPTIONAL)
- Zu jeder Meldung im Reiter "Wichtig" ein KI-Bild, das die Neuigkeit symbolisch darstellt, über Googles Bildmodell "Nano Banana" (Gemini Image)
- NUR wenn über die API wirklich kostenlos, ohne Kreditkarte und rechtlich unbedenklich nutzbar – prüfe das zuerst und sag mir das Ergebnis. Sonst: Funktion weglassen und feste Symbolbilder pro Kategorie/Thema verwenden
- Bilder klar als "KI-generiert, symbolisch" kennzeichnen; keine realistischen Bilder echter Personen, keine Logos, nichts, was wie ein echtes Foto wirkt
- Bild-Kontingent getrennt planen; Textanalyse hat immer Vorrang. Limit erreicht: Symbolbild
- Bilder klein und komprimiert speichern, mit den Meldungen automatisch löschen

10. TECHNIK – KOMPLETT KOSTENLOS
- Hosting und automatischer Abruf über kostenlose Dienste: GitHub Pages + GitHub Actions; läuft rund um die Uhr, auch wenn mein Laptop aus ist
- Repo öffentlich (GitHub Pages ist nur damit kostenlos). Darin niemals Schlüssel oder persönliche Daten
- Beachte und erkläre mir die GitHub-Grenzen:
  - Geplante Actions in öffentlichen Repos werden nach 60 Tagen ohne Aktivität deaktiviert – Lösung oder Warnung einbauen
  - Geplante Actions können sich verzögern; das ist okay
- Repo klein halten: alte Meldungen nach z. B. 30 Tagen automatisch löschen
- Wenn etwas Geld kosten würde: vorher fragen und kostenlose Alternative vorschlagen
- Keine Kreditkarte bei irgendeinem Dienst hinterlegen; nur Dienste, bei denen ohne Bezahlmethode nichts abgebucht werden kann
- Fehler einer Quelle dürfen nie den ganzen Ablauf stoppen
- Jeder externe Dienst (News, Kurse, KI, Wetter, Push) ist austauschbar und nur an EINER Stelle eingestellt; für jeden eine Ausweichlösung

11. KI-MODELLE
- Hauptmodell: Google Gemini (kostenlose Stufe). Prüfe zuerst, ob die Gratis-Stufe in Deutschland/EU nutzbar ist, erkläre die Grenzen und führe mich Schritt für Schritt durch das Anlegen des kostenlosen API-Schlüssels in Google AI Studio und das Hinterlegen in GitHub Secrets
- Ein kostenloses Ausweichmodell (z. B. Groq, Mistral oder kostenlose Modelle über OpenRouter – prüfe, welches aktuell am zuverlässigsten kostenlos ist). Springt automatisch ein, wenn Gemini am Limit ist oder ausfällt
- Nicht mehr als diese zwei Modelle
- Beide bekommen dieselben Anweisungen und dasselbe JSON-Format (einheitliche Bewertung)
- Kontingent sparen: nur NEUE Meldungen analysieren, mehrere Meldungen gebündelt pro Anfrage, ausführliche Analyse nur ab Relevanz 7
- Limit erreicht: Meldungen ohne Analyse zeigen und später nachholen, nicht abstürzen
- Modellnamen an einer Stelle einstellbar (Modelle werden irgendwann abgeschaltet)

12. SICHERHEIT
- API-Schlüssel nur in GitHub Secrets, niemals im Code, in Commits, in Logs oder in der Web-App (alles im Browser ist öffentlich sichtbar)
- .gitignore von Anfang an (.env, lokale Importdateien); vor jedem Commit prüfen, dass kein Schlüssel und keine persönlichen Daten drin sind
- GitHub-Sicherheitsfunktionen aktivieren und mir erklären: Zwei-Faktor-Anmeldung, Secret Scanning/Push Protection, Dependabot
- GitHub Actions mit minimalen Rechten (permissions); Actions von Drittanbietern nur aus vertrauenswürdigen Quellen und auf Commit-SHA gepinnt
- Feed-Inhalte sind nicht vertrauenswürdig: HTML bereinigen, nie ungeprüft einfügen (Schutz vor XSS); Content Security Policy setzen; nur https-Links
- Schutz vor Prompt Injection: News-Texte an die KI nur als reine Daten; Anweisungen in Artikeln werden ignoriert. KI-Antworten als festes JSON verlangen und vor dem Speichern/Anzeigen auf gültige Werte prüfen (z. B. Relevanz 1–10)
- ntfy: zufälliger, schwer zu erratender Kanalname; nur öffentliche News-Inhalte senden
- Webseite nicht in Suchmaschinen anzeigen (robots.txt + noindex), nicht öffentlich bewerben
- Am Ende eine Sicherheitsprüfung des ganzen Projekts und mir das Ergebnis erklären

13. DATENSCHUTZ
- Watchlist, gemerkte News, Ideen und Einstellungen nur lokal auf meinem Gerät speichern – NICHT im Repo, nicht an die KI, nicht über ntfy
- Watchlist-Vorbefüllung: Ich gebe meine Werte separat in Claude Code ein. Nicht in den Code, die CLAUDE.md oder das Repo schreiben, sondern lokale Importdatei (in .gitignore) bzw. Import-Funktion in der App. Strikt NUR Name und ISIN – keine Beträge, keine prozentualen Anteile, keine Stückzahlen, keine Kaufkurse, keine Depot-Infos, nirgends
- An die KI nur öffentliche News-Texte senden (in der Gratis-Stufe darf der Anbieter Eingaben nutzen)
- Keine Tracker, keine Analyse-Tools, keine Cookies von Drittanbietern
- Backup: Export/Import von Watchlist, gemerkten News, Ideen und Einstellungen als Datei (z. B. für ein neues Handy)

14. VERBESSERUNGEN & UPDATES
- Button "Idee / Verbesserung": jederzeit Idee eintippen; lokal gespeichert, als Liste (bearbeiten, löschen, als erledigt markieren)
- Button "Ideen an Claude Code übergeben": kopiert alle offenen Ideen als fertigen Auftrag in die Zwischenablage
- Verbesserungen immer in die BESTEHENDE App einbauen, keine neue App
- Vor dem Veröffentlichen: Änderung lokal testen, mir zeigen, erst nach meinem OK hochladen
- Update-Funktion: Bei neuer Version zeigt die App "Neue Version verfügbar – Jetzt aktualisieren"; ein Klick, ohne Neuinstallation
- Alle lokalen Daten und Einstellungen bleiben bei jedem Update erhalten
- Versionsnummer und kurze "Was ist neu"-Liste in der App
- Bei Problemen einfach zur vorherigen Version zurück

15. LANGLEBIGKEIT & WARTUNG
- Ziel: so wenig Wartung wie möglich (ca. 10 Minuten pro Monat). Mir ist klar, dass kostenlose Dienste sich ändern können – plane dafür
- Automatische Tests, die bei jeder Änderung laufen
- Automatisch übernehmen nur Sicherheits-Updates mit grünen Tests; alle anderen Updates in der monatlichen Tiefenwartung
Stufe 1 – Wöchentlicher Selbstcheck (automatisch, kostenlos, GitHub Actions, sonntags):
- Prüft: jede Quelle, Kursdaten (Haupt- und Ausweichquelle), BEIDE KI-Modelle und Schlüssel, Bild-Funktion (falls aktiv), Wetter, verbleibendes Gratis-Kontingent, offene Sicherheitswarnungen, regelmäßiger Abruf, Repo-Größe
- Wartungsbericht in einfachem Deutsch: Ampel (grün/gelb/rot) pro Bereich, bei Problemen konkrete Anleitung
- Benachrichtigung (z. B. ntfy): "Wartung durchgeführt – alles okay" oder "Handlung nötig: …"
- Hält zugleich die geplanten Actions aktiv (gegen die 60-Tage-Abschaltung)
- Darf nur prüfen und berichten, keinen Code ändern
Stufe 2 – Monatliche Tiefenwartung mit Claude Code (manuell per Button):
- Seite "Wartung": letzter Bericht, Verlauf, Datum der letzten Tiefenwartung
- Einmal im Monat (oder bei rotem Bericht) Hinweis mit Button "Wartung starten" – kopiert einen fertigen Wartungs-Prompt (als Datei im Repo) in die Zwischenablage
- Der Wartungs-Prompt weist Claude Code an: Bericht lesen, Abhängigkeiten aktualisieren, Sicherheitsprüfung, tote Feeds ersetzen, KI-Modelle auf Aktualität prüfen, Tests laufen lassen, Ergebnis auf Deutsch erklären, erst nach meinem OK übernehmen
- Danach Datum in der App aktualisieren
- Kein automatischer Claude-Code-Lauf über die kostenpflichtige API

16. ANLEITUNG
- README auf Deutsch: wie alles funktioniert, wie ich Quellen und Watchlist ändere, Updates einspiele, Backup mache
- "Was tun, wenn …"-Liste (KI-Modell abgeschaltet, Feed tot, Limit geändert, Kursquelle blockiert, Abruf gestoppt)
- Monatliche Kurz-Checkliste für mich (max. 5 Punkte)

VORGEHEN
1. Stell mir zuerst Fragen zu allem, was unklar ist.
2. Erstelle einen Plan mit Meilensteinen und schätze jeweils, ob die Gratis-Grenzen reichen.
3. Version 1: wenige Quellen, KI-Filter, beide Reiter als einfache Liste, Sicherheitsgrundlagen von Anfang an.
4. Danach Schritt für Schritt erweitern.
5. Teste jede Version, bevor du weitermachst, und sag mir nach jedem Meilenstein, was ich selbst prüfen oder klicken muss.
```

---

## Teil A2 – Ergänzungen 21.10.2026 (vom Nutzer freigegeben, GEHEN TEIL A VOR)

1. **Windows 10 Home, NICHT Windows 11.** Alle Anleitungen, Menüpfade und Befehle müssen für Windows 10 passen (ersetzt „Windows-Laptop“ in der Einleitung).
2. **KI-Modelle – ersetzt „Nicht mehr als diese zwei Modelle“ in Abschnitt 11:** Ausweichkette aus 3–4 kostenlosen Modellen ohne Kreditkarte, z. B. Gemini → Groq → OpenRouter (Gratis-Modelle) → Mistral.
   - Vorher prüfen, welche aktuell wirklich gratis und zuverlässig sind, und dem Nutzer die Kette vorschlagen.
   - Automatischer Wechsel zum nächsten Modell bei Limit oder Ausfall.
   - Für alle Modelle dieselben Anweisungen und dasselbe JSON-Format.
   - Reihenfolge an EINER Stelle einstellbar; in der App anzeigen, welches Modell analysiert hat.
   - Der wöchentliche Selbstcheck prüft alle Modelle.
3. **Kontingent sparen:** Kostenloser Vorfilter OHNE KI vor jeder KI-Anfrage: Dubletten raus, per Stichwortliste offensichtlich Irrelevantes raus, den Rest gebündelt an die KI. Bereits analysierte Meldungen nie doppelt analysieren.
4. **Obsidian-Vault:** Wichtige Entscheidungen und Meilensteine zusätzlich im Vault festhalten (`%USERPROFILE%\Desktop\Obsidian Memory Vault\Memory\Projekte\KI-Wirtschaft-Radar\` + Tagesnotiz `YYYY-MM-DD.md`).

---

## Teil B – Projektstand

### Umgebung (geprüft 21.10.2026)
- Windows 10 Home, schwache Hardware
- Vorhanden: Git 2.55, Node.js 24.22
- Nicht vorhanden: Python, GitHub CLI (`gh`)
- GitHub-Konto: kowaygg (Zwei-Faktor an, E-Mail privat, Push-Schutz für E-Mail an – seit 21.10.2026); Commit-Adresse: 345513821+kowaygg@users.noreply.github.com; Anmeldung über Git Credential Manager 2.9.1 (mit Git installiert). Commits nur mit noreply-Adresse (Repo öffentlich)
- Projektordner: `%USERPROFILE%\Desktop\Wirtschaft-KI-Radar`
- Begleitnotizen im Obsidian-Vault: `Projekte/KI-Wirtschaft-Radar/`

### Entscheidungen
- 21.10.2026: Ergänzungen A2 übernommen (Windows 10, KI-Ausweichkette 3–4 Modelle, Vorfilter ohne KI, Vault-Doku)
- 21.10.2026: Git-Repo angelegt (Branch `main`), Commit-Identität nur lokal im Repo eingestellt (noreply-Adresse). Im Repo keine echten Namen/Pfade – Benutzerordner als `%USERPROFILE%`
- 21.10.2026: KI-Ausweichkette festgelegt: Gemini → Groq → Mistral → OpenRouter (alle ohne Kreditkarte; Mistral braucht Handynummer; OpenRouter ohne Guthaben nur ~50 Anfragen/Tag → letzte Reserve). Konten werden erst beim Einbau angelegt.
- 21.10.2026: Handy = Android (PWA-Installation über Chrome; iPhone-Anleitung nur nebenbei)
- 21.10.2026: Push über ntfy (ntfy.sh, Android-App): Relevanz 9–10, Wartungsbericht sonntags, Warnung bei Abruf-Ausfall >3 h. Langer Zufalls-Kanalname, nur öffentliche Inhalte
- 21.10.2026: Englische Quellen erlaubt; ALLES auf Deutsch (Wunsch des Nutzers, ersetzt „Ticker im Original“): KI liefert `titelDe` bei der Bewertung mit, ältere/nicht bewertete englische Titel per Übersetzungs-Anfrage (1 pro Lauf, 50 Titel). Links zu englischen Artikeln öffnen über Google Übersetzer (translate.google.com → *.translate.goog) auf Deutsch; Originalseite zusätzlich verlinkt
- 21.10.2026: Regionen: Schwerpunkt DE/EU + USA; Asien nur große Themen (China, Taiwan/TSMC, Japan, Zölle). Krypto-News ja, nur große Bewegungen und Regulierung (keine Kleinst-Coins)
- 21.10.2026: Watchlist bis ca. 10 Werte; Werte ohne freien Kurs zeigen nur News
- 21.10.2026: Watchlist-Kurse = Variante B: Cloud lädt Kurse einer großen öffentlichen Werteliste (einige hundert: DAX, MSCI World, S&P 500, Nasdaq, beliebte ETFs); die App filtert die Watchlist NUR lokal. Die Werteliste darf nie gezielt nach der Watchlist zusammengestellt werden; einzelne fehlende Werte nur nach ausdrücklichem OK des Nutzers ergänzen, sonst nur News
- 21.10.2026: News-Abruf alle 15 Minuten (GitHub-Actions-Cron; Verzögerungen ok)
- 21.10.2026: Name überall „KI-Finanz-Radar“: Repo `KI-Finanz-Radar` (öffentlich, Adresse https://kowaygg.github.io/KI-Finanz-Radar/ – Groß-/Kleinschreibung beachten), App-Name „KI-Finanz-Radar“
- 21.10.2026: Technik: Node.js (schon installiert), kein Python
- Alle Rückfragen vom 21.10.2026 beantwortet
- 21.10.2026 (M3): Repo https://github.com/kowaygg/KI-Finanz-Radar (öffentlich), Secret `GEMINI_API_KEY` gesetzt, Pages-Quelle „GitHub Actions“. Sicherheit: Secret Protection + Push Protection an, Dependency graph + Dependabot alerts an (Security updates aus – keine npm-Abhängigkeiten). Push-Anmeldung über Git Credential Manager
- 21.10.2026 (M2): KI in zwei Stufen (Bewertung 25/Anfrage, Analyse ab Relevanz 7, 5/Anfrage, max. 4+4 Anfragen pro Lauf). Fehler pro Modell: 429/404/503 → nächstes Modell desselben Dienstes, 401/403 → nächster Dienst. KI vergibt Ereignis-Kürzel → gleiche Ereignisse (auch sprachübergreifend) in „Wichtig“ zusammengefasst. Clickbait/Gerüchte max. Relevanz 3. Prompt verlangt Strenge (~10 % ≥ 7, PR max. 6). Modelle 21.10.2026 geprüft: gemini-2.5-flash(-lite) für die API abgeschaltet (404) → Kette gemini-3.8-flash, 3.5-flash-lite, 3.7-flash, 3.5-flash, 3.1-flash-lite; 3.8/3.6 zeitweise überlastet (503). Groq-Konto als echte Ausweichlösung dringend empfohlen
- 21.10.2026 (M1): Nur Meldungen der letzten 48 h aufnehmen; Teaser nur intern als KI-Eingabe, nie veröffentlicht/angezeigt; Service Worker holt alles zuerst aus dem Netz (Offline-Fallback)
- 21.10.2026 (M3, ersetzt Daten-Zweig-Idee): Arbeitsstand `data/zustand.json` liegt im GitHub-Actions-Cache (neuer Schlüssel pro Lauf, Wiederherstellung über Präfix) – keine Daten-Commits, Repo bleibt klein, Teaser nicht öffentlich. Geht der Cache verloren, werden die letzten 48 h neu geholt und neu bewertet.
- 21.10.2026 (M3): Actions auf Commit-SHA gepinnt (checkout v7.0.1, setup-node v7.0.0 – v7.1.0 war erst 2 Wochen alt –, cache v6.1.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1), Node 24.22.0, minimale Rechte, persist-credentials: false

### Aufbau
- `CLAUDE.md` – diese Datei
- `.gitignore` – schließt `.env`, lokale Importdateien (`*.local.*`, `watchlist*.json`) usw. aus
- `PLAN.md` – Meilensteine M1–M8, geprüfte Quellen, Gratis-Grenzen (Stand 21.10.2026)
- `quellen.json` – News-Quellen (für den Nutzer erweiterbar)
- `config/einstellungen.json` – zentrale Werte (User-Agent, Zeitlimits, Aufbewahrung, Relevanzschwelle, Dubletten)
- `config/vorfilter.json` – Stichwortlisten: `werbung` (nie anzeigen), `ohneKi` (nur Live-Ticker)
- `src/` – Abruf (Node.js, keine Zusatzpakete): `run.js` (Durchlauf), `feed-parser.js` (RSS/Atom), `bereinigen.js` (nur Text, nur https), `dubletten.js`, `vorfilter.js`, `sammeln.js`
- `public/` – PWA (index.html mit CSP + noindex, app.js nur textContent, sw.js Offline, manifest, Symbole)
- `scripts/` – `serve.js` (lokaler Test-Server localhost:8080), `make-icons.js`
- `config/boersen.json` – Handelszeiten, Feiertage, Frühschluss (Xetra, NYSE; jährlich ergänzen) · `config/termine.json` – Termine (EZB/Fed …) für Kopfzeile/Kalender
- `config/kurse.json` – Indizes (DAX ^GDAXI, S&P 500 ^GSPC) und Zeiträume 1T/1W/1M/1J/Max · `src/kurse.js` – holt Verläufe (Yahoo Chart), Rückfall auf letzten Stand in `data/kurse.json`
- `public/diagramm.js` – SVG-Kurven, Veränderung (1T ggü. Vortag, sonst ggü. Startwert), Achsentexte
- `public/zeit.js` – Kalenderwoche, Börsenstatus, Countdown, Wettersymbol (ES-Modul, getestet)
- `config/ki.json` – KI-Kette (Reihenfolge, Modelle, Bündelgrößen, Limits pro Lauf); Schlüsselnamen nur als Variablennamen
- `src/ki/` – `anweisungen.js` (feste Prompts, Daten-JSON), `pruefen.js` (strenge Prüfung), `kette.js` (Ausweichkette), `analyse.js` (Bewertung → Ereignis-Zusammenfassung → Analyse)
- `.env` (lokal, ignoriert) / `.env.beispiel` – API-Schlüssel
- `tests/` – `npm test` (Node-Testrunner)
- `.github/workflows/abruf.yml` – alle 15 Min.: Cache laden → `npm run abruf` (Secrets als Umgebungsvariablen) → Cache sichern → `public/` auf GitHub Pages
- `.github/workflows/tests.yml` – Tests bei jedem Push; `.github/dependabot.yml` – Actions-Updates monatlich
- Erzeugt, nicht im Repo: `data/zustand.json` (mit Teaser für KI), `public/data/meldungen.json` + `status.json` (öffentlich, ohne Teaser)

### Befehle
- `npm run abruf` – einmal alle Quellen abrufen
- `npm start` – App lokal unter http://localhost:8080
- `npm test` – automatische Tests
- `npm run ki-check` – prüft Schlüssel und ob die eingestellten Modelle noch existieren

### Offene Punkte
- Rückfragen: erledigt (21.10.2026)
- M1 (0.1.0), M2 (0.2.0) und M3 fertig (21.10.2026): online unter https://kowaygg.github.io/KI-Finanz-Radar/ – Abruf alle 15 Min. per GitHub Actions; erster Lauf erfolgreich (10/10 Quellen, Gemini aktiv)
- Kopfzeile (0.3.0) vorgezogen: Wochentag, Datum, KW, Uhr mit Sekunden, Börsen nach Land gruppiert (Deutschland: Xetra + Börse Frankfurt 8–22 Uhr; USA: NYSE + Nasdaq) mit Countdown + Feiertagen, Wetter Freiburg (Open-Meteo, beim Abruf geholt → status.json), nächster Termin, Zähler neue wichtige Meldungen, Stand; Handy: Rest unter „Mehr anzeigen“. Darunter Kasten „Top-News der letzten 24 Stunden“ (warmes Lila #d59bf6, 3 höchste KI-Relevanzen, ohne Dubletten). App lädt alle 5 Min. und beim Zurückkehren neu (Neu-Markierung bleibt pro Sitzung). Über den Top-News (0.4.0): zwei Kurven-Diagramme DAX + S&P 500 nebeneinander (Handy untereinander) mit Zeitraum 1T/1W/1M/1J/Max (Auswahl wird gemerkt), Kurs + Veränderung ▲/▼, Tief/Hoch, Finger/Maus zeigt Kurs am Zeitpunkt; Marktstimmung in der Kopfzeile aus Tagesveränderung DAX + S&P 500. Noch offen: Watchlist heute (M4), Ausweich-Kursquelle (M4), Design-Umschalter (M7)
- Als Nächstes: M4 (Kurse, Watchlist; Marktstimmung in der Kopfzeile)
- Dependabot hat einen PR für eine Action-Aktualisierung geöffnet → bei der monatlichen Wartung prüfen (nicht ungeprüft übernehmen)
- Groq-/Mistral-/OpenRouter-Konten noch nicht angelegt (Kette läuft vorerst nur mit Gemini)
- Ersatz-Kursquelle finden (Stooq-CSV liefert 404); Yahoo-Nutzungsbedingungen prüfen
