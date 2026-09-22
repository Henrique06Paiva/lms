// ==============================================================================
// EduCore — Player de Vídeo Customizado Vanilla (RF20)
// ==============================================================================

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export class CustomVideoPlayer {
  constructor(containerElement) {
    this.container = containerElement;
    this.video = this.container.querySelector("video");
    this.playBtn = this.container.querySelector("[data-play-btn]");
    this.scrubberTrack = this.container.querySelector("[data-scrubber-track]");
    this.scrubberFill = this.container.querySelector("[data-scrubber-fill]");
    this.timeDisplay = this.container.querySelector("[data-time-display]");
    this.fullscreenBtn = this.container.querySelector("[data-fullscreen-btn]");

    this.initEvents();
  }

  initEvents() {
    if (!this.video) return;

    // 1. Play / Pause
    if (this.playBtn) {
      this.playBtn.addEventListener("click", () => this.togglePlay());
    }
    this.video.addEventListener("click", () => this.togglePlay());

    this.video.addEventListener("play", () => {
      if (this.playBtn) this.playBtn.innerHTML = "⏸";
    });
    this.video.addEventListener("pause", () => {
      if (this.playBtn) this.playBtn.innerHTML = "▶";
    });

    // 2. Atualização de Tempo e Barra de Progresso
    this.video.addEventListener("timeupdate", () => {
      if (!this.video.duration) return;
      const percent = (this.video.currentTime / this.video.duration) * 100;
      if (this.scrubberFill) {
        this.scrubberFill.style.width = `${percent}%`;
      }
      if (this.timeDisplay) {
        this.timeDisplay.textContent = `${formatTime(this.video.currentTime)} / ${formatTime(this.video.duration)}`;
      }
    });

    this.video.addEventListener("loadedmetadata", () => {
      if (this.timeDisplay) {
        this.timeDisplay.textContent = `00:00 / ${formatTime(this.video.duration)}`;
      }
    });

    // 3. Seek interativo na barra (Aciona Range requests HTTP 206)
    if (this.scrubberTrack) {
      this.scrubberTrack.addEventListener("click", (e) => {
        const rect = this.scrubberTrack.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        if (this.video.duration) {
          this.video.currentTime = pos * this.video.duration;
        }
      });
    }

    // 4. Tela Cheia (Fullscreen)
    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          this.container.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }
  }

  togglePlay() {
    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
  }

  loadSource(srcUrl) {
    this.video.src = srcUrl;
    this.video.load();
    if (this.scrubberFill) this.scrubberFill.style.width = "0%";
    if (this.playBtn) this.playBtn.innerHTML = "▶";
  }
}
