# Dispense Job Analyzer

Web-App zur lokalen Analyse von Dispense-Job JSON-Dateien.

## Ziele

- Client-only Verarbeitung: JSON bleibt im Browser und wird nicht an Server hochgeladen.
- Erweiterbare modulare Struktur fuer weitere Analyse- und Visualisierungsfunktionen.
- Deployment als statische Seite auf GitHub Pages.

## Start

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

- Der Workflow in [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) baut und veroeffentlicht bei Push auf `main`.
- Die `base`-URL fuer GitHub Pages ist in [vite.config.ts](vite.config.ts) auf `/DispenseJobAnalyser/` gesetzt.

## MVP Funktionen

- Drag-and-Drop Upload einer JSON-Datei
- Analyse von Struktur, Feldtypen und Contour-Abschnitten
- Validierungsreport mit Error/Warning/Info
- Strukturbaum fuer schnelle Exploration
- Feldprofil mit Datentypen und Beispielwerten

## Beispiel

Die Datei [public/sample-data.json](public/sample-data.json) ist ein Abbild aus [TestData/data (8).json](TestData/data%20(8).json).
