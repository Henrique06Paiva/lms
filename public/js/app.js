import { api } from "./api.js";
import { icons } from "./icons.js";
import { showToast, openModal, closeModal, initGlobalModals, initTheme } from "./ui.js";
import { CustomVideoPlayer } from "./player.js";

const state = {
  user: null,
  courses: [],
  currentCourse: null,
  currentLessons: [],
  activeLesson: null,
  currentEnrollment: null,
  player: null,
  activeFilter: "all",
  searchQuery: "",
  activeClassroomTab: "overview",
  viewMode: localStorage.getItem("educore_view_mode") || "grid",
};

export function isCourseCompleted(courseOrEnrollment) {
  if (!courseOrEnrollment) return false;
  if (courseOrEnrollment.enrollment_id === null && courseOrEnrollment.course_id === undefined) return false;
  if (courseOrEnrollment.completed_at !== null && courseOrEnrollment.completed_at !== undefined) return true;
  const percent = courseOrEnrollment.progress_percent !== null && courseOrEnrollment.progress_percent !== undefined
    ? Math.round(courseOrEnrollment.progress_percent)
    : 0;
  return percent >= 100;
}

function syncCourseProgress(courseId, enrollment) {
  if (!enrollment) return;
  const course = state.courses.find((c) => c.id === courseId);
  if (course) {
    course.enrollment_id = enrollment.id ?? course.enrollment_id;
    course.progress_percent = enrollment.progress_percent;
    course.completed_at = enrollment.completed_at;
  }
}

async function init() {
  initTheme();
  initGlobalModals();
  injectStaticIcons();

  state.player = new CustomVideoPlayer(document.getElementById("player-container"));

  setupNavigation();
  setupAuthScreenControls();
  setupCatalogControls();
  setupClassroomControls();
  setupForms();

  await checkAuth();

  if (state.user) {
    updateAuthLayout();
    switchView("courses");
    await loadCourses();
  } else {
    updateAuthLayout();
    switchView("auth");
  }
}

function injectStaticIcons() {
  const map = {
    "brand-logo-icon": icons.logo,
    "auth-brand-logo": icons.logo,
    "demo-info-icon": icons.info,
    "search-icon-container": icons.search,
    "nav-icon-courses": icons.book,
    "nav-icon-my-courses": icons.layers,
    "nav-icon-verify-cert": icons.shieldCheck,
    "nav-icon-plus": icons.plus,
    "icon-view-grid": icons.layoutGrid,
    "icon-view-list": icons.layoutList,
    "kpi-icon-courses": icons.book,
    "kpi-icon-progress": icons.checkCircle,
    "kpi-icon-certificates": icons.award,
    "btn-complete-icon": icons.check,
    "btn-next-icon": icons.chevronRight,
    "btn-reset-icon": icons.refresh,
    "cert-btn-icon": icons.award,
    "seal-icon-box": icons.shieldCheck,
    "verify-submit-icon": icons.search,
    "modal-login-icon": icons.user,
    "modal-reg-icon": icons.user,
    "modal-create-course-icon": icons.book,
    "nav-icon-user-plus": icons.userPlus,
    "modal-admin-user-icon": icons.userPlus,
    "modal-create-lesson-icon": icons.book,
  };

  for (const [id, svg] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  }
}

async function checkAuth() {
  try {
    const data = await api.auth.me();
    state.user = data.user;
  } catch {
    state.user = null;
  }
  renderNavActions();
  updateAdminUI();
  updateAuthLayout();
  updateKPIs();
}

function updateAuthLayout() {
  const sidebar = document.getElementById("app-sidebar");
  const search = document.getElementById("global-search-container");
  const isAuthenticated = !!state.user;

  if (sidebar) sidebar.style.display = isAuthenticated ? "flex" : "none";
  if (search) search.style.display = isAuthenticated ? "flex" : "none";
}

function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderNavActions() {
  const container = document.getElementById("nav-actions");
  if (!container) return;

  if (state.user) {
    const initials = getInitials(state.user.name);
    const roleLabel = state.user.role === "admin" ? "Admin" : "Aluno";

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.55rem; background-color: var(--bg-surface); border: 1px solid var(--border); padding: 0.25rem 0.55rem; border-radius: var(--radius-pill);">
        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: var(--primary); color: var(--bg-surface); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700;">
          ${initials}
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-primary); line-height: 1.1;">${state.user.name}</span>
          <span style="font-size: 0.62rem; font-weight: 500; color: var(--text-muted); text-transform: uppercase;">${roleLabel}</span>
        </div>
      </div>
      <button class="btn btn-secondary" id="btn-logout" title="Sair" style="padding: 0.35rem 0.55rem;">
        ${icons.logout}
      </button>
    `;

    document.getElementById("btn-logout")?.addEventListener("click", handleLogout);
  } else {
    container.innerHTML = `
      <button class="btn btn-primary" id="btn-nav-go-login" style="padding: 0.4rem 0.75rem; font-size: 0.82rem;">
        Entrar
      </button>
    `;
    document.getElementById("btn-nav-go-login")?.addEventListener("click", () => switchView("auth"));
  }
}

function updateAdminUI() {
  const isAdmin = state.user?.role === "admin";
  const title = document.getElementById("admin-section-title");
  const nav = document.getElementById("admin-section-nav");
  const btnCreateLesson = document.getElementById("btn-open-create-lesson");

  if (title) title.style.display = isAdmin ? "block" : "none";
  if (nav) nav.style.display = isAdmin ? "flex" : "none";
  if (btnCreateLesson) btnCreateLesson.style.display = isAdmin ? "inline-flex" : "none";
}

async function handleLogout() {
  try {
    await api.auth.logout();
    state.user = null;
    state.courses = [];
    showToast("Sessão encerrada.", "info");
    renderNavActions();
    updateAdminUI();
    updateAuthLayout();
    switchView("auth");
    updateKPIs();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function updateKPIs() {
  const enrolledCountEl = document.getElementById("kpi-enrolled-count");
  const avgProgressEl = document.getElementById("kpi-avg-progress");
  const certsCountEl = document.getElementById("kpi-certificates-count");

  if (!state.user || !state.courses) {
    if (enrolledCountEl) enrolledCountEl.textContent = "0";
    if (avgProgressEl) avgProgressEl.textContent = "0%";
    if (certsCountEl) certsCountEl.textContent = "0";
    return;
  }

  const enrolled = state.courses.filter((c) => c.enrollment_id !== null && c.enrollment_id !== undefined);
  const enrolledCount = enrolled.length;
  const completed = enrolled.filter((c) => isCourseCompleted(c));

  let totalPercent = 0;
  enrolled.forEach((c) => { totalPercent += c.progress_percent || 0; });
  const avgPercent = enrolledCount > 0 ? Math.round(totalPercent / enrolledCount) : 0;

  if (enrolledCountEl) enrolledCountEl.textContent = String(enrolledCount);
  if (avgProgressEl) avgProgressEl.textContent = `${avgPercent}%`;
  if (certsCountEl) certsCountEl.textContent = String(completed.length);
}

function switchView(viewName) {
  if (!state.user && viewName !== "verify-cert") {
    viewName = "auth";
  }

  const authView = document.getElementById("view-auth");
  const coursesView = document.getElementById("view-courses");
  const classroomView = document.getElementById("view-classroom");
  const verifyView = document.getElementById("view-verify-cert");

  if (authView) authView.style.display = viewName === "auth" ? "block" : "none";
  if (coursesView) coursesView.style.display = viewName === "courses" ? "flex" : "none";
  if (classroomView) classroomView.style.display = viewName === "classroom" ? "flex" : "none";
  if (verifyView) verifyView.style.display = viewName === "verify-cert" ? "block" : "none";

  document.querySelectorAll(".sidebar-nav-item").forEach((el) => el.classList.remove("active"));
  if (viewName === "courses" && state.activeFilter === "all") {
    document.getElementById("nav-courses")?.classList.add("active");
  } else if (viewName === "courses" && state.activeFilter === "my-courses") {
    document.getElementById("nav-my-courses")?.classList.add("active");
  } else if (viewName === "verify-cert") {
    document.getElementById("nav-verify-cert")?.classList.add("active");
  }

  updateAuthLayout();
}

function setupNavigation() {
  document.getElementById("nav-brand-home")?.addEventListener("click", async () => {
    if (state.user) {
      state.activeFilter = "all";
      updateCatalogFilterButtons();
      switchView("courses");
      await loadCourses();
    } else {
      switchView("auth");
    }
  });

  document.getElementById("nav-courses")?.addEventListener("click", async () => {
    if (!state.user) { switchView("auth"); return; }
    state.activeFilter = "all";
    updateCatalogFilterButtons();
    switchView("courses");
    await loadCourses();
  });

  document.getElementById("nav-my-courses")?.addEventListener("click", async () => {
    if (!state.user) {
      showToast("Faça login para acessar seus cursos", "warning");
      switchView("auth");
      return;
    }
    state.activeFilter = "my-courses";
    updateCatalogFilterButtons();
    switchView("courses");
    await loadCourses();
  });

  document.getElementById("nav-verify-cert")?.addEventListener("click", () => switchView("verify-cert"));

  document.getElementById("btn-back-to-courses")?.addEventListener("click", async () => {
    switchView("courses");
    await loadCourses();
  });

  document.getElementById("btn-open-create-course")?.addEventListener("click", () => openModal("modal-create-course"));
  document.getElementById("btn-open-admin-create-user")?.addEventListener("click", () => openModal("modal-admin-create-user"));
  document.getElementById("btn-open-create-lesson")?.addEventListener("click", () => openModal("modal-create-lesson"));
}

function setupAuthScreenControls() {
  const tabLogin = document.getElementById("auth-tab-login");
  const tabRegister = document.getElementById("auth-tab-register");
  const formLogin = document.getElementById("form-auth-login");
  const formRegister = document.getElementById("form-auth-register");

  tabLogin?.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister?.classList.remove("active");
    if (formLogin) formLogin.style.display = "flex";
    if (formRegister) formRegister.style.display = "none";
  });

  tabRegister?.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin?.classList.remove("active");
    if (formRegister) formRegister.style.display = "flex";
    if (formLogin) formLogin.style.display = "none";
  });

  document.getElementById("btn-fill-admin")?.addEventListener("click", () => {
    tabLogin?.click();
    const emailInput = document.getElementById("auth-login-email");
    const passInput = document.getElementById("auth-login-password");
    if (emailInput) emailInput.value = "admin@educore.com";
    if (passInput) passInput.value = "adminPassword123";
    showToast("Credenciais de Administrador preenchidas!", "info");
  });

  document.getElementById("btn-fill-student")?.addEventListener("click", () => {
    tabLogin?.click();
    const emailInput = document.getElementById("auth-login-email");
    const passInput = document.getElementById("auth-login-password");
    if (emailInput) emailInput.value = "aluno@empresa.com";
    if (passInput) passInput.value = "alunoPassword123";
    showToast("Credenciais de Aluno preenchidas!", "info");
  });

  document.getElementById("btn-auth-to-verify")?.addEventListener("click", () => switchView("verify-cert"));

  document.getElementById("btn-back-from-verify")?.addEventListener("click", () => {
    switchView(state.user ? "courses" : "auth");
  });

  formLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-login-email")?.value;
    const password = document.getElementById("auth-login-password")?.value;

    try {
      const data = await api.auth.login({ email, password });
      state.user = data.user;
      showToast(`Bem-vindo(a), ${data.user.name}!`, "success");
      renderNavActions();
      updateAdminUI();
      updateAuthLayout();
      switchView("courses");
      await loadCourses();
      updateKPIs();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  formRegister?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("auth-reg-name")?.value;
    const email = document.getElementById("auth-reg-email")?.value;
    const password = document.getElementById("auth-reg-password")?.value;

    try {
      await api.auth.register({ name, email, password });
      showToast("Cadastro realizado! Faça login para continuar.", "success");
      tabLogin?.click();
      const loginEmail = document.getElementById("auth-login-email");
      const loginPass = document.getElementById("auth-login-password");
      if (loginEmail) loginEmail.value = email;
      if (loginPass) loginPass.value = password;
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

function setupCatalogControls() {
  const searchInput = document.getElementById("global-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      renderCoursesGrid();
    });
  }

  document.querySelectorAll(".catalog-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeFilter = tab.getAttribute("data-filter") || "all";
      updateCatalogFilterButtons();
      renderCoursesGrid();
    });
  });

  const btnGrid = document.getElementById("btn-view-grid");
  const btnList = document.getElementById("btn-view-list");

  function updateViewModeButtons() {
    if (state.viewMode === "grid") {
      btnGrid?.classList.add("active");
      btnList?.classList.remove("active");
    } else {
      btnList?.classList.add("active");
      btnGrid?.classList.remove("active");
    }
  }

  btnGrid?.addEventListener("click", () => {
    state.viewMode = "grid";
    localStorage.setItem("educore_view_mode", "grid");
    updateViewModeButtons();
    renderCoursesGrid();
  });

  btnList?.addEventListener("click", () => {
    state.viewMode = "list";
    localStorage.setItem("educore_view_mode", "list");
    updateViewModeButtons();
    renderCoursesGrid();
  });

  updateViewModeButtons();
}

function updateCatalogFilterButtons() {
  document.querySelectorAll(".catalog-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.getAttribute("data-filter") === state.activeFilter);
  });

  document.querySelectorAll(".sidebar-nav-item").forEach((el) => el.classList.remove("active"));
  if (state.activeFilter === "all") {
    document.getElementById("nav-courses")?.classList.add("active");
  } else if (state.activeFilter === "my-courses") {
    document.getElementById("nav-my-courses")?.classList.add("active");
  }
}

async function loadCourses() {
  const grid = document.getElementById("course-grid");
  if (grid && state.courses.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted); padding: 1.5rem 0;">Carregando cursos...</p>`;
  }

  try {
    const data = await api.courses.list();
    state.courses = data.courses || [];
    renderCoursesGrid();
    updateKPIs();
  } catch (err) {
    if (grid) {
      grid.innerHTML = `<p style="color: var(--danger);">${err.message}</p>`;
    }
  }
}

function renderCoursesGrid() {
  const grid = document.getElementById("course-grid");
  if (!grid) return;

  let list = [...state.courses];

  if (state.activeFilter === "my-courses") {
    list = list.filter((c) => c.enrollment_id !== null && c.enrollment_id !== undefined);
  } else if (state.activeFilter === "in-progress") {
    list = list.filter((c) => c.enrollment_id !== null && c.enrollment_id !== undefined && !isCourseCompleted(c));
  } else if (state.activeFilter === "completed") {
    list = list.filter((c) => c.enrollment_id !== null && c.enrollment_id !== undefined && isCourseCompleted(c));
  }

  if (state.searchQuery) {
    list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(state.searchQuery) ||
        (c.description && c.description.toLowerCase().includes(state.searchQuery))
    );
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1rem; width: 100%; border: 1px dashed var(--border); border-radius: var(--radius-lg); text-align: center; gap: 0.65rem;">
        <span style="color: var(--text-muted);">${icons.book}</span>
        <h3 style="font-size: 1rem; color: var(--text-primary); font-weight: 600;">Nenhum curso encontrado</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 360px;">
          Não há registros para o filtro ou termo pesquisado.
        </p>
      </div>
    `;
    return;
  }

  const categoryTaxonomy = [
    { cat: "Segurança & Conformidade", prefix: "SEC" },
    { cat: "Arquitetura & DevSecOps", prefix: "ARC" },
    { cat: "Governança & Riscos", prefix: "GOV" },
    { cat: "Engenharia de Dados", prefix: "DAT" },
    { cat: "Liderança Corporativa", prefix: "LDR" }
  ];

  if (state.viewMode === "list") {
    grid.innerHTML = `
      <div class="executive-table-container">
        <table class="executive-table">
          <thead>
            <tr>
              <th style="width: 130px;">Código</th>
              <th>Curso</th>
              <th style="width: 90px; text-align: center;">Carga</th>
              <th style="width: 90px; text-align: center;">Aulas</th>
              <th style="width: 140px;">Status</th>
              <th style="width: 160px;">Progresso</th>
              <th style="width: 160px; text-align: right;">Ação</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((c) => {
              const isEnrolled = c.enrollment_id !== null && c.enrollment_id !== undefined;
              const isCompleted = isCourseCompleted(c);
              const percent = c.progress_percent !== null && c.progress_percent !== undefined
                ? Math.round(c.progress_percent) : 0;
              const tax = categoryTaxonomy[c.id % categoryTaxonomy.length];
              const code = `${tax.prefix}-${String(c.id).padStart(3, "0")}`;

              let statusClass = "available";
              let statusLabel = "Disponível";
              if (isCompleted) { statusClass = "completed"; statusLabel = "Concluído"; }
              else if (isEnrolled) { statusClass = "in-progress"; statusLabel = "Em andamento"; }

              return `
                <tr class="executive-table-row" data-slug="${c.slug}">
                  <td><span class="table-code">${code}</span></td>
                  <td>
                    <div class="table-course-title">${c.title}</div>
                    <div class="table-course-desc">${c.description || ""}</div>
                  </td>
                  <td style="text-align: center; font-weight: 600;">${c.workload_hours}h</td>
                  <td style="text-align: center; font-weight: 600;">${c.total_lessons || 0}</td>
                  <td>
                    <span class="dossier-status-pill ${statusClass}">
                      <span class="status-dot ${statusClass}"></span>
                      ${statusLabel}
                    </span>
                  </td>
                  <td>
                    ${isEnrolled ? `
                      <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                        <span style="font-size: 0.7rem; color: var(--text-muted);">${percent}%</span>
                        <div class="progress-track" style="height: 4px;">
                          <div class="progress-fill ${isCompleted ? "completed" : ""}" style="width: ${percent}%;"></div>
                        </div>
                      </div>
                    ` : `<span style="font-size: 0.72rem; color: var(--text-muted);">—</span>`}
                  </td>
                  <td style="text-align: right;">
                    <button class="btn ${isCompleted ? "btn-success" : isEnrolled ? "btn-secondary" : "btn-primary"} btn-enter-course" data-slug="${c.slug}" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;">
                      ${isCompleted ? `${icons.award} Certificado` : isEnrolled ? "Continuar ›" : "Iniciar ›"}
                    </button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

    grid.querySelectorAll(".executive-table-row").forEach((row) => {
      row.addEventListener("click", () => {
        const slug = row.getAttribute("data-slug");
        if (slug) handleOpenCourse(slug);
      });
    });

    grid.querySelectorAll(".btn-enter-course").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const slug = btn.getAttribute("data-slug");
        if (slug) handleOpenCourse(slug);
      });
    });
    return;
  }

  grid.innerHTML = list
    .map((c) => {
      const isEnrolled = c.enrollment_id !== null && c.enrollment_id !== undefined;
      const isCompleted = isCourseCompleted(c);
      const percent = c.progress_percent !== null && c.progress_percent !== undefined
        ? Math.round(c.progress_percent) : 0;
      const tax = categoryTaxonomy[c.id % categoryTaxonomy.length];
      const code = `${tax.prefix}-${String(c.id).padStart(3, "0")}`;

      let statusClass = "available";
      let statusLabel = "Disponível";
      if (isCompleted) { statusClass = "completed"; statusLabel = "Concluído"; }
      else if (isEnrolled) { statusClass = "in-progress"; statusLabel = "Em andamento"; }

      return `
        <div class="course-card" data-slug="${c.slug}">
          <div class="dossier-header">
            <div class="dossier-meta">
              <span class="dossier-code">${code}</span>
              <span class="dossier-category">${tax.cat}</span>
            </div>
            <div class="dossier-status-pill ${statusClass}">
              <span class="status-dot ${statusClass}"></span>
              <span>${statusLabel}</span>
            </div>
          </div>

          <div class="dossier-body">
            <h3 class="dossier-title">${c.title}</h3>
            <p class="dossier-desc">${c.description || "Curso de capacitação profissional."}</p>

            <div class="dossier-specs-grid">
              <div class="dossier-spec-item">
                <span class="dossier-spec-label">Carga</span>
                <span class="dossier-spec-value">${c.workload_hours}h</span>
              </div>
              <div class="dossier-spec-item">
                <span class="dossier-spec-label">Aulas</span>
                <span class="dossier-spec-value">${c.total_lessons || 0}</span>
              </div>
              <div class="dossier-spec-item">
                <span class="dossier-spec-label">Certificado</span>
                <span class="dossier-spec-value">Sim</span>
              </div>
            </div>

            ${isEnrolled ? `
              <div class="dossier-progress">
                <div class="dossier-progress-top">
                  <span>Progresso</span>
                  <strong class="dossier-progress-pct" style="color: ${isCompleted ? "var(--success)" : "var(--text-secondary)"};">${percent}%</strong>
                </div>
                <div class="progress-track">
                  <div class="progress-fill ${isCompleted ? "completed" : ""}" style="width: ${percent}%;"></div>
                </div>
              </div>
            ` : ""}
          </div>

          <div class="dossier-footer">
            <button class="btn ${isCompleted ? "btn-success" : isEnrolled ? "btn-secondary" : "btn-primary"} dossier-action-btn btn-enter-course" data-slug="${c.slug}">
              ${isCompleted ? `${icons.award} Certificado` : isEnrolled ? "Continuar ›" : "Iniciar ›"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  grid.querySelectorAll(".course-card").forEach((card) => {
    card.addEventListener("click", () => {
      const slug = card.getAttribute("data-slug");
      if (slug) handleOpenCourse(slug);
    });
  });

  grid.querySelectorAll(".btn-enter-course").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const slug = btn.getAttribute("data-slug");
      if (slug) handleOpenCourse(slug);
    });
  });
}

async function handleOpenCourse(slug) {
  if (!state.user) {
    showToast("Faça login para acessar este curso", "warning");
    switchView("auth");
    return;
  }

  try {
    const data = await api.courses.get(slug);
    state.currentCourse = data.course;
    state.currentLessons = data.lessons;
    state.currentEnrollment = data.enrollment;

    if (!state.currentEnrollment) {
      const enrollRes = await api.courses.enroll(data.course.id);
      state.currentEnrollment = enrollRes.enrollment;
      syncCourseProgress(data.course.id, enrollRes.enrollment);
      showToast("Matrícula realizada!", "success");
      await loadCourses();
    } else {
      syncCourseProgress(data.course.id, data.enrollment);
    }

    openClassroom();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function setupClassroomControls() {
  document.querySelectorAll(".classroom-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchClassroomTab(btn.getAttribute("data-classroom-tab") || "overview");
    });
  });

  document.getElementById("btn-complete-lesson")?.addEventListener("click", async () => {
    if (!state.activeLesson) return;
    try {
      const res = await api.lessons.complete(state.activeLesson.id);
      state.currentEnrollment = res.enrollment;
      state.activeLesson.is_completed = 1;
      syncCourseProgress(state.currentCourse.id, res.enrollment);

      const isCompleted = isCourseCompleted(res.enrollment);
      showToast(isCompleted ? "🎉 Parabéns! Curso concluído!" : "Aula concluída!", "success");

      renderClassroomCurriculum();
      updateClassroomProgress();
      updateClassroomCourseBadge();
      updateNextLessonButton();
      updateCertificateStatus();
      updateKPIs();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("btn-next-lesson")?.addEventListener("click", () => {
    if (!state.activeLesson || !state.currentLessons) return;
    const currentIndex = state.currentLessons.findIndex((l) => l.id === state.activeLesson.id);
    if (currentIndex >= 0 && currentIndex < state.currentLessons.length - 1) {
      selectLesson(state.currentLessons[currentIndex + 1]);
    }
  });

  document.getElementById("btn-reset-course")?.addEventListener("click", async () => {
    if (!state.currentCourse) return;
    if (!confirm("Deseja reiniciar seu progresso neste curso?")) return;

    try {
      const res = await api.courses.resetProgress(state.currentCourse.id);
      state.currentEnrollment = res.enrollment;
      state.currentLessons.forEach((l) => (l.is_completed = 0));
      syncCourseProgress(state.currentCourse.id, res.enrollment);

      showToast("Progresso reiniciado para 0%.", "info");
      renderClassroomCurriculum();
      updateClassroomProgress();
      updateClassroomCourseBadge();
      updateNextLessonButton();
      updateCertificateStatus();
      updateKPIs();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("btn-issue-certificate")?.addEventListener("click", async () => {
    if (!state.currentCourse) return;
    try {
      showToast("Gerando certificado...", "info");
      const res = await api.certificates.issue(state.currentCourse.id);
      showToast("Certificado emitido com sucesso!", "success");
      window.open(`/api/certificates/${res.certificate.code}/download`, "_blank");
      updateCertificateStatus();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("form-verify-cert")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = document.getElementById("input-cert-code").value.trim().toUpperCase();
    const resultBox = document.getElementById("cert-verification-result");

    try {
      const res = await api.certificates.verify(code);
      const cert = res.certificate;

      resultBox.style.display = "block";
      resultBox.innerHTML = `
        <div class="verify-result-official">
          <div class="official-header">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 600;">Autoridade Certificadora</span>
              <strong style="font-size: 1rem; color: var(--text-primary);">EduCore LMS</strong>
            </div>
            <span class="official-badge-status">
              ${icons.checkCircle}
              <span>Autêntico & Válido</span>
            </span>
          </div>

          <div class="official-data-grid">
            <div class="official-field">
              <span class="official-field-label">Aluno</span>
              <span class="official-field-val">${cert.studentName}</span>
            </div>
            <div class="official-field">
              <span class="official-field-label">Código</span>
              <span class="official-field-val" style="font-family: monospace;">${cert.code}</span>
            </div>
            <div class="official-field">
              <span class="official-field-label">Curso</span>
              <span class="official-field-val">${cert.courseTitle}</span>
            </div>
            <div class="official-field">
              <span class="official-field-label">Carga Horária</span>
              <span class="official-field-val">${cert.workloadHours}h</span>
            </div>
            <div class="official-field">
              <span class="official-field-label">Data de Emissão</span>
              <span class="official-field-val">${new Date(cert.issuedAt).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; padding-top: 0.85rem; border-top: 1px solid var(--border);">
            <a href="${cert.downloadUrl}" target="_blank" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.4rem;">
              ${icons.download}
              <span>Baixar PDF</span>
            </a>
          </div>
        </div>
      `;
    } catch (err) {
      resultBox.style.display = "block";
      resultBox.innerHTML = `
        <div style="background-color: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.25rem; display: flex; align-items: center; gap: 0.85rem;">
          <span style="color: var(--danger);">${icons.close}</span>
          <div>
            <h4 style="font-size: 0.95rem; color: var(--danger); font-weight: 600;">Certificado não encontrado</h4>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.2rem;">
              ${err.message || "O código informado não corresponde a nenhum registro válido."}
            </p>
          </div>
        </div>
      `;
    }
  });
}

function switchClassroomTab(tabName) {
  state.activeClassroomTab = tabName;
  document.querySelectorAll(".classroom-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-classroom-tab") === tabName);
  });

  const overviewPane = document.getElementById("tab-content-overview");
  const materialsPane = document.getElementById("tab-content-materials");
  const certPane = document.getElementById("tab-content-certificate");

  if (overviewPane) overviewPane.style.display = tabName === "overview" ? "block" : "none";
  if (materialsPane) materialsPane.style.display = tabName === "materials" ? "block" : "none";
  if (certPane) certPane.style.display = tabName === "certificate" ? "block" : "none";
}

function openClassroom() {
  switchView("classroom");
  switchClassroomTab("overview");

  document.getElementById("breadcrumb-course-title").textContent = state.currentCourse.title;
  document.getElementById("current-course-title").textContent = state.currentCourse.title;

  updateAdminUI();
  renderClassroomCurriculum();
  updateClassroomProgress();
  updateClassroomCourseBadge();

  const firstIncomplete = state.currentLessons.find((l) => !l.is_completed) || state.currentLessons[0];
  if (firstIncomplete) {
    selectLesson(firstIncomplete);
  } else {
    document.getElementById("current-lesson-title").textContent = "Nenhuma aula cadastrada";
  }

  updateCertificateStatus();
}

function updateClassroomCourseBadge() {
  const container = document.getElementById("classroom-course-badge-container");
  if (!container) return;

  const badges = [];

  if (state.user?.role === "admin") {
    badges.push(`
      <span class="classroom-header-badge" style="background-color: var(--bg-surface-hover); color: var(--text-primary); border: 1px solid var(--border);">
        <span>Modo Gestor / Instrutor</span>
      </span>
    `);
  }

  const isCompleted = isCourseCompleted(state.currentEnrollment);
  if (isCompleted) {
    badges.push(`
      <span class="classroom-header-badge completed">
        ${icons.checkCircle}
        <span>Concluído</span>
      </span>
    `);
  } else if (state.currentEnrollment) {
    const percent = Math.round(state.currentEnrollment.progress_percent || 0);
    badges.push(`
      <span class="classroom-header-badge in-progress">
        <span>Em andamento (${percent}%)</span>
      </span>
    `);
  }

  container.innerHTML = badges.join("");
}

function updateClassroomProgress() {
  const percent = state.currentEnrollment?.progress_percent !== null && state.currentEnrollment?.progress_percent !== undefined
    ? Math.round(state.currentEnrollment.progress_percent) : 0;
  const completedCount = state.currentLessons.filter((l) => l.is_completed).length;
  const totalCount = state.currentLessons.length;

  const textEl = document.getElementById("curriculum-progress-text");
  const percentEl = document.getElementById("curriculum-percent-text");
  const fillEl = document.getElementById("curriculum-progress-fill");

  if (textEl) textEl.textContent = `${completedCount} de ${totalCount} aulas`;
  if (percentEl) percentEl.textContent = `${percent}%`;
  if (fillEl) fillEl.style.width = `${percent}%`;
}

function renderClassroomCurriculum() {
  const container = document.getElementById("classroom-lessons-list");
  if (!container) return;

  if (!state.currentLessons || state.currentLessons.length === 0) {
    container.innerHTML = `<p style="padding: 1rem; color: var(--text-muted); font-size: 0.85rem;">Nenhuma aula cadastrada.</p>`;
    return;
  }

  const isAdmin = state.user?.role === "admin";

  container.innerHTML = state.currentLessons
    .map((lesson) => {
      const isCompleted = !!lesson.is_completed;
      const isActive = state.activeLesson?.id === lesson.id;

      let statusIcon = icons.circle;
      let statusClass = "";

      if (isCompleted) { statusIcon = icons.checkCircle; statusClass = "completed"; }
      else if (isActive) { statusIcon = icons.play; statusClass = "playing"; }

      const durationText = lesson.duration_seconds > 0 ? `${Math.round(lesson.duration_seconds / 60)} min` : "";

      const deleteBtnHtml = isAdmin
        ? `<button class="btn-delete-lesson" data-delete-lesson-id="${lesson.id}" title="Excluir aula">
             ${icons.trash}
           </button>`
        : "";

      return `
        <div class="curriculum-lesson-item ${isActive ? "active" : ""}" data-lesson-id="${lesson.id}">
          <div class="curriculum-lesson-info">
            <span class="curriculum-status-icon ${statusClass}">${statusIcon}</span>
            <span class="curriculum-lesson-title">${lesson.order_index}. ${lesson.title}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="curriculum-lesson-duration">${durationText}</span>
            ${deleteBtnHtml}
          </div>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".curriculum-lesson-item").forEach((item) => {
    item.addEventListener("click", () => {
      const lessonId = Number(item.getAttribute("data-lesson-id"));
      const target = state.currentLessons.find((l) => l.id === lessonId);
      if (target) selectLesson(target);
    });
  });

  if (isAdmin) {
    container.querySelectorAll(".btn-delete-lesson").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const lessonId = Number(btn.getAttribute("data-delete-lesson-id"));
        if (!confirm("Tem certeza que deseja excluir esta aula?")) return;
        try {
          await api.lessons.delete(lessonId);
          showToast("Aula excluída com sucesso", "success");
          state.currentLessons = state.currentLessons.filter((l) => l.id !== lessonId);
          if (state.activeLesson?.id === lessonId) {
            state.activeLesson = state.currentLessons[0] || null;
          }
          renderClassroomCurriculum();
          updateClassroomProgress();
          if (state.activeLesson) {
            selectLesson(state.activeLesson);
          } else {
            document.getElementById("current-lesson-title").textContent = "Nenhuma aula cadastrada";
            document.getElementById("current-lesson-desc").textContent = "";
            if (state.player) state.player.loadSource("");
          }
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });
  }
}

function selectLesson(lesson) {
  state.activeLesson = lesson;

  document.getElementById("breadcrumb-lesson-title").textContent = `Aula ${lesson.order_index}: ${lesson.title}`;
  document.getElementById("current-lesson-title").textContent = `${lesson.order_index}. ${lesson.title}`;
  document.getElementById("current-lesson-desc").textContent =
    `Você está assistindo à aula "${lesson.title}". Acompanhe o vídeo e os materiais disponíveis.`;

  if (lesson.video_filename) {
    state.player.loadSource(`/api/lessons/${lesson.id}/video`);
  } else {
    state.player.loadSource("");
  }

  updateNextLessonButton();
  loadLessonMaterials(lesson.id);
  renderClassroomCurriculum();
}

function updateNextLessonButton() {
  const nextBtn = document.getElementById("btn-next-lesson");
  const completeBtn = document.getElementById("btn-complete-lesson");

  if (!nextBtn || !state.activeLesson) return;

  const currentIndex = state.currentLessons.findIndex((l) => l.id === state.activeLesson.id);
  const hasNext = currentIndex >= 0 && currentIndex < state.currentLessons.length - 1;

  nextBtn.style.display = hasNext ? "inline-flex" : "none";

  if (completeBtn) {
    if (state.activeLesson.is_completed) {
      completeBtn.innerHTML = `${icons.check} <span>Aula Concluída</span>`;
      completeBtn.className = "btn btn-secondary";
    } else {
      completeBtn.innerHTML = `${icons.check} <span>Concluir Aula</span>`;
      completeBtn.className = "btn btn-primary";
    }
  }
}

async function loadLessonMaterials(lessonId) {
  const container = document.getElementById("classroom-materials-list");
  if (!container) return;

  try {
    const data = await api.lessons.listMaterials(lessonId);
    if (!data.materials || data.materials.length === 0) {
      container.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted); padding: 0.5rem 0;">Nenhum material anexado.</span>`;
      return;
    }

    container.innerHTML = data.materials
      .map(
        (m) => `
        <div class="material-card">
          <div class="material-info">
            <span style="color: var(--text-secondary);">${icons.fileText}</span>
            <span class="material-title">${m.title}</span>
          </div>
          <a href="/api/materials/${m.id}/download" class="btn btn-secondary" style="padding: 0.28rem 0.55rem; font-size: 0.78rem;" download>
            ${icons.download}
            <span>Baixar</span>
          </a>
        </div>
      `
      )
      .join("");
  } catch {
    container.innerHTML = `<span style="font-size: 0.85rem; color: var(--danger);">Não foi possível carregar os materiais.</span>`;
  }
}

function updateCertificateStatus() {
  const certBtn = document.getElementById("btn-issue-certificate");
  const msgEl = document.getElementById("cert-requirement-message");
  const isCompleted = isCourseCompleted(state.currentEnrollment);
  const percent = state.currentEnrollment?.progress_percent ?? 0;

  if (isCompleted) {
    if (certBtn) certBtn.style.display = "inline-flex";
    if (msgEl) {
      msgEl.innerHTML = `<strong>Parabéns!</strong> Você concluiu 100% do curso. Emita seu certificado oficial.`;
    }
  } else {
    if (certBtn) certBtn.style.display = "none";
    if (msgEl) {
      msgEl.textContent = `Conclua 100% das aulas para obter o certificado. Progresso atual: ${Math.round(percent)}%.`;
    }
  }
}

function setupForms() {
  document.getElementById("form-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const data = await api.auth.login({ email, password });
      state.user = data.user;
      showToast(`Bem-vindo(a), ${data.user.name}!`, "success");
      closeModal("modal-login");
      renderNavActions();
      updateAdminUI();
      updateAuthLayout();
      switchView("courses");
      await loadCourses();
      updateKPIs();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("form-register")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;

    try {
      await api.auth.register({ name, email, password });
      showToast("Cadastro realizado! Faça login para continuar.", "success");
      closeModal("modal-register");
      openModal("modal-login");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("form-admin-create-user")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("admin-user-name").value;
    const email = document.getElementById("admin-user-email").value;
    const password = document.getElementById("admin-user-password").value;
    const role = document.getElementById("admin-user-role").value;

    try {
      await api.admin.createUser({ name, email, password, role });
      showToast(`Usuário ${name} cadastrado com sucesso!`, "success");
      closeModal("modal-admin-create-user");
      document.getElementById("form-admin-create-user").reset();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("form-create-course")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("course-title").value;
    const description = document.getElementById("course-desc").value;
    const workloadHours = parseInt(document.getElementById("course-hours").value, 10);

    try {
      await api.courses.create({ title, description, workloadHours });
      showToast("Curso criado com sucesso!", "success");
      closeModal("modal-create-course");
      document.getElementById("form-create-course").reset();
      await loadCourses();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("form-create-lesson")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.currentCourse) return;

    const title = document.getElementById("lesson-title").value.trim();
    const durationMinutes = parseInt(document.getElementById("lesson-duration").value, 10) || 15;
    const description = document.getElementById("lesson-description").value.trim();

    try {
      const res = await api.lessons.create(state.currentCourse.id, {
        title,
        durationSeconds: durationMinutes * 60,
      });

      showToast("Aula adicionada com sucesso!", "success");
      closeModal("modal-create-lesson");
      document.getElementById("form-create-lesson").reset();

      state.currentLessons.push(res.lesson);
      renderClassroomCurriculum();
      updateClassroomProgress();
      if (!state.activeLesson) {
        selectLesson(res.lesson);
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

window.addEventListener("DOMContentLoaded", init);
