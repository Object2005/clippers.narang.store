# Install GTAClipper on your computer

This guide takes you from zero to your first clips. You don't need to know how to code; you'll copy and paste a few commands. Plan for about **30 minutes**, mostly waiting for the first download.

**On this page:**
[What you need](#what-you-need) ·
[1. Install Docker](#step-1-install-docker-desktop) ·
[2. Download GTAClipper](#step-2-download-gtaclipper) ·
[3. Get your API keys](#step-3-get-your-two-api-keys) ·
[4. Add your settings](#step-4-add-your-settings) ·
[5. Start it](#step-5-start-gtaclipper) ·
[6. Make clips](#step-6-make-your-first-clips) ·
[Everyday use](#everyday-use) ·
[Troubleshooting](#troubleshooting)

---

## What you need

- A computer with **Mac, Windows 10/11 or Linux**
- **8 GB of RAM** at least (16 GB is better) and **25 GB of free disk space**
- An internet connection
- About **₹0 to start**: both AI services below give new accounts free credit

---

## Step 1: Install Docker Desktop

Docker runs GTAClipper in its own little box, so you don't have to install anything else by hand.

**Mac**
1. Go to [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
2. Click **Download for Mac** and pick **Apple Silicon** (M1, M2, M3, M4…) or **Intel**. Not sure? Click the Apple menu  → **About This Mac** and look at "Chip".
3. Open the downloaded file and drag **Docker** into **Applications**.
4. Open Docker from Applications and accept the terms. Wait until the whale icon in the top menu bar stops moving.

**Windows**
1. Go to [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) and click **Download for Windows**.
2. Run the installer and keep **"Use WSL 2"** ticked.
3. Restart your computer when it asks.
4. Open **Docker Desktop** and wait until it says **Engine running** (bottom left).

**Linux**
Install Docker Engine and the Compose plugin by following [docs.docker.com/engine/install](https://docs.docker.com/engine/install/).

> 💡 **Give Docker enough memory.** In Docker Desktop, open **Settings → Resources** and set **Memory** to at least **6 GB** (8 GB if your computer has 16 GB).

---

## Step 2: Download GTAClipper

**Easiest way (no Git needed):**
1. At the top of this GitHub page, click the green **Code** button → **Download ZIP**.
2. Unzip it. Rename the folder to `GTAClipper` (GitHub names it `GTAClipper-main`) and move it somewhere easy, like your **Documents** folder.

**If you use Git:**
```bash
git clone https://github.com/V413havai/GTAClipper.git
cd GTAClipper
```

---

## Step 3: Get your two API keys

GTAClipper uses two AI services. Each needs a free account and a key (a long password-like code).

**A. AssemblyAI** (turns speech into text)
1. Sign up at [assemblyai.com](https://www.assemblyai.com/).
2. On your dashboard, copy your **API key**.

**B. Google Gemini** (picks the best moments)
1. Go to [aistudio.google.com](https://aistudio.google.com/) and sign in with Google.
2. Click **Get API key** → **Create API key**, then copy it.

> 🔒 Treat both keys like passwords. Don't post them online or share screenshots of them.

---

## Step 4: Add your settings

GTAClipper reads its settings from a file called `.env`. You'll make it from the example file that comes with it.

**1. Open a terminal in the GTAClipper folder**
- **Mac:** open **Terminal** (press `Cmd + Space`, type *Terminal*, press Enter), then type `cd ` (with a space), drag the `GTAClipper` folder into the window and press Enter.
- **Windows:** open the `GTAClipper` folder in File Explorer, click the address bar, type `powershell` and press Enter.
- **Linux:** open a terminal and `cd` into the folder.

**2. Copy the example settings file**
- **Mac / Linux:**
  ```bash
  cp .env.example .env
  ```
- **Windows (PowerShell):**
  ```powershell
  copy .env.example .env
  ```

**3. Open `.env` in a text editor**
- **Mac:** `open -e .env`
- **Windows:** `notepad .env`
- **Linux:** `nano .env` (or any editor)

> Can't see `.env` in Finder? Press `Cmd + Shift + .` to show hidden files.

**4. Fill in these lines** (use your editor's search to find each one):

```bash
# Your two keys from Step 3
ASSEMBLY_AI_API_KEY=paste-your-assemblyai-key-here
GOOGLE_API_KEY=paste-your-gemini-key-here

# Which AI picks the clips (already set to Gemini)
LLM=google-gla:gemini-3-flash-preview
```

**5. Replace the three secrets** with your own random text. Any long jumble of letters and numbers works (at least 32 characters):

```bash
BETTER_AUTH_SECRET=make-up-a-long-random-string-here-1
BACKEND_AUTH_SECRET=make-up-a-long-random-string-here-2
APP_SETTINGS_ENCRYPTION_KEY=make-up-a-long-random-string-here-3
```

> On Mac or Linux you can generate one with `openssl rand -hex 32`.

**6. Mac with Apple chip only (M1/M2/M3/M4):** for faster processing, also change these two lines:

```bash
BACKEND_PLATFORM=linux/arm64
BACKEND_CPU_ONLY=true
```

**7. Save the file** and close the editor.

---

## Step 5: Start GTAClipper

Make sure Docker Desktop is open and running, then in the same terminal:

- **Mac / Linux:**
  ```bash
  ./start.sh
  ```
- **Windows (PowerShell):**
  ```powershell
  docker compose up -d --build
  ```

⏳ **The first start takes 15–30 minutes** while Docker downloads and builds everything. Lots of text will scroll past; that's normal. Later starts take seconds.

When it's done, open **[http://localhost:3107](http://localhost:3107)** in your browser.

> If the page doesn't load yet, wait a minute and refresh. The app finishes starting a little after the build.

---

## Step 6: Make your first clips

1. On **http://localhost:3107**, click **Sign up** and create an account. It stays on your computer; no email check is needed.
2. Paste a **YouTube link** (a 10–20 minute talk or podcast is a good first test), or click **Upload** to use a file.
3. Pick a **caption style**. Try **GTAClipper** for bold captions, which also works for Hindi.
4. Click **Generate** and wait. A 15-minute video usually takes a few minutes.
5. Open your clips to **preview, edit captions, or download** them.

🎉 That's it: you're clipping for free.

---

## Everyday use

| What you want | Mac / Linux | Windows (PowerShell) |
|---|---|---|
| Start GTAClipper | Open Docker, then `./start.sh` | Open Docker, then `docker compose up -d` |
| Stop it | `docker compose down` | `docker compose down` |
| See what it's doing | `docker compose logs -f worker` | `docker compose logs -f worker` |
| Update to the newest version | `git pull` then `docker compose up -d --build` | Download the new ZIP (keep your `.env`), then `docker compose up -d --build` |

Run these from inside the `GTAClipper` folder. Your clips and account are kept between restarts.

---

## Troubleshooting

**"Cannot connect to the Docker daemon" / "docker: command not found"**
Docker Desktop isn't running. Open it, wait until it's ready, and try again.

**`./start.sh: Permission denied` (Mac/Linux)**
Run `chmod +x start.sh`, then `./start.sh` again.

**"port is already allocated" or the page won't open**
Something else is using port 3107. In `.env`, change `FRONTEND_PORT=3107` to `FRONTEND_PORT=3200`, set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to `http://localhost:3200`, restart, and open http://localhost:3200.

**YouTube says the length check timed out**
In `.env`, set `YOUTUBE_PREFLIGHT_TIMEOUT_SECONDS=60` and restart. On Apple-chip Macs, also make the change in Step 4.6.

**A video fails or gets stuck**
- Check your keys in `.env` have no extra spaces or quotes.
- Make sure your AssemblyAI account still has credit.
- Look at the error: `docker compose logs --tail 100 worker backend`.

**It's very slow or the computer freezes**
Give Docker more memory (Settings → Resources), close other heavy apps, and try a shorter video first.

**I changed `.env` but nothing changed**
Restart so it reloads: `docker compose up -d --build`.

Still stuck? [Open an issue](https://github.com/V413havai/GTAClipper/issues) and paste the error text (never your API keys).

---

## Optional extras

- **Free AI instead of Gemini:** install [Ollama](https://ollama.com), then in `.env` set `LLM=ollama:gpt-oss:20b`. This needs a powerful computer.
- **More settings** (languages, caption fonts, storage, GPUs, paid plans with Razorpay or Stripe): see [docs/configuration.md](docs/configuration.md).
- **Let Claude make clips for you** with the MCP server: see [mcp/README.md](mcp/README.md).
