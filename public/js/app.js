// ==============================================================================
// EduCore — Aplicação Frontend Vanilla SPA (RF19, RF20, RF21, RF22)
// ==============================================================================

import { api } from "./api.js";
import { showToast, openModal, closeModal, initGlobalModals } from "./ui.js";
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
};

// ==============================================================================
// 1. Inicialização e Autenticação
// ==============================================================================

async function init() {
  initGlobalModals();
  state.player = new CustomVideoPlayer(document.getElementById("player-container"));

  setupNavigation();
  setupForms();
  setupClassroomActions();

  await checkAuth();
  await loadCourses();
}

async function checkAuth() {
  try {
    const data = await api.auth.me();
    state.user = data.user;
  } catch {
    state.user = null;
  }
  renderNavActions();
}

function renderNavActions() {
  const container = document.getElementById("nav-actions");
  const createBtn = document.getElementById("btn-open-create-course");

  if (state.user) {
    container.innerHTML = `
      <span style="font-size: 0.9rem; color: var(--text-muted);">
        👤 <strong>${state.user.name}</strong> (${state.user.role})
      </span>
      <button class="btn btn-secondary" id="btn-logout" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
        Sair
      </button>
    `;

    document.getElementById("btn-logout")?.addEventListener("click", handleLogout);

    if (createBtn) {
      createBtn.style.display = state.user.role === "admin" ? "inline-flex" : "none";
    }
  } else {
    container.innerHTML = `
      <button class="btn btn-secondary" id="btn-open-login" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
        Entrar
      </button>
      <button class="btn btn-primary" id="btn-open-register" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
        Cadastre-se
      </button>
    `;

    document.getElementById("btn-open-login")?.addEventListener("click", () => openModal("modal-login"));
    document.getElementById("btn-open-register")?.addEventListener("click", () => openModal("modal-register"));

    if (createBtn) createBtn.style.display = "none";
  }
}

async function handleLogout() {
  try {
    await api.auth.logout();
    state.user = null;
    showToast("Logout efetuado com sucesso!", "info");
    renderNavActions();
    await loadCourses();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==============================================================================
// 2. Navegação e Roteamento de Visões
// ==============================================================================

function switchView(viewName) {
  document.getElementById("view-courses").style.display = viewName === "courses" ? "flex" : "none";
  document.getElementById("view-classroom").style.display = viewName === "classroom" ? "flex" : "none";
  document.getElementById("view-verify-cert").style.display = viewName === "verify-cert" ? "flex" : "none";

  document.querySelectorAll(".sidebar-nav-item").forEach((el) => el.classList.remove("active"));
  if (viewName === "courses") document.getElementById("nav-courses")?.classList.add("active");
  if (viewName === "verify-cert") document.getElementById("nav-verify-cert")?.classList.add("active");
}

function setupNavigation() {
  document.getElementById("nav-brand-home")?.addEventListener("click", () => {
    switchView("courses");
    loadCourses(false);
  });

  document.getElementById("nav-courses")?.addEventListener("click", () => {
    switchView("courses");
    loadCourses(false);
  });

  document.getElementById("nav-my-courses")?.addEventListener("click", () => {
    if (!state.user) {
      showToast("Faça login para ver seus cursos inscritos", "warning");
      openModal("modal-login");
      return;
    }
    switchView("courses");
    document.getElementById("courses-view-title").textContent = "Meus Cursos Inscritos";
    loadCourses(true);
  });

  document.getElementById("nav-verify-cert")?.addEventListener("click", () => {
    switchView("verify-cert");
  });

  document.getElementById("btn-back-to-courses")?.addEventListener("click", () => {
    switchView("courses");
    loadCourses(false);
  });

  document.getElementById("btn-open-create-course")?.addEventListener("click", () => {
    openModal("modal-create-course");
  });
}

// ==============================================================================
// 3. Catálogo de Cursos (Cards com Flexbox - RF19)
// ==============================================================================

async function loadCourses(myCoursesOnly = false) {
  const grid = document.getElementById("course-grid");
  grid.innerHTML = `<p style="color: var(--text-muted);">Carregando cursos...</p>`;

  try {
    const data = await api.courses.list();
    let courses = data.courses || [];

    if (myCoursesOnly) {
      courses = courses.filter((c) => c.enrollment_id !== null);
    }

    state.courses = courses;

    if (courses.length === 0) {
      grid.innerHTML = `<p style="color: var(--text-muted);">Nenhum curso disponível no momento.</p>`;
      return;
    }

    grid.innerHTML = courses
      .map((c) => {
        const isEnrolled = c.enrollment_id !== null;
        const percent = c.progress_percent !== null ? Math.round(c.progress_percent) : 0;

        return `
          <div class="course-card" data-slug="${c.slug}">
            <div class="card-cover">💻</div>
            <div class="card-body">
              <h3 class="card-title">${c.title}</h3>
              <p class="card-desc">${c.description}</p>
              
              ${
                isEnrolled
                  ? `
                  <div class="progress-bar-container">
                    <div class="progress-label">
                      <span>Progresso</span>
                      <span>${percent}%</span>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill" style="width: ${percent}%;"></div>
                    </div>
                  </div>
                `
                  : ""
              }

              <div class="card-meta">
                <span>⏱ ${c.workload_hours}h</span>
                <span>📖 ${c.total_lessons || 0} aula(s)</span>
              </div>

              <button class="btn btn-primary btn-enter-course" style="margin-top: 0.5rem;" data-slug="${c.slug}">
                ${isEnrolled ? (percent === 100 ? "🎓 Concluído (Ver)" : "▶ Continuar") : "Matricular-se"}
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    // Adiciona listener nos cards
    grid.querySelectorAll(".btn-enter-course").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const slug = btn.getAttribute("data-slug");
        if (slug) handleOpenCourse(slug);
      });
    });
  } catch (err) {
    grid.innerHTML = `<p style="color: var(--danger);">${err.message}</p>`;
  }
}

async function handleOpenCourse(slug) {
  if (!state.user) {
    showToast("Por favor, faça login para acessar este curso", "warning");
    openModal("modal-login");
    return;
  }

  try {
    const data = await api.courses.get(slug);
    state.currentCourse = data.course;
    state.currentLessons = data.lessons;
    state.currentEnrollment = data.enrollment;

    // Se ainda não estiver matriculado, matricula automaticamente
    if (!state.currentEnrollment) {
      const enrollRes = await api.courses.enroll(data.course.id);
      state.currentEnrollment = enrollRes.enrollment;
      showToast("Matrícula realizada com sucesso!", "success");
    }

    openClassroom();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==============================================================================
// 4. Sala de Aula (Player + Aulas + Progresso - RF14, RF15, RF16, RF20)
// ==============================================================================

function openClassroom() {
  switchView("classroom");

  document.getElementById("current-course-title").textContent = state.currentCourse.title;

  renderClassroomCurriculum();

  // Seleciona a primeira aula não concluída ou a aula 1
  const firstIncomplete = state.currentLessons.find((l) => !l.is_completed) || state.currentLessons[0];
  if (firstIncomplete) {
    selectLesson(firstIncomplete);
  }

  updateCertificateButton();
}

function renderClassroomCurriculum() {
  const container = document.getElementById("classroom-lessons-list");
  if (!state.currentLessons || state.currentLessons.length === 0) {
    container.innerHTML = `<p style="padding: 1rem; color: var(--text-muted);">Nenhuma aula cadastrada ainda.</p>`;
    return;
  }

  container.innerHTML = state.currentLessons
    .map(
      (lesson) => `
      <div class="accordion-item" data-lesson-id="${lesson.id}">
        <div class="accordion-header ${state.activeLesson?.id === lesson.id ? "active-lesson" : ""}" data-lesson-id="${lesson.id}">
          <div class="accordion-title">
            <span>${lesson.is_completed ? "✅" : "⚪"}</span>
            <span>${lesson.order_index}. ${lesson.title}</span>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${lesson.duration_seconds > 0 ? Math.round(lesson.duration_seconds / 60) + " min" : ""}</span>
        </div>
      </div>
    `
    )
    .join("");

  container.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const lessonId = Number(header.getAttribute("data-lesson-id"));
      const lesson = state.currentLessons.find((l) => l.id === lessonId);
      if (lesson) selectLesson(lesson);
    });
  });
}

async function selectLesson(lesson) {
  state.activeLesson = lesson;
  document.getElementById("current-lesson-title").textContent = `${lesson.order_index}. ${lesson.title}`;

  // Carrega vídeo no player customizado (RF20)
  if (lesson.video_filename) {
    state.player.loadSource(`/api/lessons/${lesson.id}/video`);
  } else {
    state.player.loadSource("");
  }

  // Carrega materiais complementares
  loadLessonMaterials(lesson.id);
  renderClassroomCurriculum();
}

async function loadLessonMaterials(lessonId) {
  const container = document.getElementById("classroom-materials-list");
  try {
    const data = await api.lessons.listMaterials(lessonId);
    if (!data.materials || data.materials.length === 0) {
      container.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">Nenhum material anexo para esta aula.</span>`;
      return;
    }

    container.innerHTML = data.materials
      .map(
        (m) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-main); padding: 0.5rem 0.75rem; border-radius: 4px;">
          <span style="font-size: 0.85rem;">📄 ${m.title}</span>
          <a href="/api/materials/${m.id}/download" class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" download>
            Baixar
          </a>
        </div>
      `
      )
      .join("");
  } catch {
    container.innerHTML = `<span style="font-size: 0.85rem; color: var(--danger);">Falha ao carregar materiais.</span>`;
  }
}

function updateCertificateButton() {
  const certBtn = document.getElementById("btn-issue-certificate");
  const percent = state.currentEnrollment?.progress_percent ?? 0;

  if (percent >= 100) {
    certBtn.style.display = "inline-flex";
  } else {
    certBtn.style.display = "none";
  }
}

function setupClassroomActions() {
  // Concluir Aula (RF14)
  document.getElementById("btn-complete-lesson")?.addEventListener("click", async () => {
    if (!state.activeLesson) return;
    try {
      const res = await api.lessons.complete(state.activeLesson.id);
      state.currentEnrollment = res.enrollment;
      state.activeLesson.is_completed = 1;

      showToast(`Aula concluída! Progresso: ${res.enrollment.progress_percent}%`, "success");
      renderClassroomCurriculum();
      updateCertificateButton();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Resetar Curso (RF15)
  document.getElementById("btn-reset-course")?.addEventListener("click", async () => {
    if (!state.currentCourse) return;
    if (!confirm("Deseja realmente resetar todo o seu progresso neste curso?")) return;

    try {
      const res = await api.courses.resetProgress(state.currentCourse.id);
      state.currentEnrollment = res.enrollment;
      state.currentLessons.forEach((l) => (l.is_completed = 0));

      showToast("Progresso resetado para 0%", "info");
      renderClassroomCurriculum();
      updateCertificateButton();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Emitir Certificado (RF16, RF17)
  document.getElementById("btn-issue-certificate")?.addEventListener("click", async () => {
    if (!state.currentCourse) return;
    try {
      showToast("Gerando certificado em PDF via subprocesso...", "info");
      const res = await api.certificates.issue(state.currentCourse.id);
      showToast("Certificado emitido com sucesso!", "success");

      // Abre o PDF em nova aba
      window.open(`/api/certificates/${res.certificate.code}/download`, "_blank");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Formulário de Validação Pública de Certificado (RF18)
  document.getElementById("form-verify-cert")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = document.getElementById("input-cert-code").value.trim().toUpperCase();
    const resultBox = document.getElementById("cert-verification-result");

    try {
      const res = await api.certificates.verify(code);
      const cert = res.certificate;

      resultBox.style.display = "block";
      resultBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--success); margin-bottom: 1rem;">
          <span style="font-size: 1.5rem;">✔</span>
          <strong>Certificado Válido e Autêntico</strong>
        </div>
        <p><strong>Aluno:</strong> ${cert.studentName}</p>
        <p><strong>Curso:</strong> ${cert.courseTitle}</p>
        <p><strong>Carga Horária:</strong> ${cert.workloadHours} horas</p>
        <p><strong>Data de Emissão:</strong> ${cert.issuedAt}</p>
        <p><strong>Código:</strong> <code>${cert.code}</code></p>
        <a href="${cert.downloadUrl}" target="_blank" class="btn btn-primary" style="margin-top: 1rem;">
          📥 Baixar Certificado Oficial (PDF)
        </a>
      `;
    } catch (err) {
      resultBox.style.display = "block";
      resultBox.innerHTML = `
        <div style="color: var(--danger);">
          ❌ <strong>Certificado Inválido:</strong> ${err.message}
        </div>
      `;
    }
  });
}

// ==============================================================================
// 5. Formulários de Modais (Login, Cadastro, Criação de Curso)
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
      showToast(`Bem-vindo(a), ${data.user.name}!`, "success");
      closeModal("modal-login");
      renderNavActions();
      await loadCourses();
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
      showToast("Cadastro realizado com sucesso! Faça login.", "success");
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
      showToast("Curso criado com sucesso!", "success");
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
