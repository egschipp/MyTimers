# MyTimers

Compacte timer-webapp met timerreeksen, auto-start per stap en PWA-ondersteuning.

## Lokaal starten

```bash
python3 -m http.server 8000
```

Open daarna `http://localhost:8000`.

## Docker

```bash
docker compose up -d --build
```

De container luistert dan lokaal op `127.0.0.1:8081`.

## Caddy op Raspberry Pi

Gebruik in Caddy een siteblok zoals:

```caddy
mytimers.schippers-online.nl {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8081
}
```

Een dependency-vrije lokale webapp met een instelbare analoge countdown timer.

## Starten

Open `index.html` direct in een browser.

Alternatief, als je liever een lokale server gebruikt:

- macOS / Linux: `python3 -m http.server`
- Windows: `py -m http.server`

Open daarna `http://localhost:8000`.

## Gedrag

- Timer loopt terug naar `0:00`
- Vanaf `15%` resterend wordt de timer geel
- Vanaf `5%` resterend wordt de timer oranje
- Op `0:00` wordt de timer grijs weergegeven
