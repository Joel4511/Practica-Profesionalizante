const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const today = new Date();
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const state = { user: null, client: null, clients: [], appointments: [], repairs: [] };

const statusLabels = {
  RECIBIDO: "Recibido",
  EN_DIAGNOSTICO: "En diagnóstico",
  EN_REPARACION: "En reparación",
  ESPERANDO_REPUESTO: "Esperando repuesto",
  LISTO_PARA_RETIRAR: "Listo para retirar",
  FINALIZADO: "Finalizado",
  SOLICITADO: "Solicitado",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado"
};
const statusValues = Object.fromEntries(Object.entries(statusLabels).map(([key, value]) => [value, key]));
const repairStatuses = ["RECIBIDO", "EN_DIAGNOSTICO", "EN_REPARACION", "ESPERANDO_REPUESTO", "LISTO_PARA_RETIRAR", "FINALIZADO"];

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && !url.startsWith("/api/auth/")) {
    state.user = null;
    state.client = null;
    showAuth();
    throw new Error("Tu sesión venció. Iniciá sesión nuevamente.");
  }
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la operación.");
  return payload;
}

const initials = name => String(name || "TGT").split(" ").map(word => word[0]).slice(0, 2).join("").toUpperCase();
const formatDate = value => value ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`)) : "A confirmar";
const money = value => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value) || 0);
const statusClass = status => ({
  RECIBIDO: "status-received", EN_DIAGNOSTICO: "status-diagnosis", EN_REPARACION: "status-repair",
  ESPERANDO_REPUESTO: "status-waiting", LISTO_PARA_RETIRAR: "status-ready", FINALIZADO: "status-completed",
  SOLICITADO: "status-diagnosis", CONFIRMADO: "status-ready", CANCELADO: "status-completed"
}[status] || "status-received");

function emptyState(text) {
  return `<div class="empty-state"><i class="bi bi-inbox"></i><span>${text}</span></div>`;
}

function showToast(message, error = false) {
  $("#toastMessage").textContent = message;
  $("#appToast").style.background = error ? "var(--danger)" : "var(--success)";
  bootstrap.Toast.getOrCreateInstance($("#appToast")).show();
}

function showAuth() {
  $("#authScreen").style.display = "block";
  $("#appShell").classList.add("app-locked");
  $("#clientPortal").classList.add("app-locked");
}

function openAuthDialog(mode = "login") {
  const registering = mode === "register";
  $("#authScreen").classList.add("auth-dialog-open");
  $("#registerForm").classList.toggle("d-none", !registering);
  $("#loginForm").classList.toggle("d-none", registering);
  $("#authTitle").textContent = registering ? "Crear cuenta de cliente" : "Iniciar sesión";
  $("#authSubtitle").textContent = registering ? "Registrate para pedir turnos y consultar tus reparaciones." : "Ingresá con tu cuenta para acceder al sistema.";
  $("#authSwitch").textContent = registering ? "¿Ya tenés cuenta? Iniciá sesión" : "¿No tenés cuenta? Registrate";
  (registering ? $("#registerName") : $("#loginEmail")).focus();
}

function closeAuthDialog() {
  $("#authScreen").classList.remove("auth-dialog-open");
}

async function loadSession() {
  try {
    const payload = await api("/api/auth/me");
    state.user = payload.user;
    state.client = payload.client || null;
    $("#authScreen").style.display = "none";
    if (state.user.role === "CLIENT") {
      $("#appShell").classList.add("app-locked");
      $("#clientPortal").classList.remove("app-locked");
      await loadClientPortal();
    } else {
      $("#clientPortal").classList.add("app-locked");
      $("#appShell").classList.remove("app-locked");
      await loadAdmin();
    }
  } catch {
    state.user = null;
    showAuth();
  }
}

async function loadClientPortal() {
  const payload = await api("/api/client/dashboard");
  state.client = payload.client;
  state.appointments = payload.appointments;
  state.repairs = payload.repairs;
  const client = state.client;
  $("#clientSessionName").textContent = client.name;
  $("#clientAvatar").textContent = initials(client.name);
  $("#clientWelcome").textContent = `Hola, ${client.name.split(" ")[0]}.`;
  $("#profileName").value = client.name;
  $("#profileEmail").value = client.email;
  $("#profilePhone").value = client.phone;
  $("#profileAddress").value = client.address;
  $("#requestDate").min = todayIso;
  renderClientAppointments();
  renderClientRepairs();
  renderClientTimeOptions();
}

function renderClientAppointments() {
  $("#clientAppointments").innerHTML = state.appointments.map(item => `
    <article class="appointment-card">
      <div><div class="appointment-time">${item.time}</div><div class="appointment-day">${formatDate(item.date)}</div></div>
      <div class="appointment-info"><strong>${item.device ? `${item.device} ${item.model || ""}` : "Turno técnico"}</strong>
      <span>${item.problem}</span><div class="request-detail"><span class="status-badge ${statusClass(item.status)}">${statusLabels[item.status]}</span></div></div>
      ${item.status !== "CANCELADO" && String(item.date).slice(0, 10) >= todayIso ? `<button class="more-btn danger client-cancel-appointment" data-id="${item.id}" title="Cancelar turno"><i class="bi bi-trash3"></i></button>` : ""}
    </article>`).join("") || emptyState("Todavía no solicitaste turnos");
}

function renderClientRepairs() {
  $("#clientRepairs").innerHTML = state.repairs.map(item => `
    <div class="col-md-6 col-lg-4"><article class="client-repair-card">
      <span class="order-code">Orden #${item.id}</span><h4>${item.device} ${item.model}</h4>
      <p>${item.issue}</p><p><strong>Ingreso:</strong> ${formatDate(item.date)}</p>
      <p><strong>Entrega:</strong> ${formatDate(item.delivery_date)}</p>
      <span class="status-badge ${statusClass(item.status)}">${statusLabels[item.status]}</span>
    </article></div>`).join("") || `<div class="col-12">${emptyState("Tus reparaciones aparecerán aquí cuando el técnico reciba el equipo")}</div>`;
}

async function renderClientTimeOptions() {
  const date = $("#requestDate").value;
  $("#requestTime").disabled = !date;
  if (!date) {
    $("#requestTime").innerHTML = `<option value="">Primero elegí una fecha</option>`;
    return;
  }
  try {
    const payload = await api(`/api/availability?date=${encodeURIComponent(date)}`);
    $("#requestTime").innerHTML = `<option value="">Seleccionar horario...</option>${payload.slots.filter(slot => slot.available).map(slot => `<option>${slot.time}</option>`).join("")}`;
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadAdmin() {
  const payload = await api("/api/admin/dashboard");
  Object.assign(state, payload);
  $("#sessionUserName").textContent = state.user.name;
  $$(".avatar").forEach(element => element.textContent = initials(state.user.name));
  $("#welcomeTitle").textContent = `Bienvenido, ${state.user.name.split(" ")[0]}.`;
  populateClientSelects();
  renderDashboard();
  renderAppointments();
  renderClients();
  renderRepairs();
}

function populateClientSelects() {
  $$(".client-select").forEach(select => {
    const selected = select.value;
    select.innerHTML = `<option value="">Seleccionar cliente...</option>${state.clients.map(client => `<option value="${client.id}">${client.name}</option>`).join("")}`;
    select.value = selected;
  });
}

function renderDashboard() {
  const active = state.repairs.filter(item => item.status !== "FINALIZADO");
  const future = state.appointments.filter(item => item.status !== "CANCELADO" && String(item.date).slice(0, 10) >= todayIso);
  $("#welcomePending").textContent = `${active.length} reparaciones activas`;
  $("#welcomeAppointments").textContent = `${future.length} turnos`;
  const stats = [
    ["bi-calendar2-check", "purple", future.length, "Turnos próximos"],
    ["bi-tools", "blue", active.length, "Equipos en taller"],
    ["bi-box-seam", "orange", active.filter(item => item.status === "ESPERANDO_REPUESTO").length, "Esperando repuesto"],
    ["bi-check2-circle", "green", active.filter(item => item.status === "LISTO_PARA_RETIRAR").length, "Listos para retirar"]
  ];
  $("#statsGrid").innerHTML = stats.map(([icon, color, value, label]) => `<article class="stat-card"><span class="stat-icon ${color}"><i class="bi ${icon}"></i></span><div><strong>${value}</strong><small>${label}</small></div></article>`).join("");
  $("#dashboardAppointments").innerHTML = future.slice(0, 4).map(item => `<div class="dashboard-appointment"><div class="date-box"><strong>${String(item.date).slice(8, 10)}</strong><small>${formatDate(item.date).split(" ")[1]}</small></div><div><p class="item-title">${item.client_name}</p><p class="item-subtitle">${item.problem}</p></div><span class="time-chip">${item.time}</span></div>`).join("") || emptyState("No hay turnos próximos");
  $("#dashboardRepairs").innerHTML = state.repairs.slice(0, 5).map(repairRow).join("");
  $("#repairSummary").innerHTML = repairStatuses.slice(0, 5).map(status => {
    const count = active.filter(item => item.status === status).length;
    return `<div class="summary-row"><div class="summary-label"><span>${statusLabels[status]}</span><strong>${count}</strong></div><div class="progress"><div class="progress-bar" style="width:${active.length ? count / active.length * 100 : 0}%"></div></div></div>`;
  }).join("");
}

function repairRow(item) {
  return `<tr><td><span class="order-code">#${item.id}</span></td><td><strong>${item.client_name}</strong></td><td><strong>${item.device}</strong><div class="item-subtitle">${item.model}</div></td><td>${formatDate(item.date)}</td><td><span class="status-badge ${statusClass(item.status)}">${statusLabels[item.status]}</span></td><td></td></tr>`;
}

function renderAppointments() {
  const query = ($("#appointmentSearch").value || "").toLowerCase();
  const date = $("#appointmentDateFilter").value;
  const items = state.appointments.filter(item => (!date || String(item.date).slice(0, 10) === date) && `${item.client_name} ${item.problem}`.toLowerCase().includes(query));
  $("#appointmentsList").innerHTML = items.map(item => `<article class="appointment-card"><div><div class="appointment-time">${item.time}</div><div class="appointment-day">${formatDate(item.date)}</div></div><div class="appointment-info"><strong>${item.client_name}</strong><span>${item.problem} - ${item.phone}</span><div class="request-detail"><span class="status-badge ${statusClass(item.status)}">${statusLabels[item.status]}</span></div></div><div class="row-actions"><button class="more-btn edit-appointment" data-id="${item.id}" title="Modificar turno"><i class="bi bi-pencil"></i></button>${item.status !== "CANCELADO" ? `<button class="more-btn danger cancel-appointment" data-id="${item.id}" title="Cancelar turno"><i class="bi bi-x-circle"></i></button>` : ""}</div></article>`).join("") || emptyState("No se encontraron turnos");
}

function renderClients() {
  const query = ($("#clientSearch").value || "").toLowerCase();
  const clients = state.clients.filter(client => `${client.name} ${client.phone}`.toLowerCase().includes(query));
  $("#clientCount").textContent = `${clients.length} clientes`;
  $("#clientsTable").innerHTML = clients.map(client => `<tr><td><div class="client-cell"><span class="client-avatar">${initials(client.name)}</span><div><strong>${client.name}</strong><div class="item-subtitle">${client.address}</div></div></div></td><td><strong>${client.phone}</strong><div class="item-subtitle">${client.email}</div></td><td>${state.repairs.filter(item => Number(item.client_id) === Number(client.id)).length}</td><td>-</td><td><div class="row-actions"><button class="more-btn edit-client" data-id="${client.id}"><i class="bi bi-pencil"></i></button><button class="more-btn danger delete-client" data-id="${client.id}"><i class="bi bi-trash3"></i></button></div></td></tr>`).join("");
}

function renderRepairs() {
  $("#statusFilters").innerHTML = `<button class="filter-pill active" data-status-filter="ALL">Todos (${state.repairs.length})</button>${repairStatuses.map(status => `<button class="filter-pill" data-status-filter="${status}">${statusLabels[status]} (${state.repairs.filter(item => item.status === status).length})</button>`).join("")}`;
  renderRepairCards("ALL");
}

function renderRepairCards(filter) {
  const items = state.repairs.filter(item => filter === "ALL" || item.status === filter);
  $("#repairsGrid").innerHTML = items.map(item => `<div class="col-md-6 col-xl-4"><article class="repair-card"><div class="repair-card-top"><span class="device-icon"><i class="bi bi-laptop"></i></span><span class="order-code">#${item.id}</span></div><h3>${item.model}</h3><div class="model">${item.device} - ${item.serial || "Sin número de serie"}</div><div class="issue-box"><strong>Falla:</strong> ${item.issue}</div><div class="repair-meta"><div><span>Cliente</span><strong>${item.client_name}</strong></div><div class="text-end"><span>Ingreso</span><strong>${formatDate(item.date)}</strong></div></div><div class="delivery-field"><label>Fecha de entrega</label><input class="form-control repair-delivery" data-id="${item.id}" type="date" value="${String(item.delivery_date || "").slice(0, 10)}"></div><div class="repair-actions"><select class="form-select repair-status" data-id="${item.id}">${repairStatuses.map(status => `<option value="${status}" ${status === item.status ? "selected" : ""}>${statusLabels[status]}</option>`).join("")}</select></div></article></div>`).join("") || `<div class="col-12">${emptyState("No hay reparaciones en este estado")}</div>`;
}


function setView(view) {
  const titles = { dashboard: "Resumen general", turnos: "Gestión de turnos", clientes: "Administración de clientes", reparaciones: "Seguimiento de reparaciones" };
  $$(".app-view").forEach(element => element.classList.remove("active"));
  $(`#${view}View`).classList.add("active");
  $$(".sidebar-nav .nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === view));
  $("#pageTitle").textContent = titles[view];
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  location.reload();
}

$("#authSwitch").addEventListener("click", () => openAuthDialog($("#registerForm").classList.contains("d-none") ? "register" : "login"));
$$("[data-open-auth]").forEach(button => button.addEventListener("click", () => openAuthDialog(button.dataset.openAuth)));
$("#authScreen").addEventListener("click", event => {
  if (event.target === $("#authScreen") && $("#authScreen").classList.contains("auth-dialog-open")) closeAuthDialog();
});
document.addEventListener("keydown", event => { if (event.key === "Escape") closeAuthDialog(); });

$("#registerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  try {
    await api("/api/auth/register", { method: "POST", body: JSON.stringify(values) });
    form.reset();
    await loadSession();
  } catch (error) { showToast(error.message, true); }
});

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  try {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify(values) });
    form.reset();
    await loadSession();
  } catch (error) { showToast(error.message, true); }
});

$("#trackingForm").addEventListener("submit", async event => {
  event.preventDefault();
  const result = $("#trackingResult");
  try {
    const payload = await api("/api/tracking", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const item = payload.repair;
    result.classList.remove("d-none", "error");
    result.innerHTML = `<span class="status-badge ${statusClass(item.status)}">${statusLabels[item.status]}</span><h3>${item.device} ${item.model}</h3><p>Orden #${item.id}</p><p>Ingreso: ${formatDate(item.date)}</p><p>Entrega estimada: ${formatDate(item.delivery_date)}</p>`;
  } catch (error) {
    result.classList.remove("d-none");
    result.classList.add("error");
    result.textContent = error.message;
  }
});

$("#logoutBtn").addEventListener("click", logout);
$$(".client-logout").forEach(button => button.addEventListener("click", logout));
$("#requestDate").addEventListener("change", renderClientTimeOptions);

$("#clientRequestForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api("/api/client/appointments", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset();
    showToast("Tu turno fue solicitado correctamente");
    await loadClientPortal();
  } catch (error) { showToast(error.message, true); }
});

$("#clientProfileForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api("/api/client/profile", { method: "PUT", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    showToast("Tus datos fueron actualizados");
    await loadClientPortal();
  } catch (error) { showToast(error.message, true); }
});

document.addEventListener("click", async event => {
  const view = event.target.closest("[data-view]");
  if (view) { event.preventDefault(); setView(view.dataset.view); }
  const filter = event.target.closest("[data-status-filter]");
  if (filter) {
    $$("#statusFilters .filter-pill").forEach(button => button.classList.remove("active"));
    filter.classList.add("active");
    renderRepairCards(filter.dataset.statusFilter);
  }
  const cancelClient = event.target.closest(".client-cancel-appointment");
  if (cancelClient) {
    try { await api(`/api/client/appointments/${cancelClient.dataset.id}`, { method: "DELETE" }); await loadClientPortal(); showToast("Turno cancelado"); }
    catch (error) { showToast(error.message, true); }
  }
  const editClient = event.target.closest(".edit-client");
  if (editClient) {
    const client = state.clients.find(item => Number(item.id) === Number(editClient.dataset.id));
    const form = $("#clientForm");
    form.elements.editId.value = client.id; form.elements.name.value = client.name; form.elements.email.value = client.email;
    form.elements.phone.value = client.phone; form.elements.address.value = client.address;
    $("#clientModalTitle").textContent = "Editar cliente";
    bootstrap.Modal.getOrCreateInstance($("#clientModal")).show();
  }
  const deleteClient = event.target.closest(".delete-client");
  if (deleteClient) {
    try { await api(`/api/admin/clients/${deleteClient.dataset.id}`, { method: "DELETE" }); await loadAdmin(); showToast("Cliente eliminado"); }
    catch (error) { showToast(error.message, true); }
  }
  const editAppointment = event.target.closest(".edit-appointment");
  if (editAppointment) {
    const item = state.appointments.find(row => Number(row.id) === Number(editAppointment.dataset.id));
    const form = $("#appointmentForm");
    form.elements.editId.value = item.id; form.elements.clientId.value = item.client_id;
    form.elements.date.value = String(item.date).slice(0, 10); form.elements.time.value = item.time; form.elements.reason.value = item.problem;
    $("#appointmentModalTitle").textContent = "Modificar turno";
    bootstrap.Modal.getOrCreateInstance($("#appointmentModal")).show();
    renderAdminAvailability();
  }
  const cancelAppointment = event.target.closest(".cancel-appointment");
  if (cancelAppointment) {
    const item = state.appointments.find(row => Number(row.id) === Number(cancelAppointment.dataset.id));
    if (!item || !confirm("¿Cancelar este turno?")) return;
    try {
      await api(`/api/admin/appointments/${cancelAppointment.dataset.id}`, {
        method: "PUT",
        body: JSON.stringify({ date: String(item.date).slice(0, 10), time: item.time, problem: item.problem, status: "CANCELADO" })
      });
      await loadAdmin();
      showToast("Turno cancelado");
    } catch (error) { showToast(error.message, true); }
  }
});

$("#clientForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const id = values.editId; delete values.editId;
  try {
    await api(id ? `/api/admin/clients/${id}` : "/api/admin/clients", { method: id ? "PUT" : "POST", body: JSON.stringify(values) });
    bootstrap.Modal.getInstance($("#clientModal")).hide(); form.reset(); await loadAdmin(); showToast("Cliente guardado");
  } catch (error) { showToast(error.message, true); }
});

$("#appointmentForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const id = values.editId;
  const payload = { clientId: values.clientId, date: values.date, time: values.time, problem: values.reason, status: "CONFIRMADO" };
  try {
    await api(id ? `/api/admin/appointments/${id}` : "/api/admin/appointments", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
    bootstrap.Modal.getInstance($("#appointmentModal")).hide(); form.reset(); await loadAdmin(); showToast("Turno guardado");
  } catch (error) { showToast(error.message, true); }
});

$("#repairForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  values.status = statusValues[values.status] || "RECIBIDO";
  try {
    await api("/api/admin/repairs", { method: "POST", body: JSON.stringify(values) });
    bootstrap.Modal.getInstance($("#repairModal")).hide(); form.reset(); await loadAdmin(); showToast("Orden creada");
  } catch (error) { showToast(error.message, true); }
});

document.addEventListener("change", async event => {
  if (event.target.matches(".repair-status, .repair-delivery")) {
    const card = event.target.closest(".repair-card");
    const status = card.querySelector(".repair-status").value;
    const deliveryDate = card.querySelector(".repair-delivery").value;
    try { await api(`/api/admin/repairs/${event.target.dataset.id}`, { method: "PATCH", body: JSON.stringify({ status, deliveryDate }) }); await loadAdmin(); showToast("Reparación actualizada"); }
    catch (error) { showToast(error.message, true); }
  }
});

$("#appointmentSearch").addEventListener("input", renderAppointments);
$("#appointmentDateFilter").addEventListener("change", renderAppointments);
$("#clientSearch").addEventListener("input", renderClients);
$("#clientModal").addEventListener("show.bs.modal", event => {
  if (!event.relatedTarget) return;
  $("#clientForm").reset();
  $("#clientForm [name='editId']").value = "";
  $("#clientModalTitle").textContent = "Nuevo cliente";
});
$("#appointmentModal").addEventListener("show.bs.modal", event => {
  if (!event.relatedTarget) return;
  $("#appointmentForm").reset();
  $("#appointmentForm [name='editId']").value = "";
  $("#appointmentModalTitle").textContent = "Reservar turno";
  $("#appointmentDate").min = todayIso;
});
$("#menuBtn").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#sidebarBackdrop").classList.add("show"); });
$("#sidebarBackdrop").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#sidebarBackdrop").classList.remove("show"); });

$("#currentDateLabel").textContent = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(today);
loadSession();


async function renderAdminAvailability() {
  const date = $("#appointmentDate").value;
  const editId = $("#appointmentForm").elements.editId.value || "";
  if (!date) { $("#availabilitySlots").innerHTML = ""; return; }
  try {
    const payload = await api(`/api/availability?date=${encodeURIComponent(date)}&excludeId=${encodeURIComponent(editId)}`);
    $("#availabilitySlots").innerHTML = payload.slots.map(slot => `<button type="button" class="slot ${slot.available ? "" : "busy"}" data-slot-time="${slot.time}" ${slot.available ? "" : "disabled"}>${slot.time}</button>`).join("");
  } catch (error) { showToast(error.message, true); }
}
$("#appointmentDate").addEventListener("change", renderAdminAvailability);
$("#availabilitySlots").addEventListener("click", event => {
  const slot = event.target.closest("[data-slot-time]");
  if (slot && !slot.disabled) $("#appointmentTime").value = slot.dataset.slotTime;
});
