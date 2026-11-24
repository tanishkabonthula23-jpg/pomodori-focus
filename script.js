document.addEventListener("DOMContentLoaded", () => {
  const clockReadout = document.getElementById("clock-readout");
  const sessionStatus = document.getElementById("session-status");
  const ringIndicator = document.getElementById("ring-indicator");
  const startPauseBtn = document.getElementById("start-pause-btn");
  const resetBtn = document.getElementById("reset-btn");
  const skipBtn = document.getElementById("skip-btn");
  const chimeToggle = document.getElementById("chime-toggle");
  const presetButtons = document.querySelectorAll(".preset-btn");
  const sessionGoalInput = document.getElementById("session-goal");

  const focusMinsInput = document.getElementById("focus-mins");
  const shortMinsInput = document.getElementById("short-mins");
  const longMinsInput = document.getElementById("long-mins");

  const completedCountEl = document.getElementById("completed-count");
  const focusedMinutesEl = document.getElementById("focused-minutes");
  const sessionListEl = document.getElementById("session-log");
  const emptyLogMsg = document.getElementById("empty-log-msg");
  const clearLogBtn = document.getElementById("clear-log-btn");

  const RADIUS = 102;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  ringIndicator.style.strokeDasharray = `${CIRCUMFERENCE}`;
  ringIndicator.style.strokeDashoffset = "0";

  const LOG_STORAGE_KEY = "pomodori_focus_log_v1";
  let sessionHistory = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY)) || [];

  let durations = {
    focus: 25 * 60,
    short: 5 * 60,
    long: 15 * 60,
  };

  let currentMode = "focus";
  let secondsLeft = durations.focus;
  let isRunning = false;
  let chimeOn = true;
  let intervalId = null;

  function playGentleChime() {
    if (!chimeOn) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const startAt = ctx.currentTime + idx * 0.14;
        gain.gain.setValueAtTime(0.08, startAt);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + 0.46);
      });
    } catch {
      // Ignore audio restrictions before user gesture
    }
  }

  function updateRingColor() {
    if (currentMode === "focus") {
      ringIndicator.style.stroke = "#d4623b";
    } else if (currentMode === "short") {
      ringIndicator.style.stroke = "#5d8a5a";
    } else {
      ringIndicator.style.stroke = "#c88a2b";
    }
  }

  function renderClock() {
    const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const secs = String(secondsLeft % 60).padStart(2, "0");
    clockReadout.textContent = `${mins}:${secs}`;
    document.title = `${mins}:${secs} • Pomodori Focus`;

    const totalForMode = durations[currentMode] || 1;
    const progressRatio = Math.max(0, Math.min(1, secondsLeft / totalForMode));
    const offset = CIRCUMFERENCE * (1 - progressRatio);
    ringIndicator.style.strokeDashoffset = `${offset}`;
  }

  function saveLog() {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(sessionHistory));
  }

  function renderLog() {
    sessionListEl.innerHTML = "";
    emptyLogMsg.classList.toggle("hidden", sessionHistory.length > 0);

    const totalMins = sessionHistory.reduce((sum, item) => sum + item.minutes, 0);
    completedCountEl.textContent = String(sessionHistory.length);
    focusedMinutesEl.textContent = `${totalMins}m`;  sessionHistory.forEach((entry) => { const li = document.createElement("li"); li.className = "session-item";  const left = document.createElement("div"); const topic = document.createElement("div"); topic.className = "session-topic"; topic.textContent = entry.topic;  const meta = document.createElement("div"); meta.className = "session-meta"; meta.textContent = entry.timeLabel;  left.appendChild(topic); left.appendChild(meta);  const badge = document.createElement("span"); badge.className = "duration-tag"; badge.textContent = `${entry.minutes} min`;

      li.appendChild(left);
      li.appendChild(badge);
      sessionListEl.appendChild(li);
    });
  }

  function recordCompletedFocus() {
    const minutesCompleted = Math.max(1, Math.round(durations.focus / 60));
    const topicText = sessionGoalInput.value.trim() || "Deep Focus Sprint";
    const timeStr = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    sessionHistory.unshift({
      id: Date.now().toString(),
      topic: topicText,
      minutes: minutesCompleted,
      timeLabel: `Completed at ${timeStr}`,
    });
    saveLog();
    renderLog();
  }

  function stopTimer() {
    clearInterval(intervalId);
    intervalId = null;
    isRunning = false;
    startPauseBtn.textContent = "Start Sprint";
  }

  function handleTimerComplete() {
    stopTimer();
    playGentleChime();

    if (currentMode === "focus") {
      recordCompletedFocus();
      sessionStatus.textContent = "Sprint complete! Time for a break";
      switchMode("short");
    } else {
      sessionStatus.textContent = "Break finished! Ready for next sprint";
      switchMode("focus");
    }
  }

  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    startPauseBtn.textContent = "Pause";
    sessionStatus.textContent =
      currentMode === "focus" ? "Focusing on your sprint..." : "Recharging on break...";

    intervalId = setInterval(() => {
      if (secondsLeft > 1) {
        secondsLeft--;
        renderClock();
      } else {
        secondsLeft = 0;
        renderClock();
        handleTimerComplete();
      }
    }, 1000);
  }

  function switchMode(mode) {
    stopTimer();
    currentMode = mode;
    secondsLeft = durations[mode];

    presetButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
    });

    sessionStatus.textContent =
      mode === "focus" ? "Ready to focus" : "Break timer ready";
    updateRingColor();
    renderClock();
  }

  function syncCustomDurations() {
    const f = Math.max(1, Math.min(120, Number(focusMinsInput.value) || 25));
    const s = Math.max(1, Math.min(45, Number(shortMinsInput.value) || 5));
    const l = Math.max(1, Math.min(60, Number(longMinsInput.value) || 15));

    durations = {
      focus: f * 60,
      short: s * 60,
      long: l * 60,
    };

    if (!isRunning) {
      secondsLeft = durations[currentMode];
      renderClock();
    }
  }

  startPauseBtn.addEventListener("click", () => {
    if (isRunning) {
      stopTimer();
      sessionStatus.textContent = "Paused";
    } else {
      startTimer();
    }
  });

  resetBtn.addEventListener("click", () => {
    stopTimer();
    secondsLeft = durations[currentMode];
    sessionStatus.textContent = "Reset to start";
    renderClock();
  });

  skipBtn.addEventListener("click", () => {
    const order = ["focus", "short", "long"];
    const nextIdx = (order.indexOf(currentMode) + 1) % order.length;
    switchMode(order[nextIdx]);
  });

  chimeToggle.addEventListener("click", () => {
    chimeOn = !chimeOn;
    chimeToggle.setAttribute("aria-pressed", String(chimeOn));
    chimeToggle.textContent = chimeOn ? "🔔 Chime On" : "🔕 Chime Off";
  });

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchMode(btn.getAttribute("data-mode"));
    });
  });

  [focusMinsInput, shortMinsInput, longMinsInput].forEach((inputEl) => {
    inputEl.addEventListener("change", syncCustomDurations);
  });

  clearLogBtn.addEventListener("click", () => {
    sessionHistory = [];
    saveLog();
    renderLog();
  });

  updateRingColor();
  renderClock();
  renderLog();
});
