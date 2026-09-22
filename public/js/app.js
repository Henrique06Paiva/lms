import { api } from "./api.js";
import { icons } from "./icons.js";
import { showToast, openModal, closeModal, initGlobalModals, initTheme } from "./ui.js";
import { CustomVideoPlayer } from "./player.js";

// Estado Global da Aplicação
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

// ==============================================================================
// 1. Inicialização
// ==============================================================================

async function init() {
  initTheme();
  initGlobalModals();
  injectStaticIcons();

  state.player = new CustomVideoPlayer(document.getElementById("player-container"));

  setupNavigation();
  setupCatalogControls();
  setupClassroomControls();
  setupForms();

  await checkAuth();
  await loadCourses();
}

function injectStaticIcons() {
  const map = {
    "brand-logo-icon": icons.logo,
    "search-icon-container": icons.search,
    "nav-icon-courses": icons.book,
    "nav-icon-my-courses": icons.layers,
    "nav-icon-verify-cert": icons.shieldCheck,
    "nav-icon-plus": icons.plus,
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
  };

  for (const [id, svg] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  }
}

// ==============================================================================
// 2. Autenticação & Navbar Corporativa
// ==============================================================================

async function checkAuth() {
  try {
    const data = await api.auth.me();
    state.user = data.user;
  } catch {
    state.user = null;
  }
  renderNavActions();
  updateAdminUI();
  updateKPIs();
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
    const roleLabel = state.user.role === "admin" ? "ADMIN" : "ALUNO";

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.65rem; background-color: var(--bg-surface); border: 1px solid var(--border); padding: 0.3rem 0.65rem; border-radius: var(--radius-pill);">
        <div style="width: 26px; height: 26px; border-radius: 50%; background-color: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">
          ${initials}
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); line-height: 1.1;">
            ${state.user.name}
          </span>
          <span style="font-size: 0.65rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">
            ${roleLabel}
          </span>
        </div>
      </div>
      <button class="btn btn-secondary" id="btn-logout" title="Encerrar Sessão" style="padding: 0.4rem 0.65rem;">
        ${icons.logout}
      </button>
    `;

    document.getElementById("btn-logout")?.addEventListener("click", handleLogout);
  } else {
    container.innerHTML = `
      <button class="btn btn-secondary" id="btn-open-login" style="padding: 0.45rem 0.85rem;">
        Acessar Conta
      </button>
      <button class="btn btn-primary" id="btn-open-register" style="padding: 0.45rem 0.85rem;">
        Cadastre-se
      </button>
    `;

    document.getElementById("btn-open-login")?.addEventListener("click", () => openModal("modal-login"));
    document.getElementById("btn-open-register")?.addEventListener("click", () => openModal("modal-register"));
  }
}

function updateAdminUI() {
  const isAdmin = state.user?.role === "admin";
  const title = document.getElementById("admin-section-title");
  const nav = document.getElementById("admin-section-nav");

  if (title) title.style.display = isAdmin ? "block" : "none";
  if (nav) nav.style.display = isAdmin ? "flex" : "none";
}

async function handleLogout() {
  try {
    await api.auth.logout();
    state.user = null;
    showToast("Sessão encerrada com sucesso.", "info");
    renderNavActions();
    updateAdminUI();
    await loadCourses();
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
  enrolled.forEach((c) => {
    totalPercent += c.progress_percent || 0;
  });
  const avgPercent = enrolledCount > 0 ? Math.round(totalPercent / enrolledCount) : 0;

  if (enrolledCountEl) enrolledCountEl.textContent = String(enrolledCount);
  if (avgProgressEl) avgProgressEl.textContent = `${avgPercent}%`;
  if (certsCountEl) certsCountEl.textContent = String(completed.length);
}

// ==============================================================================
// 3. Navegação & Roteamento de Visões
// ==============================================================================

function switchView(viewName) {
  document.getElementById("view-courses").style.display = viewName === "courses" ? "flex" : "none";
  document.getElementById("view-classroom").style.display = viewName === "classroom" ? "flex" : "none";
  document.getElementById("view-verify-cert").style.display = viewName === "verify-cert" ? "flex" : "none";

  document.querySelectorAll(".sidebar-nav-item").forEach((el) => el.classList.remove("active"));
  if (viewName === "courses" && state.activeFilter === "all") {
    document.getElementById("nav-courses")?.classList.add("active");
  } else if (viewName === "courses" && state.activeFilter === "my-courses") {
    document.getElementById("nav-my-courses")?.classList.add("active");
  } else if (viewName === "verify-cert") {
    document.getElementById("nav-verify-cert")?.classList.add("active");
  }
}

function setupNavigation() {
  document.getElementById("nav-brand-home")?.addEventListener("click", async () => {
    state.activeFilter = "all";
    updateCatalogFilterButtons();
    switchView("courses");
    await loadCourses();
  });

  document.getElementById("nav-courses")?.addEventListener("click", async () => {
    state.activeFilter = "all";
    updateCatalogFilterButtons();
    switchView("courses");
    await loadCourses();
  });

  document.getElementById("nav-my-courses")?.addEventListener("click", async () => {
    if (!state.user) {
      showToast("Faça login para acessar seus cursos inscritos", "warning");
      openModal("modal-login");
      return;
    }
    state.activeFilter = "my-courses";
    updateCatalogFilterButtons();
    switchView("courses");
    await loadCourses();
  });

  document.getElementById("nav-verify-cert")?.addEventListener("click", () => {
    switchView("verify-cert");
  });

  document.getElementById("btn-back-to-courses")?.addEventListener("click", async () => {
    switchView("courses");
    await loadCourses();
  });

  document.getElementById("btn-open-create-course")?.addEventListener("click", () => {
    openModal("modal-create-course");
  });
}

// ==============================================================================
// 4. Catálogo & Dashboard de Cursos
// ==============================================================================

function setupCatalogControls() {
  // Busca global
  const searchInput = document.getElementById("global-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      renderCoursesGrid();
    });
  }

  // Filtros de status (Todos os Cursos, Meus Cursos, Em Andamento, Concluídos)
  document.querySelectorAll(".catalog-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeFilter = tab.getAttribute("data-filter") || "all";
      updateCatalogFilterButtons();
      renderCoursesGrid();
    });
  });
}

function updateCatalogFilterButtons() {
  document.querySelectorAll(".catalog-tab").forEach((tab) => {
    if (tab.getAttribute("data-filter") === state.activeFilter) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
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
    grid.innerHTML = `<p style="color: var(--text-muted); padding: 1.5rem 0;">Carregando trilhas de capacitação...</p>`;
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

  // Filtros avançados
  if (state.activeFilter === "my-courses") {
    list = list.filter((c) => c.enrollment_id !== null && c.enrollment_id !== undefined);
  } else if (state.activeFilter === "in-progress") {
    list = list.filter((c) => c.enrollment_id !== null && c.enrollment_id !== undefined && !isCourseCompleted(c));
  } else if (state.activeFilter === "completed") {
    list = list.filter((c) => c.enrollment_id !== null && c.enrollment_id !== undefined && isCourseCompleted(c));
  }

  // Filtro por busca
  if (state.searchQuery) {
    list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(state.searchQuery) ||
        (c.description && c.description.toLowerCase().includes(state.searchQuery))
    );
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3.5rem 1rem; width: 100%; border: 1px dashed var(--border); border-radius: var(--radius-lg); text-align: center; gap: 0.75rem;">
        <span style="color: var(--text-muted);">${icons.book}</span>
        <h3 style="font-size: 1.1rem; color: var(--text-primary); font-weight: 600;">Nenhum curso encontrado</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 400px;">
          Não há cursos correspondentes à categoria ou termo selecionado.
        </p>
      </div>
    `;
    return;
  }

  const categoryPalettes = [
    { cat: "TECNOLOGIA", grad: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" },
    { cat: "ENGENHARIA", grad: "linear-gradient(135deg, #065f46 0%, #0f172a 100%)" },
    { cat: "GOVERNANÇA", grad: "linear-gradient(135deg, #4c1d95 0%, #0f172a 100%)" },
    { cat: "LIDERANÇA", grad: "linear-gradient(135deg, #831843 0%, #0f172a 100%)" },
  ];

  grid.innerHTML = list
    .map((c, idx) => {
      const isEnrolled = c.enrollment_id !== null && c.enrollment_id !== undefined;
      const isCompleted = isCourseCompleted(c);
      const percent = c.progress_percent !== null && c.progress_percent !== undefined
        ? Math.round(c.progress_percent)
        : 0;
      const pal = categoryPalettes[idx % categoryPalettes.length];

      let statusBadge = "";
      if (isCompleted) {
        statusBadge = `<span class="card-status-badge completed">${icons.check} Concluído</span>`;
      } else if (isEnrolled) {
        statusBadge = `<span class="card-status-badge enrolled">Em Andamento</span>`;
      } else {
        statusBadge = `<span class="card-status-badge available">Disponível</span>`;
      }

      return `
        <div class="course-card" data-slug="${c.slug}">
          <div class="card-banner" style="background: ${pal.grad};">
            <span class="card-category-badge">${pal.cat}</span>
            ${statusBadge}
          </div>
          <div class="card-body">
            <h3 class="card-title">${c.title}</h3>
            <p class="card-desc">${c.description || "Capacitação profissional com metodologia prática e certificação de conformidade."}</p>
            
            ${
              isEnrolled
                ? `
                <div class="progress-container">
                  <div class="progress-header">
                    <span>Progresso do Aluno</span>
                    <strong style="color: ${isCompleted ? "var(--success)" : "var(--primary)"};">${percent}%</strong>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill ${isCompleted ? "completed" : ""}" style="width: ${percent}%;"></div>
                  </div>
                </div>
              `
                : ""
            }

            <div class="card-footer">
              <div class="card-meta-list">
                <span class="card-meta-item">${icons.clock} ${c.workload_hours}h</span>
                <span class="card-meta-item">${icons.layers} ${c.total_lessons || 0} aulas</span>
              </div>
              <button class="btn ${isCompleted ? "btn-success" : isEnrolled ? "btn-secondary" : "btn-primary"} btn-enter-course" data-slug="${c.slug}" style="padding: 0.45rem 0.85rem; font-size: 0.8rem;">
                ${isCompleted ? `${icons.award} Ver Certificado` : isEnrolled ? "Continuar" : "Matricular-se"}
              </button>
            </div>
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
}

async function handleOpenCourse(slug) {
  if (!state.user) {
    showToast("Faça login com sua conta para acessar esta capacitação", "warning");
    openModal("modal-login");
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
      showToast("Matrícula realizada com sucesso!", "success");
      await loadCourses();
    } else {
      syncCourseProgress(data.course.id, data.enrollment);
    }

    openClassroom();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==============================================================================
// 5. Sala de Aula & Player Customizado
// ==============================================================================

function setupClassroomControls() {
  // Abas da sala de aula
  document.querySelectorAll(".classroom-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-classroom-tab") || "overview";
      switchClassroomTab(tab);
    });
  });

  // Concluir Aula
  document.getElementById("btn-complete-lesson")?.addEventListener("click", async () => {
    if (!state.activeLesson) return;
    try {
      const res = await api.lessons.complete(state.activeLesson.id);
      state.currentEnrollment = res.enrollment;
      state.activeLesson.is_completed = 1;

      // Sincroniza imediatamente o curso na lista em memória
      syncCourseProgress(state.currentCourse.id, res.enrollment);

      const isCompleted = isCourseCompleted(res.enrollment);
      if (isCompleted) {
        showToast("🎉 Parabéns! Você concluiu todas as aulas desta capacitação!", "success");
      } else {
        showToast(`Aula marcada como concluída!`, "success");
      }

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

  // Próxima Aula
  document.getElementById("btn-next-lesson")?.addEventListener("click", () => {
    if (!state.activeLesson || !state.currentLessons) return;
    const currentIndex = state.currentLessons.findIndex((l) => l.id === state.activeLesson.id);
    if (currentIndex >= 0 && currentIndex < state.currentLessons.length - 1) {
      selectLesson(state.currentLessons[currentIndex + 1]);
    }
  });

  // Resetar Curso
  document.getElementById("btn-reset-course")?.addEventListener("click", async () => {
    if (!state.currentCourse) return;
    if (!confirm("Atenção: Deseja realmente reiniciar seu progresso neste curso para 0%?")) return;

    try {
      const res = await api.courses.resetProgress(state.currentCourse.id);
      state.currentEnrollment = res.enrollment;
      state.currentLessons.forEach((l) => (l.is_completed = 0));

      // Sincroniza reset no curso na lista em memória
      syncCourseProgress(state.currentCourse.id, res.enrollment);

      showToast("Progresso reiniciado para 0%", "info");
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

  // Emitir Certificado
  document.getElementById("btn-issue-certificate")?.addEventListener("click", async () => {
    if (!state.currentCourse) return;
    try {
      showToast("Gerando certificado em PDF com assinatura e hash criptográfico...", "info");
      const res = await api.certificates.issue(state.currentCourse.id);
      showToast("Certificado corporativo emitido com sucesso!", "success");
      window.open(`/api/certificates/${res.certificate.code}/download`, "_blank");
      updateCertificateStatus();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Formulário do Validador de Certificados
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
              <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-weight: 700;">Autoridade Certificadora</span>
              <strong style="font-size: 1.15rem; color: var(--text-primary);">EduCore LMS & Compliance Authority</strong>
            </div>
            <span class="official-badge-status">
              ${icons.checkCircle}
              <span>Autêntico & Válido</span>
            </span>
          </div>

          <div class="official-data-grid">
            <div class="official-field">
              <span class="official-field-label">Aluno Titular</span>
              <span class="official-field-val">${cert.studentName}</span>
            </div>
            <div class="official-field">
              <span class="official-field-label">Código de Autenticidade</span>
              <span class="official-field-val" style="font-family: monospace; color: var(--primary);">${cert.code}</span>
            </div>
            <div class="official-field">
              <span class="official-field-label">Programa / Capacitação</span>
              <span class="official-field-val">${cert.courseTitle}</span>
            </div>
            <div class="official-field">
              <span class="official-field-label">Carga Horária Reconhecida</span>
              <span class="official-field-val">${cert.workloadHours} horas de formação</span>
            </div>
            <div class="official-field">
              <span class="official-field-label">Data de Conclusão / Emissão</span>
              <span class="official-field-val">${new Date(cert.issuedAt).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid var(--border);">
            <a href="${cert.downloadUrl}" target="_blank" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem;">
              ${icons.download}
              <span>Baixar Certificado Oficial (PDF)</span>
            </a>
          </div>
        </div>
      `;
    } catch (err) {
      resultBox.style.display = "block";
      resultBox.innerHTML = `
        <div style="background-color: var(--bg-surface); border: 1px solid var(--danger); border-radius: var(--radius-lg); padding: 1.5rem; display: flex; align-items: center; gap: 1rem;">
          <span style="color: var(--danger);">${icons.close}</span>
          <div>
            <h4 style="font-size: 1rem; color: var(--danger); font-weight: 700;">Certificado Não Encontrado</h4>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">
              ${err.message || "O código informado não corresponde a nenhum registro válido na base de dados oficial."}
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

  const isCompleted = isCourseCompleted(state.currentEnrollment);
  if (isCompleted) {
    container.innerHTML = `
      <span class="classroom-header-badge completed">
        ${icons.checkCircle}
        <span>Curso 100% Concluído</span>
      </span>
    `;
  } else if (state.currentEnrollment) {
    const percent = Math.round(state.currentEnrollment.progress_percent || 0);
    container.innerHTML = `
      <span class="classroom-header-badge in-progress">
        <span>Em Andamento (${percent}%)</span>
      </span>
    `;
  } else {
    container.innerHTML = "";
  }
}

function updateClassroomProgress() {
  const percent = state.currentEnrollment?.progress_percent !== null && state.currentEnrollment?.progress_percent !== undefined
    ? Math.round(state.currentEnrollment.progress_percent)
    : 0;
  const completedCount = state.currentLessons.filter((l) => l.is_completed).length;
  const totalCount = state.currentLessons.length;

  const textEl = document.getElementById("curriculum-progress-text");
  const percentEl = document.getElementById("curriculum-percent-text");
  const fillEl = document.getElementById("curriculum-progress-fill");

  if (textEl) textEl.textContent = `${completedCount} de ${totalCount} aulas concluídas`;
  if (percentEl) percentEl.textContent = `${percent}%`;
  if (fillEl) fillEl.style.width = `${percent}%`;
}

function renderClassroomCurriculum() {
  const container = document.getElementById("classroom-lessons-list");
  if (!container) return;

  if (!state.currentLessons || state.currentLessons.length === 0) {
    container.innerHTML = `<p style="padding: 1.25rem; color: var(--text-muted); font-size: 0.875rem;">Nenhuma aula cadastrada ainda.</p>`;
    return;
  }

  container.innerHTML = state.currentLessons
    .map((lesson) => {
      const isCompleted = !!lesson.is_completed;
      const isActive = state.activeLesson?.id === lesson.id;

      let statusIcon = icons.circle;
      let statusClass = "";

      if (isCompleted) {
        statusIcon = icons.checkCircle;
        statusClass = "completed";
      } else if (isActive) {
        statusIcon = icons.play;
        statusClass = "playing";
      }

      const durationText = lesson.duration_seconds > 0 ? `${Math.round(lesson.duration_seconds / 60)} min` : "";

      return `
        <div class="curriculum-lesson-item ${isActive ? "active" : ""}" data-lesson-id="${lesson.id}">
          <div class="curriculum-lesson-info">
            <span class="curriculum-status-icon ${statusClass}">
              ${statusIcon}
            </span>
            <span class="curriculum-lesson-title">
              ${lesson.order_index}. ${lesson.title}
            </span>
          </div>
          <span class="curriculum-lesson-duration">${durationText}</span>
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
}

function selectLesson(lesson) {
  state.activeLesson = lesson;

  document.getElementById("breadcrumb-lesson-title").textContent = `Aula ${lesson.order_index}: ${lesson.title}`;
  document.getElementById("current-lesson-title").textContent = `${lesson.order_index}. ${lesson.title}`;
  document.getElementById("current-lesson-desc").textContent =
    `Você está assistindo à aula "${lesson.title}". Acompanhe a reprodução do vídeo e os materiais didáticos disponibilizados na aba ao lado para consolidar seu aprendizado.`;

  // Carrega vídeo no player
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
      container.innerHTML = `<span style="font-size: 0.875rem; color: var(--text-muted); padding: 0.5rem 0;">Nenhum material de apoio anexado a esta aula.</span>`;
      return;
    }

    container.innerHTML = data.materials
      .map(
        (m) => `
        <div class="material-card">
          <div class="material-info">
            <span style="color: var(--primary);">${icons.fileText}</span>
            <span class="material-title">${m.title}</span>
          </div>
          <a href="/api/materials/${m.id}/download" class="btn btn-secondary" style="padding: 0.3rem 0.65rem; font-size: 0.8rem;" download>
            ${icons.download}
            <span>Baixar</span>
          </a>
        </div>
      `
      )
      .join("");
  } catch {
    container.innerHTML = `<span style="font-size: 0.875rem; color: var(--danger);">Não foi possível carregar os anexos desta aula.</span>`;
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
      msgEl.innerHTML = `<strong>Parabéns!</strong> Você concluiu 100% da carga horária deste curso. Seu certificado oficial já está pronto para emissão e download.`;
    }
  } else {
    if (certBtn) certBtn.style.display = "none";
    if (msgEl) {
      msgEl.textContent = `Para obter o certificado oficial em PDF com código de verificação criptográfica, você deve completar 100% das aulas desta capacitação (Progresso atual: ${Math.round(percent)}%).`;
    }
  }
}

// ==============================================================================
// 6. Formulários de Modais (Login, Cadastro, Criação de Curso)
// ==============================================================================

function setupForms() {
  // Login
  document.getElementById("form-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const data = await api.auth.login({ email, password });
      state.user = data.user;
      showToast(`Bem-vindo(a) ao EduCore, ${data.user.name}!`, "success");
      closeModal("modal-login");
      renderNavActions();
      updateAdminUI();
      await loadCourses();
      updateKPIs();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Cadastro
  document.getElementById("form-register")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const role = document.getElementById("reg-role").value;

    try {
      await api.auth.register({ name, email, password, role });
      showToast("Cadastro realizado com sucesso! Efetue login para continuar.", "success");
      closeModal("modal-register");
      openModal("modal-login");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Criar Curso (Admin)
  document.getElementById("form-create-course")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("course-title").value;
    const description = document.getElementById("course-desc").value;
    const workloadHours = parseInt(document.getElementById("course-hours").value, 10);

    try {
      await api.courses.create({ title, description, workloadHours });
      showToast("Programa de capacitação registrado com sucesso!", "success");
      closeModal("modal-create-course");
      document.getElementById("form-create-course").reset();
      await loadCourses();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// Inicia aplicação
window.addEventListener("DOMContentLoaded", init);
