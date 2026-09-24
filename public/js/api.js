export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request(endpoint, options = {}) {
  const config = {
    ...options,
    headers: { ...options.headers },
  };

  if (config.body && typeof config.body === "object" && !(config.body instanceof FormData) && !(config.body instanceof Blob)) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(endpoint, config);

    if (response.status === 204) return null;

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(data.error || `Erro HTTP ${response.status}`, response.status, data.details);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.message || "Falha na comunicação com o servidor", 0);
  }
}

export const api = {
  auth: {
    register: (data) => request("/api/auth/register", { method: "POST", body: data }),
    login: (data) => request("/api/auth/login", { method: "POST", body: data }),
    logout: () => request("/api/auth/logout", { method: "POST" }),
    me: () => request("/api/auth/me"),
    resetRequest: (email) => request("/api/auth/password/reset-request", { method: "POST", body: { email } }),
    resetConfirm: (token, newPassword) => request("/api/auth/password/reset-confirm", { method: "POST", body: { token, newPassword } }),
  },

  courses: {
    list: () => request("/api/courses"),
    get: (slug) => request(`/api/courses/${slug}`),
    create: (data) => request("/api/courses", { method: "POST", body: data }),
    update: (id, data) => request(`/api/courses/${id}`, { method: "PUT", body: data }),
    delete: (id) => request(`/api/courses/${id}`, { method: "DELETE" }),
    enroll: (courseId) => request(`/api/courses/${courseId}/enroll`, { method: "POST" }),
    resetProgress: (courseId) => request(`/api/courses/${courseId}/reset`, { method: "POST" }),
  },

  lessons: {
    create: (courseId, data) => request(`/api/courses/${courseId}/lessons`, { method: "POST", body: data }),
    update: (id, data) => request(`/api/lessons/${id}`, { method: "PUT", body: data }),
    delete: (id) => request(`/api/lessons/${id}`, { method: "DELETE" }),
    complete: (id) => request(`/api/lessons/${id}/complete`, { method: "POST" }),
    listMaterials: (id) => request(`/api/lessons/${id}/materials`),
  },

  certificates: {
    issue: (courseId) => request(`/api/courses/${courseId}/certificate`, { method: "POST" }),
    verify: (code) => request(`/api/certificates/${code}`),
  },
};
