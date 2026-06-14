const STORAGE_KEY = "TGT-data-v1";
const USERS_KEY = "TGT-users-v1";
const SESSION_KEY = "TGT-session-v1";
const statuses = ["Recibido", "En diagnóstico", "En reparación", "Esperando repuesto", "Listo para retirar", "Finalizado"];
const scheduleSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];

const seedData = {
  clients: [
    { id: 1, name: "Mariana López", phone: "11 5482-1930", email: "mariana@email.com", address: "Av. Corrientes 1840" },
    { id: 2, name: "Diego Fernández", phone: "11 6291-4077", email: "diego@email.com", address: "Palermo, CABA" },
    { id: 3, name: "Lucía Romero", phone: "11 4038-9211", email: "lucia@email.com", address: "Almagro, CABA" },
    { id: 4, name: "Martín Acosta", phone: "11 7134-6502", email: "martin@email.com", address: "Caballito, CABA" }
  ],
  appointments: [
    { id: 1, clientId: 1, date: "2026-06-15", time: "09:30", reason: "Notebook no enciende" },
    { id: 2, clientId: 2, date: "2026-06-15", time: "11:00", reason: "Limpieza y mantenimiento" },
    { id: 3, clientId: 3, date: "2026-06-16", time: "15:30", reason: "PC con pantalla azul" },
    { id: 4, clientId: 4, date: "2026-06-17", time: "10:00", reason: "Cambio de disco por SSD" }
  ],
  repairs: [
    { id: 1048, clientId: 1, device: "Notebook", model: "Lenovo IdeaPad 3", serial: "LNV-20491", issue: "No enciende luego de una actualización.", date: "2026-06-12", deliveryDate: "2026-06-18", status: "En diagnóstico", price: 45000 },
    { id: 1047, clientId: 2, device: "PC de escritorio", model: "PC Armada Ryzen 5", serial: "", issue: "Se reinicia al ejecutar juegos.", date: "2026-06-11", deliveryDate: "2026-06-17", status: "En reparación", price: 78000 },
    { id: 1046, clientId: 3, device: "Notebook", model: "HP Pavilion 15", serial: "HP-99102", issue: "Teclado con varias teclas sin respuesta.", date: "2026-06-10", deliveryDate: "2026-06-20", status: "Esperando repuesto", price: 62000 },
    { id: 1045, clientId: 4, device: "All in One", model: "Dell Inspiron 24", serial: "DLL-78321", issue: "El sistema demora demasiado en iniciar.", date: "2026-06-09", deliveryDate: "2026-06-15", status: "Listo para retirar", price: 85000 },
    { id: 1044, clientId: 1, device: "Notebook", model: "Asus VivoBook", serial: "AS-45120", issue: "Cambio de pantalla y limpieza interna.", date: "2026-06-02", completedDate: "2026-06-08", status: "Finalizado", price: 135000, work: "Cambio de pantalla y mantenimiento integral" }
  ]
};

let data = loadData();
let activeRepairFilter = "Todos";
let authMode = "login";
const today = new Date();
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(seedData);
  } catch {
    return structuredClone(seedData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const getClient = (id) => data.clients.find(client => client.id === Number(id));
const initials = (name) => name.split(" ").map(word => word[0]).slice(0, 2).join("").toUpperCase();
const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value || 0);
const formatDate = (value, options = {}) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC", ...options }).format(new Date(`${value}T12:00:00Z`));
const statusClass = (status) => ({
  "Recibido": "status-received", "En diagnóstico": "status-diagnosis", "En reparación": "status-repair",
  "Esperando repuesto": "status-waiting", "Listo para retirar": "status-ready", "Finalizado": "status-completed"
}[status] || "status-received");

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function getCurrentUser() {
  const sessionEmail = sessionStorage.getItem(SESSION_KEY);
  return getUsers().find(item => item.email === sessionEmail);
}

function getCurrentClient() {
  const user = getCurrentUser();
  return user ? getClient(user.clientId) : null;
}

function applySession() {
  const user = getCurrentUser();
  const isClient = user?.role === "client";
  $("#authScreen").style.display = user ? "none" : "grid";
  $("#appShell").classList.toggle("app-locked", !user || isClient);
  $("#clientPortal").classList.toggle("app-locked", !isClient);
  if (isClient) {
    renderClientPortal();
  } else if (user) {
    $("#sessionUserName").textContent = user.name;
    $(".avatar").textContent = initials(user.name);
    $("#welcomeTitle").textContent = `Bienvenido, ${user.name.split(" ")[0]}.`;
  }
}

function toggleAuthMode() {
  authMode = authMode === "login" ? "register" : "login";
  const registering = authMode === "register";
  $("#loginForm").classList.toggle("d-none", registering);
  $("#registerForm").classList.toggle("d-none", !registering);
  $("#authTitle").textContent = registering ? "Crear cuenta" : "Iniciar sesión";
  $("#authSubtitle").textContent = registering ? "Creá tu cuenta para pedir turnos y seguir tu reparación." : "Ingresá para administrar el taller o consultar tus equipos.";
  $("#authSwitch").textContent = registering ? "¿Ya tenés cuenta? Iniciá sesión" : "¿No tenés cuenta? Registrate";
}

function updateRegisterFields() {
  const isClient = $("#registerRole").value === "client";
  $("#registerClientFields").classList.toggle("d-none", !isClient);
  $("#registerPhone").required = isClient;
  $("#registerAddress").required = isClient;
}

function showToast(message, error = false) {
  $("#toastMessage").textContent = message;
  const toastElement = $("#appToast");
  toastElement.style.background = error ? "var(--danger)" : "var(--success)";
  bootstrap.Toast.getOrCreateInstance(toastElement).show();
}

function setView(view) {
  const titles = { dashboard: "Resumen general", turnos: "Gestión de turnos", clientes: "Administración de clientes", reparaciones: "Seguimiento de reparaciones", historial: "Historial técnico" };
  $$(".app-view").forEach(element => element.classList.remove("active"));
  $(`#${view}View`).classList.add("active");
  $$(".sidebar-nav .nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === view));
  $("#pageTitle").textContent = titles[view];
  $("#sidebar").classList.remove("open");
  $("#sidebarBackdrop").classList.remove("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  populateClientSelects();
  renderDashboard();
  renderAppointments();
  renderClients();
  renderRepairs();
  renderHistory();
}

function renderClientPortal() {
  const user = getCurrentUser();
  const client = getCurrentClient();
  if (!user || !client) return;
  $("#clientSessionName").textContent = client.name;
  $("#clientAvatar").textContent = initials(client.name);
  $("#clientWelcome").textContent = `Hola, ${client.name.split(" ")[0]}.`;
  const profile = $("#clientProfileForm");
  profile.elements.name.value = client.name;
  profile.elements.email.value = client.email;
  profile.elements.phone.value = client.phone;
  profile.elements.address.value = client.address || "";
  $("#requestDate").min = todayIso;
  renderClientTimeOptions();

  const appointments = data.appointments
    .filter(item => item.clientId === client.id)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  $("#clientAppointments").innerHTML = appointments.map(item => `
    <article class="appointment-card">
      <div><div class="appointment-time">${item.time}</div><div class="appointment-day">${formatDate(item.date, { day: "2-digit", month: "short", year: undefined })}</div></div>
      <div class="appointment-info"><strong>${item.device ? `${item.device} ${item.model || ""}` : "Turno técnico"}</strong>
      <span>${item.reason}</span><div class="request-detail"><span class="status-badge status-diagnosis">${item.requestStatus || "Confirmado"}</span></div></div>
      <button class="more-btn danger client-cancel-appointment" data-id="${item.id}" title="Cancelar mi turno"><i class="bi bi-trash3"></i></button>
    </article>`).join("") || emptyState("Todavía no solicitaste turnos");

  const repairs = data.repairs.filter(item => item.clientId === client.id).sort((a, b) => b.id - a.id);
  $("#clientRepairs").innerHTML = repairs.map(item => `
    <div class="col-md-6 col-lg-4"><article class="client-repair-card">
      <span class="order-code">Orden #${item.id}</span>
      <h4>${item.device} ${item.model}</h4>
      <p>${item.issue}</p>
      <p><strong>Ingreso:</strong> ${formatDate(item.date)}</p>
      <p><strong>Entrega:</strong> ${item.deliveryDate ? formatDate(item.deliveryDate) : "A confirmar"}</p>
      <span class="status-badge ${statusClass(item.status)}">${item.status}</span>
    </article></div>`).join("") || `<div class="col-12">${emptyState("Tus reparaciones aparecerán aquí cuando el técnico reciba el equipo")}</div>`;
}

function renderClientTimeOptions() {
  const date = $("#requestDate")?.value;
  const select = $("#requestTime");
  if (!select) return;
  const busy = date ? data.appointments.filter(item => item.date === date).map(item => item.time) : [];
  const available = scheduleSlots.filter(time => !busy.includes(time));
  select.innerHTML = `<option value="">${date ? "Seleccionar horario..." : "Primero elegí una fecha"}</option>${available.map(time => `<option>${time}</option>`).join("")}`;
  select.disabled = !date;
}

function renderDashboard() {
  const active = data.repairs.filter(item => item.status !== "Finalizado");
  const futureAppointments = data.appointments.filter(item => item.date >= todayIso).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const ready = active.filter(item => item.status === "Listo para retirar").length;
  const completed = data.repairs.filter(item => item.status === "Finalizado").length;
  $("#welcomePending").textContent = `${active.length} reparaciones activas`;
  $("#welcomeAppointments").textContent = `${futureAppointments.length} turnos`;

  const stats = [
    ["bi-calendar2-check", "purple", futureAppointments.length, "Turnos próximos"],
    ["bi-tools", "blue", active.length, "Equipos en taller"],
    ["bi-box-seam", "orange", active.filter(item => item.status === "Esperando repuesto").length, "Esperando repuesto"],
    ["bi-check2-circle", "green", ready, "Listos para retirar"]
  ];
  $("#statsGrid").innerHTML = stats.map(([icon, color, value, label]) => `
    <article class="stat-card"><span class="stat-icon ${color}"><i class="bi ${icon}"></i></span><div><strong>${value}</strong><small>${label}</small></div></article>
  `).join("");

  $("#dashboardAppointments").innerHTML = futureAppointments.slice(0, 4).map(item => {
    const client = getClient(item.clientId);
    const date = new Date(`${item.date}T12:00:00Z`);
    return `<div class="dashboard-appointment">
      <div class="date-box"><strong>${String(date.getUTCDate()).padStart(2, "0")}</strong><small>${date.toLocaleDateString("es-AR", { month: "short", timeZone: "UTC" })}</small></div>
      <div><p class="item-title">${client?.name || "Cliente"}</p><p class="item-subtitle">${item.reason}</p></div>
      <span class="time-chip"><i class="bi bi-clock"></i> ${item.time}</span>
    </div>`;
  }).join("") || emptyState("No hay turnos próximos");

  const counts = statuses.slice(0, 5).map(status => [status, active.filter(item => item.status === status).length]);
  const colors = ["#7474df", "#f2a83b", "#4c91e6", "#df835f", "#2fb581"];
  $("#repairSummary").innerHTML = counts.map(([status, count], index) => `
    <div class="summary-row"><div class="summary-label"><span>${status}</span><strong>${count}</strong></div>
    <div class="progress"><div class="progress-bar" style="width:${active.length ? Math.max((count / active.length) * 100, count ? 10 : 0) : 0}%;background:${colors[index]}"></div></div></div>
  `).join("");

  $("#dashboardRepairs").innerHTML = [...data.repairs].sort((a, b) => b.id - a.id).slice(0, 5).map(repairRow).join("");
}

function repairRow(item) {
  const client = getClient(item.clientId);
  return `<tr><td><span class="order-code">#${item.id}</span></td>
    <td><div class="client-cell"><span class="client-avatar">${initials(client?.name || "SC")}</span><strong>${client?.name || "Sin cliente"}</strong></div></td>
    <td><strong>${item.device}</strong><div class="item-subtitle">${item.model}</div></td><td>${formatDate(item.date)}</td>
    <td><span class="status-badge ${statusClass(item.status)}">${item.status}</span></td>
    <td><button class="more-btn" data-view="reparaciones" aria-label="Ver reparación"><i class="bi bi-chevron-right"></i></button></td></tr>`;
}

function renderAppointments() {
  const query = ($("#appointmentSearch")?.value || "").toLowerCase();
  const date = $("#appointmentDateFilter")?.value || "";
  const items = [...data.appointments].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).filter(item => {
    const client = getClient(item.clientId);
    return (!date || item.date === date) && (`${client?.name} ${item.reason}`.toLowerCase().includes(query));
  });
  $("#appointmentsList").innerHTML = items.map(item => {
    const client = getClient(item.clientId);
    return `<article class="appointment-card">
      <div><div class="appointment-time">${item.time}</div><div class="appointment-day">${formatDate(item.date, { weekday: "short", day: "2-digit", month: "short", year: undefined })}</div></div>
      <div class="appointment-info"><strong>${client?.name || "Sin cliente"}</strong><span>${item.reason} · ${client?.phone || ""}</span></div>
      <div class="row-actions"><button class="more-btn edit-appointment" data-id="${item.id}" title="Modificar turno"><i class="bi bi-pencil"></i></button>
      <button class="more-btn danger delete-appointment" data-id="${item.id}" title="Cancelar turno"><i class="bi bi-trash3"></i></button></div>
    </article>`;
  }).join("") || emptyState("No se encontraron turnos");
}

function renderClients() {
  const query = ($("#clientSearch")?.value || "").toLowerCase();
  const clients = data.clients.filter(client => `${client.name} ${client.phone} ${client.email}`.toLowerCase().includes(query));
  $("#clientCount").textContent = `${clients.length} cliente${clients.length === 1 ? "" : "s"}`;
  $("#clientsTable").innerHTML = clients.map(client => {
    const clientRepairs = data.repairs.filter(item => item.clientId === client.id);
    const latest = [...clientRepairs].sort((a, b) => b.date.localeCompare(a.date))[0];
    return `<tr><td><div class="client-cell"><span class="client-avatar">${initials(client.name)}</span><div><strong>${client.name}</strong><div class="item-subtitle">${client.address || "Sin dirección"}</div></div></div></td>
      <td><strong>${client.phone}</strong><div class="item-subtitle">${client.email}</div></td>
      <td>${clientRepairs.length}</td><td>${latest ? formatDate(latest.date) : "Sin servicios"}</td>
      <td><div class="row-actions"><button class="more-btn edit-client" data-id="${client.id}" title="Editar cliente"><i class="bi bi-pencil"></i></button>
      <button class="more-btn danger delete-client" data-id="${client.id}" title="Eliminar cliente"><i class="bi bi-trash3"></i></button></div></td></tr>`;
  }).join("") || `<tr><td colspan="5">${emptyState("No se encontraron clientes")}</td></tr>`;
}

function renderRepairs() {
  const counts = ["Todos", ...statuses].map(status => [status, status === "Todos" ? data.repairs.length : data.repairs.filter(item => item.status === status).length]);
  $("#statusFilters").innerHTML = counts.map(([status, count]) => `<button class="filter-pill ${activeRepairFilter === status ? "active" : ""}" data-status-filter="${status}">${status} (${count})</button>`).join("");
  const repairs = data.repairs.filter(item => activeRepairFilter === "Todos" || item.status === activeRepairFilter);
  $("#repairsGrid").innerHTML = repairs.map(item => {
    const client = getClient(item.clientId);
    return `<div class="col-md-6 col-xl-4"><article class="repair-card">
      <div class="repair-card-top"><span class="device-icon"><i class="bi ${item.device === "PC de escritorio" ? "bi-pc-display" : "bi-laptop"}"></i></span><span class="order-code">#${item.id}</span></div>
      <h3>${item.model}</h3><div class="model">${item.device} · ${item.serial || "Sin número de serie"}</div>
      <div class="issue-box"><strong>Falla:</strong> ${item.issue}</div>
      <div class="repair-meta"><div><span>Cliente</span><strong>${client?.name || "Sin cliente"}</strong></div><div class="text-end"><span>Presupuesto</span><strong>${money(item.price)}</strong></div></div>
      <div class="delivery-field"><label for="delivery-${item.id}">Fecha de entrega</label><input id="delivery-${item.id}" class="form-control repair-delivery" data-id="${item.id}" type="date" value="${item.deliveryDate || ""}"></div>
      <div class="repair-actions"><select class="form-select repair-status" data-id="${item.id}">${statuses.map(status => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
    </article></div>`;
  }).join("") || `<div class="col-12">${emptyState("No hay reparaciones en este estado")}</div>`;
}

function renderHistory() {
  const query = ($("#historySearch")?.value || "").toLowerCase();
  const completed = data.repairs.filter(item => item.status === "Finalizado").filter(item => {
    const client = getClient(item.clientId);
    return `${item.id} ${client?.name} ${item.model} ${item.work || item.issue}`.toLowerCase().includes(query);
  });
  $("#historyCount").textContent = `${completed.length} servicio${completed.length === 1 ? "" : "s"} finalizado${completed.length === 1 ? "" : "s"}`;
  $("#historyTable").innerHTML = completed.map(item => {
    const client = getClient(item.clientId);
    return `<tr><td><span class="order-code">#${item.id}</span></td><td><strong>${client?.name || "Sin cliente"}</strong></td>
      <td>${item.model}<div class="item-subtitle">${item.device}</div></td><td>${item.work || item.issue}</td>
      <td>${formatDate(item.completedDate || item.date)}</td><td><strong>${money(item.price)}</strong></td></tr>`;
  }).join("") || `<tr><td colspan="6">${emptyState("Todavía no hay servicios finalizados")}</td></tr>`;
}

function populateClientSelects() {
  $$(".client-select").forEach(select => {
    const current = select.value;
    select.innerHTML = `<option value="">Seleccionar cliente...</option>${data.clients.map(client => `<option value="${client.id}">${client.name}</option>`).join("")}`;
    select.value = current;
  });
}

function emptyState(text) {
  return `<div class="empty-state"><i class="bi bi-inbox"></i><span>${text}</span></div>`;
}

function nextId(items, minimum = 1) {
  return Math.max(minimum - 1, ...items.map(item => Number(item.id))) + 1;
}

function renderAvailability() {
  const date = $("#appointmentDate").value;
  const editId = Number($("#appointmentForm [name='editId']").value);
  if (!date) {
    $("#availabilitySlots").innerHTML = "<small>Seleccioná una fecha para ver los horarios.</small>";
    return;
  }
  const busy = data.appointments.filter(item => item.date === date && item.id !== editId).map(item => item.time);
  $("#availabilitySlots").innerHTML = scheduleSlots.map(time => `<button type="button" class="slot ${busy.includes(time) ? "busy" : ""}" data-slot="${time}" ${busy.includes(time) ? "disabled" : ""}>${time}</button>`).join("");
}

function openClientEditor(id) {
  const client = getClient(id);
  const form = $("#clientForm");
  form.elements.editId.value = client.id;
  form.elements.name.value = client.name;
  form.elements.phone.value = client.phone;
  form.elements.email.value = client.email;
  form.elements.address.value = client.address || "";
  $("#clientModalTitle").textContent = "Editar cliente";
  $("#clientSubmitBtn").textContent = "Guardar cambios";
  bootstrap.Modal.getOrCreateInstance($("#clientModal")).show();
}

function openAppointmentEditor(id) {
  const item = data.appointments.find(appointment => appointment.id === Number(id));
  const form = $("#appointmentForm");
  form.elements.editId.value = item.id;
  form.elements.clientId.value = item.clientId;
  form.elements.date.value = item.date;
  form.elements.time.value = item.time;
  form.elements.reason.value = item.reason;
  $("#appointmentModalTitle").textContent = "Modificar turno";
  $("#appointmentSubmitBtn").textContent = "Guardar cambios";
  renderAvailability();
  bootstrap.Modal.getOrCreateInstance($("#appointmentModal")).show();
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    event.preventDefault();
    setView(viewButton.dataset.view);
  }
  const filter = event.target.closest("[data-status-filter]");
  if (filter) {
    activeRepairFilter = filter.dataset.statusFilter;
    renderRepairs();
  }
  const deleteButton = event.target.closest(".delete-appointment");
  if (deleteButton) {
    data.appointments = data.appointments.filter(item => item.id !== Number(deleteButton.dataset.id));
    saveData();
    renderAll();
    showToast("Turno cancelado correctamente");
  }
  const editAppointment = event.target.closest(".edit-appointment");
  if (editAppointment) openAppointmentEditor(editAppointment.dataset.id);
  const editClient = event.target.closest(".edit-client");
  if (editClient) openClientEditor(editClient.dataset.id);
  const deleteClient = event.target.closest(".delete-client");
  if (deleteClient) {
    const id = Number(deleteClient.dataset.id);
    const hasRelations = data.repairs.some(item => item.clientId === id) || data.appointments.some(item => item.clientId === id);
    if (hasRelations) {
      showToast("No se puede eliminar: el cliente tiene turnos o reparaciones", true);
    } else if (confirm("¿Eliminar este cliente definitivamente?")) {
      data.clients = data.clients.filter(item => item.id !== id);
      saveData();
      renderAll();
      showToast("Cliente eliminado");
    }
  }
  const slot = event.target.closest(".slot:not(.busy)");
  if (slot) $("#appointmentTime").value = slot.dataset.slot;
  const clientCancel = event.target.closest(".client-cancel-appointment");
  if (clientCancel) {
    const appointment = data.appointments.find(item => item.id === Number(clientCancel.dataset.id));
    if (appointment && appointment.clientId === getCurrentClient()?.id) {
      data.appointments = data.appointments.filter(item => item.id !== appointment.id);
      saveData();
      renderClientPortal();
      showToast("Turno cancelado correctamente");
    }
  }
});

$("#menuBtn").addEventListener("click", () => {
  $("#sidebar").classList.add("open");
  $("#sidebarBackdrop").classList.add("show");
});
$("#sidebarBackdrop").addEventListener("click", () => {
  $("#sidebar").classList.remove("open");
  $("#sidebarBackdrop").classList.remove("show");
});

$("#clientForm").addEventListener("submit", event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const editId = Number(values.editId);
  delete values.editId;
  if (editId) {
    Object.assign(getClient(editId), values);
  } else {
    data.clients.push({ id: nextId(data.clients), ...values });
  }
  saveData();
  event.currentTarget.reset();
  bootstrap.Modal.getInstance($("#clientModal")).hide();
  renderAll();
  showToast(editId ? "Cliente actualizado correctamente" : "Cliente registrado correctamente");
});

$("#appointmentForm").addEventListener("submit", event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const editId = Number(values.editId);
  const duplicate = data.appointments.some(item => item.date === values.date && item.time === values.time && item.id !== editId);
  if (duplicate) {
    showToast("Ese horario ya se encuentra reservado", true);
    return;
  }
  const appointment = { clientId: Number(values.clientId), date: values.date, time: values.time, reason: values.reason };
  if (editId) {
    Object.assign(data.appointments.find(item => item.id === editId), appointment);
  } else {
    data.appointments.push({ id: nextId(data.appointments), ...appointment });
  }
  saveData();
  event.currentTarget.reset();
  bootstrap.Modal.getInstance($("#appointmentModal")).hide();
  renderAll();
  showToast(editId ? "Turno modificado correctamente" : "Turno reservado correctamente");
});

$("#repairForm").addEventListener("submit", event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  data.repairs.push({
    id: nextId(data.repairs, 1000), clientId: Number(values.clientId), device: values.device, model: values.model,
    serial: values.serial, issue: values.issue, price: Number(values.price), status: values.status,
    date: todayIso, deliveryDate: values.deliveryDate
  });
  saveData();
  event.currentTarget.reset();
  bootstrap.Modal.getInstance($("#repairModal")).hide();
  renderAll();
  showToast("Orden de reparación creada");
});

document.addEventListener("change", event => {
  if (event.target.matches(".repair-status")) {
    const repair = data.repairs.find(item => item.id === Number(event.target.dataset.id));
    repair.status = event.target.value;
    if (repair.status === "Finalizado" && !repair.completedDate) repair.completedDate = new Date().toISOString().slice(0, 10);
    saveData();
    renderAll();
    showToast(`Orden #${repair.id} actualizada`);
  }
  if (event.target.matches(".repair-delivery")) {
    const repair = data.repairs.find(item => item.id === Number(event.target.dataset.id));
    repair.deliveryDate = event.target.value;
    saveData();
    showToast(`Fecha de entrega de la orden #${repair.id} actualizada`);
  }
});

$("#appointmentDate").addEventListener("change", renderAvailability);
$("#appointmentSearch").addEventListener("input", renderAppointments);
$("#appointmentDateFilter").addEventListener("change", renderAppointments);
$("#clientSearch").addEventListener("input", renderClients);
$("#historySearch").addEventListener("input", renderHistory);

$("#exportHistory").addEventListener("click", () => {
  const rows = [["Orden", "Cliente", "Equipo", "Trabajo", "Fecha", "Total"]];
  data.repairs.filter(item => item.status === "Finalizado").forEach(item => {
    const client = getClient(item.clientId);
    rows.push([`#${item.id}`, client?.name || "", `${item.device} ${item.model}`, item.work || item.issue, item.completedDate || item.date, item.price]);
  });
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = "historial-TGT.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Historial exportado");
});

$("#clientModal").addEventListener("show.bs.modal", event => {
  if (event.relatedTarget) {
    $("#clientForm").reset();
    $("#clientForm [name='editId']").value = "";
    $("#clientModalTitle").textContent = "Nuevo cliente";
    $("#clientSubmitBtn").textContent = "Guardar cliente";
  }
});

$("#appointmentModal").addEventListener("show.bs.modal", event => {
  if (event.relatedTarget) {
    $("#appointmentForm").reset();
    $("#appointmentForm [name='editId']").value = "";
    $("#appointmentModalTitle").textContent = "Reservar turno";
    $("#appointmentSubmitBtn").textContent = "Confirmar turno";
    $("#appointmentDate").min = todayIso;
    renderAvailability();
  }
});

$("#authSwitch").addEventListener("click", toggleAuthMode);
$("#registerRole").addEventListener("change", updateRegisterFields);

$("#registerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const email = values.email.trim().toLowerCase();
  const users = getUsers();
  if (users.some(user => user.email === email)) {
    showToast("Ya existe un usuario con ese email", true);
    return;
  }
  let clientId = null;
  if (values.role === "client") {
    let client = data.clients.find(item => item.email.toLowerCase() === email);
    if (client) {
      client.name = values.name.trim();
      client.phone = values.phone.trim();
      client.address = values.address.trim();
    } else {
      client = { id: nextId(data.clients), name: values.name.trim(), email, phone: values.phone.trim(), address: values.address.trim() };
      data.clients.push(client);
    }
    clientId = client.id;
    saveData();
  }
  users.push({
    id: crypto.randomUUID(),
    name: values.name.trim(),
    email,
    role: values.role,
    clientId,
    passwordHash: await hashPassword(values.password)
  });
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  sessionStorage.setItem(SESSION_KEY, email);
  form.reset();
  updateRegisterFields();
  applySession();
  showToast("Cuenta creada correctamente");
});

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const email = values.email.trim().toLowerCase();
  const passwordHash = await hashPassword(values.password);
  const user = getUsers().find(item => item.email === email && item.passwordHash === passwordHash);
  if (!user) {
    showToast("Email o contraseña incorrectos", true);
    return;
  }
  sessionStorage.setItem(SESSION_KEY, email);
  form.reset();
  applySession();
  showToast(`Bienvenido, ${user.name}`);
});

$("#logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  applySession();
});

$$(".client-logout").forEach(button => button.addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  applySession();
}));

$("#requestDate").addEventListener("change", renderClientTimeOptions);

$("#clientRequestForm").addEventListener("submit", event => {
  event.preventDefault();
  const client = getCurrentClient();
  if (!client) return;
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const duplicate = data.appointments.some(item => item.date === values.date && item.time === values.time);
  if (duplicate) {
    showToast("Ese horario acaba de ser reservado. Elegí otro.", true);
    renderClientTimeOptions();
    return;
  }
  data.appointments.push({
    id: nextId(data.appointments),
    clientId: client.id,
    date: values.date,
    time: values.time,
    device: values.device,
    model: values.model,
    serial: values.serial,
    problem: values.problem,
    reason: `${values.device} ${values.model}: ${values.problem}`,
    requestStatus: "Solicitado por cliente"
  });
  saveData();
  event.currentTarget.reset();
  renderClientPortal();
  renderAll();
  showToast("Tu turno fue solicitado correctamente");
});

$("#clientProfileForm").addEventListener("submit", event => {
  event.preventDefault();
  const client = getCurrentClient();
  const user = getCurrentUser();
  if (!client || !user) return;
  const values = Object.fromEntries(new FormData(event.currentTarget));
  client.name = values.name.trim();
  client.phone = values.phone.trim();
  client.address = values.address.trim();
  const users = getUsers();
  const storedUser = users.find(item => item.id === user.id);
  storedUser.name = client.name;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  saveData();
  renderClientPortal();
  showToast("Tus datos fueron actualizados");
});

$("#trackingForm").addEventListener("submit", event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const repair = data.repairs.find(item => item.id === Number(String(values.order).replace("#", "")));
  const client = repair ? getClient(repair.clientId) : null;
  const normalized = value => String(value).replace(/\D/g, "");
  const result = $("#trackingResult");
  result.classList.remove("d-none", "error");
  if (!repair || !client || normalized(client.phone) !== normalized(values.phone)) {
    result.classList.add("error");
    result.innerHTML = "<strong>No encontramos una reparación con esos datos.</strong>";
    return;
  }
  result.innerHTML = `<span class="status-badge ${statusClass(repair.status)}">${repair.status}</span>
    <h3>${repair.device} ${repair.model}</h3>
    <p>Orden #${repair.id}</p>
    <p>Ingreso: ${formatDate(repair.date)}</p>
    <p>Entrega estimada: ${repair.deliveryDate ? formatDate(repair.deliveryDate) : "A confirmar"}</p>`;
});

renderAll();
$("#currentDateLabel").textContent = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(today);
updateRegisterFields();
applySession();
