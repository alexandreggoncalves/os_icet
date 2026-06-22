const {
  useEffect,
  useMemo,
  useState
} = React;
const pages = [{
  id: "inicio",
  label: "Início",
  public: true
}, {
  id: "solicitacao",
  label: "Solicitação",
  public: true
}, {
  id: "login",
  label: "Login",
  public: true
}, {
  id: "primeiro-acesso",
  label: "Primeiro acesso",
  hidden: true
}, {
  id: "painel",
  label: "Painel TI"
}, {
  id: "consultas",
  label: "Consultar"
}, {
  id: "pendencias",
  label: "Pendências",
  adminOnly: true
}, {
  id: "relatorios",
  label: "Simples",
  adminOnly: true,
  reports: true
}, {
  id: "relatorios-anual",
  label: "Anual",
  adminOnly: true,
  reports: true
}, {
  id: "relatorios-geral",
  label: "Geral",
  adminOnly: true,
  reports: true
}, {
  id: "gerenciamento-grupos",
  label: "Grupos",
  adminOnly: true,
  management: true
}, {
  id: "gerenciamento-usuarios",
  label: "Usuários",
  adminOnly: true,
  management: true
}, {
  id: "gerenciamento-demandas",
  label: "Demandas",
  adminOnly: true,
  management: true
}, {
  id: "gerenciamento-locais",
  label: "Locais",
  adminOnly: true,
  management: true
}, {
  id: "gerenciamento-blocos",
  label: "Blocos",
  adminOnly: true,
  management: true
}];
const emptyRequest = {
  nome: "",
  siape: "",
  email: "",
  perfil: "Docente",
  local: "",
  bloco: "",
  sala: "",
  categoria: "Manutenção de Hardware",
  descricao: ""
};
function App() {
  const [page, setPage] = useState("inicio");
  const [loginInitialMode, setLoginInitialMode] = useState("login");
  const [token, setToken] = useState(localStorage.getItem("os_token") || "");
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [demands, setDemands] = useState([]);
  const [locations, setLocations] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const currentPage = useMemo(() => pages.find(item => item.id === page), [page]);
  const authed = Boolean(token);
  const pendingUsers = users.filter(item => item.approval_status === "pending");
  function navigate(nextPage) {
    if (nextPage === "login") setLoginInitialMode("login");
    setPage(nextPage);
  }
  function openFirstAccess() {
    setLoginInitialMode("register");
    setPage("login");
  }
  useEffect(() => {
    loadBootstrapData();
  }, [token]);
  async function api(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(isFormData ? {} : {
          "Content-Type": "application/json"
        }),
        ...(token ? {
          Authorization: `Bearer ${token}`
        } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.detail || "Erro ao comunicar com o servidor local.");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function notify(message, type = "success") {
    setToast({
      message,
      type
    });
  }
  async function loadBootstrapData() {
    try {
      const publicData = await api("/api/public/bootstrap");
      setDemands(publicData.demands || []);
      setLocations(publicData.locations || []);
      setBlocks(publicData.blocks || []);
      if (token) {
        const data = await api("/api/admin/bootstrap");
        const requestDemands = data.demands || publicData.demands || [];
        setUser(data.user);
        setRequests((data.requests || []).map(item => attachEstimatedDeadline(item, requestDemands)));
        setGroups(data.groups || []);
        setUsers(data.users || []);
        setDemands(data.demands || []);
        setLocations(data.locations || []);
        setBlocks(data.blocks || []);
        setPermissions(data.permissions || {});
        if (data.user?.first_login_required) {
          setPage("primeiro-acesso");
        }
      }
    } catch (error) {
      if (error.status === 401) {
        localStorage.removeItem("os_token");
        setToken("");
        setUser(null);
        setPermissions({});
        setPage("login");
      }
      notify(error.message, error.status === 401 ? "warning" : "danger");
    }
  }
  async function login(credentials) {
    setLoading(true);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      });
      localStorage.setItem("os_token", data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      if (data.first_login_required) {
        setPage("primeiro-acesso");
        notify("Primeiro acesso: cadastre uma senha definitiva.", "warning");
      } else {
        setPage("painel");
        notify("Login realizado com sucesso.", "success");
      }
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setLoading(false);
    }
  }
  async function requestPasswordReset(login) {
    setLoading(true);
    try {
      const data = await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          login
        })
      });
      notify(`${data.mensagem} ${data.ambiente_local || ""}`, "warning");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    } finally {
      setLoading(false);
    }
  }
  async function resetPassword(payload) {
    setLoading(true);
    try {
      const data = await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      notify(data.mensagem, "success");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    } finally {
      setLoading(false);
    }
  }
  function logout() {
    localStorage.removeItem("os_token");
    setToken("");
    setUser(null);
    setPermissions({});
    setPage("inicio");
    notify("Sessão encerrada.", "warning");
  }
  async function createRequest(payload) {
    setLoading(true);
    try {
      const data = await api("/api/requests", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setRequests(current => [attachEstimatedDeadline(data.request, demands), ...current]);
      setSelectedRequest(data.request);
      setPage("consultas");
      setTimeout(scrollToRequestDetail, 100);
      notify(`Solicitação ${data.request.protocolo} cadastrada com sucesso.`, "success");
      return true;
    } catch (error) {
      notify(error.message, error.status === 401 ? "warning" : "danger");
      return false;
    } finally {
      setLoading(false);
    }
  }
  async function updateRequestStatus(id, payload) {
    const currentRequest = requests.find(item => item.id === id);
    if (payload.status === "Resolvido" && !isRequestResolved(currentRequest?.status || "")) {
      const confirmed = window.confirm("Ao marcar esta solicitação como Resolvido, ela ficará somente para leitura e não poderá mais receber interações, edições ou alterações. Deseja continuar?");
      if (!confirmed) return false;
    }
    try {
      const data = await api(`/api/requests/${id}/status`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setRequests(current => current.map(item => item.id === id ? attachEstimatedDeadline(data.request, demands) : item));
      setSelectedRequest(current => current?.id === id ? {
        ...current,
        ...data.request
      } : current);
      notify("Status atualizado.", "success");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }
  async function createEntity(path, payload, setter, message) {
    try {
      const data = await api(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setter(current => [data.item, ...current]);
      notify(data.mensagem || message, "success");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }
  async function registerUser(payload) {
    setLoading(true);
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      notify(data.mensagem, "success");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    } finally {
      setLoading(false);
    }
  }
  async function completeFirstAccess(payload) {
    setLoading(true);
    try {
      const data = await api("/api/auth/complete-first-access", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      notify(data.mensagem, "success");
      localStorage.removeItem("os_token");
      setToken("");
      setUser(null);
      setPermissions({});
      setPage("login");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    } finally {
      setLoading(false);
    }
  }
  async function updateUser(userId, payload) {
    try {
      const data = await api(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setUsers(current => current.map(item => item.id === userId ? data.item : item));
      notify("Usuário atualizado.", payload.active === false ? "warning" : "success");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }
  async function approveUser(userId, payload) {
    try {
      const data = await api(`/api/users/${userId}/approve`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setUsers(current => current.map(item => item.id === userId ? data.item : item));
      notify(data.mensagem || "Usuário aprovado.", "success");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }
  async function rejectUser(userId) {
    try {
      const data = await api(`/api/users/${userId}/reject`, {
        method: "POST"
      });
      setUsers(current => current.filter(item => item.id !== userId));
      notify(data.mensagem || "Cadastro removido.", "warning");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }
  async function updateEntity(path, itemId, payload, setter, message) {
    try {
      const data = await api(`${path}/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setter(current => current.map(item => item.id === itemId ? data.item : item));
      notify(message, payload.active === false ? "warning" : "success");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }
  async function openRequest(id) {
    try {
      const data = await api(`/api/requests/${id}`);
      setSelectedRequest(data.request);
      setTimeout(scrollToRequestDetail, 100);
    } catch (error) {
      notify(error.message, "danger");
    }
  }
  async function sendInteraction(id, mensagem, attachments = []) {
    try {
      const formData = new FormData();
      formData.append("mensagem", mensagem);
      attachments.forEach(file => formData.append("attachments", file));
      const data = await api(`/api/requests/${id}/interactions`, {
        method: "POST",
        body: formData
      });
      setSelectedRequest(data.request);
      setRequests(current => current.map(item => item.id === id ? {
        ...item,
        updated_at: data.request.updated_at
      } : item));
      notify("Interação registrada.", "success");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }
  async function editInteraction(interactionId, mensagem) {
    try {
      const data = await api(`/api/interactions/${interactionId}`, {
        method: "PUT",
        body: JSON.stringify({
          mensagem
        })
      });
      setSelectedRequest(data.request);
      setRequests(current => current.map(item => item.id === data.request.id ? {
        ...item,
        updated_at: data.request.updated_at
      } : item));
      notify("Interação editada.", "success");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }
  async function deleteAttachment(attachmentId) {
    try {
      const data = await api(`/api/attachments/${attachmentId}`, {
        method: "DELETE"
      });
      setSelectedRequest(data.request);
      notify("Anexo excluído.", "warning");
    } catch (error) {
      notify(error.message, "danger");
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "app-shell"
  }, /*#__PURE__*/React.createElement(Header, {
    page: page,
    setPage: navigate,
    authed: authed,
    user: user,
    logout: logout,
    pendingCount: pendingUsers.length
  }), /*#__PURE__*/React.createElement("main", {
    className: "container py-4 py-lg-5"
  }, /*#__PURE__*/React.createElement(MobileNav, {
    page: page,
    setPage: navigate,
    authed: authed,
    permissions: permissions
  }), toast && /*#__PURE__*/React.createElement(Toast, {
    toast: toast,
    onClose: () => setToast(null)
  }), /*#__PURE__*/React.createElement(PageTitle, {
    currentPage: currentPage,
    authed: authed
  }), page === "inicio" && /*#__PURE__*/React.createElement(Home, {
    setPage: navigate,
    authed: authed,
    openFirstAccess: openFirstAccess
  }), page === "solicitacao" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(RequestForm, {
    createRequest: createRequest,
    demands: demands,
    locations: locations,
    blocks: blocks,
    loading: loading,
    user: user
  })), page === "login" && /*#__PURE__*/React.createElement(Login, {
    onLogin: login,
    loading: loading,
    requestPasswordReset: requestPasswordReset,
    resetPassword: resetPassword,
    registerUser: registerUser,
    initialMode: loginInitialMode
  }), page === "primeiro-acesso" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(FirstAccess, {
    user: user,
    loading: loading,
    completeFirstAccess: completeFirstAccess
  })), page === "painel" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(Dashboard, {
    setPage: setPage,
    requests: requests,
    users: users,
    groups: groups,
    permissions: permissions,
    user: user
  })), page === "consultas" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(ConsultRequests, {
    requests: requests,
    updateRequestStatus: updateRequestStatus,
    permissions: permissions,
    openRequest: openRequest
  }), /*#__PURE__*/React.createElement(RequestDetail, {
    request: selectedRequest,
    permissions: permissions,
    user: user,
    updateRequestStatus: updateRequestStatus,
    sendInteraction: sendInteraction,
    editInteraction: editInteraction,
    deleteAttachment: deleteAttachment,
    onClose: () => setSelectedRequest(null)
  })), ["relatorios", "relatorios-anual", "relatorios-geral"].includes(page) && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    allowed: permissions.can_reports,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(Reports, {
    requests: requests,
    type: page === "relatorios-anual" ? "annual" : page === "relatorios-geral" ? "general" : "simple"
  })), page === "pendencias" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    allowed: permissions.can_manage,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(PendingApprovals, {
    users: pendingUsers,
    groups: groups,
    approveUser: approveUser,
    rejectUser: rejectUser
  })), page === "gerenciamento-grupos" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    allowed: permissions.can_manage,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(GroupManager, {
    groups: groups,
    createGroup: payload => createEntity("/api/groups", payload, setGroups, "Grupo cadastrado."),
    updateGroup: (id, payload) => updateEntity("/api/groups", id, payload, setGroups, "Grupo atualizado.")
  })), page === "gerenciamento-usuarios" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    allowed: permissions.can_manage,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(UserManager, {
    users: users,
    groups: groups,
    createUser: payload => createEntity("/api/users", payload, setUsers, "Usuário cadastrado."),
    updateUser: updateUser
  })), page === "gerenciamento-demandas" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    allowed: permissions.can_manage,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(DemandManager, {
    demands: demands,
    createDemand: payload => createEntity("/api/demands", payload, setDemands, "Demanda cadastrada."),
    updateDemand: (id, payload) => updateEntity("/api/demands", id, payload, setDemands, "Demanda atualizada.")
  })), page === "gerenciamento-locais" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    allowed: permissions.can_manage,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(LocationManager, {
    locations: locations,
    createLocation: payload => createEntity("/api/locations", payload, setLocations, "Local cadastrado."),
    updateLocation: (id, payload) => updateEntity("/api/locations", id, payload, setLocations, "Local atualizado.")
  })), page === "gerenciamento-blocos" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    allowed: permissions.can_manage,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(BlockManager, {
    blocks: blocks,
    locations: locations,
    createBlock: payload => createEntity("/api/blocks", payload, setBlocks, "Bloco cadastrado."),
    updateBlock: (id, payload) => updateEntity("/api/blocks", id, payload, setBlocks, "Bloco atualizado.")
  })), page === "gerenciamento" && /*#__PURE__*/React.createElement(Protected, {
    authed: authed,
    allowed: permissions.can_manage,
    setPage: setPage
  }, /*#__PURE__*/React.createElement(Management, {
    groups: groups,
    users: users,
    demands: demands,
    createGroup: payload => createEntity("/api/groups", payload, setGroups, "Grupo cadastrado."),
    updateGroup: (id, payload) => updateEntity("/api/groups", id, payload, setGroups, "Grupo atualizado."),
    createUser: payload => createEntity("/api/users", payload, setUsers, "Usuário cadastrado."),
    updateUser: updateUser,
    createDemand: payload => createEntity("/api/demands", payload, setDemands, "Demanda cadastrada."),
    updateDemand: (id, payload) => updateEntity("/api/demands", id, payload, setDemands, "Demanda atualizada.")
  }))));
}
function Header({
  page,
  setPage,
  authed,
  user,
  logout,
  pendingCount = 0
}) {
  const isAdmin = user?.role === "admin" || user?.grupo_nome === "Administradores";
  const visiblePages = pages.filter(item => !item.hidden && !item.management && !item.reports && (!authed || item.id !== "login") && (item.public || authed && (!item.adminOnly || isAdmin)));
  const reportPages = pages.filter(item => item.reports && authed && isAdmin);
  const managementPages = pages.filter(item => item.management && authed && isAdmin);
  const reportsActive = reportPages.some(item => item.id === page);
  const managementActive = managementPages.some(item => item.id === page);
  return /*#__PURE__*/React.createElement("nav", {
    className: "navbar sticky-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container py-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn p-0 d-flex align-items-center gap-3 text-start",
    onClick: () => setPage("inicio")
  }, /*#__PURE__*/React.createElement("img", {
    className: "brand-logo",
    src: "assets/logo_icet.png",
    alt: "Logo ICET"
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "d-block fw-bold text-icet-900"
  }, "Ordem de Serviço"), /*#__PURE__*/React.createElement("small", {
    className: "text-muted"
  }, "ICET / UFAM"))), /*#__PURE__*/React.createElement("ul", {
    className: "nav nav-pills desktop-nav gap-1"
  }, visiblePages.map(item => /*#__PURE__*/React.createElement("li", {
    className: "nav-item",
    key: item.id
  }, /*#__PURE__*/React.createElement("button", {
    className: `nav-link ${page === item.id ? "active" : ""}`,
    onClick: () => setPage(item.id)
  }, item.label))), reportPages.length > 0 && /*#__PURE__*/React.createElement("li", {
    className: "nav-item dropdown"
  }, /*#__PURE__*/React.createElement("button", {
    className: `nav-link dropdown-toggle ${reportsActive ? "active" : ""}`,
    type: "button",
    "data-bs-toggle": "dropdown",
    "aria-expanded": "false"
  }, "Relatórios"), /*#__PURE__*/React.createElement("ul", {
    className: "dropdown-menu dropdown-menu-end management-dropdown"
  }, reportPages.map(item => /*#__PURE__*/React.createElement("li", {
    key: item.id
  }, /*#__PURE__*/React.createElement("button", {
    className: `dropdown-item ${page === item.id ? "active" : ""}`,
    type: "button",
    onClick: () => setPage(item.id)
  }, item.label))))), managementPages.length > 0 && /*#__PURE__*/React.createElement("li", {
    className: "nav-item dropdown"
  }, /*#__PURE__*/React.createElement("button", {
    className: `nav-link dropdown-toggle ${managementActive ? "active" : ""}`,
    type: "button",
    "data-bs-toggle": "dropdown",
    "aria-expanded": "false"
  }, "Gerenciamento"), /*#__PURE__*/React.createElement("ul", {
    className: "dropdown-menu dropdown-menu-end management-dropdown"
  }, managementPages.map(item => /*#__PURE__*/React.createElement("li", {
    key: item.id
  }, /*#__PURE__*/React.createElement("button", {
    className: `dropdown-item ${page === item.id ? "active" : ""}`,
    type: "button",
    onClick: () => setPage(item.id)
  }, item.label)))))), authed && /*#__PURE__*/React.createElement("div", {
    className: "desktop-session text-end"
  }, /*#__PURE__*/React.createElement("small", {
    className: "d-block text-muted"
  }, "Logado como"), isAdmin && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm btn-outline-warning position-relative me-2 bell-alert-button",
    type: "button",
    onClick: () => setPage("pendencias"),
    title: "Cadastros pendentes",
    "aria-label": `Cadastros pendentes: ${pendingCount}`
  }, /*#__PURE__*/React.createElement(BellIcon, null), pendingCount > 0 && /*#__PURE__*/React.createElement("span", {
    className: "position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger"
  }, pendingCount)), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm btn-outline-icet",
    onClick: logout
  }, user?.nome || "admin", " · ", user?.grupo_nome || "grupo", " · sair"))));
}
function BellIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    className: "bell-alert-icon",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
    focusable: "false"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13.73 21a2 2 0 0 1-3.46 0"
  }));
}
function MobileNav({
  page,
  setPage,
  authed,
  permissions
}) {
  const visiblePages = pages.filter(item => !item.hidden && (!authed || item.id !== "login") && (item.public || authed && (!item.adminOnly || permissions.admin)));
  return /*#__PURE__*/React.createElement("div", {
    className: "mobile-page-select mb-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "form-label fw-semibold",
    htmlFor: "pageSelect"
  }, "Tela do sistema"), /*#__PURE__*/React.createElement("select", {
    className: "form-select",
    id: "pageSelect",
    value: page,
    onChange: event => setPage(event.target.value)
  }, visiblePages.map(item => /*#__PURE__*/React.createElement("option", {
    key: item.id,
    value: item.id
  }, item.label))));
}
function PageTitle({
  currentPage,
  authed
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mb-4"
  }, !authed && /*#__PURE__*/React.createElement("span", {
    className: "badge rounded-pill badge-soft mb-2"
  }, "Acesso público"), /*#__PURE__*/React.createElement("h1", {
    className: "h3 fw-bold text-icet-900 m-0"
  }, currentPage?.label));
}
function Toast({
  toast,
  onClose
}) {
  const message = typeof toast === "string" ? toast : toast.message;
  const type = typeof toast === "string" ? "success" : toast.type;
  const title = {
    success: "Sucesso",
    warning: "Atenção",
    danger: "Erro"
  }[type] || "Mensagem";
  return /*#__PURE__*/React.createElement("div", {
    className: `alert alert-${type} app-alert d-flex justify-content-between align-items-center`
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, title, ":"), " ", message), /*#__PURE__*/React.createElement("button", {
    className: `btn btn-sm btn-outline-${type}`,
    onClick: onClose
  }, "OK"));
}
function Protected({
  authed,
  allowed = true,
  setPage,
  children
}) {
  if (authed && allowed) return children;
  if (authed && !allowed) {
    return /*#__PURE__*/React.createElement("section", {
      className: "surface p-4 text-center"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "h4 fw-bold"
    }, "Acesso limitado pelo grupo"), /*#__PURE__*/React.createElement("p", {
      className: "text-muted"
    }, "Seu grupo pode criar e consultar solicitações, mas não acessa esta rotina administrativa."), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-icet",
      onClick: () => setPage("consultas")
    }, "Consultar minhas solicitações"));
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-4 text-center"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h4 fw-bold"
  }, "Acesso restrito"), /*#__PURE__*/React.createElement("p", {
    className: "text-muted"
  }, "Entre com o usuário administrativo para acessar esta área."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet",
    onClick: () => setPage("login")
  }, "Ir para login"));
}
function Home({
  setPage,
  authed,
  openFirstAccess
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    className: "hero p-4 p-lg-5 mb-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row align-items-center g-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-lg-7"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-uppercase fw-bold opacity-75 mb-2"
  }, "Sistema de atendimento de TI"), /*#__PURE__*/React.createElement("h2", {
    className: "display-6 fw-bold mb-3"
  }, "Solicitações, triagem e gestão local para o ICET."), /*#__PURE__*/React.createElement("p", {
    className: "lead mb-4"
  }, "Esta versão já usa um backend Python com banco SQLite local para cadastrar chamados, usuários, grupos e tipos de demanda."), /*#__PURE__*/React.createElement("div", {
    className: "d-flex flex-column flex-sm-row gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-light fw-bold",
    onClick: () => setPage("solicitacao")
  }, "Abrir solicitação"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-light fw-bold",
    onClick: () => setPage(authed ? "painel" : "login")
  }, authed ? "Abrir painel" : "Acesso restrito"), !authed && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-light fw-bold",
    onClick: openFirstAccess
  }, "1º acesso"))), /*#__PURE__*/React.createElement("div", {
    className: "col-lg-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "surface text-dark p-4"
  }, /*#__PURE__*/React.createElement("img", {
    className: "hero-logo mb-3",
    src: "assets/logo_icet.png",
    alt: "Logo ICET"
  }), /*#__PURE__*/React.createElement("h3", {
    className: "h5 fw-bold mb-3"
  }, "Credencial provisória"), /*#__PURE__*/React.createElement("p", {
    className: "mb-1"
  }, /*#__PURE__*/React.createElement("strong", null, "Usuário:"), " admin"), /*#__PURE__*/React.createElement("p", {
    className: "mb-3"
  }, /*#__PURE__*/React.createElement("strong", null, "Senha:"), " admin1234"), /*#__PURE__*/React.createElement("small", {
    className: "text-muted"
  }, "Use apenas para testes locais. Troque antes de qualquer uso real."))))), /*#__PURE__*/React.createElement("div", {
    className: "row g-3"
  }, /*#__PURE__*/React.createElement(Feature, {
    text: "Chamados públicos persistidos no banco local."
  }), /*#__PURE__*/React.createElement(Feature, {
    text: "Painel restrito com atualização de status."
  }), /*#__PURE__*/React.createElement(Feature, {
    text: "Gerenciamento de grupos, usuários e tipos de demanda."
  })));
}
function Feature({
  text
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "col-md-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "feature-card h-100 p-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge badge-soft rounded-pill mb-2"
  }, "Funcionalidade"), /*#__PURE__*/React.createElement("p", {
    className: "mb-0"
  }, text)));
}
function RequestForm({
  createRequest,
  demands,
  locations,
  blocks,
  loading,
  user
}) {
  const [form, setForm] = useState(emptyRequest);
  const activeLocations = locations.filter(item => item.active !== false);
  const activeBlocks = blocks.filter(item => item.active !== false);
  const selectedLocation = activeLocations.find(item => item.nome === form.local) || null;
  const filteredBlocks = selectedLocation ? activeBlocks.filter(item => Number(item.local_id || item.location_id) === Number(selectedLocation.id)) : [];
  function defaultRequestValues() {
    const firstLocation = activeLocations[0] || null;
    const firstBlock = firstLocation ? activeBlocks.find(item => Number(item.local_id || item.location_id) === Number(firstLocation.id)) : null;
    return {
      ...emptyRequest,
      local: firstLocation?.nome || "",
      bloco: firstBlock?.nome || ""
    };
  }
  const registeredSiape = user?.siape || "";
  const hasRegisteredSiape = Boolean(registeredSiape);
  useEffect(() => {
    if (!form.local && activeLocations[0]) {
      setForm(current => ({
        ...current,
        local: activeLocations[0].nome
      }));
    }
  }, [locations]);
  useEffect(() => {
    if (form.local && !form.bloco && filteredBlocks[0]) {
      setForm(current => ({
        ...current,
        bloco: filteredBlocks[0].nome
      }));
    }
  }, [form.local, blocks]);
  const requestPayload = {
    ...form,
    nome: user.nome,
    siape: registeredSiape,
    email: user.email,
    perfil: user.grupo_nome
  };
  function update(field, value) {
    setForm(current => ({
      ...current,
      [field]: value,
      ...(field === "local" ? {
        bloco: ""
      } : {})
    }));
  }
  async function submit(event) {
    event.preventDefault();
    const ok = await createRequest(requestPayload);
    if (ok) setForm(defaultRequestValues());
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-3 p-lg-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row g-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-lg-5"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h4 fw-bold"
  }, "Cadastrar solicitação de serviço"), /*#__PURE__*/React.createElement("p", {
    className: "text-muted"
  }, "O chamado é gravado no PostgreSQL e vinculado à conta conectada."), /*#__PURE__*/React.createElement("div", {
    className: "alert alert-success"
  }, "Todos os campos são obrigatórios."), !hasRegisteredSiape && /*#__PURE__*/React.createElement("div", {
    className: "alert alert-warning"
  }, "Sua conta não possui SIAPE cadastrado. Solicite a regularização do cadastro antes de abrir um chamado.")), /*#__PURE__*/React.createElement("div", {
    className: "col-lg-7"
  }, /*#__PURE__*/React.createElement("form", {
    className: "row g-3",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Nome do solicitante",
    value: user.nome,
    onChange: () => {},
    disabled: true
  }), /*#__PURE__*/React.createElement(Input, {
    label: "SIAPE",
    value: registeredSiape,
    onChange: () => {},
    col: "col-sm-6",
    disabled: true,
    inputMode: "numeric",
    maxLength: 7,
    pattern: "[0-9]{7}"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "E-mail institucional",
    type: "email",
    value: user.email,
    onChange: () => {},
    col: "col-sm-6",
    disabled: true
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Perfil",
    value: user.grupo_nome || "",
    onChange: () => {},
    col: "col-sm-6",
    disabled: true
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Tipo de demanda",
    value: form.categoria,
    onChange: v => update("categoria", v),
    options: demands.filter(item => item.active !== false).map(item => item.nome),
    col: "col-sm-6"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Local",
    value: form.local,
    onChange: v => update("local", v),
    options: activeLocations.map(item => item.nome),
    col: "col-sm-6"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Bloco",
    value: form.bloco,
    onChange: v => update("bloco", v),
    options: filteredBlocks.map(item => item.nome),
    col: "col-sm-6"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Sala",
    value: form.sala,
    onChange: v => update("sala", v.replace(/\D/g, "").slice(0, 3)),
    col: "col-sm-6",
    inputMode: "numeric",
    maxLength: 3,
    pattern: "[0-9]{1,3}"
  }), /*#__PURE__*/React.createElement(TextArea, {
    label: "Descrição sucinta da ocorrência",
    value: form.descricao,
    onChange: v => update("descricao", v)
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-12 d-flex justify-content-end"
  }, /*#__PURE__*/React.createElement("button", {
    disabled: loading || !hasRegisteredSiape,
    className: "btn btn-icet px-4"
  }, loading ? "Enviando..." : "Enviar solicitação"))))));
}
function Login({
  onLogin,
  loading,
  requestPasswordReset,
  resetPassword,
  registerUser,
  initialMode = "login"
}) {
  const [mode, setMode] = useState("login");
  const [login, setLogin] = useState("admin");
  const [password, setPassword] = useState("admin1234");
  const [forgotLogin, setForgotLogin] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    nome: "",
    login: "",
    siape: "",
    cargo: "Docente"
  });
  const [registerSuccess, setRegisterSuccess] = useState(false);
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  async function submitResetRequest() {
    const normalizedLogin = forgotLogin.trim().toLowerCase();
    const ok = await requestPasswordReset(normalizedLogin);
    if (ok) {
      setEmail(`${normalizedLogin}@ufam.edu.br`);
      setMode("reset");
    }
  }
  async function submitNewPassword() {
    if (newPassword !== confirmPassword) {
      return;
    }
    const ok = await resetPassword({
      email,
      code,
      new_password: newPassword,
      confirm_password: confirmPassword
    });
    if (ok) {
      setResetSuccess(true);
      setTimeout(() => {
        setMode("login");
        setPassword("");
        setCode("");
        setNewPassword("");
        setConfirmPassword("");
        setResetSuccess(false);
      }, 3000);
    }
  }
  async function submitRegister(event) {
    event.preventDefault();
    const ok = await registerUser(registerForm);
    if (ok) {
      setRegisterSuccess(true);
      setRegisterForm({
        nome: "",
        login: "",
        siape: "",
        cargo: "Docente"
      });
    }
  }
  function updateRegister(field, value) {
    setRegisterForm(current => ({
      ...current,
      [field]: value
    }));
  }
  if (mode === "register") {
    const validLogin = /^[a-z0-9._-]+$/i.test(registerForm.login.trim());
    const validSiape = /^\d{7}$/.test(registerForm.siape);
    const canSubmit = registerForm.nome && validLogin && validSiape && registerForm.cargo;
    return /*#__PURE__*/React.createElement(AuthLayout, {
      title: "1º acesso",
      description: "Informe seus dados institucionais. O acesso será liberado após validação administrativa em até 24h."
    }, /*#__PURE__*/React.createElement("form", {
      className: "row g-3",
      onSubmit: submitRegister
    }, /*#__PURE__*/React.createElement(Input, {
      label: "Nome completo",
      value: registerForm.nome,
      onChange: v => updateRegister("nome", v)
    }), /*#__PURE__*/React.createElement(EmailPrefixInput, {
      label: "Login",
      value: registerForm.login,
      onChange: v => updateRegister("login", v)
    }), /*#__PURE__*/React.createElement(Input, {
      label: "Número SIAPE",
      value: registerForm.siape,
      onChange: v => updateRegister("siape", v.replace(/\D/g, "").slice(0, 7)),
      col: "col-sm-6",
      inputMode: "numeric",
      maxLength: 7,
      pattern: "[0-9]{7}"
    }), /*#__PURE__*/React.createElement(Select, {
      label: "Cargo",
      value: registerForm.cargo,
      onChange: v => updateRegister("cargo", v),
      options: ["Docente", "Técnico Administrativo em Educação"],
      col: "col-sm-6"
    }), !validLogin && registerForm.login && /*#__PURE__*/React.createElement("div", {
      className: "col-12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "alert alert-warning mb-0 small"
    }, "Informe apenas o login, sem @ e sem domínio.")), registerSuccess && /*#__PURE__*/React.createElement("div", {
      className: "col-12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "alert alert-success mb-0"
    }, "Cadastro realizado. Aguarde até 24h para validação do administrador.")), /*#__PURE__*/React.createElement("div", {
      className: "col-12 d-grid gap-2"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-icet",
      disabled: loading || !canSubmit
    }, loading ? "Enviando..." : "Solicitar cadastro"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline-icet",
      type: "button",
      onClick: () => setMode("login")
    }, "Voltar ao login"))));
  }
  if (mode === "forgot") {
    const validForgotLogin = /^[a-z0-9._-]+$/i.test(forgotLogin.trim());
    return /*#__PURE__*/React.createElement(AuthLayout, {
      title: "Esqueci minha senha",
      description: "Informe seu login institucional. O sistema enviará um código temporário de verificação."
    }, /*#__PURE__*/React.createElement(EmailPrefixInput, {
      label: "Login",
      value: forgotLogin,
      onChange: setForgotLogin
    }), /*#__PURE__*/React.createElement("div", {
      className: "col-12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "alert alert-warning mb-0 small"
    }, "Em ambiente local, o e-mail é simulado na pasta ", /*#__PURE__*/React.createElement("strong", null, "dev_mailbox"), ". A senha antiga nunca é exibida.")), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-icet w-100",
      disabled: loading || !validForgotLogin,
      onClick: submitResetRequest
    }, loading ? "Enviando..." : "Enviar código"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline-icet w-100",
      type: "button",
      onClick: () => setMode("login")
    }, "Voltar ao login"));
  }
  if (mode === "reset") {
    const rules = passwordRules(newPassword);
    const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
    const canSubmit = rules.length && rules.every(rule => rule.ok) && passwordsMatch && code && email && !resetSuccess;
    return /*#__PURE__*/React.createElement(AuthLayout, {
      title: "Redefinir senha",
      description: "Use o código recebido no e-mail cadastrado para criar uma nova senha."
    }, /*#__PURE__*/React.createElement(Input, {
      label: "E-mail cadastrado",
      type: "email",
      value: email,
      onChange: setEmail
    }), /*#__PURE__*/React.createElement(Input, {
      label: "Código recebido",
      value: code,
      onChange: setCode
    }), /*#__PURE__*/React.createElement(PasswordInput, {
      label: "Nova senha",
      value: newPassword,
      onChange: setNewPassword
    }), /*#__PURE__*/React.createElement(PasswordInput, {
      label: "Confirmar nova senha",
      value: confirmPassword,
      onChange: setConfirmPassword
    }), /*#__PURE__*/React.createElement("div", {
      className: "col-12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "password-rules"
    }, rules.map(rule => /*#__PURE__*/React.createElement("div", {
      className: `password-rule ${rule.ok ? "rule-ok" : "rule-missing"}`,
      key: rule.label
    }, rule.ok ? "OK" : "Pendente", " - ", rule.label)), /*#__PURE__*/React.createElement("div", {
      className: `password-rule ${passwordsMatch ? "rule-ok" : "rule-missing"}`
    }, passwordsMatch ? "OK" : "Pendente", " - Confirmação igual à nova senha"))), resetSuccess && /*#__PURE__*/React.createElement("div", {
      className: "col-12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "alert alert-success mb-0"
    }, "Senha alterada com sucesso. Redirecionando para o login em alguns segundos.")), /*#__PURE__*/React.createElement("div", {
      className: "col-12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "alert alert-warning mb-0 small"
    }, "O sistema substitui o hash da senha; ele nunca recupera nem exibe a senha anterior.")), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-icet w-100",
      disabled: loading || !canSubmit,
      onClick: submitNewPassword
    }, loading ? "Salvando..." : "Alterar senha"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline-icet w-100",
      type: "button",
      onClick: () => setMode("forgot")
    }, "Enviar novo código"));
  }
  return /*#__PURE__*/React.createElement(AuthLayout, {
    title: "Acesso administrativo",
    description: "Entre para acessar consultas, relatórios e telas de gerenciamento."
  }, /*#__PURE__*/React.createElement(EmailPrefixInput, {
    label: "Usuário",
    value: login,
    onChange: setLogin
  }), /*#__PURE__*/React.createElement(PasswordInput, {
    label: "Senha",
    value: password,
    onChange: setPassword
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet w-100",
    disabled: loading,
    onClick: () => onLogin({
      login: login.trim().replace(/@.*$/, ""),
      password
    })
  }, loading ? "Entrando..." : "Entrar"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-success w-100",
    type: "button",
    onClick: () => setMode("register")
  }, "1º acesso"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet w-100",
    type: "button",
    onClick: () => setMode("forgot")
  }, "Esqueci minha senha"), /*#__PURE__*/React.createElement("div", {
    className: "col-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "alert alert-success mb-0 small"
  }, /*#__PURE__*/React.createElement("strong", null, "Contas de teste:"), /*#__PURE__*/React.createElement("br", null), "admin / admin1234: acesso total", /*#__PURE__*/React.createElement("br", null), "docente / Docente@1234: cria e consulta próprias solicitações", /*#__PURE__*/React.createElement("br", null), "tecnico / Tecnico@1234: cria e consulta próprias solicitações")));
}
function FirstAccess({
  user,
  loading,
  completeFirstAccess
}) {
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const rules = passwordRules(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canSubmit = temporaryPassword && rules.every(rule => rule.ok) && passwordsMatch;
  async function submit(event) {
    event.preventDefault();
    await completeFirstAccess({
      temporary_password: temporaryPassword,
      new_password: newPassword,
      confirm_password: confirmPassword
    });
  }
  return /*#__PURE__*/React.createElement(AuthLayout, {
    title: "Primeiro acesso",
    description: `Olá, ${user?.nome || "usuário"}. Confirme a senha provisória recebida e cadastre sua senha definitiva.`
  }, /*#__PURE__*/React.createElement("form", {
    className: "row g-3",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(PasswordInput, {
    label: "Senha provisória recebida por e-mail",
    value: temporaryPassword,
    onChange: setTemporaryPassword
  }), /*#__PURE__*/React.createElement(PasswordInput, {
    label: "Nova senha",
    value: newPassword,
    onChange: setNewPassword
  }), /*#__PURE__*/React.createElement(PasswordInput, {
    label: "Confirmar nova senha",
    value: confirmPassword,
    onChange: setConfirmPassword
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "password-rules"
  }, rules.map(rule => /*#__PURE__*/React.createElement("div", {
    className: `password-rule ${rule.ok ? "rule-ok" : "rule-missing"}`,
    key: rule.label
  }, rule.ok ? "OK" : "Pendente", " - ", rule.label)), /*#__PURE__*/React.createElement("div", {
    className: `password-rule ${passwordsMatch ? "rule-ok" : "rule-missing"}`
  }, passwordsMatch ? "OK" : "Pendente", " - Confirmação igual à nova senha"))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet w-100",
    disabled: loading || !canSubmit
  }, loading ? "Salvando..." : "Cadastrar senha definitiva")));
}
function Dashboard({
  setPage,
  requests,
  users,
  groups,
  permissions,
  user
}) {
  const abertas = requests.filter(request => request.status === "Aberto").length;
  const atendimento = requests.filter(request => request.status === "Em Atendimento").length;
  const resolvidas = requests.filter(request => request.status === "Resolvido").length;
  const stats = [[requests.length, "Solicitações"], [abertas, "Abertas"], [atendimento, "Em atendimento"], [resolvidas, "Resolvidas"], [permissions.admin ? users.length : 1, permissions.admin ? "Usuários" : "Meu usuário"], [permissions.admin ? groups.length : 1, permissions.admin ? "Grupos" : user?.grupo_nome || "Grupo"]];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "row g-3 mb-4"
  }, stats.map(([value, label]) => /*#__PURE__*/React.createElement("div", {
    className: "col-6 col-lg-2",
    key: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card p-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "h3 fw-bold text-success d-block"
  }, value), /*#__PURE__*/React.createElement("span", {
    className: "text-muted"
  }, label))))), /*#__PURE__*/React.createElement("section", {
    className: "surface p-3 p-lg-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "h4 fw-bold mb-1"
  }, "Painel da Gerência de TI"), /*#__PURE__*/React.createElement("p", {
    className: "text-muted mb-0"
  }, permissions.admin ? "Acompanhe os chamados e acesse as rotinas administrativas." : "Crie e acompanhe apenas as suas solicitações."))), /*#__PURE__*/React.createElement("div", {
    className: "row g-3"
  }, /*#__PURE__*/React.createElement(ActionCard, {
    title: "Consultar solicitações",
    text: "Filtre e atualize status dos chamados recebidos.",
    onClick: () => setPage("consultas")
  }), permissions.can_reports && /*#__PURE__*/React.createElement(ActionCard, {
    title: "Emitir relatórios",
    text: "Veja uma prévia consolidada dos chamados por período.",
    onClick: () => setPage("relatorios")
  }), permissions.can_manage && /*#__PURE__*/React.createElement(ActionCard, {
    title: "Gerenciar usuários",
    text: "Cadastre, edite, ative ou desative usuários do sistema.",
    onClick: () => setPage("gerenciamento-usuarios")
  }))));
}
function ConsultRequests({
  requests,
  updateRequestStatus,
  permissions,
  openRequest
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [requesterFilter, setRequesterFilter] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const statuses = ["Todos", ...Array.from(new Set(requests.map(item => item.status))).sort()];
  const filtered = requests.filter(item => {
    const haystack = `${item.protocolo} ${item.nome} ${item.localizacao} ${item.status}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "Todos" || item.status === statusFilter;
    const matchesRequester = item.nome.toLowerCase().includes(requesterFilter.toLowerCase());
    return matchesQuery && matchesStatus && matchesRequester;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);
  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, requesterFilter, pageSize]);
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-3 p-lg-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row g-3 align-items-end mb-4"
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Busca geral",
    value: query,
    onChange: setQuery,
    col: "col-lg-4"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Nome do solicitante",
    value: requesterFilter,
    onChange: setRequesterFilter,
    col: "col-lg-3"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Status",
    value: statusFilter,
    onChange: setStatusFilter,
    options: statuses,
    col: "col-md-3 col-lg-2"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Itens por página",
    value: String(pageSize),
    onChange: value => setPageSize(Number(value)),
    options: ["10", "20", "50", "100"],
    col: "col-md-3 col-lg-2"
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-md-6 col-lg-1"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet w-100",
    type: "button",
    onClick: () => {
      setQuery("");
      setRequesterFilter("");
      setStatusFilter("Todos");
      setPageSize(10);
    }
  }, "Limpar")), /*#__PURE__*/React.createElement("div", {
    className: "col-12 d-flex flex-column flex-md-row justify-content-between gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge badge-soft rounded-pill align-self-start"
  }, filtered.length, " registros encontrados"), /*#__PURE__*/React.createElement("small", {
    className: "text-muted"
  }, "Exibindo ", filtered.length ? start + 1 : 0, "-", Math.min(start + pageSize, filtered.length), " de ", filtered.length))), !permissions.admin && /*#__PURE__*/React.createElement("div", {
    className: "alert alert-success"
  }, "Seu grupo possui consulta limitada: somente solicitações vinculadas ao seu usuário/e-mail aparecem aqui."), /*#__PURE__*/React.createElement(RequestsTable, {
    requests: paginated,
    updateRequestStatus: updateRequestStatus,
    editable: permissions.can_update_status,
    openRequest: openRequest
  }), /*#__PURE__*/React.createElement(PaginationControls, {
    currentPage: safePage,
    totalPages: totalPages,
    setCurrentPage: setCurrentPage
  }));
}
function Reports({
  requests,
  type = "simple"
}) {
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [userFilter, setUserFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const statuses = ["Todos", ...Array.from(new Set(requests.map(item => item.status))).sort()];
  const users = Array.from(new Set(requests.map(item => item.nome).filter(Boolean))).sort();
  const years = Array.from(new Set(requests.map(item => new Date(item.created_at).getFullYear()).filter(Boolean))).sort((a, b) => b - a);
  const selectedYear = yearFilter || String(years[0] || new Date().getFullYear());
  const reportMeta = {
    simple: {
      title: "Relatório simples",
      description: "Consulta filtrada com prévia e emissão em PDF.",
      canExportCsv: false
    },
    annual: {
      title: "Relatório anual",
      description: "Consolidado do ano selecionado, com emissão em PDF e CSV.",
      canExportCsv: true
    },
    general: {
      title: "Relatório geral",
      description: "Consolidado de toda a base existente, com emissão em PDF e CSV.",
      canExportCsv: true
    }
  }[type];
  const filtered = requests.filter(item => {
    const matchesStatus = statusFilter === "Todos" || item.status === statusFilter;
    const normalizedUserFilter = userFilter.trim().toLowerCase();
    const matchesUser = !normalizedUserFilter || item.nome.toLowerCase().includes(normalizedUserFilter);
    const matchesYear = type !== "annual" || String(new Date(item.created_at).getFullYear()) === String(selectedYear);
    return matchesStatus && matchesUser && matchesYear;
  });
  const byStatus = ["Aberto", "Em Atendimento", "Resolvido"].map(status => ({
    status,
    total: filtered.filter(item => item.status === status).length
  }));
  const reportFilters = {
    statusFilter,
    userFilter,
    yearFilter: type === "annual" ? selectedYear : "",
    reportType: type,
    reportTitle: reportMeta.title
  };
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-3 p-lg-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "d-flex flex-column flex-lg-row justify-content-between gap-2 mb-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "h4 fw-bold mb-1"
  }, reportMeta.title), /*#__PURE__*/React.createElement("p", {
    className: "text-muted mb-0"
  }, reportMeta.description)), /*#__PURE__*/React.createElement("span", {
    className: "badge badge-soft rounded-pill align-self-start"
  }, filtered.length, " registros na consulta atual")), /*#__PURE__*/React.createElement("div", {
    className: "row g-3 align-items-end mb-4"
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Status",
    value: statusFilter,
    onChange: setStatusFilter,
    options: statuses,
    col: "col-md-4 col-lg-3"
  }), /*#__PURE__*/React.createElement(UserAutocomplete, {
    label: "Usuário",
    value: userFilter,
    onChange: setUserFilter,
    options: users,
    col: "col-md-4 col-lg-3"
  }), type === "annual" && /*#__PURE__*/React.createElement(Select, {
    label: "Ano",
    value: selectedYear,
    onChange: setYearFilter,
    options: years.length ? years.map(String) : [String(new Date().getFullYear())],
    col: "col-md-4 col-lg-2"
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-md-4 col-lg-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet w-100",
    type: "button",
    onClick: () => {
      setStatusFilter("Todos");
      setUserFilter("");
      setYearFilter("");
    }
  }, "Limpar")), /*#__PURE__*/React.createElement("div", {
    className: "col-md-4 col-lg-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet w-100",
    type: "button",
    onClick: () => openReportsPdfWindow(filtered, reportFilters),
    disabled: !filtered.length
  }, "Gerar PDF")), reportMeta.canExportCsv && /*#__PURE__*/React.createElement("div", {
    className: "col-md-4 col-lg-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet w-100",
    type: "button",
    onClick: () => downloadReportsCsv(filtered, reportFilters),
    disabled: !filtered.length
  }, "Gerar CSV"))), /*#__PURE__*/React.createElement("div", {
    className: "row g-3 mb-4"
  }, byStatus.map(item => /*#__PURE__*/React.createElement("div", {
    className: "col-md-4",
    key: item.status
  }, /*#__PURE__*/React.createElement("div", {
    className: `stat-card p-3 ${statusCardClass(item.status)}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "h3 fw-bold text-success d-block"
  }, item.total), /*#__PURE__*/React.createElement("span", {
    className: "text-muted"
  }, item.status))))), /*#__PURE__*/React.createElement("div", {
    className: "request-card p-3"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h5 fw-bold mb-3"
  }, "Prévia do relatório"), /*#__PURE__*/React.createElement(RequestsTable, {
    requests: filtered,
    compact: true
  }), !filtered.length && /*#__PURE__*/React.createElement("p", {
    className: "text-muted mb-0"
  }, "Nenhuma solicitação encontrada para os filtros selecionados.")));
}
function Management({
  groups,
  users,
  demands,
  createGroup,
  updateGroup,
  createUser,
  updateUser,
  createDemand,
  updateDemand
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "row g-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-xl-4"
  }, /*#__PURE__*/React.createElement(GroupManager, {
    groups: groups,
    createGroup: createGroup,
    updateGroup: updateGroup
  })), /*#__PURE__*/React.createElement("div", {
    className: "col-xl-4"
  }, /*#__PURE__*/React.createElement(UserManager, {
    users: users,
    groups: groups,
    createUser: createUser,
    updateUser: updateUser
  })), /*#__PURE__*/React.createElement("div", {
    className: "col-xl-4"
  }, /*#__PURE__*/React.createElement(DemandManager, {
    demands: demands,
    createDemand: createDemand,
    updateDemand: updateDemand
  })));
}
function PendingApprovals({
  users,
  groups,
  approveUser,
  rejectUser
}) {
  const activeGroups = groups.filter(group => group.active !== false);
  const [selectedId, setSelectedId] = useState(null);
  const selected = users.find(item => item.id === selectedId) || null;
  const [groupId, setGroupId] = useState("");
  useEffect(() => {
    if (selectedId && !users.some(item => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [users, selectedId]);
  useEffect(() => {
    if (selected) {
      const group = activeGroups.find(item => item.nome === selected.grupo_nome) || activeGroups[0];
      setGroupId(group ? String(group.id) : "");
    }
  }, [selected, groups]);
  async function approveSelected() {
    if (!selected) return;
    const confirmed = window.confirm(`Deseja aprovar o cadastro de ${selected.nome}? Uma senha provisória será enviada ao e-mail simulado.`);
    if (!confirmed) return;
    const ok = await approveUser(selected.id, {
      grupo_id: groupId
    });
    if (ok) {
      setSelectedId(null);
    }
  }
  async function rejectSelected() {
    if (!selected) return;
    const confirmed = window.confirm(`Deseja remover o cadastro de ${selected.nome}? O usuário será excluído da base e receberá um e-mail simulado informando que o cadastro não foi autorizado.`);
    if (!confirmed) return;
    const ok = await rejectUser(selected.id);
    if (ok) {
      setSelectedId(null);
    }
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "h5 fw-bold mb-1"
  }, "Cadastros pendentes"), /*#__PURE__*/React.createElement("p", {
    className: "text-muted mb-0"
  }, "Analise os dados informados pelo usuário antes de liberar o acesso.")), /*#__PURE__*/React.createElement("span", {
    className: "badge rounded-pill text-bg-warning"
  }, users.length, " pendente(s)")), users.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "alert alert-success mb-0"
  }, "Não há cadastros pendentes de validação.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "list-group pending-list"
  }, users.map(item => {
    const isSelected = selected?.id === item.id;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: item.id
    }, /*#__PURE__*/React.createElement("button", {
      className: `list-group-item list-group-item-action ${isSelected ? "active" : ""}`,
      type: "button",
      onClick: () => setSelectedId(isSelected ? null : item.id)
    }, /*#__PURE__*/React.createElement("div", {
      className: "d-flex flex-column flex-md-row justify-content-between gap-2"
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, item.nome), /*#__PURE__*/React.createElement("small", {
      className: "d-block"
    }, item.email)), /*#__PURE__*/React.createElement("span", {
      className: "text-md-end"
    }, /*#__PURE__*/React.createElement("small", {
      className: "d-block"
    }, "SIAPE: ", item.siape || "-"), /*#__PURE__*/React.createElement("small", {
      className: "d-block"
    }, "Cargo: ", item.cargo || "-")))), isSelected && /*#__PURE__*/React.createElement("div", {
      className: "list-group-item approval-detail"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "h6 fw-bold"
    }, "Dados para validação"), /*#__PURE__*/React.createElement("dl", {
      className: "row mb-3"
    }, /*#__PURE__*/React.createElement("dt", {
      className: "col-sm-4"
    }, "Nome"), /*#__PURE__*/React.createElement("dd", {
      className: "col-sm-8"
    }, item.nome), /*#__PURE__*/React.createElement("dt", {
      className: "col-sm-4"
    }, "E-mail"), /*#__PURE__*/React.createElement("dd", {
      className: "col-sm-8"
    }, item.email), /*#__PURE__*/React.createElement("dt", {
      className: "col-sm-4"
    }, "SIAPE"), /*#__PURE__*/React.createElement("dd", {
      className: "col-sm-8"
    }, item.siape || "-"), /*#__PURE__*/React.createElement("dt", {
      className: "col-sm-4"
    }, "Cargo"), /*#__PURE__*/React.createElement("dd", {
      className: "col-sm-8"
    }, item.cargo || "-"), /*#__PURE__*/React.createElement("dt", {
      className: "col-sm-4"
    }, "Login sugerido"), /*#__PURE__*/React.createElement("dd", {
      className: "col-sm-8"
    }, item.login), /*#__PURE__*/React.createElement("dt", {
      className: "col-sm-4"
    }, "Solicitado em"), /*#__PURE__*/React.createElement("dd", {
      className: "col-sm-8"
    }, formatDateTime(item.created_at))), /*#__PURE__*/React.createElement(Select, {
      label: "Grupo de acesso",
      value: String(groupId),
      onChange: setGroupId,
      options: activeGroups.map(group => ({
        value: String(group.id),
        label: group.nome
      }))
    }), /*#__PURE__*/React.createElement("div", {
      className: "alert alert-warning small mt-3"
    }, "Ao aprovar, o usuário será ativado, receberá uma senha provisória no e-mail simulado e precisará cadastrar uma senha definitiva no primeiro acesso."), /*#__PURE__*/React.createElement("div", {
      className: "d-flex flex-wrap gap-2"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-icet",
      type: "button",
      onClick: approveSelected,
      disabled: !groupId
    }, "Aprovar cadastro"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline-danger",
      type: "button",
      onClick: rejectSelected
    }, "Remover Cadastro"))));
  })), !selected && /*#__PURE__*/React.createElement("div", {
    className: "alert alert-info small mt-3 mb-0"
  }, "Clique em um cadastro pendente para visualizar os dados, escolher o grupo e aprovar o acesso.")));
}
function GroupManager({
  groups,
  createGroup,
  updateGroup
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [editingGroup, setEditingGroup] = useState(null);
  function resetForm() {
    setEditingGroup(null);
    setNome("");
    setDescricao("");
  }
  function startEdit(group) {
    if (group.nome.trim().toLowerCase() === "administradores") return;
    setEditingGroup(group);
    setNome(group.nome);
    setDescricao(group.descricao || "");
  }
  async function submit(event) {
    event.preventDefault();
    const payload = {
      nome,
      descricao
    };
    const ok = editingGroup ? await updateGroup(editingGroup.id, {
      ...payload,
      active: editingGroup.active !== false
    }) : await createGroup(payload);
    if (ok) resetForm();
  }
  async function toggleActive(group) {
    if (group.nome.trim().toLowerCase() === "administradores") return;
    const nextActive = group.active === false;
    const action = nextActive ? "reativar" : "desativar";
    if (!window.confirm(`Deseja ${action} o grupo ${group.nome}?`)) return;
    const ok = await updateGroup(group.id, {
      nome: group.nome,
      descricao: group.descricao,
      active: nextActive
    });
    if (ok && editingGroup?.id === group.id) resetForm();
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-3 h-100"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h5 fw-bold"
  }, "Grupos"), /*#__PURE__*/React.createElement("form", {
    className: "row g-3 mb-3",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Nome do grupo",
    value: nome,
    onChange: setNome
  }), /*#__PURE__*/React.createElement(TextArea, {
    label: "Descrição",
    value: descricao,
    onChange: setDescricao,
    rows: "3"
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-12 d-flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet flex-fill",
    disabled: !nome.trim()
  }, editingGroup ? "Salvar grupo" : "Cadastrar grupo"), editingGroup && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet",
    type: "button",
    onClick: resetForm
  }, "Cancelar"))), /*#__PURE__*/React.createElement(ManagementEntityTable, {
    items: groups,
    detailField: "descricao",
    detailLabel: "Descrição",
    startEdit: startEdit,
    toggleActive: toggleActive,
    protectedName: "Administradores"
  }));
}
function UserManager({
  users,
  groups,
  createUser,
  updateUser
}) {
  const activeGroups = groups.filter(group => group.active !== false);
  const [form, setForm] = useState({
    nome: "",
    login: "",
    siape: "",
    grupo_id: activeGroups[0]?.id || ""
  });
  const [editingUser, setEditingUser] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * pageSize;
  const paginatedUsers = users.slice(start, start + pageSize);
  useEffect(() => {
    if (!form.grupo_id && activeGroups[0]) setForm(current => ({
      ...current,
      grupo_id: activeGroups[0].id
    }));
  }, [groups]);
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);
  function update(field, value) {
    setForm(current => ({
      ...current,
      [field]: value
    }));
  }
  function groupIdByName(name) {
    return activeGroups.find(group => group.nome === name)?.id || activeGroups[0]?.id || "";
  }
  function resetForm() {
    setEditingUser(null);
    setForm({
      nome: "",
      login: "",
      siape: "",
      grupo_id: activeGroups[0]?.id || ""
    });
  }
  function startEdit(user) {
    if (isPrimaryAdminUser(user)) return;
    if (user.approval_status === "pending") return;
    setEditingUser(user);
    setForm({
      nome: user.nome,
      login: user.login,
      siape: user.siape || "",
      grupo_id: groupIdByName(user.grupo_nome)
    });
  }
  async function submit(event) {
    event.preventDefault();
    if (editingUser) {
      const ok = await updateUser(editingUser.id, {
        nome: form.nome,
        login: form.login,
        siape: form.siape,
        grupo_id: form.grupo_id,
        active: Boolean(editingUser.active)
      });
      if (ok) resetForm();
      return;
    }
    if (await createUser(form)) resetForm();
  }
  async function toggleActive(user) {
    if (isPrimaryAdminUser(user)) return;
    if (user.approval_status === "pending") return;
    const nextActive = !user.active;
    const confirmed = window.confirm(nextActive ? `Deseja reativar o usuário ${user.nome}?` : `Deseja desativar o usuário ${user.nome}? O histórico de atendimentos será preservado.`);
    if (!confirmed) return;
    await updateUser(user.id, {
      nome: user.nome,
      login: user.login,
      siape: user.siape,
      grupo_id: groupIdByName(user.grupo_nome),
      active: nextActive
    });
  }
  const validLogin = /^[a-z0-9._-]+$/i.test(form.login.trim());
  const validSiape = /^\d{7}$/.test(form.siape);
  const canSubmit = Boolean(form.nome && validLogin && form.grupo_id && validSiape);
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-3 h-100"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h5 fw-bold"
  }, "Usuários"), /*#__PURE__*/React.createElement("form", {
    className: "row g-3 mb-3",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Nome",
    value: form.nome,
    onChange: v => update("nome", v)
  }), /*#__PURE__*/React.createElement(EmailPrefixInput, {
    label: "E-mail institucional",
    value: form.login,
    onChange: v => update("login", v),
    col: "col-sm-6"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Número SIAPE",
    value: form.siape,
    onChange: v => update("siape", v.replace(/\D/g, "").slice(0, 7)),
    col: "col-sm-6",
    inputMode: "numeric",
    maxLength: 7,
    pattern: "[0-9]{7}"
  }), !editingUser && /*#__PURE__*/React.createElement("div", {
    className: "col-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "alert alert-info mb-0 small"
  }, "O sistema gerará uma senha provisória e enviará as instruções para o e-mail institucional do usuário.")), /*#__PURE__*/React.createElement(Select, {
    label: "Grupo",
    value: String(form.grupo_id),
    onChange: v => update("grupo_id", v),
    options: activeGroups.map(item => ({
      value: String(item.id),
      label: item.nome
    }))
  }), editingUser && /*#__PURE__*/React.createElement("div", {
    className: "col-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "alert alert-warning mb-0 small"
  }, "Senha não é alterada nesta tela. Use o fluxo \"Esqueci minha senha\" quando necessário.")), /*#__PURE__*/React.createElement("div", {
    className: "col-12 d-flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet flex-fill",
    disabled: !canSubmit
  }, editingUser ? "Salvar usuário" : "Cadastrar usuário"), editingUser && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet",
    type: "button",
    onClick: resetForm
  }, "Cancelar"))), /*#__PURE__*/React.createElement("div", {
    className: "row g-3 align-items-end mb-3"
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Itens por página",
    value: String(pageSize),
    onChange: value => setPageSize(Number(value)),
    options: ["10", "20", "50", "100"],
    col: "col-sm-6 col-lg-4"
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-sm-6 col-lg-8 d-flex flex-column flex-md-row justify-content-md-end gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge badge-soft rounded-pill align-self-start align-self-md-center"
  }, users.length, " usuários cadastrados"), /*#__PURE__*/React.createElement("small", {
    className: "text-muted align-self-start align-self-md-center"
  }, "Exibindo ", users.length ? start + 1 : 0, "-", Math.min(start + pageSize, users.length), " de ", users.length))), /*#__PURE__*/React.createElement(UsersTable, {
    users: paginatedUsers,
    startEdit: startEdit,
    toggleActive: toggleActive
  }), /*#__PURE__*/React.createElement(PaginationControls, {
    currentPage: safePage,
    totalPages: totalPages,
    setCurrentPage: setCurrentPage
  }));
}
function isPrimaryAdminUser(user) {
  return user?.id === 1 || user?.login === "admin";
}
function UsersTable({
  users,
  startEdit,
  toggleActive
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "table-responsive"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table align-middle management-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nome"), /*#__PURE__*/React.createElement("th", null, "Login"), /*#__PURE__*/React.createElement("th", null, "Grupo"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Ações"))), /*#__PURE__*/React.createElement("tbody", null, users.map(user => {
    const primaryAdmin = isPrimaryAdminUser(user);
    const active = Boolean(user.active);
    const pending = user.approval_status === "pending";
    const editable = !primaryAdmin && !pending;
    return /*#__PURE__*/React.createElement("tr", {
      className: `${!active ? "inactive-row " : ""}${editable ? "clickable-row" : ""}`.trim(),
      key: user.id,
      onClick: editable ? () => startEdit(user) : undefined,
      onKeyDown: editable ? event => {
        if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          startEdit(user);
        }
      } : undefined,
      tabIndex: editable ? 0 : undefined,
      "aria-label": editable ? `Editar usuário ${user.nome}` : undefined,
      title: editable ? "Clique para editar este usuário" : undefined
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, user.nome), /*#__PURE__*/React.createElement("small", {
      className: "d-block text-muted"
    }, user.email)), /*#__PURE__*/React.createElement("td", null, user.login), /*#__PURE__*/React.createElement("td", null, user.grupo_nome || "-"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: `badge rounded-pill ${pending ? "text-bg-warning" : active ? "text-bg-success" : "text-bg-secondary"}`
    }, pending ? "Pendente" : active ? "Ativo" : "Inativo"), user.first_login_required ? /*#__PURE__*/React.createElement("small", {
      className: "d-block text-muted mt-1"
    }, "Primeiro acesso pendente") : null, primaryAdmin && /*#__PURE__*/React.createElement("small", {
      className: "d-block text-muted mt-1"
    }, "Protegido")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      className: "d-flex flex-wrap gap-2"
    }, /*#__PURE__*/React.createElement("button", {
      className: `btn btn-sm ${active ? "btn-outline-warning" : "btn-outline-success"}`,
      type: "button",
      disabled: primaryAdmin || pending,
      onClick: event => {
        event.stopPropagation();
        toggleActive(user);
      }
    }, active ? "Desativar" : "Reativar"))));
  }))));
}
function DemandManager({
  demands,
  createDemand,
  updateDemand
}) {
  const [nome, setNome] = useState("");
  const [prazo, setPrazo] = useState("2 dias úteis");
  const [editingDemand, setEditingDemand] = useState(null);
  function resetForm() {
    setEditingDemand(null);
    setNome("");
    setPrazo("2 dias úteis");
  }
  function startEdit(demand) {
    setEditingDemand(demand);
    setNome(demand.nome);
    setPrazo(demand.prazo);
  }
  async function submit(event) {
    event.preventDefault();
    const payload = {
      nome,
      prazo
    };
    const ok = editingDemand ? await updateDemand(editingDemand.id, {
      ...payload,
      active: editingDemand.active !== false
    }) : await createDemand(payload);
    if (ok) resetForm();
  }
  async function toggleActive(demand) {
    const nextActive = demand.active === false;
    const action = nextActive ? "reativar" : "desativar";
    if (!window.confirm(`Deseja ${action} a demanda ${demand.nome}?`)) return;
    const ok = await updateDemand(demand.id, {
      nome: demand.nome,
      prazo: demand.prazo,
      active: nextActive
    });
    if (ok && editingDemand?.id === demand.id) resetForm();
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-3 h-100"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h5 fw-bold"
  }, "Demandas"), /*#__PURE__*/React.createElement("form", {
    className: "row g-3 mb-3",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Tipo de demanda",
    value: nome,
    onChange: setNome
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Prazo sugerido",
    value: prazo,
    onChange: setPrazo
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-12 d-flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet flex-fill",
    disabled: !nome.trim() || !prazo.trim()
  }, editingDemand ? "Salvar demanda" : "Cadastrar demanda"), editingDemand && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet",
    type: "button",
    onClick: resetForm
  }, "Cancelar"))), /*#__PURE__*/React.createElement(ManagementEntityTable, {
    items: demands,
    detailField: "prazo",
    detailLabel: "Prazo",
    startEdit: startEdit,
    toggleActive: toggleActive
  }));
}
function LocationManager({
  locations,
  createLocation,
  updateLocation
}) {
  const [nome, setNome] = useState("");
  const [editingLocation, setEditingLocation] = useState(null);
  function resetForm() {
    setEditingLocation(null);
    setNome("");
  }
  function startEdit(location) {
    setEditingLocation(location);
    setNome(location.nome);
  }
  async function submit(event) {
    event.preventDefault();
    const payload = {
      nome
    };
    const ok = editingLocation ? await updateLocation(editingLocation.id, {
      ...payload,
      active: editingLocation.active !== false
    }) : await createLocation(payload);
    if (ok) resetForm();
  }
  async function toggleActive(location) {
    const nextActive = location.active === false;
    const action = nextActive ? "reativar" : "desativar";
    if (!window.confirm(`Deseja ${action} o local ${location.nome}?`)) return;
    const ok = await updateLocation(location.id, {
      nome: location.nome,
      active: nextActive
    });
    if (ok && editingLocation?.id === location.id) resetForm();
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-3 h-100"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h5 fw-bold"
  }, "Locais"), /*#__PURE__*/React.createElement("form", {
    className: "row g-3 mb-3",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Nome do local",
    value: nome,
    onChange: setNome
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-12 d-flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet flex-fill",
    disabled: !nome.trim()
  }, editingLocation ? "Salvar local" : "Cadastrar local"), editingLocation && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet",
    type: "button",
    onClick: resetForm
  }, "Cancelar"))), /*#__PURE__*/React.createElement(ManagementEntityTable, {
    items: locations,
    detailField: "created_at",
    detailLabel: "Criado em",
    detailFormatter: formatDateTime,
    startEdit: startEdit,
    toggleActive: toggleActive
  }));
}
function BlockManager({
  blocks,
  locations,
  createBlock,
  updateBlock
}) {
  const activeLocations = locations.filter(location => location.active !== false);
  const [form, setForm] = useState({
    nome: "",
    local_id: activeLocations[0]?.id || ""
  });
  const [editingBlock, setEditingBlock] = useState(null);
  useEffect(() => {
    if (!form.local_id && activeLocations[0]) setForm(current => ({
      ...current,
      local_id: activeLocations[0].id
    }));
  }, [locations]);
  function update(field, value) {
    setForm(current => ({
      ...current,
      [field]: value
    }));
  }
  function resetForm() {
    setEditingBlock(null);
    setForm({
      nome: "",
      local_id: activeLocations[0]?.id || ""
    });
  }
  function startEdit(block) {
    setEditingBlock(block);
    setForm({
      nome: block.nome,
      local_id: block.local_id || block.location_id || ""
    });
  }
  async function submit(event) {
    event.preventDefault();
    const payload = {
      nome: form.nome,
      local_id: form.local_id
    };
    const ok = editingBlock ? await updateBlock(editingBlock.id, {
      ...payload,
      active: editingBlock.active !== false
    }) : await createBlock(payload);
    if (ok) resetForm();
  }
  async function toggleActive(block) {
    const nextActive = block.active === false;
    const action = nextActive ? "reativar" : "desativar";
    if (!window.confirm(`Deseja ${action} o bloco ${block.nome}?`)) return;
    const ok = await updateBlock(block.id, {
      nome: block.nome,
      local_id: block.local_id || block.location_id,
      active: nextActive
    });
    if (ok && editingBlock?.id === block.id) resetForm();
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-3 h-100"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h5 fw-bold"
  }, "Blocos"), /*#__PURE__*/React.createElement("form", {
    className: "row g-3 mb-3",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Nome do bloco",
    value: form.nome,
    onChange: value => update("nome", value),
    col: "col-sm-6"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Local",
    value: String(form.local_id),
    onChange: value => update("local_id", value),
    options: activeLocations.map(location => ({
      value: String(location.id),
      label: location.nome
    })),
    col: "col-sm-6"
  }), /*#__PURE__*/React.createElement("div", {
    className: "col-12 d-flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet flex-fill",
    disabled: !form.nome.trim() || !form.local_id
  }, editingBlock ? "Salvar bloco" : "Cadastrar bloco"), editingBlock && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet",
    type: "button",
    onClick: resetForm
  }, "Cancelar"))), /*#__PURE__*/React.createElement(ManagementEntityTable, {
    items: blocks,
    detailField: "local_nome",
    detailLabel: "Local",
    startEdit: startEdit,
    toggleActive: toggleActive
  }));
}
function ManagementEntityTable({
  items,
  detailField,
  detailLabel,
  detailFormatter,
  startEdit,
  toggleActive,
  protectedName
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "table-responsive"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table align-middle management-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nome"), /*#__PURE__*/React.createElement("th", null, detailLabel), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Ação"))), /*#__PURE__*/React.createElement("tbody", null, items.map(item => {
    const protectedItem = protectedName && item.nome.trim().toLowerCase() === protectedName.toLowerCase();
    const active = item.active !== false;
    return /*#__PURE__*/React.createElement("tr", {
      key: item.id,
      className: `${!active ? "inactive-row " : ""}${!protectedItem ? "clickable-row" : ""}`.trim(),
      onClick: !protectedItem ? () => startEdit(item) : undefined,
      onKeyDown: !protectedItem ? event => {
        if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          startEdit(item);
        }
      } : undefined,
      tabIndex: !protectedItem ? 0 : undefined,
      title: !protectedItem ? "Clique para editar" : "Grupo protegido"
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, item.nome)), /*#__PURE__*/React.createElement("td", null, detailFormatter ? detailFormatter(item[detailField]) : item[detailField] || "-"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: `badge rounded-pill ${active ? "text-bg-success" : "text-bg-secondary"}`
    }, active ? "Ativo" : "Inativo"), protectedItem && /*#__PURE__*/React.createElement("small", {
      className: "d-block text-muted mt-1"
    }, "Protegido")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
      className: `btn btn-sm ${active ? "btn-outline-warning" : "btn-outline-success"}`,
      type: "button",
      disabled: protectedItem,
      onClick: event => {
        event.stopPropagation();
        toggleActive(item);
      }
    }, active ? "Desativar" : "Reativar")));
  }))));
}
function StatusBadge({
  status
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: `badge rounded-pill status-badge ${statusClass(status)}`
  }, status);
}
function passwordRules(password = "") {
  const special = /[!@#$%^&*()\-_=+\[\]{};:,.?/\\|`~'"<>]/;
  return [{
    label: "Mínimo de 8 caracteres",
    ok: password.length >= 8
  }, {
    label: "Pelo menos uma letra maiúscula",
    ok: /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(password)
  }, {
    label: "Pelo menos um caractere especial",
    ok: special.test(password)
  }];
}
function statusClass(status = "") {
  const normalized = status.toLowerCase();
  if (normalized.includes("aberto")) return "status-open";
  if (normalized.includes("atendimento")) return "status-progress";
  if (normalized.includes("resolvido")) return "status-resolved";
  if (normalized.includes("cancelado") || normalized.includes("erro")) return "status-danger";
  return "status-neutral";
}
function statusCardClass(status = "") {
  return `status-card ${statusClass(status)}`;
}
function isRequestResolved(status = "") {
  return status.trim().toLowerCase() === "resolvido";
}
function scrollToRequestDetail() {
  document.getElementById("request-detail")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}
function RequestDetail({
  request,
  permissions,
  user,
  updateRequestStatus,
  sendInteraction,
  editInteraction,
  deleteAttachment,
  onClose
}) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [editingInteractionId, setEditingInteractionId] = useState(null);
  const [editingMessage, setEditingMessage] = useState("");
  if (!request) {
    return /*#__PURE__*/React.createElement("section", {
      className: "surface p-4 mt-4 text-center",
      id: "request-detail"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "h5 fw-bold"
    }, "Selecione uma solicitação"), /*#__PURE__*/React.createElement("p", {
      className: "text-muted mb-0"
    }, "Clique em uma linha da consulta para abrir os dados completos e o histórico de atendimento."));
  }
  const requestResolved = isRequestResolved(request.status);
  async function submit(event) {
    event.preventDefault();
    if (requestResolved) return;
    const ok = await sendInteraction(request.id, message, attachments);
    if (ok) {
      setMessage("");
      setAttachments([]);
      event.target.reset();
    }
  }
  function addAttachments(fileList) {
    const nextFiles = Array.from(fileList || []);
    setAttachments(current => [...current, ...nextFiles]);
  }
  function removeAttachment(index) {
    setAttachments(current => current.filter((_, itemIndex) => itemIndex !== index));
  }
  function startEditInteraction(item) {
    if (requestResolved) return;
    setEditingInteractionId(item.id);
    setEditingMessage(item.mensagem);
  }
  function cancelEditInteraction() {
    setEditingInteractionId(null);
    setEditingMessage("");
  }
  async function submitEditInteraction(event, item) {
    event.preventDefault();
    if (requestResolved) return;
    const ok = await editInteraction(item.id, editingMessage);
    if (ok) {
      cancelEditInteraction();
    }
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "surface p-3 p-lg-4 mt-4",
    id: "request-detail"
  }, /*#__PURE__*/React.createElement("div", {
    className: "d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(StatusBadge, {
    status: request.status
  }), /*#__PURE__*/React.createElement("h2", {
    className: "h4 fw-bold mb-1"
  }, request.protocolo), /*#__PURE__*/React.createElement("p", {
    className: "text-muted mb-0"
  }, request.categoria, " · ", request.localizacao)), /*#__PURE__*/React.createElement("div", {
    className: "d-flex flex-wrap gap-2 align-items-start"
  }, permissions.can_update_status && !requestResolved && /*#__PURE__*/React.createElement("select", {
    className: "form-select",
    value: request.status,
    onChange: event => updateRequestStatus(request.id, {
      status: event.target.value
    })
  }, /*#__PURE__*/React.createElement("option", null, "Aberto"), /*#__PURE__*/React.createElement("option", null, "Em Atendimento"), /*#__PURE__*/React.createElement("option", null, "Resolvido")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet",
    type: "button",
    onClick: () => openRequestPdfWindow(request)
  }, "Emitir PDF"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet",
    onClick: onClose
  }, "Fechar"))), /*#__PURE__*/React.createElement("div", {
    className: "row g-3 mb-4"
  }, /*#__PURE__*/React.createElement(Info, {
    label: "Solicitante",
    value: request.nome
  }), /*#__PURE__*/React.createElement(Info, {
    label: "E-mail",
    value: request.email
  }), /*#__PURE__*/React.createElement(Info, {
    label: "SIAPE",
    value: request.siape
  }), /*#__PURE__*/React.createElement(Info, {
    label: "Perfil",
    value: request.perfil
  }), /*#__PURE__*/React.createElement(Info, {
    label: "Local",
    value: request.local
  }), /*#__PURE__*/React.createElement(Info, {
    label: "Bloco",
    value: request.bloco
  }), /*#__PURE__*/React.createElement(Info, {
    label: "Sala",
    value: request.sala
  })), /*#__PURE__*/React.createElement("div", {
    className: "request-card p-3 mb-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "h6 fw-bold"
  }, "Descrição do problema"), /*#__PURE__*/React.createElement("p", {
    className: "mb-0"
  }, request.descricao)), requestResolved && /*#__PURE__*/React.createElement("div", {
    className: "alert alert-success app-alert"
  }, "Esta solicitação foi finalizada como resolvida. O atendimento está bloqueado para novas interações e alterações; o conteúdo permanece disponível para leitura e emissão do PDF."), /*#__PURE__*/React.createElement("div", {
    className: "row g-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-lg-7"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "h5 fw-bold"
  }, "Histórico de conversas e feedbacks"), /*#__PURE__*/React.createElement("div", {
    className: "chat-thread"
  }, (request.interactions || []).map(item => /*#__PURE__*/React.createElement("div", {
    className: `chat-message ${item.autor_grupo === "Administradores" ? "admin-message" : ""}`,
    key: item.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "d-flex justify-content-between gap-2"
  }, /*#__PURE__*/React.createElement("strong", null, item.autor_nome), /*#__PURE__*/React.createElement("small", {
    className: "text-muted"
  }, formatDateTime(item.created_at))), /*#__PURE__*/React.createElement("small", {
    className: "d-block text-muted mb-1"
  }, item.autor_grupo), editingInteractionId === item.id && !requestResolved ? /*#__PURE__*/React.createElement("form", {
    className: "interaction-edit-box",
    onSubmit: event => submitEditInteraction(event, item)
  }, /*#__PURE__*/React.createElement("textarea", {
    className: "form-control form-control-sm",
    rows: "3",
    value: editingMessage,
    onChange: event => setEditingMessage(event.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "d-flex gap-2 mt-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm btn-icet",
    type: "submit"
  }, "Salvar"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm btn-outline-secondary",
    type: "button",
    onClick: cancelEditInteraction
  }, "Cancelar"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "mb-0"
  }, item.mensagem), item.edited_at && /*#__PURE__*/React.createElement("small", {
    className: "interaction-meta"
  }, "Editado em ", formatDateTime(item.edited_at))), item.attachments?.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "attachment-list mt-3"
  }, item.attachments.map(attachment => /*#__PURE__*/React.createElement("div", {
    className: "attachment-link",
    key: attachment.id
  }, /*#__PURE__*/React.createElement("a", {
    href: attachment.url,
    target: "_blank",
    rel: "noreferrer"
  }, /*#__PURE__*/React.createElement("span", null, attachment.original_name), /*#__PURE__*/React.createElement("small", null, formatFileSize(attachment.size))), item.user_id === user?.id && !requestResolved && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm btn-outline-danger",
    type: "button",
    onClick: () => deleteAttachment(attachment.id)
  }, "Excluir")))), item.user_id === user?.id && !requestResolved && editingInteractionId !== item.id && /*#__PURE__*/React.createElement("div", {
    className: "interaction-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-link btn-sm p-0",
    type: "button",
    onClick: () => startEditInteraction(item)
  }, "Editar interação")))), (!request.interactions || request.interactions.length === 0) && /*#__PURE__*/React.createElement("p", {
    className: "text-muted mb-0"
  }, "Nenhuma interação registrada ainda."))), /*#__PURE__*/React.createElement("div", {
    className: "col-lg-5"
  }, requestResolved ? /*#__PURE__*/React.createElement("div", {
    className: "request-card p-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "h5 fw-bold"
  }, "Atendimento finalizado"), /*#__PURE__*/React.createElement("p", {
    className: "text-muted small mb-3"
  }, "A solicitação está somente para leitura. Use a emissão em PDF para salvar ou imprimir o histórico completo."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet w-100",
    type: "button",
    onClick: () => openRequestPdfWindow(request)
  }, "Emitir PDF")) : /*#__PURE__*/React.createElement("form", {
    className: "request-card p-3",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement("h3", {
    className: "h5 fw-bold"
  }, "Adicionar interação"), /*#__PURE__*/React.createElement("p", {
    className: "text-muted small"
  }, "Administradores podem registrar observações do atendimento. Solicitantes podem responder e enviar feedbacks."), /*#__PURE__*/React.createElement("textarea", {
    className: "form-control mb-3",
    rows: "5",
    value: message,
    onChange: event => setMessage(event.target.value),
    placeholder: "Escreva uma mensagem para o histórico do atendimento"
  }), /*#__PURE__*/React.createElement("label", {
    className: "form-label fw-semibold",
    htmlFor: "interactionAttachments"
  }, "Anexos"), /*#__PURE__*/React.createElement("input", {
    className: "form-control mb-2",
    id: "interactionAttachments",
    type: "file",
    multiple: true,
    accept: ".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx",
    onChange: event => addAttachments(event.target.files)
  }), /*#__PURE__*/React.createElement("small", {
    className: "text-muted d-block mb-3"
  }, "Formatos aceitos: imagens, PDF, DOC e DOCX. Máximo de 8 MB por arquivo."), attachments.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "selected-attachments mb-3"
  }, attachments.map((file, index) => /*#__PURE__*/React.createElement("div", {
    className: "selected-attachment",
    key: `${file.name}-${index}`
  }, /*#__PURE__*/React.createElement("span", null, file.name), /*#__PURE__*/React.createElement("small", null, formatFileSize(file.size)), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm btn-outline-danger",
    type: "button",
    onClick: () => removeAttachment(index)
  }, "Remover")))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-icet w-100"
  }, "Enviar mensagem")))));
}
function Info({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "col-sm-6 col-lg-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "request-card p-3 h-100"
  }, /*#__PURE__*/React.createElement("small", {
    className: "text-muted d-block"
  }, label), /*#__PURE__*/React.createElement("strong", null, value || "-")));
}
function formatDateTime(value) {
  if (!value) return "-";
  const rawValue = String(value);
  const normalizedValue = rawValue.includes("T") ? rawValue : rawValue.replace(" ", "T");
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus"
  }).format(new Date(normalizedValue));
}
function attachEstimatedDeadline(request, demands = []) {
  if (request.prazo_estimado) return request;
  const demand = demands.find(item => item.nome === request.categoria);
  return {
    ...request,
    prazo_estimado: demand?.prazo || "Não informado"
  };
}
function formatFileSize(size = 0) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function printInfoRow(label, value) {
  return `
    <div class="info-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}
function openRequestPdfWindow(request) {
  const printWindow = window.open("", "_blank", "width=960,height=720");
  if (!printWindow) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.");
    return;
  }
  const generatedAt = formatDateTime(new Date().toISOString());
  const interactions = request.interactions || [];
  const origin = window.location.origin;
  const interactionsHtml = interactions.length ? interactions.map(item => {
    const attachments = item.attachments || [];
    const attachmentsHtml = attachments.length ? `
            <div class="attachments">
              <strong>Anexos:</strong>
              <ul>
                ${attachments.map(attachment => `
                  <li>
                    <a href="${escapeHtml(new URL(attachment.url, origin).href)}" target="_blank" rel="noreferrer">
                      ${escapeHtml(attachment.original_name)} (${escapeHtml(formatFileSize(attachment.size))})
                    </a>
                  </li>
                `).join("")}
              </ul>
            </div>
          ` : "";
    return `
          <article class="interaction">
            <header>
              <div>
                <strong>${escapeHtml(item.autor_nome)}</strong>
                <span>${escapeHtml(item.autor_grupo)}</span>
              </div>
              <time>${escapeHtml(formatDateTime(item.created_at))}</time>
            </header>
            <p>${escapeHtml(item.mensagem || "Interação sem mensagem textual.")}</p>
            ${item.edited_at ? `<small>Editado em ${escapeHtml(formatDateTime(item.edited_at))}</small>` : ""}
            ${attachmentsHtml}
          </article>
        `;
  }).join("") : '<p class="muted">Nenhuma interação registrada.</p>';
  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(request.protocolo)} - OS ICET/UFAM</title>
        <style>
          * { box-sizing: border-box; }
          body {
            color: #102418;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.45;
            margin: 0;
            padding: 28px;
          }
          .toolbar {
            align-items: center;
            background: #eefbf2;
            border: 1px solid #cfe8d6;
            border-radius: 8px;
            display: flex;
            gap: 10px;
            justify-content: space-between;
            margin-bottom: 24px;
            padding: 12px;
          }
          .toolbar button {
            background: #0f6b3a;
            border: 0;
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            font-weight: 700;
            padding: 9px 14px;
          }
          .toolbar button.secondary {
            background: #fff;
            border: 1px solid #0f6b3a;
            color: #0f6b3a;
          }
          .report-header {
            align-items: center;
            border-bottom: 3px solid #0f6b3a;
            display: flex;
            gap: 16px;
            padding-bottom: 16px;
          }
          .report-header img {
            height: 72px;
            object-fit: contain;
            width: 72px;
          }
          h1, h2, h3, p { margin-top: 0; }
          h1 { color: #073b22; font-size: 24px; margin-bottom: 4px; }
          h2 {
            border-bottom: 1px solid #cfe8d6;
            color: #0f6b3a;
            font-size: 18px;
            margin: 26px 0 12px;
            padding-bottom: 6px;
          }
          .muted { color: #65756c; }
          .status {
            background: #dcfce7;
            border: 1px solid #86efac;
            border-radius: 999px;
            color: #166534;
            display: inline-block;
            font-weight: 700;
            padding: 5px 10px;
          }
          .grid {
            display: grid;
            gap: 10px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .info-row {
            border: 1px solid #dcebe1;
            border-radius: 8px;
            padding: 10px;
          }
          .info-row span {
            color: #65756c;
            display: block;
            font-size: 12px;
          }
          .info-row strong {
            display: block;
            overflow-wrap: anywhere;
          }
          .description,
          .interaction {
            border: 1px solid #dcebe1;
            border-radius: 8px;
            margin-bottom: 10px;
            padding: 12px;
          }
          .interaction header {
            align-items: flex-start;
            display: flex;
            gap: 12px;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .interaction header span,
          .interaction small {
            color: #65756c;
            display: block;
            font-size: 12px;
          }
          .interaction p,
          .description p {
            white-space: pre-wrap;
          }
          .attachments {
            background: #f7fff9;
            border-radius: 6px;
            margin-top: 10px;
            padding: 8px 10px;
          }
          .attachments ul {
            margin: 6px 0 0 18px;
            padding: 0;
          }
          a { color: #0f6b3a; }
          @media print {
            body { padding: 0; }
            .toolbar { display: none; }
            a { color: inherit; text-decoration: none; }
            .interaction,
            .description,
            .info-row { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <span>Relatório pronto para impressão ou salvamento em PDF.</span>
          <div>
            <button type="button" onclick="window.print()">Imprimir / Salvar PDF</button>
            <button class="secondary" type="button" onclick="window.close()">Fechar</button>
          </div>
        </div>

        <header class="report-header">
          <img src="${escapeHtml(new URL("assets/logo_icet.png", origin).href)}" alt="Logo ICET" />
          <div>
            <h1>Ordem de Serviço TI - ICET/UFAM</h1>
            <p class="muted">Relatório completo da solicitação</p>
            <p><strong>${escapeHtml(request.protocolo)}</strong> <span class="status">${escapeHtml(request.status)}</span></p>
          </div>
        </header>

        <section>
          <h2>Dados da solicitação</h2>
          <div class="grid">
            ${printInfoRow("Solicitante", request.nome)}
            ${printInfoRow("E-mail", request.email)}
            ${printInfoRow("SIAPE", request.siape)}
            ${printInfoRow("Perfil", request.perfil)}
            ${printInfoRow("Local", request.local)}
            ${printInfoRow("Categoria", request.categoria)}
            ${printInfoRow("Localização", request.localizacao)}
            ${printInfoRow("Bloco", request.bloco)}
            ${printInfoRow("Sala", request.sala)}
            ${printInfoRow("Criada em", formatDateTime(request.created_at))}
            ${printInfoRow("Atualizada em", formatDateTime(request.updated_at))}
          </div>
        </section>

        <section>
          <h2>Descrição do problema</h2>
          <div class="description">
            <p>${escapeHtml(request.descricao)}</p>
          </div>
        </section>

        <section>
          <h2>Histórico de conversas e feedbacks</h2>
          ${interactionsHtml}
        </section>

        <footer class="muted">
          Documento gerado em ${escapeHtml(generatedAt)} pelo sistema OS ICET/UFAM.
        </footer>

        <script>
          window.addEventListener("load", () => {
            setTimeout(() => window.print(), 400);
          });
        </script>
      </body>
    </html>
  `;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
function csvValue(value = "") {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
function downloadReportsCsv(requests, filters) {
  const headers = ["Protocolo", "Solicitante", "E-mail", "SIAPE", "Perfil", "Demanda", "Local", "Localização", "Bloco", "Sala", "Status", "Criada em", "Atualizada em", "Descrição"];
  const rows = requests.map(request => [request.protocolo, request.nome, request.email, request.siape, request.perfil, request.categoria, request.local, request.localizacao, request.bloco, request.sala, request.status, formatDateTime(request.created_at), formatDateTime(request.updated_at), request.descricao]);
  const content = [headers, ...rows].map(row => row.map(csvValue).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const suffix = [filters.reportType || "relatorio", filters.yearFilter, filters.statusFilter !== "Todos" ? filters.statusFilter : "", filters.userFilter !== "Todos" ? filters.userFilter : ""].filter(Boolean).join("-").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  link.href = url;
  link.download = `os-icet-${suffix || "relatorio"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function openReportsPdfWindow(requests, filters) {
  const printWindow = window.open("", "_blank", "width=1060,height=720");
  if (!printWindow) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.");
    return;
  }
  const origin = window.location.origin;
  const generatedAt = formatDateTime(new Date().toISOString());
  const statusSummary = ["Aberto", "Em Atendimento", "Resolvido"].map(status => ({
    status,
    total: requests.filter(item => item.status === status).length
  }));
  const rowsHtml = requests.map(request => `
    <tr>
      <td><strong>${escapeHtml(request.protocolo)}</strong></td>
      <td>${escapeHtml(request.nome)}<br><span>${escapeHtml(request.email)}</span></td>
      <td>${escapeHtml(request.categoria)}</td>
      <td>${escapeHtml(request.localizacao)}</td>
      <td>${escapeHtml(request.status)}</td>
      <td>${escapeHtml(formatDateTime(request.created_at))}</td>
      <td>${escapeHtml(formatDateTime(request.updated_at))}</td>
    </tr>
  `).join("");
  const userLabel = filters.userFilter || "Todos";
  const reportTitle = filters.reportTitle || "Relatório de solicitações";
  const reportSubtitle = filters.reportType === "annual" ? `Consolidado anual de ${filters.yearFilter || "todos os anos"}` : filters.reportType === "general" ? "Consolidado de toda a base existente" : "Consulta atual da tela de relatórios";
  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(reportTitle)} - OS ICET/UFAM</title>
        <style>
          * { box-sizing: border-box; }
          body {
            color: #102418;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.45;
            margin: 0;
            padding: 28px;
          }
          .toolbar {
            align-items: center;
            background: #eefbf2;
            border: 1px solid #cfe8d6;
            border-radius: 8px;
            display: flex;
            gap: 10px;
            justify-content: space-between;
            margin-bottom: 24px;
            padding: 12px;
          }
          .toolbar button {
            background: #0f6b3a;
            border: 0;
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            font-weight: 700;
            padding: 9px 14px;
          }
          .toolbar button.secondary {
            background: #fff;
            border: 1px solid #0f6b3a;
            color: #0f6b3a;
          }
          .report-header {
            align-items: center;
            border-bottom: 3px solid #0f6b3a;
            display: flex;
            gap: 16px;
            padding-bottom: 16px;
          }
          .report-header img {
            height: 72px;
            object-fit: contain;
            width: 72px;
          }
          h1, h2, p { margin-top: 0; }
          h1 { color: #073b22; font-size: 24px; margin-bottom: 4px; }
          h2 {
            border-bottom: 1px solid #cfe8d6;
            color: #0f6b3a;
            font-size: 18px;
            margin: 26px 0 12px;
            padding-bottom: 6px;
          }
          .muted { color: #65756c; }
          .grid {
            display: grid;
            gap: 10px;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .info-row,
          .summary-card {
            border: 1px solid #dcebe1;
            border-radius: 8px;
            padding: 10px;
          }
          .info-row span,
          td span {
            color: #65756c;
            font-size: 12px;
          }
          .summary-card strong {
            color: #0f6b3a;
            display: block;
            font-size: 24px;
          }
          table {
            border-collapse: collapse;
            font-size: 12px;
            width: 100%;
          }
          th {
            background: #eefbf2;
            color: #073b22;
            text-align: left;
          }
          th, td {
            border: 1px solid #dcebe1;
            padding: 8px;
            vertical-align: top;
          }
          tr { break-inside: avoid; }
          @media print {
            body { padding: 0; }
            .toolbar { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <span>Relatório pronto para impressão ou salvamento em PDF.</span>
          <div>
            <button type="button" onclick="window.print()">Imprimir / Salvar PDF</button>
            <button class="secondary" type="button" onclick="window.close()">Fechar</button>
          </div>
        </div>

        <header class="report-header">
          <img src="${escapeHtml(new URL("assets/logo_icet.png", origin).href)}" alt="Logo ICET" />
          <div>
            <h1>${escapeHtml(reportTitle)} - OS ICET/UFAM</h1>
            <p class="muted">${escapeHtml(reportSubtitle)}</p>
            <p><strong>${requests.length}</strong> registros encontrados</p>
          </div>
        </header>

        <section>
          <h2>Filtros aplicados</h2>
          <div class="grid">
            ${printInfoRow("Tipo", reportTitle)}
            ${filters.yearFilter ? printInfoRow("Ano", filters.yearFilter) : ""}
            ${printInfoRow("Status", filters.statusFilter || "Todos")}
            ${printInfoRow("Usuário", userLabel)}
            ${printInfoRow("Gerado em", generatedAt)}
          </div>
        </section>

        <section>
          <h2>Resumo por status</h2>
          <div class="grid">
            ${statusSummary.map(item => `
              <div class="summary-card">
                <strong>${item.total}</strong>
                <span>${escapeHtml(item.status)}</span>
              </div>
            `).join("")}
          </div>
        </section>

        <section>
          <h2>Solicitações da consulta</h2>
          <table>
            <thead>
              <tr>
                <th>OS</th>
                <th>Solicitante</th>
                <th>Demanda</th>
                <th>Local</th>
                <th>Status</th>
                <th>Criada em</th>
                <th>Atualizada em</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </section>

        <footer class="muted">
          Documento gerado em ${escapeHtml(generatedAt)} pelo sistema OS ICET/UFAM.
        </footer>

        <script>
          window.addEventListener("load", () => {
            setTimeout(() => window.print(), 400);
          });
        </script>
      </body>
    </html>
  `;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
function RequestsTable({
  requests,
  compact = false,
  editable = false,
  updateRequestStatus,
  openRequest = () => {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "table-responsive"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table align-middle"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "OS"), /*#__PURE__*/React.createElement("th", null, "Solicitante"), !compact && /*#__PURE__*/React.createElement("th", null, "Demanda"), /*#__PURE__*/React.createElement("th", null, "Local"), /*#__PURE__*/React.createElement("th", null, "Data/Hora"), /*#__PURE__*/React.createElement("th", null, "Status"), editable && /*#__PURE__*/React.createElement("th", null, "Ação"))), /*#__PURE__*/React.createElement("tbody", null, requests.map(request => /*#__PURE__*/React.createElement("tr", {
    key: request.id,
    className: "clickable-row",
    onClick: () => openRequest(request.id)
  }, /*#__PURE__*/React.createElement("td", {
    className: "fw-bold text-success"
  }, request.protocolo), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, request.nome), /*#__PURE__*/React.createElement("small", {
    className: "d-block text-muted"
  }, request.email)), !compact && /*#__PURE__*/React.createElement("td", null, request.categoria), /*#__PURE__*/React.createElement("td", null, request.localizacao), /*#__PURE__*/React.createElement("td", {
    className: "request-date-cell"
  }, /*#__PURE__*/React.createElement("span", null, formatDateTime(request.created_at)), /*#__PURE__*/React.createElement("small", {
    className: "d-block text-muted"
  }, "Prazo estimado: ", request.prazo_estimado || "Não informado")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusBadge, {
    status: request.status
  })), editable && /*#__PURE__*/React.createElement("td", null, isRequestResolved(request.status) ? /*#__PURE__*/React.createElement("small", {
    className: "text-muted"
  }, "Somente leitura") : /*#__PURE__*/React.createElement("select", {
    className: "form-select form-select-sm",
    value: request.status,
    onClick: event => event.stopPropagation(),
    onChange: event => updateRequestStatus(request.id, {
      status: event.target.value
    })
  }, /*#__PURE__*/React.createElement("option", null, "Aberto"), /*#__PURE__*/React.createElement("option", null, "Em Atendimento"), /*#__PURE__*/React.createElement("option", null, "Resolvido"))))))));
}
function PaginationControls({
  currentPage,
  totalPages,
  setCurrentPage
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "pagination-bar d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mt-3"
  }, /*#__PURE__*/React.createElement("small", {
    className: "text-muted"
  }, "Página ", currentPage, " de ", totalPages), /*#__PURE__*/React.createElement("div", {
    className: "btn-group",
    role: "group",
    "aria-label": "Paginação"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet",
    type: "button",
    disabled: currentPage <= 1,
    onClick: () => setCurrentPage(1)
  }, "Primeira"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet",
    type: "button",
    disabled: currentPage <= 1,
    onClick: () => setCurrentPage(page => Math.max(1, page - 1))
  }, "Anterior"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet",
    type: "button",
    disabled: currentPage >= totalPages,
    onClick: () => setCurrentPage(page => Math.min(totalPages, page + 1))
  }, "Próxima"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet",
    type: "button",
    disabled: currentPage >= totalPages,
    onClick: () => setCurrentPage(totalPages)
  }, "Última")));
}
function AuthLayout({
  title,
  description,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "row justify-content-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-lg-6 col-xl-5"
  }, /*#__PURE__*/React.createElement("section", {
    className: "surface p-4"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h4 fw-bold"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "text-muted"
  }, description), /*#__PURE__*/React.createElement("div", {
    className: "row g-3"
  }, children))));
}
function ActionCard({
  title,
  text,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "col-md-4"
  }, /*#__PURE__*/React.createElement("button", {
    className: "feature-card text-start p-4 w-100 h-100",
    onClick: onClick
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge badge-soft rounded-pill mb-2"
  }, "Restrito"), /*#__PURE__*/React.createElement("h3", {
    className: "h5 fw-bold"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "text-muted mb-3"
  }, text), /*#__PURE__*/React.createElement("span", {
    className: "fw-bold text-success"
  }, "Acessar")));
}
function Input({
  label,
  type = "text",
  value = "",
  onChange = () => {},
  col = "col-12",
  disabled = false,
  inputMode,
  maxLength,
  pattern
}) {
  const id = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W+/g, "-");
  return /*#__PURE__*/React.createElement("div", {
    className: col
  }, /*#__PURE__*/React.createElement("label", {
    className: "form-label fw-semibold",
    htmlFor: id
  }, label), /*#__PURE__*/React.createElement("input", {
    className: "form-control",
    id: id,
    type: type,
    value: value,
    onChange: event => onChange(event.target.value),
    required: true,
    disabled: disabled,
    inputMode: inputMode,
    maxLength: maxLength,
    pattern: pattern
  }));
}
function EmailPrefixInput({
  label,
  value = "",
  onChange = () => {},
  col = "col-12"
}) {
  const id = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W+/g, "-");
  return /*#__PURE__*/React.createElement("div", {
    className: col
  }, /*#__PURE__*/React.createElement("label", {
    className: "form-label fw-semibold",
    htmlFor: id
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "email-prefix-field"
  }, /*#__PURE__*/React.createElement("input", {
    className: "form-control",
    id: id,
    type: "text",
    value: value,
    onChange: event => onChange(event.target.value.replace(/@.*$/, "")),
    required: true,
    placeholder: "seu.nome",
    autoComplete: "username"
  }), /*#__PURE__*/React.createElement("span", {
    className: "email-domain"
  }, "@ufam.edu.br")));
}
function PasswordInput({
  label,
  value = "",
  onChange = () => {},
  col = "col-12",
  disabled = false
}) {
  const [visible, setVisible] = useState(false);
  const id = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W+/g, "-");
  return /*#__PURE__*/React.createElement("div", {
    className: col
  }, /*#__PURE__*/React.createElement("label", {
    className: "form-label fw-semibold",
    htmlFor: id
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "password-field"
  }, /*#__PURE__*/React.createElement("input", {
    className: "form-control",
    id: id,
    type: visible ? "text" : "password",
    value: value,
    onChange: event => onChange(event.target.value),
    required: true,
    disabled: disabled
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline-icet password-toggle",
    type: "button",
    onClick: () => setVisible(current => !current),
    disabled: disabled,
    "aria-label": visible ? `Ocultar ${label}` : `Mostrar ${label}`
  }, visible ? "Ocultar" : "Mostrar")));
}
function UserAutocomplete({
  label,
  value = "",
  onChange = () => {},
  options = [],
  col = "col-12"
}) {
  const [focused, setFocused] = useState(false);
  const id = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W+/g, "-");
  const query = value.trim().toLowerCase();
  const suggestions = options.filter(option => !query || option.toLowerCase().includes(query)).slice(0, 8);
  const showSuggestions = focused && suggestions.length > 0;
  return /*#__PURE__*/React.createElement("div", {
    className: `${col} autocomplete-field`
  }, /*#__PURE__*/React.createElement("label", {
    className: "form-label fw-semibold",
    htmlFor: id
  }, label), /*#__PURE__*/React.createElement("input", {
    className: "form-control",
    id: id,
    type: "text",
    value: value,
    onChange: event => onChange(event.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setTimeout(() => setFocused(false), 140),
    placeholder: "Digite o nome",
    autoComplete: "off"
  }), showSuggestions && /*#__PURE__*/React.createElement("div", {
    className: "autocomplete-suggestions",
    role: "listbox",
    "aria-label": `Sugestões de ${label}`
  }, suggestions.map(option => /*#__PURE__*/React.createElement("button", {
    className: "autocomplete-option",
    key: option,
    type: "button",
    onMouseDown: event => event.preventDefault(),
    onClick: () => {
      onChange(option);
      setFocused(false);
    }
  }, option))));
}
function Select({
  label,
  options,
  value,
  onChange = () => {},
  col = "col-12",
  disabled = false
}) {
  const normalizedOptions = options.map(option => typeof option === "string" ? {
    value: option,
    label: option
  } : option);
  const id = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W+/g, "-");
  return /*#__PURE__*/React.createElement("div", {
    className: col
  }, /*#__PURE__*/React.createElement("label", {
    className: "form-label fw-semibold",
    htmlFor: id
  }, label), /*#__PURE__*/React.createElement("select", {
    className: "form-select",
    id: id,
    value: value,
    onChange: event => onChange(event.target.value),
    required: true,
    disabled: disabled
  }, normalizedOptions.map(option => /*#__PURE__*/React.createElement("option", {
    key: option.value,
    value: option.value
  }, option.label))));
}
function TextArea({
  label,
  value = "",
  onChange = () => {},
  rows = "5"
}) {
  const id = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W+/g, "-");
  return /*#__PURE__*/React.createElement("div", {
    className: "col-12"
  }, /*#__PURE__*/React.createElement("label", {
    className: "form-label fw-semibold",
    htmlFor: id
  }, label), /*#__PURE__*/React.createElement("textarea", {
    className: "form-control",
    id: id,
    rows: rows,
    value: value,
    onChange: event => onChange(event.target.value),
    required: true
  }));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
