import { icons } from "./icons.js";

// ==============================================================================
// 1. Gerenciador de Tema (Light & Dark Mode)
// ==============================================================================

export function initTheme() {
  const savedTheme = localStorage.getItem("educore-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

  setTheme(initialTheme);

  const toggleBtn = document.getElementById("btn-toggle-theme");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
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

// ==============================================================================
// 2. Toasts Corporativos com Ícones Vetoriais
// ==============================================================================

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

  const iconName = type === "success" ? "checkCircle" : type === "error" ? "close" : type === "warning" ? "info" : "info";
  const iconSvg = icons[iconName] || icons.info;

  toast.innerHTML = `
    <span class="toast-icon">${iconSvg}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ==============================================================================
// 3. Modais Acessíveis
// ==============================================================================

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
  if (modal) {
    modal.classList.remove("open");
  }
}

export function initGlobalModals() {
  // Fecha modais ao clicar no backdrop escuro
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove("open");
      }
    });
  });

  // Fecha modais com a tecla ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.open").forEach((m) => {
        m.classList.remove("open");
      });
    }
  });

  // Botões com data-close-modal
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.innerHTML = icons.close;
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-backdrop");
      if (modal) modal.classList.remove("open");
    });
  });
}
