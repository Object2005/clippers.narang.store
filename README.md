<p align="center">
  <img src="assets/banner.png" alt="GTAClipper home page" width="100%" />
</p>

<h1 align="center">GTAClipper</h1>

<p align="center">
  <b>Turn one long video into a week of Shorts and Reels, free, on your own computer.</b><br/>
  AI finds the best moments, crops them to 9:16 around the speaker and adds word-by-word captions.
</p>

<p align="center">
  <a href="INSTALL.md"><b>📦 Install guide</b></a> ·
  <a href="#whats-inside">Features</a> ·
  <a href="#what-it-costs">Costs</a> ·
  <a href="docs/README.md">Docs</a>
</p>

---

## What it does

Paste a **YouTube, Twitch or Kick** link (or upload a video file). GTAClipper:

1. **Transcribes** the video with word-level timing
2. **Finds the most viral moments** with AI and scores each one
3. **Crops to vertical 9:16**, keeping the speaker's face in frame
4. **Adds animated captions** and a hook title
5. Gives you **ready-to-post clips** for Reels, Shorts and TikTok

No watermarks. No monthly limits. Your videos stay on your computer.

## What's inside

- 🎬 **AI clip picking:** Gemini, GPT, Claude or a free local model chooses the best moments
- 🗣️ **Word-by-word captions** in many styles, including the **GTAClipper style** (bold caps with a yellow highlight)
- 🇮🇳 **Hindi and Hinglish captions** that render properly, plus 99+ spoken languages
- 🙂 **Face tracking** so the speaker stays centred, with speaker switching for podcasts
- 📺 **YouTube, Twitch and Kick** links, or upload your own files
- ✂️ **Clip editor:** fix words, change timing, framing and style, then export
- 🤖 **Works with AI agents:** an MCP server lets Claude, Cursor and others make clips for you
- 💳 **Optional paid hosting:** built-in Razorpay (India, UPI) or Stripe subscriptions if you want to run it as a service

## Install

👉 **Follow the step-by-step [Install guide](INSTALL.md).** It's written for beginners and takes about 30 minutes, most of it waiting for the first download.

The short version, if you already use Docker:

```bash
git clone https://github.com/V413havai/gtaclipper.git
cd gtaclipper
cp .env.example .env      # then add ASSEMBLY_AI_API_KEY and GOOGLE_API_KEY
./start.sh                # or: docker compose up -d --build
```

Open **http://localhost:3107**, create an account and paste a video link.

## What it costs

GTAClipper itself is free. You pay the AI services directly, per use:

| Service | What it does | Cost |
|---|---|---|
| AssemblyAI | Transcription | about $0.21 per hour of video (new accounts get free credit) |
| Google Gemini | Picks the best moments | a few cents per video |

Typical cost: **under ₹50 per hour of video**. You can also use a free local model with [Ollama](https://ollama.com) instead of Gemini.

## Need help?

- Something not working? See [Troubleshooting](INSTALL.md#troubleshooting) in the install guide.
- Found a bug or have an idea? [Open an issue](https://github.com/V413havai/gtaclipper/issues).

## License

GTAClipper is free and open source under the **AGPL-3.0** license. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

If you run a modified version as a public website, the license requires you to share your changes with its users.

---

<p align="center">Made by <a href="https://www.instagram.com/vaibhavv.ai/">Vaibhav Hedaoo (@vaibhavv.ai)</a> · <a href="https://aitoolbox.in">AiToolBox.in</a></p>
