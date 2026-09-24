import { icons } from "./icons.js";

export function initTheme() {
  const savedTheme = localStorage.getItem("educore-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(savedTheme || (prefersDark ? "dark" : "light"));

  const toggleBtn = document.getElementById("btn-toggle-theme");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      setTheme(current === "dark" ? "light" : "dark");
    });
  }
}

export function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("educore-theme", theme);

  const toggleBtn = document.getElementById("btn-toggle-theme");
  if (toggleBtn) {
    toggleBtn.innerHTML = theme === "dark" ? icons.sun : icons.moon;
  }
}

export function showToast(message, type = "info", duration = 4000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const iconName = type === "success" ? "checkCircle" : type === "error" ? "close" : "info";
  toast.innerHTML = `
    <span class="toast-icon">${icons[iconName] || icons.info}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(30px)";
    toast.style.transition = "all 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("open");
    const firstInput = modal.querySelector("input, select, textarea");
    if (firstInput) firstInput.focus();
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("open");
}

export function initGlobalModals() {
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.classList.remove("open");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
    }
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.innerHTML = icons.close;
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-backdrop");
      if (modal) modal.classList.remove("open");
    });
  });
}
