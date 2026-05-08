# 🎮 Paradise City Roleplay — Discord Bot

  Ein Discord-Bot für den Paradise City Roleplay Server.

  ## Befehle

  | Befehl   | Beschreibung                         |
  |----------|--------------------------------------|
  | `!hallo` | Begrüßt den Benutzer im Server       |

  ## Setup

  ### 1. Discord Bot erstellen
  1. Gehe zu [discord.com/developers](https://discord.com/developers/applications)
  2. Erstelle eine neue Anwendung
  3. Gehe zu **Bot** → **Add Bot**
  4. Kopiere den **Token**
  5. Aktiviere unter **Privileged Gateway Intents**: `Message Content Intent`

  ### 2. Hosting auf Railway
  1. Verbinde dieses GitHub-Repo mit [Railway](https://railway.app)
  2. Setze die Umgebungsvariable: `DISCORD_TOKEN=dein_token`
  3. Railway startet den Bot automatisch

  ## Entwicklung

  ```bash
  npm install
  cp .env.example .env
  # DISCORD_TOKEN in .env eintragen
  npm start
  ```
  