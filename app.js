const form = document.getElementById("timer-form");
const pauseButton = document.getElementById("pause-button");
const resetButton = document.getElementById("reset-button");
const saveButton = document.getElementById("save-button");
const addTimerButton = document.getElementById("add-timer-button");
const inlineStartButton = document.getElementById("inline-start-button");
const inlinePauseButton = document.getElementById("inline-pause-button");
const timerList = document.getElementById("timer-list");
const timerItemTemplate = document.getElementById("timer-item-template");
const settingsButton = document.getElementById("settings-button");
const closeSettingsButton = document.getElementById("close-settings-button");
const settingsModal = document.getElementById("settings-modal");
const modalBackdrop = document.getElementById("modal-backdrop");
const statusText = document.getElementById("status-text");
const digitalTime = document.getElementById("digital-time");
const largeTime = document.getElementById("large-time");
const timerName = document.getElementById("timer-name");
const activeStepLabel = document.getElementById("active-step-label");
const nextStepLabel = document.getElementById("next-step-label");
const sequenceLabel = document.getElementById("sequence-label");
const timerCard = document.getElementById("timer-card");
const progressSlice = document.getElementById("progress-slice");

const DEFAULT_STEPS = [
  {
    name: "Timer 1",
    mode: "duration",
    minutes: 5,
    seconds: 0,
    endTime: "",
    autoStartNext: true
  }
];

let timerSteps = structuredClone(DEFAULT_STEPS);
let currentStepIndex = 0;
let totalDurationMs = getStepDurationMs(timerSteps[0]);
let remainingMs = totalDurationMs;
let deadline = 0;
let rafId = 0;
let running = false;
let hasStarted = false;
let waitingForManualStart = false;

function formatTime(totalMs) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStepDurationMs(step, fromDate = new Date()) {
  if (step.mode === "endTime") {
    if (!step.endTime || !/^\d{2}:\d{2}$/.test(step.endTime)) {
      return 0;
    }

    const [hours, minutes] = step.endTime.split(":").map(Number);
    const target = new Date(fromDate);
    target.setHours(hours, minutes, 0, 0);

    if (target <= fromDate) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime() - fromDate.getTime();
  }

  return (step.minutes * 60 + step.seconds) * 1000;
}

function normalizeStep(step, index) {
  const mode = step.mode === "endTime" ? "endTime" : "duration";
  const minutes = Math.max(0, Number(step.minutes) || 0);
  const seconds = Math.min(59, Math.max(0, Number(step.seconds) || 0));
  return {
    name: String(step.name || "").trim() || `Timer ${index + 1}`,
    mode,
    minutes,
    seconds,
    endTime: String(step.endTime || ""),
    autoStartNext: Boolean(step.autoStartNext)
  };
}

function setState(state) {
  timerCard.className = `timer-card ${state}`;
}

function setModalOpen(nextOpen) {
  settingsModal.hidden = !nextOpen;
  settingsButton.setAttribute("aria-expanded", String(nextOpen));
}

function syncWidgetScale() {
  document.documentElement.style.setProperty("--widget-scale", "1");

  requestAnimationFrame(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const baseWidth = parseFloat(rootStyle.getPropertyValue("--widget-width-base")) || 210;
    const baseHeight = parseFloat(rootStyle.getPropertyValue("--widget-height-base")) || 332;
    const viewportWidth = Math.max(140, window.innerWidth - 24);
    const viewportHeight = Math.max(180, window.innerHeight - 24);
    const scale = Math.min(1, viewportWidth / baseWidth, viewportHeight / baseHeight);

    document.documentElement.style.setProperty("--widget-scale", scale.toFixed(4));
  });
}

function stopTimer() {
  running = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function loadStep(index, resetStarted = false) {
  currentStepIndex = Math.max(0, Math.min(index, timerSteps.length - 1));
  totalDurationMs = getStepDurationMs(timerSteps[currentStepIndex], new Date());
  remainingMs = totalDurationMs;
  waitingForManualStart = false;

  if (resetStarted) {
    hasStarted = false;
  }
}

function syncItemModeVisibility(item) {
  const modeSelect = item.querySelector(".timer-mode-select");
  const durationFields = item.querySelectorAll(".duration-field");
  const endTimeField = item.querySelector(".endtime-field");
  const isEndTime = modeSelect.value === "endTime";

  durationFields.forEach((field) => {
    field.hidden = isEndTime;
  });

  endTimeField.hidden = !isEndTime;
}

function renderList() {
  timerList.innerHTML = "";

  timerSteps.forEach((step, index) => {
    const fragment = timerItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".timer-item");
    const itemIndex = fragment.querySelector(".timer-item-index");
    const nameInput = fragment.querySelector(".timer-name-input");
    const modeSelect = fragment.querySelector(".timer-mode-select");
    const minutesInput = fragment.querySelector(".timer-minutes-input");
    const secondsInput = fragment.querySelector(".timer-seconds-input");
    const endTimeInput = fragment.querySelector(".timer-endtime-input");
    const autostartInput = fragment.querySelector(".timer-autostart-input");
    const removeButton = fragment.querySelector(".remove-timer-button");

    item.dataset.index = String(index);
    itemIndex.textContent = `Timer ${index + 1}`;
    nameInput.value = step.name;
    modeSelect.value = step.mode || "duration";
    minutesInput.value = step.minutes;
    secondsInput.value = step.seconds;
    endTimeInput.value = step.endTime || "";
    autostartInput.checked = step.autoStartNext;
    syncItemModeVisibility(item);

    if (index === timerSteps.length - 1) {
      autostartInput.checked = false;
      autostartInput.disabled = true;
      fragment.querySelector(".toggle-field span").textContent = "Laatste timer in de reeks";
    }

    if (timerSteps.length === 1) {
      removeButton.disabled = true;
    }

    timerList.append(fragment);
  });
}

function readStepsFromForm() {
  const items = [...timerList.querySelectorAll(".timer-item")];
  const steps = items.map((item, index) => {
    const step = normalizeStep(
      {
        name: item.querySelector(".timer-name-input").value,
        mode: item.querySelector(".timer-mode-select").value,
        minutes: item.querySelector(".timer-minutes-input").value,
        seconds: item.querySelector(".timer-seconds-input").value,
        endTime: item.querySelector(".timer-endtime-input").value,
        autoStartNext: item.querySelector(".timer-autostart-input").checked
      },
      index
    );

    if (getStepDurationMs(step) <= 0) {
      throw new Error(
        step.mode === "endTime"
          ? `Timer ${index + 1} heeft een geldige eindtijd nodig`
          : `Timer ${index + 1} moet groter zijn dan 0 seconden`
      );
    }

    return step;
  });

  if (steps.length === 0) {
    throw new Error("Voeg minimaal 1 timer toe");
  }

  steps[steps.length - 1].autoStartNext = false;
  return steps;
}

function applyStepsFromForm() {
  timerSteps = readStepsFromForm();
}

function render() {
  const safeRemaining = Math.max(0, remainingMs);
  const timeLabel = formatTime(safeRemaining);
  const progressRatio = totalDurationMs === 0 ? 0 : safeRemaining / totalDurationMs;
  const activeStep = timerSteps[currentStepIndex];
  const nextStep = timerSteps[currentStepIndex + 1];

  digitalTime.textContent = timeLabel;
  largeTime.textContent = timeLabel;
  timerName.textContent = activeStep ? activeStep.name : "Timer";
  activeStepLabel.textContent = activeStep ? activeStep.name : "Timer";
  nextStepLabel.textContent = nextStep ? nextStep.name : "Geen";
  sequenceLabel.textContent = `${currentStepIndex + 1} / ${timerSteps.length}`;
  progressSlice.style.background = `conic-gradient(from -90deg, var(--ring-color) 0deg ${progressRatio * 360}deg, transparent ${progressRatio * 360}deg 360deg)`;

  if (safeRemaining === 0 && !running && !waitingForManualStart && hasStarted) {
    statusText.textContent = "Klaar";
    setState("state-done");
    return;
  }

  if (waitingForManualStart) {
    const nextStep = timerSteps[currentStepIndex];
    statusText.textContent = nextStep ? `Start klaar: ${nextStep.name}` : "Wacht op start";
  } else if (!hasStarted) {
    statusText.textContent = "Gereed";
  } else if (!running) {
    statusText.textContent = "Gepauzeerd";
  } else {
    statusText.textContent = "Loopt";
  }

  if (progressRatio <= 0.05) {
    setState("state-alert");
  } else if (progressRatio <= 0.15) {
    setState("state-warning");
  } else {
    setState("state-normal");
  }

  syncWidgetScale();
}

function startCurrentStep() {
  if (!timerSteps[currentStepIndex]) {
    return;
  }

  stopTimer();
  hasStarted = true;
  waitingForManualStart = false;
  deadline = performance.now() + remainingMs;
  running = true;
  render();
  rafId = requestAnimationFrame(tick);
}

function completeCurrentStep() {
  stopTimer();

  const currentStep = timerSteps[currentStepIndex];
  const nextIndex = currentStepIndex + 1;
  const hasNext = nextIndex < timerSteps.length;

  if (!hasNext) {
    remainingMs = 0;
    render();
    return;
  }

  loadStep(nextIndex);

  if (currentStep.autoStartNext) {
    startCurrentStep();
    return;
  }

  waitingForManualStart = true;
  hasStarted = true;
  render();
}

function tick() {
  remainingMs = Math.max(0, deadline - performance.now());
  render();

  if (remainingMs === 0) {
    completeCurrentStep();
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function resetSequence() {
  stopTimer();
  loadStep(0, true);
  statusText.textContent = "Gereed";
  render();
}

function addStep() {
  timerSteps.push(
    normalizeStep(
      {
        name: `Timer ${timerSteps.length + 1}`,
        mode: "duration",
        minutes: 5,
        seconds: 0,
        endTime: "",
        autoStartNext: false
      },
      timerSteps.length
    )
  );
  renderList();
}

function handleStartAction() {
  if (waitingForManualStart) {
    startCurrentStep();
    return;
  }

  if (!hasStarted || remainingMs === totalDurationMs || remainingMs === 0) {
    loadStep(0);
  }

  startCurrentStep();
}

function handlePauseAction() {
  if (waitingForManualStart) {
    return;
  }

  if (running) {
    stopTimer();
    render();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    applyStepsFromForm();
  } catch (error) {
    statusText.textContent = error.message;
    return;
  }

  loadStep(waitingForManualStart ? currentStepIndex : 0);

  setModalOpen(false);
  renderList();
  startCurrentStep();
});

saveButton.addEventListener("click", () => {
  try {
    applyStepsFromForm();
    renderList();
    resetSequence();
    setModalOpen(false);
  } catch (error) {
    statusText.textContent = error.message;
  }
});

pauseButton.addEventListener("click", () => {
  if (waitingForManualStart) {
    startCurrentStep();
    return;
  }

  if (remainingMs === 0 && currentStepIndex === timerSteps.length - 1) {
    return;
  }

  if (running) {
    stopTimer();
    render();
    return;
  }

  if (!hasStarted) {
    startCurrentStep();
    return;
  }

  deadline = performance.now() + remainingMs;
  running = true;
  render();
  rafId = requestAnimationFrame(tick);
});

inlineStartButton.addEventListener("click", () => {
  handleStartAction();
});

inlinePauseButton.addEventListener("click", () => {
  handlePauseAction();
});

resetButton.addEventListener("click", () => {
  try {
    applyStepsFromForm();
  } catch (error) {
    statusText.textContent = error.message;
    return;
  }

  renderList();
  resetSequence();
});

addTimerButton.addEventListener("click", () => {
  try {
    timerSteps = readStepsFromForm();
  } catch {
    timerSteps = timerSteps.length ? timerSteps : structuredClone(DEFAULT_STEPS);
  }

  addStep();
});

timerList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-timer-button");

  if (!removeButton) {
    return;
  }

  const item = removeButton.closest(".timer-item");
  const itemIndex = Number(item.dataset.index);

  if (timerSteps.length <= 1) {
    return;
  }

  try {
    timerSteps = readStepsFromForm();
  } catch {
    timerSteps = timerSteps.length ? timerSteps : structuredClone(DEFAULT_STEPS);
  }

  timerSteps.splice(itemIndex, 1);
  currentStepIndex = Math.min(currentStepIndex, timerSteps.length - 1);
  renderList();
});

timerList.addEventListener("change", (event) => {
  const modeSelect = event.target.closest(".timer-mode-select");

  if (!modeSelect) {
    return;
  }

  syncItemModeVisibility(modeSelect.closest(".timer-item"));
});

settingsButton.addEventListener("click", () => {
  renderList();
  setModalOpen(true);
});

closeSettingsButton.addEventListener("click", () => {
  setModalOpen(false);
});

modalBackdrop.addEventListener("click", () => {
  setModalOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsModal.hidden) {
    setModalOpen(false);
  }
});

window.addEventListener("resize", syncWidgetScale);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

renderList();
resetSequence();
setModalOpen(false);
syncWidgetScale();
