import { icons } from "./icons.js";

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
    this.controls = this.container.querySelector("#player-controls");
    this.playBtn = this.container.querySelector("[data-play-btn]");
    this.playIcon = this.container.querySelector("#player-play-icon");
    this.replay10Btn = this.container.querySelector("[data-replay10-btn]");
    this.replayIcon = this.container.querySelector("#player-replay-icon");
    this.forward10Btn = this.container.querySelector("[data-forward10-btn]");
    this.forwardIcon = this.container.querySelector("#player-forward-icon");
    this.volumeBtn = this.container.querySelector("[data-volume-btn]");
    this.volumeIcon = this.container.querySelector("#player-volume-icon");
    this.volumeSlider = this.container.querySelector("[data-volume-slider]");
    this.scrubberTrack = this.container.querySelector("[data-scrubber-track]");
    this.scrubberFill = this.container.querySelector("[data-scrubber-fill]");
    this.timeDisplay = this.container.querySelector("[data-time-display]");
    this.speedSelect = this.container.querySelector("[data-speed-select]");
    this.fullscreenBtn = this.container.querySelector("[data-fullscreen-btn]");
    this.fullscreenIcon = this.container.querySelector("#player-fullscreen-icon");

    this.lastVolume = 1;
    this.hideTimeout = null;

    this.renderIcons();
    this.initEvents();
  }

  renderIcons() {
    if (this.playIcon) this.playIcon.innerHTML = icons.play;
    if (this.replayIcon) this.replayIcon.innerHTML = icons.replay10;
    if (this.forwardIcon) this.forwardIcon.innerHTML = icons.forward10;
    if (this.volumeIcon) this.volumeIcon.innerHTML = icons.volume;
    if (this.fullscreenIcon) this.fullscreenIcon.innerHTML = icons.fullscreen;
  }

  initEvents() {
    if (!this.video) return;

    if (this.playBtn) this.playBtn.addEventListener("click", () => this.togglePlay());
    this.video.addEventListener("click", () => this.togglePlay());

    this.video.addEventListener("play", () => {
      if (this.playIcon) this.playIcon.innerHTML = icons.pause;
      this.scheduleAutoHide();
    });

    this.video.addEventListener("pause", () => {
      if (this.playIcon) this.playIcon.innerHTML = icons.play;
      this.showControls();
    });

    if (this.replay10Btn) {
      this.replay10Btn.addEventListener("click", () => {
        this.video.currentTime = Math.max(0, this.video.currentTime - 10);
      });
    }

    if (this.forward10Btn) {
      this.forward10Btn.addEventListener("click", () => {
        if (this.video.duration) {
          this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
        }
      });
    }

    if (this.volumeBtn) this.volumeBtn.addEventListener("click", () => this.toggleMute());

    if (this.volumeSlider) {
      this.volumeSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        this.video.volume = val;
        this.video.muted = val === 0;
        this.updateVolumeIcon();
      });
    }

    this.video.addEventListener("timeupdate", () => {
      if (!this.video.duration) return;
      const percent = (this.video.currentTime / this.video.duration) * 100;
      if (this.scrubberFill) this.scrubberFill.style.width = `${percent}%`;
      if (this.timeDisplay) {
        this.timeDisplay.textContent = `${formatTime(this.video.currentTime)} / ${formatTime(this.video.duration)}`;
      }
    });

    this.video.addEventListener("loadedmetadata", () => {
      if (this.timeDisplay) {
        this.timeDisplay.textContent = `00:00 / ${formatTime(this.video.duration)}`;
      }
    });

    if (this.scrubberTrack) {
      this.scrubberTrack.addEventListener("click", (e) => {
        const rect = this.scrubberTrack.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        if (this.video.duration) this.video.currentTime = pos * this.video.duration;
      });
    }

    if (this.speedSelect) {
      this.speedSelect.addEventListener("change", (e) => {
        this.video.playbackRate = parseFloat(e.target.value);
      });
    }

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());
    }

    document.addEventListener("fullscreenchange", () => {
      const isFull = !!document.fullscreenElement;
      if (this.fullscreenIcon) {
        this.fullscreenIcon.innerHTML = isFull ? icons.fullscreenExit : icons.fullscreen;
      }
    });

    this.container.addEventListener("mousemove", () => {
      this.showControls();
      this.scheduleAutoHide();
    });

    this.container.addEventListener("mouseleave", () => {
      if (!this.video.paused) this.hideControls();
    });

    window.addEventListener("keydown", (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (e.code === "Space") { e.preventDefault(); this.togglePlay(); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); this.video.currentTime = Math.max(0, this.video.currentTime - 5); }
      else if (e.code === "ArrowRight") { e.preventDefault(); if (this.video.duration) this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 5); }
      else if (e.code === "KeyM") { e.preventDefault(); this.toggleMute(); }
      else if (e.code === "KeyF") { e.preventDefault(); this.toggleFullscreen(); }
    });
  }

  togglePlay() {
    if (this.video.paused) this.video.play().catch(() => {});
    else this.video.pause();
  }

  toggleMute() {
    this.video.muted = !this.video.muted;
    if (this.volumeSlider) this.volumeSlider.value = this.video.muted ? 0 : this.video.volume;
    this.updateVolumeIcon();
  }

  updateVolumeIcon() {
    if (!this.volumeIcon) return;
    this.volumeIcon.innerHTML = (this.video.muted || this.video.volume === 0) ? icons.volumeMute : icons.volume;
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) this.container.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  showControls() {
    if (this.controls) this.controls.classList.remove("fade-out");
  }

  hideControls() {
    if (this.controls) this.controls.classList.add("fade-out");
  }

  scheduleAutoHide() {
    clearTimeout(this.hideTimeout);
    if (!this.video.paused) {
      this.hideTimeout = setTimeout(() => this.hideControls(), 2500);
    }
  }

  loadSource(srcUrl) {
    this.video.src = srcUrl;
    this.video.load();
    if (this.scrubberFill) this.scrubberFill.style.width = "0%";
    if (this.playIcon) this.playIcon.innerHTML = icons.play;
    if (this.timeDisplay) this.timeDisplay.textContent = "00:00 / 00:00";
    this.showControls();
  }
}
