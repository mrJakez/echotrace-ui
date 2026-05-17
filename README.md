# EchoTrace UI

Kalenderzentrierte Web-App fuer Recordings, Transcripts und Sentence-Segmente aus PostgreSQL.

## Start lokal

1. `.env.example` nach `.env.local` kopieren
2. `DATABASE_URL` auf deinen PostgreSQL-Server setzen
3. Optional `USE_MOCK_DATA=false`, wenn direkt gegen die echte DB gelesen werden soll
4. `npm install`
5. `npm run dev`

Die App laeuft dann auf `http://localhost:3000`.

## Relevante Umgebungsvariablen

- `DATABASE_URL`: PostgreSQL-Verbindung
- `APP_TIMEZONE`: Anzeigezeitzone
- `AUDIO_FILES_ROOT`: NAS-Pfad fuer Audio-Dateien
- `AUDIO_PUBLIC_MODE`: `proxy` oder `url`
- `AUDIO_PUBLIC_BASE_URL`: Basis-URL fuer Audio-Dateien
- `AUDIO_FILE_NAMING`: `auto`, `filename` oder `transcript_id`
- `USE_MOCK_DATA`: `true` fuer UI-Entwicklung ohne DB
- `AUTH_RP_ID`: WebAuthn RP ID, lokal meist `localhost`
- `AUTH_RP_NAME`: Anzeigename fuer Passkey-Registrierung
- `AUTH_ORIGIN`: exakte App-Origin, z. B. `http://localhost:3000`
- `AUTH_SESSION_SECRET`: Secret fuer signierte Session-Cookies
- `AUTH_ALLOW_REGISTRATION`: `true` fuer initiale Registrierung, danach auf `false`

## Audio per Docker Mount

Wenn deine MP3-Dateien lokal oder auf dem NAS flach in einem Verzeichnis liegen, kannst du sie direkt in den Container mounten.

Beispiel in `.env.local`:

```env
LOCAL_AUDIO_FILES_PATH=/absolute/path/to/mp3-folder
AUDIO_FILES_ROOT=/data/knowledge/audio
AUDIO_PUBLIC_MODE=proxy
AUDIO_FILE_NAMING=transcript_id
```

Dann liefert die App die Dateien ueber `/api/audio/:recordingId` aus. Bei `AUDIO_FILE_NAMING=auto` wird zuerst `assembly_ai_transcript_id.mp3`, danach `filename` versucht.

## Passkey Login

Die App kann optional mit Passkey-Login vor der Kalenderansicht laufen.

1. SQL aus `docs/create_passkey_auth.sql` in PostgreSQL ausfuehren
2. in `.env.local` setzen:

```env
AUTH_RP_ID=localhost
AUTH_RP_NAME=EchoTrace
AUTH_ORIGIN=http://localhost:3000
AUTH_SESSION_SECRET=bitte-langes-zufaelliges-secret
AUTH_ALLOW_REGISTRATION=true
```

3. App starten, einmal ueber `/login` registrieren
4. danach `AUTH_ALLOW_REGISTRATION=false` setzen und neu starten

Danach bleibt nur noch der Passkey-Login aktiv.

## MVP-Status

- Wochenkalender mit Vor/Zurueck/Heute
- Detailpanel fuer ein Recording
- Sentences mit Sprecher und Zeitmarken
- Read-only PostgreSQL-Layer
- Mock-Fallback fuer lokale UI-Iteration
- Docker- und GitHub-Actions-Grundlage

## Naechste sinnvolle Schritte

1. Echte Tabellen gegen das Schema pruefen
2. Audio-Proxy-Endpunkt bauen
3. Volltranskript aus eigener Tabelle oder View anbinden
4. Deployment-Workflow fuers NAS per SSH oder Pull-Mechanismus ergaenzen
