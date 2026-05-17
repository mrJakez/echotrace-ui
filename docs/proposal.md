# Recording Calendar App Proposal

## Zielbild

Eine moderne, minimalistische Web-App mit Fokus auf Wochenansicht:

- Kalenderansicht wie Outlook, aber klarer und reduzierter
- Recordings direkt im Zeitraster sichtbar
- Klick auf ein Recording oeffnet Detailansicht mit:
  - Audio-Wiedergabe
  - Metadaten
  - Volltranskript
  - Sentence-Timeline mit Sprecher, Start, Ende, Text
- Navigation zwischen Wochen
- Optional spaeter: Matching gegen Kalendertermine, Filter, Suche, Tags

## Datenlage aus den Exporten

Stand der vorliegenden Exporte:

- `recordings.json`: 60 Datensaetze
- `recording_sentences.json`: 341 Datensaetze
- `calendar_events.json`: aktuell leer
- `recording_calendar_candidates.json`: aktuell leer oder `null`

Relevante Felder fuer den MVP:

- `recordings.id`
- `recordings.started_at`
- `recordings.ended_at`
- `recordings.filename`
- `recordings.audio_path`
- `recordings.transcript_summary`
- `recordings.transcript_language`
- `recordings.status`
- `recordings.transcription_status`
- `recordings.selected_calendar_event_id`
- `recording_sentences.recording_id`
- `recording_sentences.position`
- `recording_sentences.start_ms`
- `recording_sentences.end_ms`
- `recording_sentences.speaker`
- `recording_sentences.text`

## Empfehlung fuer den Stack

Ich wuerde das als eine Fullstack-App in einem Repo bauen:

- Frontend: Next.js, TypeScript, App Router
- Styling: Tailwind CSS plus eigene Design-Tokens, keine generische Boilerplate-Optik
- Datenzugriff: Drizzle ORM mit PostgreSQL
- API: Next.js Route Handlers
- Deployment: Docker Image
- CI/CD: GitHub Actions

Warum diese Wahl:

- Ein Repo fuer UI, API und DB-Zugriff reduziert Komplexitaet
- Next.js ist fuer so ein internes Tool schnell produktiv und gut deploybar
- Drizzle ist typsicher, leichtgewichtig und passt gut zu bestehender PostgreSQL-Struktur
- Docker + GitHub Actions ist sauber fuer Docker Hub und NAS-Deployment

## Geplanter MVP

### 1. Wochenkalender

- Wochenraster Montag bis Sonntag
- Zeitslots fuer den Tag
- Recordings als Events an `started_at` bis `ended_at`
- Mehrere Recordings pro Tag sauber gestapelt
- Anzeige von Titel:
  - bevorzugt Kalendertermin
  - sonst Transcript Summary
  - sonst Filename

### 2. Recording-Detailansicht

- Drawer oder Side Panel
- Audio Player
- Basisinfos:
  - Zeit
  - Dauer
  - Sprache
  - Status
  - Quelle
- Volltranskript
- Sentence-Liste mit Zeitmarken und Sprecher

### 3. Basisfilter

- Woche vor/zurueck/heute
- Filter nach Sprache
- Filter nach Status
- Optional Suchfeld ueber Transcript Summary / Sentences

## Datenmodell in der App

Ich wuerde die bestehende PostgreSQL-Datenbank zunaechst nur lesend anbinden.

Geplante Queries:

- `GET /api/recordings?weekStart=...`
  - liefert alle Recordings der Woche
- `GET /api/recordings/:id`
  - liefert Recording plus Sentences

Spaeter:

- `GET /api/calendar-events`
- `POST /api/recordings/:id/select-calendar-event`

## Kritischer Punkt: Audio-Zugriff

Die JSON-Daten zeigen `audio_path` als Dateisystempfad, zum Beispiel `/data/knowledge/audio/`.

Das ist fuer die Web-App entscheidend:

- Lokal auf deinem Rechner kann der Browser diesen NAS-Pfad nicht direkt lesen
- In Produktion auf dem NAS kann der Container den Pfad per Volume mounten

Deshalb schlage ich zwei Modi vor:

### Lokale Entwicklung

- App laeuft lokal
- verbindet sich gegen den PostgreSQL-Server auf dem NAS
- Audio wird zunaechst optional behandelt
- entweder:
  - ueber eine konfigurierbare HTTP-Basis-URL
  - oder temporaer ohne Audio im lokalen Dev-Modus

### Produktion auf dem NAS

- Container bekommt Audio-Verzeichnis gemountet
- Next.js API liefert Audio-Dateien als Stream aus
- Browser greift nur auf die Web-App zu, nicht direkt aufs Dateisystem

Empfohlene Konfiguration:

- `DATABASE_URL`
- `AUDIO_FILES_ROOT`
- `AUDIO_PUBLIC_MODE=proxy|url`
- `AUDIO_PUBLIC_BASE_URL`

## Konfigurationsvorschlag

`.env.example`

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
APP_TIMEZONE=Europe/Berlin

# production: mounted NAS path inside container
AUDIO_FILES_ROOT=/data/knowledge/audio

# url = use already hosted audio files, proxy = stream through app
AUDIO_PUBLIC_MODE=proxy
AUDIO_PUBLIC_BASE_URL=
```

## UI-Richtung

Visuell wuerde ich nicht die Standard-SaaS-Karteikarten bauen, sondern:

- helle, ruhige Oberflaeche
- starke Typografie
- feine Grid-Struktur
- klare Tagesspalten
- dezente Farbsemantik fuer Status
- schnelle Detailansicht ohne Seitenwechsel

Layout:

- Topbar mit Wochensteuerung
- links optional kompakter Mini-Kalender
- Hauptbereich mit Wochenansicht
- rechte Detailspalte oder Overlay fuer Recording-Details

## CI/CD Vorschlag

### GitHub

- Push auf `main`
- Test + Lint + Build
- Docker Image bauen
- Push zu Docker Hub

### NAS Deployment

Am robustesten ist Pull-basiertes Deployment auf dem NAS:

- NAS prueft neues Docker-Image
- zieht neues Image
- startet Container neu

Varianten:

1. GitHub Action deployed per SSH auf das NAS
2. Watchtower oder aehnlicher Auto-Update-Mechanismus auf dem NAS

Empfehlung:

- kurzfristig: GitHub Actions + SSH + `docker compose pull && docker compose up -d`
- spaeter optional: Watchtower

## Zielstruktur im Repo

```text
.
├── app/
├── components/
├── db/
├── lib/
├── public/
├── docs/
├── .env.example
├── Dockerfile
├── docker-compose.local.yml
└── .github/workflows/
```

## Umsetzung in 3 Schritten

### Schritt 1: MVP lokal

- Next.js App aufsetzen
- PostgreSQL read-only anbinden
- Wochenkalender bauen
- Detailansicht mit Sentences
- lokale `.env` Konfiguration

### Schritt 2: Production-ready

- Dockerfile
- Healthcheck
- GitHub Actions
- Docker Hub Push

### Schritt 3: NAS Deployment

- Compose fuer NAS
- Audio-Mount
- Deploy per SSH

## Meine konkrete Empfehlung

Ich wuerde genau so starten:

1. Next.js + TypeScript + Tailwind + Drizzle scaffolden
2. Read-only Postgres-Anbindung bauen
3. Wochenkalender gegen echte Daten umsetzen
4. Detailpanel mit Transcript und Sentences bauen
5. Danach Docker, CI und NAS-Deploy

## Offene Punkte vor Implementierung

Die zwei Punkte sollte ich beim Bau direkt beruecksichtigen:

1. Wie kommen Audio-Dateien im Browser an:
   - per App-Proxy
   - oder ueber separate statische URL
2. Gibt es bereits echte Tabellen fuer:
   - `recordings`
   - `recording_sentences`
   - `calendar_events`
   - `recording_calendar_candidates`

## Nächster sinnvoller Schritt

Wenn du willst, setze ich dir als Naechstes direkt das Grundgeruest auf:

- Next.js App
- `.env.example`
- DB-Layer
- erste Wochenansicht mit Mock- und DB-Adapter
- Dockerfile
- vorbereitete GitHub Actions Pipeline
